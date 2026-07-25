import React, { useState, useEffect } from "react";
import {
  HaltItem,
  SortConfig,
  SortColumn,
} from "../types";
import {
  formatRelativeTime,
  formatNYTimeStr,
  getHaltCountForSymbolToday,
  remainingMs,
  fmtMinSecFromMs,
  translateStatus,
  getSyncedNow,
} from "../utils/time";
import { playResumeChime } from "../utils/sound";
import {
  Star,
  ExternalLink,
  Copy,
  Clock,
  ChevronDown,
  ChevronUp,
  Zap,
  Info,
  CheckCircle2,
  ListFilter,
  SquareArrowOutUpRight,
  EyeOff,
} from "lucide-react";
import { openPopoutTimerWindow } from "../utils/popout";
import { invoke } from "@tauri-apps/api/core";

interface HaltTableProps {
  data: HaltItem[];
  allData: HaltItem[];
  sortConfig: SortConfig;
  onSort: (column: SortColumn) => void;
  watchedSymbols: Set<string>;
  onToggleWatch: (symbol: string) => void;
  onCopyKitText: (item: HaltItem) => void;
  onSelectSymbol: (symbol: string) => void;
  ignoredSymbols?: Set<string>;
  onToggleIgnore?: (symbol: string) => void;
  onRefresh?: () => void;
  soundEnabled?: boolean;
}

