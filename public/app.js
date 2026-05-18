import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";

const CYCLE_QUICK = ["1 C", "2 C", "3 C", "4 C", "5 C", "8 C"];

const $ = (id) => document.getElementById(id);

const FILTER_KEYS = [
  "q",
  "threshold",
  "repeat",
  "source",
  "airplane",
  "engine",
  "ata",
];

const els = {
  metaLine: $("meta-line"),
  statTotal: $("stat-total"),
  statFiltered: $("stat-filtered"),
  resultsCount: $("results-count"),
  cardsBody: $("cards-body"),
  listEmpty: $("list-empty"),
  activeFilters: $("active-filters"),
  filterQ: $("filter-q"),
  filterThreshold: $("filter-threshold"),
  filterRepeat: $("filter-repeat"),
  filterSource: $("filter-source"),
  filterAirplane: $("filter-airplane"),
  filterEngine: $("filter-engine"),
  filterAta: $("filter-ata"),
  filterSort: $("filter-sort"),
  cycleChips: $("cycle-chips"),
  resultsFilterQ: $("results-filter-q"),
  resultsFilterThreshold: $("results-filter-threshold"),
  resultsFilterRepeat: $("results-filter-repeat"),
  resultsFilterSource: $("results-filter-source"),
  resultsFilterAta: $("results-filter-ata"),
  resultsSort: $("results-sort"),
  resultsCycleChips: $("results-cycle-chips"),
  printSummaryPill: $("print-summary-pill"),
  btnClear: $("btn-clear"),
  pdfCanvas: $("pdf-canvas"),
  pdfLoading: $("pdf-loading"),
  pdfPage: $("pdf-page"),
  pdfPages: $("pdf-pages"),
  pdfPrev: $("pdf-prev"),
  pdfNext: $("pdf-next"),
  pdfIndex: $("pdf-index"),
  pdfCardLabel: $("pdf-card-label"),
  pdfNavMode: $("pdf-nav-mode"),
  cardDetail: $("card-detail"),
  detailTitle: $("detail-title"),
  detailBody: $("detail-body"),
  printPanel: $("print-panel"),
  printSelectedCount: $("print-selected-count"),
  countIncluded: $("count-included"),
  countExcluded: $("count-excluded"),
  listViewHint: $("list-view-hint"),
  printStatus: $("print-status"),
  btnSelectAll: $("btn-select-all"),
  btnSelectNone: $("btn-select-none"),
  btnExportPdf: $("btn-export-pdf"),
  printViewTabs: document.querySelector(".print-view-tabs"),
};

/** @type {{ thresholds: string[], repeats: string[], sources: string[], airplanes: string[], engines: string[] } | null} */
let meta = null;
/** @type {object[]} */
let allCards = [];
let selectedId = null;
let pdfDoc = null;
let currentPage = 1;
let debounceTimer = null;
let syncing = false;
let indexPageEnd = 0;
/** @type {Map<number, string>} */
let pageToCardId = new Map();
/** @type {number[]} */
let filteredPageQueue = [];
let filteredPageIndex = 0;
let filterNavActive = false;
/** @type {object[]} */
let currentFilteredCards = [];
/** @type {Set<string>} */
let selectedForPrint = new Set();
/** @type {"all" | "included" | "excluded"} */
let printListView = "all";

const filterState = {
  q: "",
  threshold: "",
  repeat: "",
  source: "",
  airplane: "",
  engine: "",
  ata: "",
  sort: "id-asc",
};

const sidebarControls = {
  q: els.filterQ,
  threshold: els.filterThreshold,
  repeat: els.filterRepeat,
  source: els.filterSource,
  airplane: els.filterAirplane,
  engine: els.filterEngine,
  ata: els.filterAta,
};

const resultsControls = {
  q: els.resultsFilterQ,
  threshold: els.resultsFilterThreshold,
  repeat: els.resultsFilterRepeat,
  source: els.resultsFilterSource,
  ata: els.resultsFilterAta,
};

