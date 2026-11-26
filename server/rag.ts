import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { PDFParse } from 'pdf-parse';
import type { Response } from 'express';
import { db } from './db.ts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export async function extractPdfPages(buffer: Buffer): Promise<{ pages: ExtractedPage[]; pageCount: number }> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const ordered: ExtractedPage[] = (result.pages || [])
      .map((p) => ({
        pageNumber: p.num,
        text: p.text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(),
      }))
      .filter((p) => p.text.length > 0)
      .sort((a, b) => a.pageNumber - b.pageNumber);

    return {
      pages: ordered,
      pageCount: Math.max(result.total || ordered.length || 1, 1),
    };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

export interface TextChunk {
  chunkIndex: number;
  pageNumber: number;
  content: string;
}

export function chunkPages(pages: ExtractedPage[], chunkSize = 900, overlap = 160): TextChunk[] {
  const chunks: TextChunk[] = [];
  let idx = 0;

  for (const page of pages) {
    const text = page.text.trim();
    if (!text) continue;

    if (text.length <= chunkSize) {
      chunks.push({
        chunkIndex: idx++,
        pageNumber: page.pageNumber,
        content: text,
      });
      continue;
    }

    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + chunkSize, text.length);
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastPeriod > start + chunkSize * 0.6) {
          end = lastPeriod + 1;
        } else if (lastSpace > start + chunkSize * 0.5) {
          end = lastSpace;
        }
      }

      const slice = text.slice(start, end).trim();
      if (slice.length > 20) {
        chunks.push({
          chunkIndex: idx++,
          pageNumber: page.pageNumber,
          content: slice,
        });
      }

      if (end >= text.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  }

  return chunks;
}

export async function embedTexts(texts: string[]): Promise<Array<number[] | null>> {
  const ai = getGeminiClient();
  if (!ai || texts.length === 0) {
    return texts.map(() => null);
  }

  const results: Array<number[] | null> = [];
  const batchSize = 16;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    try {
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-2',
        contents: batch,
      });
      const embeddings = response.embeddings ?? [];
      for (let j = 0; j < batch.length; j++) {
        results.push(embeddings[j]?.values ?? null);
      }
    } catch (err) {
      console.warn('Embedding batch fallback to lexical search:', err instanceof Error ? err.message : err);
      for (let j = 0; j < batch.length; j++) {
        results.push(null);
      }
    }
  }

  return results;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'for', 'to', 'of',
  'in', 'are', 'what', 'when', 'where', 'how', 'who', 'can', 'do', 'does', 'i',
  'my', 'me', 'we', 'our', 'you', 'your', 'with', 'from', 'by', 'about', 'it',
  'be', 'this', 'that', 'was', 'were', 'will', 'have', 'has', 'had', 'if', 'please',
  'tell', 'explain', 'give', 'help',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s%]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function lexicalScore(queryTokens: string[], content: string): number {
  if (queryTokens.length === 0) return 0;
  const contentLower = content.toLowerCase();
  const contentTokens = new Set(tokenize(content));
  let hits = 0;
  for (const token of queryTokens) {
    if (contentTokens.has(token)) {
      hits += 1;
    } else if (contentLower.includes(token)) {
      hits += 0.6;
    }
  }
  return hits / queryTokens.length;
}

export interface RetrievedChunk {
  chunkId: number;
  documentId: number;
  filename: string;
  category: string;
  department: string;
  pageNumber: number;
  content: string;
  score: number;
}

export async function ensureUnembeddedChunksIndexed() {
  const ai = getGeminiClient();
  if (!ai) return;

  const pending = db
    .prepare('SELECT id, content FROM document_chunks WHERE embedding_json IS NULL LIMIT 24')
    .all() as Array<{ id: number; content: string }>;

  if (pending.length === 0) return;

  const vectors = await embedTexts(pending.map((p) => p.content));
  const update = db.prepare('UPDATE document_chunks SET embedding_json = ? WHERE id = ?');
  const tx = db.transaction(() => {
    pending.forEach((row, idx) => {
      const vec = vectors[idx];
      if (vec) {
        update.run(JSON.stringify(vec), row.id);
      }
    });
  });
  tx();
}