export const HaltTable: React.FC<HaltTableProps> = ({
  data,
  allData,
  sortConfig,
  onSort,
  onToggleWatch,
  ignoredSymbols,
  onToggleIgnore,
  onCopyKitText,
  onSelectSymbol,
  onRefresh,
  soundEnabled = true,
}) => {
  const [openDetails, setOpenDetails] = useState<Set<string>>(new Set());
  const [isExpandedOther, setIsExpandedOther] = useState(false);
  const [nowMs, setNowMs] = useState(getSyncedNow());
  const refreshedBoundariesRef = React.useRef<Set<string>>(new Set());

  // Ticker timer update tick for live Kit countdown (200ms for zero-latency boundary sound trigger)
  useEffect(() => {
    const timer = setInterval(() => setNowMs(getSyncedNow()), 200);
    return () => clearInterval(timer);
  }, []);

  // Helper to check if halt reason corresponds to Kit Countdown (Volatility Halt: M, LUDP, LUDT, LU, DP)
  const isKitCountdownReason = (code: string) => {
    const c = (code || "").toUpperCase().trim();
    return ["LUDP", "LUDT", "M", "LU", "DP"].includes(c);
  };

  const isKitCountdownItem = (h: HaltItem) => {
    const code = h.reasons && h.reasons[0] ? h.reasons[0].code : "";
    return h.status === "halted" && isKitCountdownReason(code) && Boolean(h.halted_at_epoch_ms);
  };

  // Monitor countdown boundaries (e.g. 5m, 10m, 15m) and trigger immediate sound & refresh
  const playedBoundariesRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentNow = getSyncedNow();
    allData.forEach((h) => {
      const code = h.reasons && h.reasons[0] ? h.reasons[0].code : "";
      if (h.status === "halted" && h.halted_at_epoch_ms && isKitCountdownReason(code)) {
        const checkMins = [5, 10, 15, 20, 25, 30];
        for (const m of checkMins) {
          const boundaryEpoch = h.halted_at_epoch_ms + m * 60 * 1000;
          const diff = boundaryEpoch - currentNow;
          const key = `${h.symbol}_${boundaryEpoch}`;

          // Pre-fetch refresh when approaching boundary (within 3s)
          if (diff <= 3000 && diff >= -3000) {
            if (onRefresh) onRefresh();
          }

          // Trigger chime as soon as boundary is reached (00:00)
          if (currentNow >= boundaryEpoch && !playedBoundariesRef.current.has(key)) {
            playedBoundariesRef.current.add(key);
            if (soundEnabled) {
              playResumeChime();
            }
            if (onRefresh) onRefresh();
          }
        }
      }
    });
  }, [nowMs, allData, soundEnabled, onRefresh]);

  const handleExternalLink = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    if ((window as any).__TAURI_INTERNALS__) {
      invoke("open_url", { url }).catch(console.error);
    } else {
      window.open(url, "_blank");
    }
  };

  const toggleDetail = (key: string) => {
    setOpenDetails((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getCodeBadgeStyle = (code: string) => {
    const c = (code || "").toUpperCase();
    if (c === "LUDP")
      return "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 font-bold";
    if (c === "M")
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-bold";
    if (c === "LU")
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold";
    if (c === "DP")
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-bold";
    if (c.startsWith("T"))
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 font-bold";
    if (c.startsWith("H"))
      return "bg-rose-600/15 text-rose-800 dark:text-rose-400 border-rose-600/30 font-bold";
    return "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 font-bold";
  };

  const renderSortArrow = (column: SortColumn) => {
    if (sortConfig.column !== column) return null;
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="w-3.5 h-3.5 inline ml-1 text-blue-600 dark:text-blue-400" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 inline ml-1 text-blue-600 dark:text-blue-400" />
    );
  };

  if (!data || data.length === 0) {
    return (
      <div className="p-12 text-center bg-white dark:bg-[#1A202C] rounded-xl border border-slate-200 dark:border-[#2D3748] shadow-sm">
        <p className="text-slate-800 dark:text-gray-200 font-bold text-base mb-2">
          조건에 부합하는 거래정지 종목이 없습니다.
        </p>
        <p className="text-xs text-slate-500 dark:text-gray-400 font-mono">
          검색어 및 필터 조건을 변경하거나 상단 갱신 버튼을 눌러보세요.
        </p>
      </div>
    );
  }

  // Split items into Active Kit Countdowns (volatility halts currently in progress) vs Others
  const activeCountdownItems = data.filter((h) => isKitCountdownItem(h));

  const otherItems = data.filter((h) => !isKitCountdownItem(h));

  const visibleOtherItems = isExpandedOther ? otherItems : otherItems.slice(0, 4);

  const renderTableHeader = () => (
    <thead>
      <tr className="border-b border-slate-200 dark:border-[#2D3748] text-slate-700 dark:text-gray-300 font-mono font-extrabold text-[12px] bg-slate-100 dark:bg-[#111318] uppercase tracking-wider select-none">
        <th
          onClick={() => onSort("symbol")}
          className="py-3.5 px-4 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors w-[26%]"
        >
          티커 / 종목명 {renderSortArrow("symbol")}
        </th>
        <th
          onClick={() => onSort("halted_at_epoch_ms")}
          className="py-3.5 px-3 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors w-[15%]"
        >
          정지 시각 {renderSortArrow("halted_at_epoch_ms")}
        </th>
        <th
          onClick={() => onSort("resumed_at_epoch_ms")}
          className="py-3.5 px-3 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors w-[15%]"
        >
          재개 시각 {renderSortArrow("resumed_at_epoch_ms")}
        </th>
        <th
          onClick={() => onSort("reason_code")}
          className="py-3.5 px-3 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors w-[11%]"
        >
          정지 사유 {renderSortArrow("reason_code")}
        </th>
        <th className="py-3.5 px-3 w-[17%]">킷 카운트다운</th>
        <th
          onClick={() => onSort("status")}
          className="py-3.5 px-3 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors w-[10%]"
        >
          상태 {renderSortArrow("status")}
        </th>
        <th className="py-3.5 px-4 text-center w-[6%]">작업</th>
      </tr>
    </thead>
  );

  const renderTableRows = (itemList: HaltItem[]) => (
    <tbody className="divide-y divide-slate-200 dark:divide-[#2D3748]/60 font-medium">
      {itemList.map((h) => {
        const key = h.id;
        const isWatched = watchedSymbols.has(h.symbol);
        const isIgnored = ignoredSymbols?.has(h.symbol) || false;
        const isOpen = openDetails.has(key);
        const haltedEpoch = h.halted_at_epoch_ms;
        const resumedEpoch = h.resumed_at_epoch_ms;
        const reasonObj = h.reasons && h.reasons[0] ? h.reasons[0] : null;
        const code = reasonObj ? reasonObj.code : "";

        const targetCount = getHaltCountForSymbolToday(
          allData,
          h.symbol,
          haltedEpoch
        );
        const hasKitTimer = h.status === "halted" && isKitCountdownReason(code) && Boolean(haltedEpoch);

        // Live Kit countdown calculation
        let remTimeStr = "-";
        let kitGlowClass = "";
        let targetM = 5;

        if (hasKitTimer && haltedEpoch) {
          const GRACE_PERIOD_MS = 20000;
          while (haltedEpoch + targetM * 60 * 1000 + GRACE_PERIOD_MS <= nowMs) {
            targetM += 5;
          }
          const targetEpoch = haltedEpoch + targetM * 60 * 1000;
          const rem = remainingMs(targetEpoch);
          remTimeStr = fmtMinSecFromMs(rem);

          if (rem === 0) {
            remTimeStr = "확인 중..";
            kitGlowClass = "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/50 animate-pulse";
          } else if (rem < 60 * 1000) {
            kitGlowClass = "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/50 animate-pulse";
          } else if (rem < 180 * 1000) {
            kitGlowClass = "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/50";
          } else {
            kitGlowClass = "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-500/50";
          }
        }

        return (
          <React.Fragment key={key}>
            <tr
              onClick={() => toggleDetail(key)}
              className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-[#171923] ${
                isWatched
                  ? "bg-amber-50/70 dark:bg-amber-500/10 border-l-4 border-l-amber-500 dark:border-l-amber-400"
                  : isIgnored
                  ? "opacity-50 grayscale bg-slate-100 dark:bg-slate-800"
                  : ""
              }`}
            >
              {/* Symbol, Toss Link & Halt Count Badge */}
              <td className="py-3.5 px-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Ticker Symbol */}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSymbol(h.symbol);
                    }}
                    className="font-mono font-black text-xl md:text-2xl text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors tracking-tight cursor-pointer"
                  >
                    {h.symbol}
                  </span>

                  {/* Toss External Link Button */}
                  <a
                    href={`https://www.tossinvest.com/stocks/${encodeURIComponent(h.symbol)}`}
                    onClick={(e) => handleExternalLink(e, `https://www.tossinvest.com/stocks/${encodeURIComponent(h.symbol)}`)}
                    className="p-1.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 transition-all"
                    title="토스증권 바로가기"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {/* Halt Count Badge Placement - Placed after Toss link */}
                  <span
                    title={`오늘 정규장 정지 ${targetCount}회 발동`}
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-black border ${
                      targetCount > 1
                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {targetCount}회
                  </span>
                </div>

                {/* Company Name & Market */}
                <div
                  className="text-xs md:text-sm font-semibold text-slate-600 dark:text-gray-300 leading-snug mt-1 tracking-tight flex items-center gap-1.5 flex-wrap"
                  title={`${h.name} (${h.market})`}
                >
                  <span className="truncate max-w-[260px] md:max-w-[320px]">{h.name}</span>
                  <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-gray-400 font-mono text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                    {h.market}
                  </span>
                </div>
              </td>

              {/* Halt Time */}
              <td className="py-3.5 px-3">
                <div
                  className="font-mono text-xs md:text-sm font-bold text-slate-900 dark:text-gray-100"
                  title={formatNYTimeStr(haltedEpoch)}
                >
                  {formatRelativeTime(haltedEpoch)}
                </div>
              </td>

              {/* Resumption Time */}
              <td className="py-3.5 px-3">
                <div
                  className="font-mono text-xs md:text-sm font-bold text-slate-900 dark:text-gray-100"
                  title={formatNYTimeStr(resumedEpoch)}
                >
                  {formatRelativeTime(resumedEpoch)}
                </div>
              </td>

              {/* Reason Badge (Enlarged and high legibility) */}
              <td className="py-3.5 px-3">
                {code ? (
                  <span
                    title={reasonObj?.description}
                    className={`inline-block px-3 py-1 rounded-md font-mono text-xs md:text-sm font-extrabold shadow-sm border ${getCodeBadgeStyle(
                      code
                    )}`}
                  >
                    {code}
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-gray-500 font-mono">-</span>
                )}
              </td>

              {/* Kit Countdown Timer Pill */}
              <td className="py-3.5 px-3">
                {hasKitTimer ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      openPopoutTimerWindow(h);
                    }}
                    title="클릭하여 상세 타이머 창 열기"
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono font-black text-xs md:text-sm shadow-md transition-transform hover:scale-105 cursor-pointer ${kitGlowClass}`}
                  >
                    <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400 fill-amber-400/30" />
                    <span className="tracking-tight">{remTimeStr}</span>
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-extrabold shadow-sm">
                      {targetM}분
                    </span>
                  </div>
                ) : h.status === "resumed" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-extrabold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>재개 완료</span>
                  </span>
                ) : h.status === "quote_resumed" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-xs font-extrabold">
                    <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>호가 재개</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-gray-400 text-xs font-medium">
                    -
                  </span>
                )}
              </td>

              {/* Status Badge */}
              <td className="py-3.5 px-3">
                <span
                  className={`inline-block px-2.5 py-1 rounded-md text-xs font-mono font-bold ${
                    h.status === "halted"
                      ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40"
                      : h.status === "resumed"
                      ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40"
                      : "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40"
                  }`}
                >
                  {translateStatus(h.status)}
                </span>
              </td>

              {/* Actions */}
              <td className="py-3.5 px-4 text-center">
                <div
                  className="flex items-center justify-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Star Watchlist */}
                  <button
                    onClick={() => onToggleWatch(h.symbol)}
                    title="관심종목 등록/해제"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-[#2D3748] hover:bg-slate-100 dark:hover:bg-[#2D3748] text-slate-500 dark:text-gray-400 transition-all cursor-pointer"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        isWatched
                          ? "fill-amber-400 text-amber-500 dark:text-amber-400"
                          : "text-slate-400 dark:text-gray-500"
                      }`}
                    />
                  </button>

                  {/* Copy Kit Text */}
                  <button
                    onClick={() => onCopyKitText(h)}
                    title="킷 요정 텍스트 복사"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-[#2D3748] hover:bg-slate-100 dark:hover:bg-[#2D3748] text-slate-500 dark:text-gray-400 transition-all cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  {/* Ignore / Unignore */}
                  {onToggleIgnore && (
                    <button
                      onClick={() => onToggleIgnore(h.symbol)}
                      title={isIgnored ? "숨김 해제" : "숨기기 (상장폐지 등)"}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-[#2D3748] hover:bg-slate-100 dark:hover:bg-[#2D3748] text-slate-500 dark:text-gray-400 transition-all cursor-pointer"
                    >
                      <EyeOff className={`w-4 h-4 ${isIgnored ? "text-red-500" : ""}`} />
                    </button>
                  )}

                  {/* Popout Trigger */}
                  {hasKitTimer && (
                    <button
                      onClick={() => openPopoutTimerWindow(h)}
                      title="타이머 위젯(팝업) 띄우기"
                      className="p-1.5 rounded-lg border border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all cursor-pointer"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>

            {/* Expandable Detail Drawer */}
            {isOpen && (
              <tr className="bg-slate-50 dark:bg-[#111318] border-b border-slate-200 dark:border-[#2D3748]">
                <td colSpan={7} className="p-4 md:p-6">
                  <div className="border-l-4 border-l-blue-500 pl-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-mono font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>정지 상세 사유 ({code || "N/A"})</span>
                      </h4>
                      <p className="text-sm font-semibold text-slate-800 dark:text-gray-200 leading-relaxed">
                        {reasonObj?.description || "상세 설명이 없습니다."}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-white dark:bg-[#171923] border border-slate-200 dark:border-[#2D3748]">
                        <span className="text-slate-500 dark:text-gray-400 font-medium block mb-0.5">
                          오늘 정규장 킷 발생 횟수
                        </span>
                        <span className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400">
                          총 {targetCount}회 발동
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-gray-500 block mt-0.5 font-mono">
                          (미국 동부시간 09:30~16:00 기준)
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white dark:bg-[#171923] border border-slate-200 dark:border-[#2D3748]">
                        <span className="text-slate-500 dark:text-gray-400 font-medium block mb-0.5">
                          미국 동부 현지 시간 (ET)
                        </span>
                        <span className="text-xs font-bold font-mono text-slate-800 dark:text-gray-200">
                          {formatNYTimeStr(haltedEpoch)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white dark:bg-[#171923] border border-slate-200 dark:border-[#2D3748]">
                        <span className="text-slate-500 dark:text-gray-400 font-medium block mb-0.5">
                          변동성 한도 가격 (Pause Threshold Price)
                        </span>
                        <span className="text-xs font-bold font-mono text-slate-800 dark:text-gray-200">
                          {h.pause_threshold_price || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        );
      })}
    </tbody>
  );

  const renderMobileCards = (itemList: HaltItem[]) => (
    <div className="md:hidden divide-y divide-slate-200 dark:divide-[#2D3748]">
      {itemList.map((h) => {
        const key = h.id;
        const isWatched = watchedSymbols.has(h.symbol);
        const isIgnored = ignoredSymbols?.has(h.symbol) || false;
        const isOpen = openDetails.has(key);
        const haltedEpoch = h.halted_at_epoch_ms;
        const resumedEpoch = h.resumed_at_epoch_ms;
        const reasonObj = h.reasons && h.reasons[0] ? h.reasons[0] : null;
        const code = reasonObj ? reasonObj.code : "";

        const targetCount = getHaltCountForSymbolToday(
          allData,
          h.symbol,
          haltedEpoch
        );
        const hasKitTimer = h.status === "halted" && isKitCountdownReason(code) && Boolean(haltedEpoch);

        // Live Kit countdown calculation
        let remTimeStr = "-";
        let kitGlowClass = "";
        let targetM = 5;

        if (hasKitTimer && haltedEpoch) {
          while (haltedEpoch + targetM * 60 * 1000 <= nowMs) {
            targetM += 5;
          }
          const targetEpoch = haltedEpoch + targetM * 60 * 1000;
          const rem = remainingMs(targetEpoch);
          remTimeStr = fmtMinSecFromMs(rem);

          if (rem < 60 * 1000) {
            kitGlowClass = "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/50 animate-pulse";
          } else if (rem < 180 * 1000) {
            kitGlowClass = "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/50";
          } else {
            kitGlowClass = "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-500/50";
          }
        }

        return (
          <div
            key={key}
            className={`p-3.5 transition-colors ${
              isWatched 
                ? "bg-amber-50/80 dark:bg-amber-500/10 border-l-4 border-l-amber-500" 
                : isIgnored
                ? "opacity-50 grayscale bg-slate-100 dark:bg-slate-800"
                : ""
            }`}
          >
            {/* Top Row: Symbol, Toss Link, Halt Count & Badges */}
            <div className="flex items-center justify-between gap-1.5 mb-1.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span
                  onClick={() => onSelectSymbol(h.symbol)}
                  className="font-mono font-black text-xl text-blue-600 dark:text-blue-400 active:scale-95 transition-transform cursor-pointer"
                >
                  {h.symbol}
                </span>

                <a
                  href={`https://www.tossinvest.com/stocks/${encodeURIComponent(h.symbol)}`}
                  onClick={(e) => handleExternalLink(e, `https://www.tossinvest.com/stocks/${encodeURIComponent(h.symbol)}`)}
                  className="p-1 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30"
                  title="토스증권 바로가기"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-black border ${
                    targetCount > 1
                      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                  }`}
                >
                  {targetCount}회
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {code && (
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-extrabold border ${getCodeBadgeStyle(code)}`}>
                    {code}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                    h.status === "halted"
                      ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40"
                      : h.status === "resumed"
                      ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40"
                      : "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40"
                  }`}
                >
                  {translateStatus(h.status)}
                </span>
              </div>
            </div>

            {/* Name & Market */}
            <div className="text-xs font-semibold text-slate-600 dark:text-gray-300 mb-2.5 flex items-center gap-1.5">
              <span className="truncate max-w-[200px]">{h.name}</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-gray-400 font-mono text-[10px] border border-slate-200 dark:border-slate-700">
                {h.market}
              </span>
            </div>

            {/* Live Kit Timer Banner on Mobile */}
            {hasKitTimer && (
              <div
                onClick={() => openPopoutTimerWindow(h)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border font-mono font-black text-xs shadow-sm mb-2.5 cursor-pointer ${kitGlowClass}`}
              >
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400 fill-amber-400/30" />
                  <span>킷 카운트다운</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tracking-tight text-sm">{remTimeStr}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-extrabold">
                    {targetM}분
                  </span>
                </div>
              </div>
            )}

            {/* Timestamps Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-50 dark:bg-[#111318] p-2 rounded-lg border border-slate-200 dark:border-[#2D3748] mb-2.5">
              <div>
                <span className="text-slate-400 dark:text-gray-500 block text-[10px]">정지시각</span>
                <span className="font-bold text-slate-800 dark:text-gray-200">{formatRelativeTime(haltedEpoch)}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-gray-500 block text-[10px]">재개시각</span>
                <span className="font-bold text-slate-800 dark:text-gray-200">{formatRelativeTime(resumedEpoch)}</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-[#2D3748]/60">
              <button
                onClick={() => toggleDetail(key)}
                className="text-xs font-bold text-slate-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer"
              >
                <span>{isOpen ? "상세 닫기 ▲" : "상세 사유 ▼"}</span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onToggleWatch(h.symbol)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-[#2D3748] hover:bg-slate-100 dark:hover:bg-[#2D3748] cursor-pointer"
                  title="관심종목"
                >
                  <Star className={`w-3.5 h-3.5 ${isWatched ? "fill-amber-400 text-amber-500" : "text-slate-400"}`} />
                </button>

                <button
                  onClick={() => onCopyKitText(h)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-[#2D3748] hover:bg-slate-100 dark:hover:bg-[#2D3748] cursor-pointer"
                  title="킷 복사"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-600 dark:text-gray-300" />
                </button>

                {onToggleIgnore && (
                  <button
                    onClick={() => onToggleIgnore(h.symbol)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-[#2D3748] hover:bg-slate-100 dark:hover:bg-[#2D3748] cursor-pointer"
                    title={isIgnored ? "숨김 해제" : "숨기기"}
                  >
                    <EyeOff className={`w-3.5 h-3.5 ${isIgnored ? "text-red-500" : "text-slate-600 dark:text-gray-300"}`} />
                  </button>
                )}

                {hasKitTimer && (
                  <button
                    onClick={() => openPopoutTimerWindow(h)}
                    className="p-1.5 rounded-lg border border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 cursor-pointer"
                    title="타이머 위젯(팝업) 띄우기"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Expanded Drawer */}
            {isOpen && (
              <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-[#2D3748] space-y-2 text-xs">
                <div>
                  <h4 className="font-mono font-bold text-slate-600 dark:text-gray-300 uppercase flex items-center gap-1 mb-0.5">
                    <Info className="w-3.5 h-3.5 text-blue-500" />
                    <span>정지 상세 사유 ({code || "N/A"})</span>
                  </h4>
                  <p className="font-medium text-slate-800 dark:text-gray-200">
                    {reasonObj?.description || "상세 설명이 없습니다."}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-1.5 pt-1 text-[11px] font-mono">
                  <div className="p-2 rounded bg-slate-50 dark:bg-[#111318] border border-slate-200 dark:border-[#2D3748]">
                    <span className="text-slate-400 block">미국 동부 현지 시간 (ET)</span>
                    <span className="font-bold text-slate-700 dark:text-gray-300">{formatNYTimeStr(haltedEpoch)}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 dark:bg-[#111318] border border-slate-200 dark:border-[#2D3748]">
                    <span className="text-slate-400 block">변동성 한도 가격 (Pause Threshold)</span>
                    <span className="font-bold text-slate-700 dark:text-gray-300">{h.pause_threshold_price || "N/A"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6 mb-8">
      {/* SECTION 1: Active Kit Countdowns */}
      <div className="w-full rounded-xl border border-amber-300/80 dark:border-amber-500/40 bg-white dark:bg-[#1A202C] shadow-md overflow-hidden transition-colors">
        <div className="px-5 py-3.5 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/30 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500 fill-amber-400/40 animate-bounce" />
            <h3 className="text-sm md:text-base font-black text-amber-900 dark:text-amber-200 tracking-tight">
              실시간 킷 카운트다운 진행 중
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-black font-mono bg-amber-500 text-slate-950">
              {activeCountdownItems.length}개
            </span>
          </div>
          <span className="text-xs font-bold text-amber-800 dark:text-amber-300 font-mono">
            실시간 추적
          </span>
        </div>

        {activeCountdownItems.length > 0 ? (
          <>
            <div className="w-full overflow-x-auto hidden md:block">
              <table className="w-full text-left text-xs md:text-sm border-collapse">
                {renderTableHeader()}
                {renderTableRows(activeCountdownItems)}
              </table>
            </div>
            {renderMobileCards(activeCountdownItems)}
          </>
        ) : (
          <div className="p-8 text-center bg-amber-50/30 dark:bg-amber-500/5">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-1">
              현재 실시간 킷 카운트다운 진행 중인 종목이 없습니다.
            </p>
            <p className="text-xs font-mono text-slate-500 dark:text-gray-400">
              새로운 변동성 정지(LULD) 발동 시 즉시 이 섹션에 카운트다운 타이머가 표시됩니다.
            </p>
          </div>
        )}
      </div>

      {/* SECTION 2: Other Items & Recent History */}
      <div className="w-full rounded-xl border border-slate-200 dark:border-[#2D3748] bg-white dark:bg-[#1A202C] shadow-md overflow-hidden transition-colors">
        <div className="px-5 py-3.5 bg-slate-100/90 dark:bg-[#111318] border-b border-slate-200 dark:border-[#2D3748] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ListFilter className="w-4 h-4 text-slate-600 dark:text-gray-300" />
            <h3 className="text-sm md:text-base font-black text-slate-800 dark:text-gray-200 tracking-tight">
              거래 재개 완료 및 기타 정지 기록
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-gray-200">
              {otherItems.length}개
            </span>
          </div>

          {otherItems.length > 4 && (
            <button
              onClick={() => setIsExpandedOther(!isExpandedOther)}
              className="px-3 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-gray-200 font-bold text-xs font-mono transition-all cursor-pointer flex items-center gap-1"
            >
              <span>{isExpandedOther ? "접기 ▲" : `전체 보기 (${otherItems.length}개) ▼`}</span>
            </button>
          )}
        </div>

        {otherItems.length > 0 ? (
          <>
            <div className="w-full overflow-x-auto hidden md:block">
              <table className="w-full text-left text-xs md:text-sm border-collapse">
                {renderTableHeader()}
                {renderTableRows(visibleOtherItems)}
              </table>
            </div>
            {renderMobileCards(visibleOtherItems)}

            {otherItems.length > 4 && (
              <div className="p-3 text-center bg-slate-50 dark:bg-[#111318] border-t border-slate-200 dark:border-[#2D3748]">
                <button
                  onClick={() => setIsExpandedOther(!isExpandedOther)}
                  className="px-5 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 font-extrabold font-mono text-xs shadow-sm transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  {isExpandedOther ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      <span>기록 목록 접기</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      <span>기록 {otherItems.length - 4}개 더보기</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center bg-slate-50/50 dark:bg-[#111318]/50">
            <p className="text-xs font-mono text-slate-500 dark:text-gray-400">
              추가 거래정지 및 재개 기록이 없습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