function fillSelect(select, options, keepFirst = true) {
  const first = keepFirst ? select.options[0]?.outerHTML : "";
  select.innerHTML = first || '<option value="">Todos</option>';
  for (const opt of options) {
    const el = document.createElement("option");
    el.value = opt;
    el.textContent = opt;
    select.appendChild(el);
  }
}

function getAtaFromId(id) {
  return id.split("-")[0] ?? "";
}

function readStateFromControls() {
  const qSidebar = els.filterQ.value.trim();
  const qResults = els.resultsFilterQ.value.trim();
  filterState.q =
    document.activeElement === els.resultsFilterQ ? qResults : qSidebar;
  if (!filterState.q) filterState.q = qResults || qSidebar;

  filterState.threshold = els.filterThreshold.value;
  filterState.repeat = els.filterRepeat.value;
  filterState.source = els.filterSource.value;
  filterState.airplane = els.filterAirplane.value;
  filterState.engine = els.filterEngine.value;
  filterState.ata = els.resultsFilterAta.value || els.filterAta.value;
  filterState.sort = els.resultsSort.value || els.filterSort.value;
}

function syncControlsFromState() {
  syncing = true;
  for (const key of ["q", "threshold", "repeat", "source", "airplane", "engine"]) {
    const val = filterState[key];
    if (sidebarControls[key]) sidebarControls[key].value = val;
    if (resultsControls[key]) resultsControls[key].value = val;
  }
  els.filterQ.value = filterState.q;
  els.resultsFilterQ.value = filterState.q;
  els.filterAta.value = filterState.ata;
  els.resultsFilterAta.value = filterState.ata;
  els.filterSort.value = filterState.sort;
  els.resultsSort.value = filterState.sort;
  syncAllSegmented();
  syncing = false;
}

