import { Injectable, Logger } from '@nestjs/common';
import {
  asStringArray,
  clampText,
  detectKind,
  extractHtmlTitle,
  firstSentence,
  KnowledgeKindValue,
  normalizeKind,
  stripHtml,
} from './ingestion.utils';

export interface ExtractedKnowledgeItem {
  kind: KnowledgeKindValue;
  title: string;
  summary?: string;
  content: string;
  examSlug?: string;
  subject?: string;
  topic?: string;
  tags?: string[];
  confidence?: number;
  sourceUrl?: string;
  extractedJson?: unknown;
}

export interface ExtractionInput {
  text: string;
  rawHtml?: string;
  url?: string;
  title?: string;
  examSlug?: string;
  sourceName?: string;
  preferredKind?: KnowledgeKindValue;
  extractedJson?: unknown;
}

export interface ExtractionResult {
  provider: string;
  items: ExtractedKnowledgeItem[];
  notes: string[];
}

interface ProviderCandidate {
  name: string;
  model: string;
}

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || '').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';
const AI_TIMEOUT_MS = Number(process.env.INGESTION_AI_TIMEOUT_MS || 30_000);
const OLLAMA_HEALTH_TIMEOUT_MS = Number(process.env.OLLAMA_HEALTH_TIMEOUT_MS || 2_000);

@Injectable()
export class IngestionAiService {
  private readonly logger = new Logger(IngestionAiService.name);

  getProviderStatus() {
    return {
      schedulerEnabled: process.env.INGESTION_SCHEDULER_ENABLED === 'true',
      configuredProvider: process.env.INGESTION_AI_PROVIDER || 'auto',
      providers: [
        {
          name: 'ollama',
          configured: Boolean(OLLAMA_BASE_URL),
          model: OLLAMA_MODEL,
          baseUrl: OLLAMA_BASE_URL || null,
        },
        {
          name: 'gemini',
          configured: Boolean(GEMINI_API_KEY),
          model: GEMINI_MODEL,
        },
        {
          name: 'openrouter',
          configured: Boolean(OPENROUTER_API_KEY),
          model: OPENROUTER_MODEL,
        },
        {
          name: 'heuristic',
          configured: true,
          model: 'rules',
        },
      ],
    };
  }

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const text = clampText(stripHtml(input.text));
    if (!text) {
      return { provider: 'heuristic', items: [], notes: ['No readable text found.'] };
    }

    const prompt = this.buildPrompt(text, input);
    const notes: string[] = [];

    for (const provider of await this.providerCandidates()) {
      try {
        const raw =
          provider.name === 'ollama'
            ? await this.callOllama(prompt)
            : provider.name === 'gemini'
              ? await this.callGemini(prompt)
              : await this.callOpenRouter(prompt);
        const items = this.parseItems(raw, input);
        if (items.length) {
          return { provider: `${provider.name}:${provider.model}`, items, notes };
        }
        notes.push(`${provider.name} returned no usable knowledge items.`);
      } catch (error) {
        const message = (error as Error).message;
        notes.push(`${provider.name} failed: ${message}`);
        this.logger.warn(`AI provider ${provider.name} failed: ${message}`);
      }
    }

