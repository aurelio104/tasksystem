import express from "express";
import fs from "node:fs";
import { buildPrintPdf } from "./export-print.js";
import { filterTaskCards } from "./filter.js";
import { dataPath, manualPdfPath, publicDir } from "./paths.js";
import type { FilterQuery, TaskCardIndex } from "./types.js";

const pdfPath = manualPdfPath;

function loadIndex(): TaskCardIndex {
  if (!fs.existsSync(dataPath)) {
    throw new Error(
      "Índice no encontrado. Ejecuta primero: npm run parse"
    );
  }
  return JSON.parse(fs.readFileSync(dataPath, "utf-8")) as TaskCardIndex;
}

export function createApp(): express.Application {
  const index = loadIndex();
  const app = express();

  app.use(express.json({ limit: "2mb" }));
  app.use(express.static(publicDir));

  app.get("/api/meta", (_req, res) => {
    res.json({
      generatedAt: index.generatedAt,
      pdfFile: index.pdfFile,
      totalPages: index.totalPages,
      indexPageEnd: index.indexPageEnd ?? 0,
      totalCards: index.cards.length,
      mappedPages: Object.keys(index.pageByCardId ?? {}).length,
      facets: index.facets,
    });
  });

  app.get("/api/cards", (req, res) => {
    const query: FilterQuery = {
      q: req.query.q as string | undefined,
      threshold: req.query.threshold as string | undefined,
      repeat: req.query.repeat as string | undefined,
      source: req.query.source as string | undefined,
      airplane: req.query.airplane as string | undefined,
      engine: req.query.engine as string | undefined,
    };

    const filtered = filterTaskCards(index.cards, query);
    res.json({
      total: filtered.length,
      cards: filtered,
    });
  });

  app.get("/api/cards/:id", (req, res) => {
    const card = index.cards.find((c) => c.id === req.params.id);
    if (!card) {
      res.status(404).json({ error: "Task card no encontrada" });
      return;
    }
    res.json(card);
  });

  app.post("/api/export-print", async (req, res) => {
    const cardIds = req.body?.cardIds;
    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      res.status(400).json({ error: "Indica al menos una task card" });
      return;
    }

    const validIds = cardIds.filter(
      (id): id is string =>
        typeof id === "string" && index.cards.some((c) => c.id === id)
    );

    if (validIds.length === 0) {
      res.status(400).json({ error: "Ningún ID de task card válido" });
      return;
    }

    try {
      if (!index.pageRanges || Object.keys(index.pageRanges).length === 0) {
        res.status(503).json({
          error: "Falta el mapa de páginas. Ejecuta: npm run parse",
        });
        return;
      }

      const pdfBytes = await buildPrintPdf(validIds, index, pdfPath);
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `tasksystem-impresion-${validIds.length}-${stamp}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al generar PDF";
      res.status(500).json({ error: message });
    }
  });

  app.get("/pdf/task-cards.pdf", (_req, res) => {
    if (!fs.existsSync(pdfPath)) {
      res.status(404).send("PDF no encontrado");
      return;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="ALL TASK CARDS MD80 SEZ.pdf"'
    );
    fs.createReadStream(pdfPath).pipe(res);
  });

  return app;
}