function cardMatches(card) {
  if (filterState.threshold && card.threshold !== filterState.threshold) return false;
  if (filterState.repeat && card.repeat !== filterState.repeat) return false;
  if (filterState.source && card.source !== filterState.source) return false;
  if (filterState.airplane && card.airplane !== filterState.airplane) return false;
  if (filterState.engine && card.engine !== filterState.engine) return false;
  if (filterState.ata && getAtaFromId(card.id) !== filterState.ata) return false;

  const q = filterState.q.toLowerCase();
  if (!q) return true;

  const haystack = [
    card.id,
    card.source,
    card.amm,
    card.threshold,
    card.repeat,
    card.airplane,
    card.engine,
    card.description ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

function sortCards(cards) {
  const list = [...cards];
  switch (filterState.sort) {
    case "id-desc":
      return list.sort((a, b) => b.id.localeCompare(a.id));
    case "threshold":
      return list.sort(
        (a, b) =>
          a.threshold.localeCompare(b.threshold) || a.id.localeCompare(b.id)
      );
    case "source":
      return list.sort(
        (a, b) => a.source.localeCompare(b.source) || a.id.localeCompare(b.id)
      );
    default:
      return list.sort((a, b) => a.id.localeCompare(b.id));
  }
}

function hasActiveFilter() {
  return (
    FILTER_KEYS.some((k) => filterState[k]) ||
    Boolean(filterState.q.trim())
  );
}

function buildFilteredPageQueue(cards) {
  const pages = cards
    .map((c) => c.page)
    .filter((p) => typeof p === "number" && p > indexPageEnd);
  return [...new Set(pages)].sort((a, b) => a - b);
}

function findCardIdOnPage(pageNum) {
  return pageToCardId.get(pageNum) ?? null;
}

function applyFilters() {
  readStateFromControls();
  syncControlsFromState();

  const filtered = sortCards(allCards.filter(cardMatches));
  currentFilteredCards = filtered;
  syncPrintSelection(filtered);
  renderList(getCardsForListView(filtered));
  els.resultsCount.textContent = String(filtered.length);
  els.statFiltered.textContent = `${filtered.length} filtradas`;
  renderActiveFilters();
  updatePrintUI();

  filterNavActive = hasActiveFilter();
  filteredPageQueue = filterNavActive
    ? buildFilteredPageQueue(filtered)
    : [];

  if (pdfDoc && filterNavActive && filteredPageQueue.length > 0) {
    filteredPageIndex = 0;
    goToFilteredPage(0);
  } else {
    updatePdfNavUI();
  }
}

function renderActiveFilters() {
  const tags = [];
  if (filterState.q) tags.push({ key: "q", label: `Buscar: ${filterState.q}` });
  if (filterState.threshold)
    tags.push({ key: "threshold", label: `Threshold: ${filterState.threshold}` });
  if (filterState.repeat)
    tags.push({ key: "repeat", label: `Repeat: ${filterState.repeat}` });
  if (filterState.source)
    tags.push({ key: "source", label: `Source: ${filterState.source}` });
  if (filterState.airplane)
    tags.push({ key: "airplane", label: `Airplane: ${filterState.airplane}` });
  if (filterState.engine)
    tags.push({ key: "engine", label: `Engine: ${filterState.engine}` });
  if (filterState.ata) tags.push({ key: "ata", label: `ATA: ${filterState.ata}` });

  els.activeFilters.replaceChildren();
  els.activeFilters.hidden = tags.length === 0;

  for (const tag of tags) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-tag";
    btn.innerHTML = `${escapeHtml(tag.label)} <span aria-hidden="true">×</span>`;
    btn.addEventListener("click", () => {
      filterState[tag.key] = "";
      syncControlsFromState();
      applyFilters();
    });
    els.activeFilters.appendChild(btn);
  }
}

function syncPrintSelection(cards) {
  selectedForPrint = new Set(cards.map((c) => c.id));
}

function getCardsForListView(cards) {
  if (printListView === "included") {
    return cards.filter((c) => selectedForPrint.has(c.id));
  }
  if (printListView === "excluded") {
    return cards.filter((c) => !selectedForPrint.has(c.id));
  }
  return cards;
}

function syncPrintViewTabs() {
  els.printViewTabs?.querySelectorAll(".seg-btn").forEach((btn) => {
    const active = btn.dataset.printView === printListView;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });
}

function updatePrintUI() {
  const show =
    hasActiveFilter() && currentFilteredCards.length > 0;
  els.printPanel.hidden = !show;

  if (!show) return;

  const n = selectedForPrint.size;
  const total = currentFilteredCards.length;
  const excluded = total - n;

  const ratio = `${n}/${total}`;
  els.printSelectedCount.textContent = ratio;
  if (els.printSummaryPill) els.printSummaryPill.textContent = ratio;
  els.countIncluded.textContent = String(n);
  els.countExcluded.textContent = String(excluded);
  els.btnExportPdf.disabled = n === 0;

  const viewLabels = {
    all: `Mostrando ${total} tarjetas`,
    included: `Mostrando ${n} incluidas`,
    excluded: `Mostrando ${excluded} excluidas`,
  };
  els.listViewHint.textContent = viewLabels[printListView];
  syncPrintViewTabs();
}

function togglePrintSelection(cardId, checked) {
  if (checked) selectedForPrint.add(cardId);
  else selectedForPrint.delete(cardId);

  const row = els.cardsBody.querySelector(`[data-card-id="${cardId}"]`);
  if (row) {
    row.classList.toggle("print-off", !checked);
    const badge = row.querySelector(".print-badge");
    if (badge) badge.textContent = checked ? "Incluida" : "Excluida";
  }

  updatePrintUI();

  if (
    (printListView === "included" && !checked) ||
    (printListView === "excluded" && checked)
  ) {
    refreshListView();
  }
}

function refreshListView() {
  renderList(getCardsForListView(currentFilteredCards));
  updatePrintUI();
}

function renderList(cards) {
  els.cardsBody.replaceChildren();
  const isEmpty = cards.length === 0;
  els.listEmpty.classList.toggle("hidden", !isEmpty);

  for (const card of cards) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "list-row";
    row.dataset.cardId = card.id;
    if (card.id === selectedId) row.classList.add("selected");
    const checked = selectedForPrint.has(card.id);
    if (!checked) row.classList.add("print-off");

    const pageInfo =
      card.page && card.pageEnd && card.pageEnd > card.page
        ? `pág. ${card.page}–${card.pageEnd}`
        : card.page
          ? `pág. ${card.page}`
          : "";

    const badgeLabel = checked ? "Incluida" : "Excluida";

    row.innerHTML = `
      <div class="row-top">
        <label class="row-check" title="Incluir en PDF de impresión">
          <input type="checkbox" class="print-checkbox" ${checked ? "checked" : ""} aria-label="Imprimir ${escapeHtml(card.id)}" />
        </label>
        <span class="print-badge">${badgeLabel}</span>
        <div class="row-top-main">
          <span class="row-id">${escapeHtml(card.id)}</span>
          <div class="row-badges">
            <span class="row-interval threshold" title="Threshold">${escapeHtml(card.threshold)}</span>
            <span class="row-interval" title="Repeat">${escapeHtml(card.repeat)}</span>
          </div>
        </div>
      </div>
      <p class="row-meta">${escapeHtml(card.source)} · ${escapeHtml(card.amm)}${pageInfo ? ` · ${pageInfo}` : ""}</p>
      <p class="row-desc">${escapeHtml(card.description ?? "Sin descripción en el índice")}</p>
    `;

    const checkbox = row.querySelector(".print-checkbox");
    checkbox.addEventListener("click", (e) => e.stopPropagation());
    checkbox.addEventListener("change", (e) => {
      togglePrintSelection(card.id, e.target.checked);
    });

    row.addEventListener("click", (e) => {
      if (e.target.closest(".row-check")) return;
      selectCard(card, row);
    });
    li.appendChild(row);
    els.cardsBody.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function selectCard(card, rowEl) {
  selectedId = card.id;
  els.cardDetail.hidden = false;
  els.cardDetail.open = true;
  els.detailTitle.textContent = card.id;
  els.detailBody.replaceChildren();

  const fields = [
    ["Source", card.source],
    ["AMM", card.amm],
    ["Versión", card.version],
    ["Threshold", card.threshold],
    ["Repeat", card.repeat],
    ["Airplane", card.airplane],
    ["Engine", card.engine],
    ["Descripción", card.description ?? "—"],
  ];

  for (const [label, value] of fields) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    els.detailBody.append(dt, dd);
  }

  document.querySelectorAll(".list-row.selected").forEach((r) => {
    r.classList.remove("selected");
  });
  rowEl?.classList.add("selected");

  goToCardPage(card);
}

function buildCycleChips(container, onSelect) {
  container.replaceChildren();
  for (const cycle of CYCLE_QUICK) {
    if (!meta?.facets.thresholds.includes(cycle)) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seg-btn";
    btn.textContent = cycle;
    btn.dataset.cycle = cycle;
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => onSelect(cycle, btn));
    container.appendChild(btn);
  }
}