export async function retrieveRelevantChunks(
  query: string,
  department = 'All Departments',
  topK = 5
): Promise<RetrievedChunk[]> {
  // Fire embedding backfill without blocking if already mostly indexed
  await ensureUnembeddedChunksIndexed().catch(() => {});

  const rows = db
    .prepare(
      `
      SELECT
        dc.id as chunkId,
        dc.document_id as documentId,
        d.original_name as filename,
        d.category as category,
        d.department as department,
        dc.page_number as pageNumber,
        dc.content as content,
        dc.embedding_json as embeddingJson
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE d.processing_status = 'completed'
        AND (? = 'All Departments' OR d.department = 'All Departments' OR d.department = ?)
    `
    )
    .all(department, department) as Array<{
    chunkId: number;
    documentId: number;
    filename: string;
    category: string;
    department: string;
    pageNumber: number;
    content: string;
    embeddingJson: string | null;
  }>;

  if (rows.length === 0) return [];

  const [queryEmbedding] = await embedTexts([query]);
  const queryTokens = tokenize(query);

  const scored: RetrievedChunk[] = rows.map((row) => {
    const lex = lexicalScore(queryTokens, row.content);
    let sem = 0;
    if (queryEmbedding && row.embeddingJson) {
      try {
        const vec = JSON.parse(row.embeddingJson) as number[];
        sem = Math.max(0, cosineSimilarity(queryEmbedding, vec));
      } catch {
        sem = 0;
      }
    }
    const combined = queryEmbedding && row.embeddingJson ? sem * 0.7 + lex * 0.3 : lex;
    return {
      chunkId: row.chunkId,
      documentId: row.documentId,
      filename: row.filename,
      category: row.category,
      department: row.department,
      pageNumber: row.pageNumber,
      content: row.content,
      score: combined,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((item) => item.score > 0.2).slice(0, topK);
}

export function retrieveCampusNoticesAndFaqs(query: string, department = 'All Departments'): string {
  const tokens = tokenize(query);
  if (tokens.length === 0) return '';

  const faqs = db
    .prepare(
      "SELECT question, answer, category FROM faqs WHERE ? = 'All Departments' OR department = 'All Departments' OR department = ?"
    )
    .all(department, department) as Array<{ question: string; answer: string; category: string }>;

  const notices = db
    .prepare(
      "SELECT title, content, category, published_at FROM notices WHERE ? = 'All Departments' OR department = 'All Departments' OR department = ? ORDER BY published_at DESC LIMIT 10"
    )
    .all(department, department) as Array<{ title: string; content: string; category: string; published_at: string }>;

  const matchedFaqs = faqs
    .map((f) => ({ ...f, score: lexicalScore(tokens, `${f.question} ${f.answer}`) }))
    .filter((f) => f.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const matchedNotices = notices
    .map((n) => ({ ...n, score: lexicalScore(tokens, `${n.title} ${n.content}`) }))
    .filter((n) => n.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const lines: string[] = [];
  for (const f of matchedFaqs) {
    lines.push(`[FAQ | ${f.category}] Q: ${f.question}\nA: ${f.answer}`);
  }
  for (const n of matchedNotices) {
    lines.push(`[Campus Notice: ${n.title} | ${n.category} | ${n.published_at.slice(0, 10)}]\n${n.content}`);
  }
  return lines.join('\n\n');
}

export type ChatMode = 'all' | 'campus' | 'study' | 'career';

export interface ChatTurn {
  sender: 'user' | 'assistant';
  message: string;
}

function parseFriendlyApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? 'Failed to generate response.');
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return 'The AI model is temporarily busy due to high demand. Please try sending your question again in a few seconds.';
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return 'Rate limit reached for the current API quota. Please wait a moment and try again.';
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
    return 'Gemini API key error. Please check your GEMINI_API_KEY in Settings > Secrets.';
  }
  return raw;
}

function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand') || msg.includes('429');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function streamRagResponse(params: {
  res: Response;
  query: string;
  chunks: RetrievedChunk[];
  campusContextExtra?: string;
  history: ChatTurn[];
  department: string;
  mode?: ChatMode;
  onComplete: (fullText: string) => void;
}) {
  const { res, query, chunks, campusContextExtra = '', history, department, mode = 'all', onComplete } = params;
  const ai = getGeminiClient();

  if (!ai) {
    res.write(
      `event: error\ndata: ${JSON.stringify({
        error: 'Gemini API key is not configured. Please add GEMINI_API_KEY in the Settings > Secrets panel.',
      })}\n\n`
    );
    res.end();
    return;
  }

  const docsBlock =
    chunks.length > 0
      ? chunks
          .map(
            (c, i) =>
              `[Excerpt ${i + 1} | Source: ${c.filename} | Page ${c.pageNumber} | Category: ${c.category}]\n${c.content}`
          )
          .join('\n\n---\n\n')
      : '';

  const contextSections = [docsBlock, campusContextExtra].filter(Boolean).join('\n\n---\n\n');

  const historyText = history
    .slice(-8)
    .map((m) => `${m.sender === 'user' ? 'Student' : 'Assistant'}: ${m.message}`)
    .join('\n');

  let modeInstruction = '';
  if (mode === 'campus') {
    modeInstruction = `MODE: STRICT CAMPUS POLICY & HANDBOOK LOOKUP
- Answer using ONLY the College Document Excerpts, FAQs, and Campus Notices provided below.
- Cite source documents and page numbers inline as [Document_Name.pdf, p. X].
- If the provided campus documents do not contain the specific rule, date, or fee requested, state clearly: "I could not find this specific policy in the uploaded college documents." and suggest contacting the campus office or checking the Notice Board.`;
  } else if (mode === 'study') {
    modeInstruction = `MODE: STUDY, CODING & ACADEMIC TUTOR
- Help the student thoroughly with any subject: computer science, programming, math, engineering, science, humanities, writing, study schedules, or exam preparation.
- Use clear explanations, step-by-step reasoning, and well-formatted Markdown code blocks or formulas.
- If relevant college syllabus/grading excerpts are provided below, reference them as [Document_Name.pdf, p. X].`;
  } else if (mode === 'career') {
    modeInstruction = `MODE: PLACEMENTS & CAREER ADVISOR
- Help the student with campus placement rules, resume improvements, technical/HR interview prep, project ideas, and career planning.
- Use any matching campus placement policies from the excerpts below (citing [Document_Name.pdf, p. X]) alongside practical career guidance.`;
  } else {
    modeInstruction = `MODE: ALL-PURPOSE SMART CAMPUS & ACADEMIC ASSISTANT
- You can answer ALL types of student questions:
  1. **College Policies, Attendance, Exams, Admissions, Fees, Hostel & Notices**: Whenever relevant excerpts from College Documents, FAQs, or Notices are provided below, prioritize those facts strictly, do NOT invent campus-specific rules or fees, and cite sources inline as [Document_Name.pdf, p. X]. If a student asks for an undisclosed institution-specific figure (e.g., an exact fee or specific local date) not present in the excerpts, state clearly that it is not in the uploaded college documents while offering helpful next steps.
  2. **General Academics, Coding, Math, Science, Study Help, Career Advice & Everyday Questions**: Answer clearly, accurately, and helpfully! Never refuse a valid academic, technical, study, writing, career, or general question just because it isn't in a college PDF.`;
  }

  const systemInstruction = `You are AI College Assistant, a helpful, accurate, and friendly Smart Campus & Academic Assistant (active department context: ${department}).

${modeInstruction}

FORMATTING & TONE:
- Use crisp, readable Markdown (bullet points, numbered steps, tables, or fenced code blocks with language tags when showing code).
- Keep explanations concise, practical, and easy for a college student to follow.`;

  const prompt = `${historyText ? `Conversation History:\n${historyText}\n\n` : ''}${
    contextSections
      ? `Retrieved College Knowledge Base (Documents, FAQs & Notices):\n${contextSections}\n\n`
      : 'Retrieved College Knowledge Base: No matching local policy excerpts were needed or found for this query.\n\n'
  }Student Question: ${query}`;

  const attempts: Array<{ model: string; thinkingLevel: ThinkingLevel }> = [
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
    { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
  ];

  let lastErr: unknown = null;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    let emittedAnyToken = false;

    try {
      const stream = await ai.models.generateContentStream({
        model: attempt.model,
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: attempt.thinkingLevel },
        },
      });

      let fullText = '';
      for await (const chunk of stream) {
        const token = chunk.text ?? '';
        if (token) {
          emittedAnyToken = true;
          fullText += token;
          res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
        }
      }

      onComplete(fullText.trim() || 'I am sorry, I could not generate a response. Please try rephrasing your question.');
      return;
    } catch (err) {
      lastErr = err;
      if (emittedAnyToken || !isRetryableError(err) || i === attempts.length - 1) {
        break;
      }
      console.warn(`Gemini stream fallback from ${attempt.model} to ${attempts[i + 1].model} due to transient availability.`);
      await sleep(150);
    }
  }

  const friendlyMessage = parseFriendlyApiError(lastErr);
  console.error('Gemini chat stream error:', friendlyMessage);
  res.write(`event: error\ndata: ${JSON.stringify({ error: friendlyMessage })}\n\n`);
  res.end();
}
