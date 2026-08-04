import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

export const manualDir = path.join(root, "manual");
export const manualPdfPath = path.join(
  manualDir,
  "ALL TASK CARDS MD80 SEZ 01-02-18.pdf"
);
export const dataPath = path.join(root, "data", "task-cards.json");
export const publicDir = path.join(root, "public");