function syncAllSegmented() {
  const th = filterState.threshold;
  document.querySelectorAll(".seg-btn").forEach((btn) => {
    const active = btn.dataset.cycle === th;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}

function onCycleClick(cycle) {
  const isActive = filterState.threshold === cycle;
  filterState.threshold = isActive ? "" : cycle;
  filterState.repeat = "";
  syncControlsFromState();
  applyFilters();
}

async function loadMeta() {
  const [metaRes, cardsRes] = await Promise.all([
    fetch("/api/meta"),
    fetch("/api/cards"),
  ]);
  meta = await metaRes.json();
  const cardsData = await cardsRes.json();
  allCards = cardsData.cards;
  indexPageEnd = meta.indexPageEnd ?? 0;

  pageToCardId = new Map();
  for (const card of allCards) {
    if (card.page) pageToCardId.set(card.page, card.id);
  }

  const date = new Date(meta.generatedAt).toLocaleString("es", {
    dateStyle: "short",
    timeStyle: "short",
  });
  els.metaLine.textContent = `${meta.pdfFile} · ${meta.totalPages.toLocaleString("es")} págs · ${date}`;
  els.statTotal.textContent = `${meta.totalCards} total`;

  const ataSet = [...new Set(allCards.map((c) => getAtaFromId(c.id)))].sort(
    (a, b) => a.localeCompare(b, undefined, { numeric: true })
  );

  const thresholdSelects = [els.filterThreshold, els.resultsFilterThreshold];
  const repeatSelects = [els.filterRepeat, els.resultsFilterRepeat];
  const sourceSelects = [els.filterSource, els.resultsFilterSource];

  for (const sel of thresholdSelects) fillSelect(sel, meta.facets.thresholds);
  for (const sel of repeatSelects) fillSelect(sel, meta.facets.repeats);
  for (const sel of sourceSelects) fillSelect(sel, meta.facets.sources);
  fillSelect(els.filterAirplane, meta.facets.airplanes);
  fillSelect(els.filterEngine, meta.facets.engines);
  fillSelect(els.filterAta, ataSet);
  fillSelect(els.resultsFilterAta, ataSet);

  buildCycleChips(els.cycleChips, onCycleClick);
  buildCycleChips(els.resultsCycleChips, onCycleClick);
}

function scheduleApply() {
  if (syncing) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(applyFilters, 120);
}

function clearFilters() {
  for (const key of FILTER_KEYS) filterState[key] = "";
  filterState.sort = "id-asc";
  syncControlsFromState();
  applyFilters();
}

function bindFilterInputs() {
  const inputs = [
    els.filterQ,
    els.filterThreshold,
    els.filterRepeat,
    els.filterSource,
    els.filterAirplane,
    els.filterEngine,
    els.filterAta,
    els.filterSort,
    els.resultsFilterQ,
    els.resultsFilterThreshold,
    els.resultsFilterRepeat,
    els.resultsFilterSource,
    els.resultsFilterAta,
    els.resultsSort,
  ];

  for (const el of inputs) {
    el.addEventListener("input", scheduleApply);
    el.addEventListener("change", scheduleApply);
  }
}

function updatePdfNavUI() {
  const cardId = findCardIdOnPage(currentPage);
  els.pdfCardLabel.textContent = cardId ?? "—";

  if (filterNavActive && filteredPageQueue.length > 0) {
    els.pdfNavMode.textContent = `Tarjeta ${filteredPageIndex + 1} de ${filteredPageQueue.length} (filtro activo)`;
    els.pdfNavMode.classList.add("filter-active");
    els.pdfPrev.disabled = filteredPageIndex <= 0;
    els.pdfNext.disabled = filteredPageIndex >= filteredPageQueue.length - 1;
  } else {
    els.pdfNavMode.textContent =
      indexPageEnd > 0
        ? `Pág. ${currentPage} · índice hasta pág. ${indexPageEnd}`
        : "";
    els.pdfNavMode.classList.remove("filter-active");
    els.pdfPrev.disabled = currentPage <= 1;
    els.pdfNext.disabled = pdfDoc ? currentPage >= pdfDoc.numPages : true;
  }
}

function goToFilteredPage(index) {
  if (!filteredPageQueue.length) return;
  filteredPageIndex = Math.max(
    0,
    Math.min(index, filteredPageQueue.length - 1)
  );
  renderPdfPage(filteredPageQueue[filteredPageIndex]);
}

function goToCardPage(card) {
  if (!card.page || !pdfDoc) return;
  if (filterNavActive && filteredPageQueue.length > 0) {
    const idx = filteredPageQueue.indexOf(card.page);
    if (idx >= 0) {
      goToFilteredPage(idx);
      return;
    }
  }
  renderPdfPage(card.page);
}

async function initPdf() {
  try {
    const loading = pdfjsLib.getDocument("/pdf/task-cards.pdf");
    pdfDoc = await loading.promise;
    els.pdfPages.textContent = `/ ${pdfDoc.numPages.toLocaleString("es")}`;
    els.pdfPage.max = String(pdfDoc.numPages);
    els.pdfLoading.hidden = true;

    const firstCardPage =
      allCards.find((c) => c.page && c.page > indexPageEnd)?.page ??
      indexPageEnd + 1;
    await renderPdfPage(firstCardPage);
  } catch (err) {
    els.pdfLoading.hidden = false;
    els.pdfLoading.innerHTML = `<span>${escapeHtml(err.message)}</span>`;
    console.error(err);
  }
}

async function renderPdfPage(pageNum) {
  if (!pdfDoc) return;
  const num = Math.max(1, Math.min(pageNum, pdfDoc.numPages));
  currentPage = num;
  els.pdfPage.value = String(num);

  const page = await pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale: 1.05 });
  const canvas = els.pdfCanvas;
  const ctx = canvas.getContext("2d");
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({ canvasContext: ctx, viewport }).promise;
  updatePdfNavUI();
}

