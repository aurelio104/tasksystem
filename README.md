# TaskSystem

Dashboard web para el manual **MD-80 Task Cards** (SEZ): filtrar tarjetas, navegar el PDF y exportar un PDF solo con las tarjetas seleccionadas.

## Requisitos

- Node.js 20+
- Manual PDF en `manual/ALL TASK CARDS MD80 SEZ 01-02-18.pdf`

## Instalación automática

```bash
git clone git@github.com:aurelio104/tasksystem.git
cd tasksystem
npm run setup    # instala, parsea PDF y compila
npm run dev
```

O paso a paso:

```bash
npm install
npm run parse
npm run dev
```

Abre [http://localhost:3847](http://localhost:3847).

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run parse` | Extrae el índice de task cards del PDF → `data/task-cards.json` |
| `npm run dev` | Servidor de desarrollo (puerto 3847) |
| `npm run build` | Compila TypeScript → `dist/` |
| `npm start` | Servidor en producción (`dist/server.js`) |

## Estructura

```
tasksystem/
├── manual/          # PDF fuente del manual
├── data/            # Índice generado (no versionado)
├── public/          # UI (HTML, CSS, JS)
├── src/             # API Express, parser, export PDF
└── package.json
```

## API

- `GET /api/meta` — metadatos y facetas de filtro
- `GET /api/cards` — listado de task cards
- `GET /api/cards/:id` — detalle de una tarjeta
- `POST /api/export-print` — PDF con tarjetas seleccionadas
- `GET /pdf/task-cards.pdf` — visor del manual completo

## Licencia

Uso interno — manual Boeing MD-80 sujeto a sus propios términos.
