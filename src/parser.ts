import fs from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { buildPageMap } from "./page-map.js";
import type { TaskCard, TaskCardIndex } from "./types.js";

const TASK_CARD_LINE =
  /^(\d{2}-\d{3}-\d{2}-\d{2})\s+(\w+)\s+([\d-]+)\s+([\d.]+)\s+(.+)$/;

const VALID_INTERVAL =
  /^(DAILY|\d+\s+(C|DY|MO|FH|FC|A|YR)|LIF|APU|ENG|VEN|\d+)$/i;

function parseIntervalTokens(
  tokens: string[]
): { threshold: string; repeat: string } | null {
  if (tokens.length === 0) return null;
  if (tokens.length === 1) {
    return { threshold: tokens[0], repeat: tokens[0] };
  }
  const mid = Math.floor(tokens.length / 2);
  const threshold = tokens.slice(0, mid).join(" ");
  const repeat = tokens.slice(mid).join(" ");
  if (!VALID_INTERVAL.test(threshold) && threshold !== repeat) {
    return null;
  }
  return { threshold, repeat };
}

function extractDescription(
  text: string,
  cardId: string,
  nextCardId?: string
): string | undefined {
  const start = text.indexOf(cardId);
  if (start === -1) return undefined;
  const lineEnd = text.indexOf("\n", start);
  const bodyStart = lineEnd + 1;
  const bodyEnd = nextCardId
    ? text.indexOf(nextCardId, bodyStart)
    : text.indexOf("\n-- ", bodyStart);
  if (bodyEnd === -1 || bodyEnd <= bodyStart) return undefined;
  const raw = text.slice(bodyStart, bodyEnd).trim();
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !l.startsWith("SEZ MD-80") &&
        !l.startsWith("INDEX") &&
        !l.startsWith("ECCN") &&
        !l.startsWith("ME80-") &&
        !l.startsWith("Page ")
    );
  return lines.slice(0, 4).join(" ").slice(0, 280) || undefined;
}

export async function parseTaskCardsPdf(
  pdfPath: string,
  options?: { skipPageMap?: boolean }
): Promise<TaskCardIndex> {
  const buffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const totalPages = result.total ?? 0;

  const text = result.text;
  const cards: TaskCard[] = [];

  for (const line of text.split("\n")) {
    const m = line.trim().match(TASK_CARD_LINE);
    if (!m) continue;

    const tokens = m[5].trim().split(/\s+/);
    if (tokens.length < 3) continue;

    const engine = tokens.pop()!;
    const airplane = tokens.pop()!;
    const interval = parseIntervalTokens(tokens);
    if (!interval) continue;

    cards.push({
      id: m[1],
      source: m[2],
      amm: m[3],
      version: m[4],
      threshold: interval.threshold,
      repeat: interval.repeat,
      airplane,
      engine,
    });
  }

  const seen = new Set<string>();
  const unique = cards.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  unique.sort((a, b) => a.id.localeCompare(b.id));

  for (let i = 0; i < unique.length; i++) {
    unique[i].description = extractDescription(
      text,
      unique[i].id,
      unique[i + 1]?.id
    );
  }

  let pageByCardId: Record<string, number> = {};
  let pageRanges: Record<string, { start: number; end: number }> = {};
  let indexPageEnd = 0;

  if (!options?.skipPageMap && totalPages > 0) {
    const mapResult = await buildPageMap(parser, totalPages, (p, t) => {
      if (p % 200 === 0 || p === t) {
        process.stdout.write(`\rMapeando páginas: ${p}/${t}`);
      }
    });
    process.stdout.write("\n");
    pageByCardId = mapResult.pageByCardId;
    pageRanges = mapResult.pageRanges;
    indexPageEnd = mapResult.indexPageEnd;

    for (const card of unique) {
      const range = mapResult.pageRanges[card.id];
      if (range) {
        card.page = range.start;
        card.pageEnd = range.end;
      } else {
        const page = pageByCardId[card.id];
        if (page) {
          card.page = page;
          card.pageEnd = page;
        }
      }
    }
  }

  await parser.destroy();

  const facet = (key: keyof TaskCard) =>
    [...new Set(unique.map((c) => c[key] as string))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );

  return {
    generatedAt: new Date().toISOString(),
    pdfFile: path.basename(pdfPath),
    totalPages,
    indexPageEnd,
    pageByCardId,
    pageRanges,
    cards: unique,
    facets: {
      thresholds: facet("threshold"),
      repeats: facet("repeat"),
      sources: facet("source"),
      airplanes: facet("airplane"),
      engines: facet("engine"),
    },
  };
}

export function saveIndex(index: TaskCardIndex, outPath: string): void {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(index, null, 2), "utf-8");
}