function pdfPrev() {
  if (filterNavActive && filteredPageQueue.length > 0) {
    goToFilteredPage(filteredPageIndex - 1);
    return;
  }
  renderPdfPage(currentPage - 1);
}

function pdfNext() {
  if (filterNavActive && filteredPageQueue.length > 0) {
    goToFilteredPage(filteredPageIndex + 1);
    return;
  }
  renderPdfPage(currentPage + 1);
}

function onPdfPageInput() {
  const num = Number(els.pdfPage.value);
  if (filterNavActive && filteredPageQueue.length > 0) {
    const idx = filteredPageQueue.indexOf(num);
    if (idx >= 0) {
      goToFilteredPage(idx);
      return;
    }
    const nearest = filteredPageQueue.reduce((best, p) =>
      Math.abs(p - num) < Math.abs(best - num) ? p : best
    );
    goToFilteredPage(filteredPageQueue.indexOf(nearest));
    return;
  }
  if (num <= indexPageEnd && indexPageEnd > 0) {
    renderPdfPage(indexPageEnd + 1);
    return;
  }
  renderPdfPage(num);
}

bindFilterInputs();
els.btnClear.addEventListener("click", clearFilters);

els.btnSelectAll.addEventListener("click", () => {
  for (const card of currentFilteredCards) selectedForPrint.add(card.id);
  refreshListView();
});

