import { PDFParse } from "pdf-parse";

const TASK_CARD_ID = /\b(\d{2}-\d{3}-\d{2}-\d{2})\b/g;

export function isIndexPage(text: string): boolean {
  if (/SUBTASK|Page \d+ of \d+/.test(text)) return false;
  if (/\bINDEX\b/.test(text) && /THRESHOLD\s+REPEAT/.test(text)) return true;
  const lines = text.match(/^\d{2}-\d{3}-\d{2}-\d{2}\s+\w+\s+[\d-]+\s+[\d.]+/gm);
  return (lines?.length ?? 0) >= 3;
}

export function isTaskCardPage(text: string): boolean {
  return (
    /Page \d+ of \d+/.test(text) ||
    /DATE TAIL NUMBER STATION/.test(text) ||
    (/SUBTASK/.test(text) && /ME80-021-SEZ/.test(text))
  );
}

/** ID principal de la tarjeta en una hoja (no referencias cruzadas del índice) */
export function extractPrimaryCardId(text: string): string | null {
  const footer = text.match(
    /DATE TAIL NUMBER[\s\S]{0,120}?(\d{2}-\d{3}-\d{2}-\d{2})/
  );
  if (footer) return footer[1];

  const me80 = text.match(
    /ME80-021-SEZ[\s\S]{0,100}?(\d{2}-\d{3}-\d{2}-\d{2})/
  );
  if (me80) return me80[1];

  if (!/Page \d+ of \d+/.test(text)) return null;

  const ids = [...text.matchAll(TASK_CARD_ID)].map((m) => m[1]);
  return ids.at(-1) ?? null;
}

export interface CardPageRange {
  start: number;
  end: number;
}

export interface PageMapResult {
  pageByCardId: Record<string, number>;
  pageRanges: Record<string, CardPageRange>;
  indexPageEnd: number;
}

export async function buildPageMap(
  parser: PDFParse,
  totalPages: number,
  onProgress?: (page: number, total: number) => void
): Promise<PageMapResult> {
  const pageByCardId: Record<string, number> = {};
  const pageRanges: Record<string, CardPageRange> = {};
  let indexPageEnd = 0;

  for (let p = 1; p <= totalPages; p++) {
    onProgress?.(p, totalPages);
    const result = await parser.getText({ partial: [p] });
    const text = result.text ?? "";

    if (isIndexPage(text)) {
      indexPageEnd = p;
      continue;
    }

    if (!isTaskCardPage(text)) continue;

    const primaryId = extractPrimaryCardId(text);
    if (!primaryId) continue;

    if (!pageRanges[primaryId]) {
      pageRanges[primaryId] = { start: p, end: p };
      pageByCardId[primaryId] = p;
    } else {
      pageRanges[primaryId].end = p;
    }
  }

  return { pageByCardId, pageRanges, indexPageEnd };
}

export function collectPagesForCards(
  cardIds: string[],
  pageRanges: Record<string, CardPageRange>,
  pageByCardId: Record<string, number>
): number[] {
  const pages: number[] = [];

  for (const id of cardIds) {
    const range = pageRanges[id];
    if (range) {
      for (let p = range.start; p <= range.end; p++) pages.push(p);
      continue;
    }
    const single = pageByCardId[id];
    if (single) pages.push(single);
  }

  return [...new Set(pages)].sort((a, b) => a - b);
}
