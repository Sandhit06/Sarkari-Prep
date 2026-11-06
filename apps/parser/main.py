"""
SarkariPrep Document Parsing Microservice.

Endpoints
---------
GET  /health                 capability probe used by the API gateway
POST /parse                  multipart upload (pdf/docx/md/txt/png/jpg)
POST /parse/manual           paste raw paper text as JSON
GET  /parse                  recent jobs (summaries)
GET  /parse/{job_id}         full draft for human review
DELETE /parse/{job_id}       drop an in-memory job

The parser is intentionally stateless apart from an in-memory job cache: the
NestJS API owns durable persistence (ParsingJob) and publishing.
"""
from fastapi import BackgroundTasks, FastAPI, UploadFile, File, Form, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from collections import OrderedDict
import importlib.util
import os
import re
import shutil
import threading
import time
import uuid

from extractor import extract_text_from_bytes
from structurer import (
    ParsedPaperDraft,
    extract_answer_key,
    extract_metadata,
    get_structurer,
    split_question_blocks,
)

SERVICE_VERSION = "1.1.0"
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "25")) * 1024 * 1024
ALLOWED_EXTENSIONS = {"pdf", "docx", "md", "markdown", "txt", "png", "jpg", "jpeg", "webp", "tif", "tiff", "bmp"}
MAX_JOBS = 200

