import React from "react";
import { Search, Star } from "lucide-react";

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  marketFilter: string;
  onMarketChange: (m: string) => void;
  statusFilter: string;
  onStatusChange: (s: string) => void;
  reasonFilter: string;
  onReasonChange: (r: string) => void;
  watchlistOnly: boolean;
  onToggleWatchlistOnly: () => void;
  watchedCount: number;
  showIgnored?: boolean;
  onToggleShowIgnored?: () => void;
  ignoredCount?: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  marketFilter,
  onMarketChange,
  statusFilter,
  onStatusChange,
  reasonFilter,
  onReasonChange,
  watchlistOnly,
  onToggleWatchlistOnly,
  watchedCount,
  showIgnored,
  onToggleShowIgnored,
  ignoredCount,
}) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 md:p-4 mb-6 rounded-xl bg-white dark:bg-[#1A202C] border border-slate-200 dark:border-[#2D3748] shadow-md transition-colors">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-center gap-2.5 flex-1">
        {/* Search */}
        <div className="relative col-span-1 sm:col-span-2 md:flex-1 md:min-w-[200px] md:max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="티커 / 종목명 검색 (예: RADX, TSLA)..."
            className="w-full pl-9 pr-3 py-2 text-xs md:text-sm font-semibold rounded-lg bg-slate-50 dark:bg-[#171923] border border-slate-300 dark:border-[#2D3748] text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Market Select */}
        <div className="w-full sm:w-auto">
          <select
            value={marketFilter}
            onChange={(e) => onMarketChange(e.target.value)}
            className="w-full sm:w-auto text-xs md:text-sm font-semibold px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#171923] border border-slate-300 dark:border-[#2D3748] text-slate-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">시장: 전체</option>
            <option value="NASDAQ">NASDAQ (나스닥)</option>
            <option value="NYSE">NYSE (뉴욕증권거래소)</option>
            <option value="AMEX">AMEX (아멕스)</option>
            <option value="BATS">BATS</option>
          </select>
        </div>

        {/* Status Select */}
        <div className="w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full sm:w-auto text-xs md:text-sm font-semibold px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#171923] border border-slate-300 dark:border-[#2D3748] text-slate-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">상태: 전체</option>
            <option value="halted">🔴 거래정지 중 (Halted)</option>
            <option value="resumed">🟢 거래재개 완료 (Resumed)</option>
            <option value="quote_resumed">🟡 호가재개 (Quote Resumed)</option>
          </select>
        </div>

        {/* Reason Code Select */}
        <div className="w-full sm:w-auto">
          <select
            value={reasonFilter}
            onChange={(e) => onReasonChange(e.target.value)}
            className="w-full sm:w-auto text-xs md:text-sm font-semibold px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#171923] border border-slate-300 dark:border-[#2D3748] text-slate-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">사유: 전체</option>
            <option value="KIT_VOLATILITY">⚡ 변동성 정지 / LULD (킷)</option>
            <option value="LUDP">LUDP (변동성 완화 장치)</option>
            <option value="M">M (변동성 정지)</option>
            <option value="T1">T1 (주요 뉴스 발표 대기)</option>
            <option value="T2">T2 (주요 뉴스 공시 발표)</option>
            <option value="T12">T12 (추가 정보 요구)</option>
            <option value="H10">H10 (SEC 거래 정지)</option>
          </select>
        </div>
      </div>

      {/* Toggles */}
      <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
        {onToggleShowIgnored && (
          <button
            onClick={onToggleShowIgnored}
            className={`w-full sm:w-auto justify-center flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs md:text-sm font-bold transition-all cursor-pointer ${
              showIgnored
                ? "bg-slate-700 border-slate-600 text-white shadow-sm"
                : "bg-slate-50 dark:bg-[#171923] border-slate-300 dark:border-[#2D3748] text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-[#2D3748]"
            }`}
            title="숨긴 종목 표시 켜기/끄기"
          >
            <span>숨김 해제 보기</span>
            {ignoredCount !== undefined && ignoredCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-400 text-slate-900 font-mono">
                {ignoredCount}
              </span>
            )}
          </button>
        )}

        {/* Watchlist Toggle */}
        <button
          onClick={onToggleWatchlistOnly}
          className={`w-full sm:w-auto justify-center flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs md:text-sm font-bold transition-all cursor-pointer ${
            watchlistOnly
              ? "bg-amber-100 dark:bg-amber-500/20 border-amber-400 dark:border-amber-500/50 text-amber-900 dark:text-amber-200 shadow-sm"
              : "bg-slate-50 dark:bg-[#171923] border-slate-300 dark:border-[#2D3748] text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-[#2D3748]"
          }`}
        >
          <Star className={`w-4 h-4 ${watchlistOnly ? "fill-amber-400 text-amber-500 dark:text-amber-400" : "text-slate-400 dark:text-gray-400"}`} />
          <span>관심종목만 보기</span>
          {watchedCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950 font-mono">
              {watchedCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

