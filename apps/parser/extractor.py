"""
Stage 2 — Raw document extraction engine.

- PDF native text & 2-column layout detection via PyMuPDF (fitz)
- Per-page OCR fallback for scanned PDFs via Tesseract (eng+hin+ben)
- Microsoft Word (.docx) paragraphs + tables via python-docx
- Markdown (.md), plain text (.txt) and image (.png/.jpg) ingestion
"""
import io
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, List, Optional, Tuple

OCR_LANGS = os.getenv("OCR_LANGS", "eng+hin")
OCR_DPI = max(100, int(os.getenv("OCR_DPI", "160")))
OCR_CONFIG = os.getenv("OCR_CONFIG", "--oem 1 --psm 6")
OCR_WORKERS = max(1, min(4, int(os.getenv("OCR_WORKERS", "4"))))
TEXT_EXTENSIONS = {"md", "markdown", "txt"}
IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "tif", "tiff", "bmp"}

ProgressCallback = Optional[Callable[[str, int, str], None]]


def _decode_text(raw_bytes: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return raw_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw_bytes.decode("utf-8", errors="replace")


def _report(
    progress: ProgressCallback,
    stage: str,
    percent: int,
    message: str,
) -> None:
    if not progress:
        return
    try:
        progress(stage, max(0, min(100, int(percent))), message)
    except Exception:
        pass


def _ocr_image(image) -> str:
    try:
        import pytesseract

        if image.mode not in ("L", "RGB"):
            image = image.convert("L")
        return pytesseract.image_to_string(image, lang=OCR_LANGS, config=OCR_CONFIG)
    except Exception:
        try:
            import pytesseract

            return pytesseract.image_to_string(image, lang="eng")
        except Exception:
            return ""


def _ocr_images(
    images: List[object],
    progress: ProgressCallback,
    start_percent: int,
    end_percent: int,
    stage: str,
) -> List[str]:
    """OCR pages concurrently while preserving the original page order."""
    if not images:
        return []

    results: List[str] = [""] * len(images)
    span = max(1, end_percent - start_percent)

    def report(done: int) -> None:
        percent = start_percent + int(span * (done / max(len(images), 1)))
        _report(progress, stage, percent, f"OCR page {done} of {len(images)}")

    if len(images) == 1 or OCR_WORKERS == 1:
        for index, image in enumerate(images):
            results[index] = _ocr_image(image).strip()
            report(index + 1)
        return results

    with ThreadPoolExecutor(max_workers=min(OCR_WORKERS, len(images))) as pool:
        futures = {pool.submit(_ocr_image, image): index for index, image in enumerate(images)}
        completed = 0
        for future in as_completed(futures):
            index = futures[future]
            try:
                results[index] = (future.result() or "").strip()
            except Exception:
                results[index] = ""
            completed += 1
            report(completed)

    return results


def _extract_pdf(raw_bytes: bytes, progress: ProgressCallback = None) -> Tuple[str, str]:
    try:
        import fitz  # PyMuPDF
        from PIL import Image

        doc = fitz.open(stream=raw_bytes, filetype="pdf")
        total_pages = max(len(doc), 1)
        pages: List[str] = [""] * total_pages
        ocr_images: List[Tuple[int, object]] = []

        try:
            for index, page in enumerate(doc):
                # Sort blocks by vertical band then horizontal position so
                # two-column question papers read top-left -> top-right.
                blocks = page.get_text("blocks")
                sorted_blocks = sorted(blocks, key=lambda b: (round(b[1] / 20), b[0]))
                page_text = "\n".join(
                    block[4].strip()
                    for block in sorted_blocks
                    if len(block) > 4 and block[4].strip()
                ).strip()

                if len(page_text) < 40:
                    pixmap = page.get_pixmap(dpi=OCR_DPI, colorspace=fitz.csGRAY)
                    ocr_images.append(
                        (index, Image.open(io.BytesIO(pixmap.tobytes("png"))))
                    )
                else:
                    pages[index] = page_text

                _report(
                    progress,
                    "EXTRACTING_TEXT",
                    8 + int(30 * ((index + 1) / total_pages)),
                    f"Reading page {index + 1} of {total_pages}",
                )
        finally:
            doc.close()

        ocr_pages = 0
        if ocr_images:
            _report(
                progress,
                "EXTRACTING_TEXT",
                40,
                f"Running OCR on {len(ocr_images)} scanned page(s)",
            )
            ocr_text = _ocr_images(
                [image for _, image in ocr_images],
                progress,
                40,
                62,
                "EXTRACTING_TEXT",
            )
            for (index, _), text in zip(ocr_images, ocr_text):
                pages[index] = text
                if text:
                    ocr_pages += 1

        combined = "\n\n".join(pages).strip()
        if ocr_pages and combined:
            return combined, "pymupdf_layout+tesseract_ocr"
        if combined:
            return combined, "pymupdf_layout"
    except Exception:
        pass

    # Last-resort OCR path (pdf2image + poppler).
    try:
        from pdf2image import convert_from_bytes

        _report(progress, "EXTRACTING_TEXT", 10, "Rendering PDF pages for OCR")
        images = convert_from_bytes(raw_bytes, dpi=OCR_DPI)
        texts = _ocr_images(images, progress, 10, 65, "EXTRACTING_TEXT")
        return "\n\n".join(texts).strip(), "tesseract_ocr"
    except Exception:
        return _decode_text(raw_bytes), "fallback_utf8"


def _extract_docx(raw_bytes: bytes) -> Tuple[str, str]:
    try:
        import docx

        document = docx.Document(io.BytesIO(raw_bytes))
        parts = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]

        for table in document.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if cells:
                    parts.append(" | ".join(cells))

        return "\n".join(parts), "python_docx"
    except Exception:
        return _decode_text(raw_bytes), "fallback_utf8"


def _extract_image(raw_bytes: bytes, progress: ProgressCallback = None) -> Tuple[str, str]:
    try:
        from PIL import Image

        _report(progress, "EXTRACTING_TEXT", 15, "Preparing image for OCR")
        image = Image.open(io.BytesIO(raw_bytes))
        if image.mode not in ("L", "RGB"):
            image = image.convert("L")
        text = _ocr_image(image).strip()
        _report(progress, "EXTRACTING_TEXT", 62, "Image OCR complete")
        return text, "tesseract_ocr"
    except Exception:
        return "", "ocr_failed"


def extract_text_from_bytes(
    filename: str,
    raw_bytes: bytes,
    progress: ProgressCallback = None,
) -> Tuple[str, str]:
    """Return `(extracted_text, extraction_method)` for an uploaded document."""
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "txt").lower()

    if ext in TEXT_EXTENSIONS:
        _report(progress, "EXTRACTING_TEXT", 50, "Reading text file")
        return _decode_text(raw_bytes), "direct_text"

    if ext == "pdf":
        return _extract_pdf(raw_bytes, progress)

    if ext == "docx":
        _report(progress, "EXTRACTING_TEXT", 40, "Reading Word document")
        return _extract_docx(raw_bytes)

    if ext in IMAGE_EXTENSIONS:
        return _extract_image(raw_bytes, progress)

    _report(progress, "EXTRACTING_TEXT", 50, "Reading uploaded file")
    return _decode_text(raw_bytes), "fallback_utf8"
