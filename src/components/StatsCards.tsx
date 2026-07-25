import React from "react";
import { StatsSummary } from "../types";
import { AlertCircle, Activity, CheckCircle2, Zap, Clock } from "lucide-react";

interface StatsCardsProps {
  stats: StatsSummary;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const lastUpdatedText = stats.lastUpdatedMs
    ? new Date(stats.lastUpdatedMs).toLocaleTimeString("ko-KR", { hour12: false })
    : "-";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {/* Active Halts Card */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-[#2D3748] bg-white dark:bg-[#171923] shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider mb-2">
          <span className="truncate">현재 정지 종목</span>
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 ml-1" />
        </div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-2xl md:text-3xl font-extrabold font-mono text-rose-600 dark:text-rose-400">{stats.activeHalted}</span>
          <span className="text-xs font-bold text-slate-600 dark:text-gray-300">개 정지 중</span>
        </div>
      </div>

      {/* Today Total Card */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-[#2D3748] bg-white dark:bg-[#171923] shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider mb-2">
          <span className="truncate">오늘 누적 수집</span>
          <Activity className="w-4 h-4 text-blue-500 shrink-0 ml-1" />
        </div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-2xl md:text-3xl font-extrabold font-mono text-blue-600 dark:text-blue-400">{stats.total}</span>
          <span className="text-xs font-bold text-slate-600 dark:text-gray-300">건 감지</span>
        </div>
      </div>

      {/* Main Reason Card */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-[#2D3748] bg-white dark:bg-[#171923] shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider mb-2">
          <span className="truncate">주요 정지 사유</span>
          <Zap className="w-4 h-4 text-amber-500 shrink-0 ml-1" />
        </div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-2xl md:text-3xl font-extrabold font-mono text-amber-600 dark:text-amber-400">LULD</span>
          <span className="text-xs font-bold text-slate-600 dark:text-gray-300">({stats.volatilityLuld}건 킷)</span>
        </div>
      </div>

      {/* Resumed Count Card */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-[#2D3748] bg-white dark:bg-[#171923] shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider mb-2">
          <span className="truncate">거래 재개 완료</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 ml-1" />
        </div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-2xl md:text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">{stats.resumed}</span>
          <span className="text-xs font-bold text-slate-600 dark:text-gray-300">건 재개</span>
        </div>
      </div>

      {/* Sync Time Card */}
      <div className="col-span-2 sm:col-span-1 p-4 rounded-xl border border-slate-200 dark:border-[#2D3748] bg-white dark:bg-[#171923] shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider mb-2">
          <span className="truncate">동기화 시각</span>
          <Clock className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
        </div>
        <div className="text-xl md:text-2xl font-black font-mono text-slate-800 dark:text-gray-200">
          {lastUpdatedText}
        </div>
      </div>
    </div>
  );
};