    return { provider: 'heuristic', items: this.heuristic(input, text), notes };
  }

  private async providerCandidates(): Promise<ProviderCandidate[]> {
    const configured = String(process.env.INGESTION_AI_PROVIDER || 'auto').toLowerCase();
    if (configured === 'heuristic') return [];

    const candidates: ProviderCandidate[] = [];
    if (configured === 'auto' || configured === 'ollama') {
      if (OLLAMA_BASE_URL && (await this.ollamaAvailable())) {
        candidates.push({ name: 'ollama', model: OLLAMA_MODEL });
      }
    }
    if ((configured === 'auto' || configured === 'gemini') && GEMINI_API_KEY) {
      candidates.push({ name: 'gemini', model: GEMINI_MODEL });
    }
    if ((configured === 'auto' || configured === 'openrouter') && OPENROUTER_API_KEY) {
      candidates.push({ name: 'openrouter', model: OPENROUTER_MODEL });
    }
    return candidates;
  }

  private async ollamaAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        signal: AbortSignal.timeout(OLLAMA_HEALTH_TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async callOllama(prompt: string): Promise<string> {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: 'json',
        options: { temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as { response?: string };
    return body.response || '';
  }

  private async callGemini(prompt: string): Promise<string> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return body.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
  }

  private async callOpenRouter(prompt: string): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://sarkariprep.local',
        'X-Title': 'SarkariPrep Ingestion Brain',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You extract structured exam preparation knowledge. Return only valid JSON with no markdown.',
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return body.choices?.[0]?.message?.content || '';
  }

  private buildPrompt(text: string, input: ExtractionInput): string {
    return [
      'You are the SarkariPrep ingestion brain for Indian government exam preparation.',
      'Extract useful, factual knowledge from the source content below.',
      'Return ONLY a JSON array. Do not wrap it in markdown.',
      'Each item must have: kind, title, summary, content, examSlug, subject, topic, tags, confidence, extractedJson.',
      'Allowed kind values: EXAM_UPDATE, NOTIFICATION, SYLLABUS, QUESTION, LEARNING_TRICK, STRATEGY.',
      'Use QUESTION only when the source contains a complete multiple-choice question with options and an answer.',
      'For QUESTION, extractedJson must include options as [{ "id": "A", "text": "..." }], correctOptionId, and optional explanation.',
      'Use LEARNING_TRICK only for a reusable shortcut, formula, mnemonic or exam strategy.',
      'Keep content under 1500 characters per item. Do not invent facts, dates, vacancies or answer keys.',
      'If the source has no useful exam knowledge, return [].',
      `Source name: ${input.sourceName || 'Unknown source'}`,
      `Source URL: ${input.url || 'Not provided'}`,
      `Preferred exam slug: ${input.examSlug || 'Not specified'}`,
      `Preferred kind: ${input.preferredKind || 'Auto-detect'}`,
      'Source content:',
      text,
    ].join('\n');
  }

  private parseItems(raw: string, input: ExtractionInput): ExtractedKnowledgeItem[] {
    const cleaned = raw
      .replace(/```(?:json)?/gi, '')
      .replace(/```/g, '')
      .trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('AI response did not contain a JSON array.');
    }

    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed)) throw new Error('AI response was not a JSON array.');

    return parsed
      .map((entry) => this.normalizeAiItem(entry, input))
      .filter((item): item is ExtractedKnowledgeItem => Boolean(item))
      .slice(0, 12);
  }

  private normalizeAiItem(
    entry: unknown,
    input: ExtractionInput,
  ): ExtractedKnowledgeItem | null {
    if (!entry || typeof entry !== 'object') return null;
    const item = entry as Record<string, unknown>;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const content =
      typeof item.content === 'string'
        ? item.content.trim()
        : typeof item.summary === 'string'
          ? item.summary.trim()
          : '';
    if (!title || !content) return null;

    const confidence =
      typeof item.confidence === 'number' && Number.isFinite(item.confidence)
        ? Math.min(Math.max(item.confidence, 0), 1)
        : 0.72;

    return {
      kind: normalizeKind(item.kind, input.preferredKind || detectKind(`${title} ${content}`)),
      title: title.slice(0, 200),
      summary:
        typeof item.summary === 'string' && item.summary.trim()
          ? item.summary.trim().slice(0, 600)
          : firstSentence(content),
      content: clampText(content, 4_000),
      examSlug:
        typeof item.examSlug === 'string' && item.examSlug.trim()
          ? item.examSlug.trim()
          : input.examSlug,
      subject: typeof item.subject === 'string' ? item.subject.trim() : undefined,
      topic: typeof item.topic === 'string' ? item.topic.trim() : undefined,
      tags: asStringArray(item.tags),
      confidence,
      sourceUrl: input.url,
      extractedJson:
        item.extractedJson && typeof item.extractedJson === 'object'
          ? item.extractedJson
          : undefined,
    };
  }

  private heuristic(input: ExtractionInput, text: string): ExtractedKnowledgeItem[] {
    if (!input.preferredKind && text.trim().length < 80) return [];

    const html = input.rawHtml || '';
    const title =
      input.title ||
      (html ? extractHtmlTitle(html) : undefined) ||
      text.split('\n').find((line) => line.trim().length > 4)?.trim() ||
      'Ingested exam update';

    const blocks = this.contentBlocks(html, text);
    const sourceTitle = title.slice(0, 200);

    if (input.preferredKind) {
      return [
        {
          kind: input.preferredKind,
          title: sourceTitle,
          summary: firstSentence(text),
          content: clampText(text, 4_000),
          examSlug: input.examSlug,
          tags: input.examSlug ? [input.examSlug] : [],
          confidence: 0.5,
          sourceUrl: input.url,
          extractedJson: input.extractedJson,
        },
      ];
    }

    const items = blocks.slice(0, 10).map((block, index) => {
      const blockTitle =
        block.length < 140 && index === 0
          ? sourceTitle
          : `${sourceTitle} - ${firstSentence(block, 80)}`;
      return {
        kind: detectKind(`${sourceTitle} ${block}`),
        title: blockTitle.slice(0, 200),
        summary: firstSentence(block),
        content: clampText(block, 4_000),
        examSlug: input.examSlug,
        tags: input.examSlug ? [input.examSlug] : [],
        confidence: 0.45,
        sourceUrl: input.url,
      };
    });

    if (items.length) return items;

    return [
      {
        kind: detectKind(sourceTitle),
        title: sourceTitle,
        summary: firstSentence(text),
        content: clampText(text, 4_000),
        examSlug: input.examSlug,
        tags: input.examSlug ? [input.examSlug] : [],
        confidence: 0.4,
        sourceUrl: input.url,
        extractedJson: input.extractedJson,
      },
    ];
  }

  private contentBlocks(html: string, text: string): string[] {
    if (html) {
      const blocks = html
        .split(/<\/(?:p|li|h[1-6]|section|article|blockquote)>/i)
        .map((block) => stripHtml(block))
        .map((block) => block.replace(/\s+/g, ' ').trim())
        .filter((block) => block.length >= 80);
      if (blocks.length) return blocks;
    }

    return text
      .split(/\n{2,}/)
      .map((block) => block.replace(/\s+/g, ' ').trim())
      .filter((block) => block.length >= 80);
  }
}
