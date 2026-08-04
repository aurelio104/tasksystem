export interface TaskCard {
  id: string;
  source: string;
  amm: string;
  version: string;
  threshold: string;
  repeat: string;
  airplane: string;
  engine: string;
  description?: string;
  /** Primera página del PDF con la tarjeta (fuera del índice) */
  page?: number;
  /** Última página de la tarjeta en el PDF */
  pageEnd?: number;
}

export interface CardPageRange {
  start: number;
  end: number;
}

export interface TaskCardIndex {
  generatedAt: string;
  pdfFile: string;
  totalPages: number;
  /** Última página considerada índice (no navegar aquí al filtrar) */
  indexPageEnd: number;
  pageByCardId: Record<string, number>;
  pageRanges: Record<string, CardPageRange>;
  cards: TaskCard[];
  facets: {
    thresholds: string[];
    repeats: string[];
    sources: string[];
    airplanes: string[];
    engines: string[];
  };
}

export interface FilterQuery {
  q?: string;
  threshold?: string;
  repeat?: string;
  source?: string;
  airplane?: string;
  engine?: string;
}