app = FastAPI(
    title="SarkariPrep Document Parsing Microservice",
    description="5-stage extraction & structuring pipeline for Indian government exam papers",
    version=SERVICE_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Small LRU-ish cache so the API gateway can poll /parse/{id} after upload.
JOBS_DB: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
JOB_LOCK = threading.Lock()


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


class ManualParseRequest(BaseModel):
    fileName: str = "manual-paste.md"
    rawText: str = Field(..., min_length=20, description="Raw paper text / Markdown")
    examSlug: str = "ssc-cgl"
    year: int = 2024
    title: Optional[str] = None
    shift: Optional[str] = None
    durationMinutes: int = 60
    positiveMarks: float = 2.0
    negativeMarks: float = 0.5
    llmProvider: Optional[str] = None


def _capabilities() -> Dict[str, Any]:
    tesseract_path = shutil.which("tesseract")
    languages: List[str] = []
    if tesseract_path:
        try:
            import pytesseract

            languages = pytesseract.get_languages(config="")
        except Exception:
            languages = []

    return {
        "pymupdf": importlib.util.find_spec("fitz") is not None,
        "pdf2image": importlib.util.find_spec("pdf2image") is not None,
        "pythonDocx": importlib.util.find_spec("docx") is not None,
        "tesseract": tesseract_path is not None,
        "tesseractLanguages": languages,
        "pillow": importlib.util.find_spec("PIL") is not None,
    }


def _remember(job_id: str, payload: Dict[str, Any]) -> None:
    with JOB_LOCK:
        JOBS_DB[job_id] = payload
        JOBS_DB.move_to_end(job_id)
        while len(JOBS_DB) > MAX_JOBS:
            JOBS_DB.popitem(last=False)


def _update_job(job_id: str, **fields: Any) -> None:
    with JOB_LOCK:
        job = JOBS_DB.get(job_id)
        if not job:
            return
        job.update(fields)
        job["updatedAt"] = _now()
        JOBS_DB.move_to_end(job_id)


def _new_job(filename: str, extension: str) -> Dict[str, Any]:
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    job = {
        "jobId": job_id,
        "status": "QUEUED",
        "progress": 0,
        "stage": "QUEUED",
        "stageLabel": "Queued",
        "message": "Waiting for a worker",
        "createdAt": _now(),
        "updatedAt": _now(),
        "fileName": filename,
        "fileType": extension,
        "extractionMethod": None,
        "charactersExtracted": 0,
        "extractedQuestionCount": 0,
        "averageConfidence": 0,
        "stages": None,
        "metadata": None,
        "draft": None,
        "errorMessage": None,
    }
    _remember(job_id, job)
    return job


def _extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"


def _default_title(exam_slug: str, year: int, shift: Optional[str] = None) -> str:
    label = f"{exam_slug.replace('-', ' ').upper()} {year}"
    return f"{label} — {shift.strip()}" if shift and shift.strip() else f"{label} — Converted Paper"


async def _build_draft(
    *,
    text: str,
    filename: str,
    extraction_method: str,
    exam_slug: str,
    year: int,
    title: Optional[str],
    shift: Optional[str],
    duration_minutes: int,
    positive_marks: float,
    negative_marks: float,
) -> Dict[str, Any]:
    started = time.perf_counter()

    metadata = extract_metadata(
        text,
        {
            "examSlug": exam_slug,
            "year": year,
            "title": title or _default_title(exam_slug, year, shift),
            "shift": shift,
            "setSeries": None,
            "durationMinutes": duration_minutes,
            "positiveMarks": positive_marks,
            "negativeMarks": negative_marks,
            "language": "en",
            "sourceType": "USER_UPLOADED",
        },
    )

    # If the caller did not name the paper and the file has no title header,
    # derive the title from the *final* exam/year/shift (headers may override).
    has_markdown_title = re.search(
        r"(?im)^\s{0,3}#\s+(?!\s*(?:exam|year|duration|maximum\s+marks|total\s+questions|paper\s+code)\s*:).+",
        text,
    )
    has_title_metadata = re.search(r"(?im)^\s*#?\s*(?:title|paper)\s*[:=]", text)
    if not title and not has_title_metadata and not has_markdown_title:
        metadata["title"] = _default_title(
            metadata["examSlug"], metadata["year"], metadata.get("shift")
        )

    blocks = split_question_blocks(text)
    segmentation_ms = int((time.perf_counter() - started) * 1000)

    structure_started = time.perf_counter()
    structurer = get_structurer()
    questions = await structurer.structure_blocks(
        blocks,
        metadata["positiveMarks"],
        metadata["negativeMarks"],
        gate_mode=metadata["examSlug"] == "gate-cse",
    )

    # Attach a separately printed answer key when the paper has one.
    answer_key = extract_answer_key(text)
    if answer_key:
        for question in questions:
            answer = answer_key.get(question.questionNumber)
            if answer and question.questionType == "NUMERICAL":
                numerical_key = re.match(r"^\s*([+\-]?\d+(?:\.\d+)?)", answer)
                if not numerical_key:
                    continue
                question.correctNumericalAnswer = float(numerical_key.group(1))
                question.numericalTolerance = question.numericalTolerance or 0.01
                question.sourceConfidence = max(question.sourceConfidence, 0.88)
                question.needsHumanReview = question.sourceConfidence < 0.85
            elif answer and question.questionType in ("SINGLE_CHOICE", "MULTI_CHOICE"):
                answer_ids = [part.upper() for part in re.findall(r"[A-Ea-e]", answer)]
                if metadata["examSlug"] == "gate-cse" and len(answer_ids) > 1:
                    question.questionType = "MULTI_CHOICE"
                if question.questionType == "SINGLE_CHOICE" and len(answer_ids) != 1:
                    continue
                if not answer_ids:
                    continue
                question.correctOptionId = answer_ids[0]
                question.correctOptionIds = answer_ids
                # A separate printed key is strong evidence the options are
                # correct; lift confidence unless OCR left placeholder options.
                has_placeholders = any(
                    "requires review" in option.text for option in question.options
                )
                if not has_placeholders:
                    question.sourceConfidence = max(question.sourceConfidence, 0.88)
                question.needsHumanReview = question.sourceConfidence < 0.85
    structuring_ms = int((time.perf_counter() - structure_started) * 1000)

    warnings: List[str] = []
    if not blocks:
        warnings.append(
            "No numbered questions were detected. Check that the upload contains readable text "
            "or try the manual paste mode with the Markdown contributor format."
        )
    if extraction_method in ("fallback_utf8", "ocr_failed"):
        warnings.append(
            "The document could not be read as a PDF/DOCX/image. The raw bytes were decoded as text, "
            "so quality may be poor."
        )
    if questions and not answer_key and all(q.needsHumanReview for q in questions):
        warnings.append(
            "No answer key was found. Every question is flagged for review — set the correct option "
            "for each question before publishing."
        )
    if metadata.get("maximumMarks") is not None and questions:
        extracted_marks = sum(question.marks for question in questions)
        if abs(extracted_marks - float(metadata["maximumMarks"])) > 0.01:
            warnings.append(
                f"The paper header says {metadata['maximumMarks']:g} maximum marks, but the extracted "
                f"question marks add up to {extracted_marks:g}. Review the per-question marks before publishing."
            )
    expected_count = metadata.get("expectedQuestionCount")
    if expected_count is not None and len(questions) != int(expected_count):
        warnings.append(
            f"The paper header says {expected_count} questions, but {len(questions)} question blocks were extracted. "
            "Review the question list for missed or extra blocks."
        )
    if expected_count is not None and questions:
        actual_numbers = [question.questionNumber for question in questions]
        expected_numbers = list(range(1, int(expected_count) + 1))
        if len(set(actual_numbers)) != len(actual_numbers) or sorted(actual_numbers) != expected_numbers:
            warnings.append(
                "Extracted question numbers are duplicated or do not run from 1 through the paper's stated total. "
                "Review numbering before publishing."
            )
    if answer_key:
        unanswered = [
            question.questionNumber
            for question in questions
            if (question.questionType == "NUMERICAL" and question.correctNumericalAnswer is None)
            or (question.questionType == "MULTI_CHOICE" and not question.correctOptionIds)
            or (question.questionType == "SINGLE_CHOICE" and not question.correctOptionId)
        ]
        if unanswered:
            warnings.append(
                f"The answer key did not match {len(unanswered)} extracted question(s): "
                f"{', '.join(map(str, unanswered[:12]))}{'…' if len(unanswered) > 12 else ''}. "
                "Review their answer fields."
            )

    average_confidence = round(
        sum(question.sourceConfidence for question in questions) / max(len(questions), 1), 2
    )

    draft = ParsedPaperDraft(
        examSlug=metadata["examSlug"],
        year=metadata["year"],
        title=metadata["title"],
        shift=metadata.get("shift"),
        setSeries=metadata.get("setSeries"),
        durationMinutes=metadata["durationMinutes"],
        positiveMarks=metadata["positiveMarks"],
        negativeMarks=metadata["negativeMarks"],
        maximumMarks=metadata.get("maximumMarks"),
        expectedQuestionCount=metadata.get("expectedQuestionCount"),
        language=metadata.get("language", "en"),
        sourceType=metadata.get("sourceType", "USER_UPLOADED"),
        averageConfidence=average_confidence,
        questions=questions,
        warnings=warnings,
    )

    return {
        "fileName": filename,
        "fileType": _extension(filename),
        "extractionMethod": extraction_method,
        "charactersExtracted": len(text),
        "metadata": metadata,
        "stages": {
            "extraction": extraction_method,
            "segmentationMs": segmentation_ms,
            "structuringMs": structuring_ms,
            "totalMs": int((time.perf_counter() - started) * 1000),
        },
        "draft": draft.model_dump(),
    }


def _store_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    draft = payload["draft"]
    job = {
        "jobId": job_id,
        "status": "NEEDS_REVIEW",
        "progress": 100,
        "stage": "NEEDS_REVIEW",
        "stageLabel": "Ready for review",
        "message": f"Extracted {len(draft['questions'])} questions",
        "createdAt": _now(),
        "updatedAt": _now(),
        "fileName": payload["fileName"],
        "fileType": payload["fileType"],
        "extractionMethod": payload["extractionMethod"],
        "charactersExtracted": payload["charactersExtracted"],
        "extractedQuestionCount": len(draft["questions"]),
        "averageConfidence": draft["averageConfidence"],
        "stages": payload["stages"],
        "metadata": payload["metadata"],
        "draft": draft,
        "errorMessage": None,
    }
    _remember(job_id, job)
    return job


async def _run_async_parse(
    job_id: str,
    filename: str,
    raw_bytes: bytes,
    exam_slug: str,
    year: int,
    title: Optional[str],
    shift: Optional[str],
    duration_minutes: int,
    positive_marks: float,
    negative_marks: float,
    llm_provider: Optional[str],
) -> None:
    def report(stage: str, percent: int, message: str) -> None:
        _update_job(
            job_id,
            status=stage,
            progress=percent,
            stage=stage,
            stageLabel=message,
            message=message,
        )

    try:
        _update_job(
            job_id,
            status="EXTRACTING_TEXT",
            progress=5,
            stage="EXTRACTING_TEXT",
            stageLabel="Extracting text",
            message="Reading the uploaded document",
        )
        text, extraction_method = await run_in_threadpool(
            extract_text_from_bytes, filename, raw_bytes, report
        )
        if not text.strip():
            raise ValueError(
                "No text could be extracted. If this is a scan, make sure it is legible; "
                "otherwise use the manual paste mode."
            )

        _update_job(
            job_id,
            status="IDENTIFYING_QUESTIONS",
            progress=66,
            stage="IDENTIFYING_QUESTIONS",
            stageLabel="Splitting questions",
            message=f"Detected {len(text):,} characters; finding question blocks",
        )
        payload = await _build_draft(
            text=text,
            filename=filename,
            extraction_method=extraction_method,
            exam_slug=exam_slug,
            year=year,
            title=title,
            shift=shift,
            duration_minutes=duration_minutes,
            positive_marks=positive_marks,
            negative_marks=negative_marks,
        )
        if llm_provider:
            payload["metadata"]["llmProvider"] = llm_provider

        draft = payload["draft"]
        _update_job(
            job_id,
            status="NEEDS_REVIEW",
            progress=100,
            stage="NEEDS_REVIEW",
            stageLabel="Ready for review",
            message=f"Extracted {len(draft['questions'])} questions",
            extractionMethod=payload["extractionMethod"],
            charactersExtracted=payload["charactersExtracted"],
            extractedQuestionCount=len(draft["questions"]),
            averageConfidence=draft["averageConfidence"],
            stages=payload["stages"],
            metadata=payload["metadata"],
            draft=draft,
            errorMessage=None,
        )
    except Exception as exc:
        _update_job(
            job_id,
            status="FAILED",
            progress=100,
            stage="FAILED",
            stageLabel="Conversion failed",
            message=str(exc),
            errorMessage=str(exc),
        )


@app.get("/")
async def root() -> Dict[str, Any]:
    return {
        "service": "sarkariprep-parser",
        "version": SERVICE_VERSION,
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
async def health() -> Dict[str, Any]:
    capabilities = await run_in_threadpool(_capabilities)
    ready = capabilities["pymupdf"] or capabilities["tesseract"]
    return {
        "status": "ok" if ready else "degraded",
        "service": "sarkariprep-parser",
        "version": SERVICE_VERSION,
        "maxUploadMb": MAX_UPLOAD_BYTES // (1024 * 1024),
        "supportedExtensions": sorted(ALLOWED_EXTENSIONS),
        "capabilities": capabilities,
        "jobsCached": len(JOBS_DB),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


@app.post("/parse/async")
async def create_parse_job_async(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    exam_slug: str = Form("ssc-cgl"),
    year: int = Form(2024),
    title: Optional[str] = Form(None),
    shift: Optional[str] = Form(None),
    duration_minutes: int = Form(60),
    default_marks: float = Form(2.0),
    default_neg: float = Form(0.5),
    llm_provider: Optional[str] = Form(None),
):
    filename = file.filename or "upload.txt"
    extension = _extension(filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '.{extension}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    job = _new_job(filename, extension)
    background_tasks.add_task(
        _run_async_parse,
        job["jobId"],
        filename,
        raw_bytes,
        exam_slug,
        year,
        title,
        shift,
        duration_minutes,
        default_marks,
        default_neg,
        llm_provider,
    )
    return job


@app.post("/parse")
async def create_parse_job(
    file: UploadFile = File(...),
    exam_slug: str = Form("ssc-cgl"),
    year: int = Form(2024),
    title: Optional[str] = Form(None),
    shift: Optional[str] = Form(None),
    duration_minutes: int = Form(60),
    default_marks: float = Form(2.0),
    default_neg: float = Form(0.5),
    llm_provider: Optional[str] = Form(None),
):
    filename = file.filename or "upload.txt"
    extension = _extension(filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '.{extension}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    # Extraction (PDF rendering / Tesseract OCR) is blocking CPU work.
    text, extraction_method = await run_in_threadpool(
        extract_text_from_bytes, filename, raw_bytes
    )
    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="No text could be extracted. If this is a scan, make sure it is legible; "
            "otherwise use the manual paste mode.",
        )

    payload = await _build_draft(
        text=text,
        filename=filename,
        extraction_method=extraction_method,
        exam_slug=exam_slug,
        year=year,
        title=title,
        shift=shift,
        duration_minutes=duration_minutes,
        positive_marks=default_marks,
        negative_marks=default_neg,
    )
    if llm_provider:
        payload["metadata"]["llmProvider"] = llm_provider
    return _store_job(payload)


@app.post("/parse/manual")
async def create_manual_parse_job(request: ManualParseRequest):
    text = request.rawText.replace("\r\n", "\n").strip()
    if len(text) < 20:
        raise HTTPException(status_code=400, detail="Paste at least a few lines of paper text.")

    payload = await _build_draft(
        text=text,
        filename=request.fileName or "manual-paste.md",
        extraction_method="manual_paste",
        exam_slug=request.examSlug,
        year=request.year,
        title=request.title,
        shift=request.shift,
        duration_minutes=request.durationMinutes,
        positive_marks=request.positiveMarks,
        negative_marks=request.negativeMarks,
    )
    if request.llmProvider:
        payload["metadata"]["llmProvider"] = request.llmProvider
    return _store_job(payload)


@app.get("/parse")
async def list_parse_jobs(limit: int = 20) -> Dict[str, Any]:
    jobs = list(JOBS_DB.values())[-max(1, min(limit, MAX_JOBS)):][::-1]
    return {
        "count": len(jobs),
        "jobs": [
            {
                "jobId": job["jobId"],
                "status": job["status"],
                "progress": job.get("progress", 0),
                "stage": job.get("stage"),
                "stageLabel": job.get("stageLabel"),
                "message": job.get("message"),
                "fileName": job["fileName"],
                "extractedQuestionCount": job["extractedQuestionCount"],
                "averageConfidence": job["averageConfidence"],
                "createdAt": job["createdAt"],
            }
            for job in jobs
        ],
    }


@app.get("/parse/{job_id}")
async def get_parse_job(job_id: str) -> Dict[str, Any]:
    job = JOBS_DB.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Parsing job not found or expired")
    return job


@app.delete("/parse/{job_id}")
async def delete_parse_job(job_id: str) -> Dict[str, Any]:
    if job_id not in JOBS_DB:
        raise HTTPException(status_code=404, detail="Parsing job not found or expired")
    JOBS_DB.pop(job_id, None)
    return {"jobId": job_id, "deleted": True}
