import { dataPath, manualPdfPath } from "../paths.js";
import { parseTaskCardsPdf, saveIndex } from "../parser.js";

const pdfPath = manualPdfPath;
const outPath = dataPath;

async function main() {
  console.log("Parseando PDF:", pdfPath);
  const index = await parseTaskCardsPdf(pdfPath);
  saveIndex(index, outPath);
  console.log(`Listo: ${index.cards.length} task cards → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
