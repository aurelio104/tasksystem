#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> TaskSystem — instalación automática"
command -v node >/dev/null || { echo "Node.js no encontrado"; exit 1; }

if [[ ! -f manual/ALL\ TASK\ CARDS\ MD80\ SEZ\ 01-02-18.pdf ]]; then
  echo "ERROR: Coloca el PDF en manual/ALL TASK CARDS MD80 SEZ 01-02-18.pdf"
  exit 1
fi

npm ci
npm run parse
npm run build

echo ""
echo "Listo. Inicia con: npm run dev"
echo "URL: http://localhost:${PORT:-3847}"
