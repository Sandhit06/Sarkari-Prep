import { createHash } from 'crypto';

export const KNOWLEDGE_KINDS = [
  'EXAM_UPDATE',
  'NOTIFICATION',
  'SYLLABUS',
  'QUESTION',
  'LEARNING_TRICK',
  'STRATEGY',
] as const;

export type KnowledgeKindValue = (typeof KNOWLEDGE_KINDS)[number];

export function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractHtmlTitle(html: string): string | undefined {
  const title =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  return title ? stripHtml(title).slice(0, 200) : undefined;
}

export function toPlainText(input: string): string {
  return stripHtml(input).slice(0, 60_000);
}

export function slugify(input: string, fallback = 'item'): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

export function contentHash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function firstSentence(input: string, max = 240): string {
  const sentence = input.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/)[0] ?? '';
  if (!sentence) return input.slice(0, max);
  return sentence.length > max ? `${sentence.slice(0, max - 1).trim()}...` : sentence;
}

export function clampText(input: string, max = 12_000): string {
  const text = input.trim();
  return text.length > max ? `${text.slice(0, max)}\n\n[truncated]` : text;
}

export function normalizeKind(value: unknown, fallback: KnowledgeKindValue = 'EXAM_UPDATE'): KnowledgeKindValue {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return (KNOWLEDGE_KINDS as readonly string[]).includes(normalized)
    ? (normalized as KnowledgeKindValue)
    : fallback;
}

export function detectKind(input: string, fallback: KnowledgeKindValue = 'EXAM_UPDATE'): KnowledgeKindValue {
  const text = input.toLowerCase();
  if (/(syllabus|exam pattern|marking scheme)/.test(text)) return 'SYLLABUS';
  if (/(admit card|answer key|result|notification|notice|apply online|application|vacancy)/.test(text)) {
    return 'NOTIFICATION';
  }
  if (/(question paper|previous year|mcq|answer key)/.test(text)) return 'QUESTION';
  if (/(shortcut|trick|tips|formula|mnemonic|study hack)/.test(text)) return 'LEARNING_TRICK';
  if (/(strategy|study plan|preparation|how to prepare)/.test(text)) return 'STRATEGY';
  return fallback;
}

export function asStringArray(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}
