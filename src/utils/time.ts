import { HaltItem } from "../types";

export function pad2(v: number | string): string {
  return String(v).padStart(2, "0");
}

export function formatRelativeTime(epochMs: number | null): string {
  if (!epochMs) return "-";
  const d = new Date(Number(epochMs));
  const now = new Date();

  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timeStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

  if (isToday) return `오늘 ${timeStr}`;
  if (isYesterday) return `어제 ${timeStr}`;

  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${timeStr}`;
}

export function formatNYTimeStr(epochMs: number | null): string {
  if (!epochMs) return "-";
  const d = new Date(Number(epochMs));
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d) + " (미국 동부 ET)";
  } catch (e) {
    return d.toLocaleString();
  }
}

export function getNYTimeDetails(epochMs: number | null) {
  if (!epochMs) return null;
  const d = new Date(epochMs);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(d);

    let y = "", m = "", day = "", h = 0, min = 0;
    parts.forEach((p) => {
      if (p.type === "year") y = p.value;
      if (p.type === "month") m = p.value;
      if (p.type === "day") day = p.value;
      if (p.type === "hour") h = parseInt(p.value, 10) % 24;
      if (p.type === "minute") min = parseInt(p.value, 10);
    });
    return { date: `${y}-${m}-${day}`, mins: h * 60 + min };
  } catch (e) {
    return null;
  }
}

// Calculate total volatility halts for this symbol during regular market hours (09:30 - 16:00 ET = 570 - 960 mins)
export function getHaltCountForSymbolToday(data: HaltItem[], symbol: string, targetEpochMs: number | null): number {
  if (!targetEpochMs) return 1;
  const targetTime = getNYTimeDetails(targetEpochMs);
  if (!targetTime) return 1;

  let count = 0;
  data.forEach((item) => {
    if (item.symbol !== symbol) return;
    const itemEpoch = item.halted_at_epoch_ms;
    if (!itemEpoch || itemEpoch > targetEpochMs) return;

    const itemTime = getNYTimeDetails(itemEpoch);
    if (!itemTime || itemTime.date !== targetTime.date) return;

    const code = item.reasons && item.reasons[0] ? item.reasons[0].code : "";
    const isVolatilityHalt = ["LUDP", "M", "LU", "DP"].includes(code.toUpperCase());

    if (isVolatilityHalt && itemTime.mins >= 570 && itemTime.mins < 960) {
      count++;
    }
  });

  return Math.max(1, count);
}

let serverTimeOffsetMs = 0;

export function updateServerTimeOffset(serverTimeMs: number) {
  if (serverTimeMs && typeof serverTimeMs === "number") {
    serverTimeOffsetMs = serverTimeMs - Date.now();
  }
}

export function getSyncedNow(): number {
  return Date.now() + serverTimeOffsetMs;
}

export function remainingMs(targetMs: number, nowMs?: number): number {
  const current = nowMs ?? getSyncedNow();
  return Math.max(0, targetMs - current);
}

export function getKitIntervals(haltedEpoch: number, nowMs: number = getSyncedNow()): number[] {
  let currentKitM = 5;
  const GRACE_PERIOD_MS = 20000; // 20s grace period
  while (haltedEpoch + currentKitM * 60 * 1000 + GRACE_PERIOD_MS <= nowMs) {
    currentKitM += 5;
  }
  return [currentKitM, currentKitM + 5, currentKitM + 10];
}

export function fmtMinSecFromMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}분 ${pad2(s)}초`;
}

export function translateStatus(s: string): string {
  if (!s) return "";
  if (s === "halted") return "정지";
  if (s === "resumed") return "재개";
  if (s === "quote_resumed") return "호가 재개";
  return s;
}