els.btnSelectNone.addEventListener("click", () => {
  selectedForPrint.clear();
  refreshListView();
});

els.printViewTabs?.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    printListView = btn.dataset.printView ?? "all";
    refreshListView();
  });
});

async function exportPrintPdf() {
  const ids = [...selectedForPrint];
  if (ids.length === 0) return;

  els.btnExportPdf.disabled = true;
  els.printStatus.hidden = false;
  els.printStatus.textContent = "Generando PDF…";
  els.printStatus.className = "print-status print-status-inline";

  try {
    const res = await fetch("/api/export-print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardIds: ids }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Error ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `tasksystem-impresion-${ids.length}-${stamp}.pdf`;
    a.click();
    URL.revokeObjectURL(url);

    els.printStatus.textContent = `PDF · ${ids.length} tarjetas`;
    els.printStatus.className = "print-status print-status-inline success";
  } catch (err) {
    els.printStatus.textContent = err.message;
    els.printStatus.className = "print-status print-status-inline error";
  } finally {
    els.btnExportPdf.disabled = selectedForPrint.size === 0;
  }
}

els.btnExportPdf.addEventListener("click", exportPrintPdf);

els.pdfPrev.addEventListener("click", pdfPrev);
els.pdfNext.addEventListener("click", pdfNext);
els.pdfPage.addEventListener("change", onPdfPageInput);
els.pdfIndex.addEventListener("click", () => renderPdfPage(10));

(async function init() {
  await loadMeta();
  await initPdf();
  applyFilters();
})();
