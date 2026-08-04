import fs from "node:fs";
import { PDFDocument } from "pdf-lib";
import { collectPagesForCards } from "./page-map.js";
import type { TaskCardIndex } from "./types.js";

export async function buildPrintPdf(
  cardIds: string[],
  index: TaskCardIndex,
  sourcePdfPath: string
): Promise<Uint8Array> {
  const uniqueIds = [...new Set(cardIds)].sort((a, b) => {
    const pa = index.pageRanges[a]?.start ?? index.pageByCardId[a] ?? 0;
    const pb = index.pageRanges[b]?.start ?? index.pageByCardId[b] ?? 0;
    return pa - pb || a.localeCompare(b);
  });

  const pageNumbers = collectPagesForCards(
    uniqueIds,
    index.pageRanges,
    index.pageByCardId
  );

  if (pageNumbers.length === 0) {
    throw new Error("No hay páginas para las tarjetas seleccionadas");
  }

  const srcBytes = fs.readFileSync(sourcePdfPath);
  const srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
  const outDoc = await PDFDocument.create();

  const copied = await outDoc.copyPages(
    srcDoc,
    pageNumbers.map((p) => p - 1)
  );

  for (const page of copied) {
    outDoc.addPage(page);
  }

  outDoc.setTitle(`TaskSystem — ${uniqueIds.length} tarjetas`);
  outDoc.setSubject(
    `Exportación para impresión: ${uniqueIds.slice(0, 5).join(", ")}${uniqueIds.length > 5 ? "…" : ""}`
  );

  return outDoc.save();
}
