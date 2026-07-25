export interface ReasonDetail {
  code: string;
  title: string;
  description: string;
}

export interface HaltItem {
  id: string;
  symbol: string;
  name: string;
  market: string;
  status: "halted" | "resumed" | "quote_resumed";
  halted_at: string | null;
  halted_at_epoch_ms: number | null;
  resumed_at: string | null;
  resumed_at_epoch_ms: number | null;
  resumption_quote_at: string | null;
  resumption_quote_at_epoch_ms: number | null;
  reasons: ReasonDetail[];
  pause_threshold_price: string;
}

export interface Settings {
  interval: number;
  market: string;
  status: string;
  reason: string;
  theme: "dark" | "light";
  sound: boolean;
  watchlistOnly: boolean;
  watchedSymbols: string[];
  ignoredSymbols: string[];
}

export type SortColumn = "symbol" | "halted_at_epoch_ms" | "resumed_at_epoch_ms" | "reason_code" | "status";
export type SortDirection = "asc" | "desc";

export interface SortConfig {
  column: SortColumn;
  direction: SortDirection;
}

export interface StatsSummary {
  total: number;
  activeHalted: number;
  volatilityLuld: number;
  resumed: number;
  lastUpdatedMs: number;
}

export interface PerfStats {
  totalPolls: number;
  hit304Count: number;
  hit200Count: number;
  lastLatencyMs: number;
  avgLatencyMs: number;
  totalBytesDownloaded: number;
  totalBytesSaved: number;
  lastStatusCode: number;
  keepAliveActive?: boolean;
  conditionalGetActive?: boolean;
}
