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
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* Active Halts Badge */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2D3748] bg-white dark:bg-[#1A202C] shadow-sm">
        <AlertCircle className="w-4 h-4 text-rose-500" />
        <span className="text-xs font-bold text-slate-600 dark:text-gray-300">현재 정지:</span>
        <span className="text-sm font-black font-mono text-rose-600 dark:text-rose-400">{stats.activeHalted}건</span>
      </div>

      {/* Today Total Badge */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2D3748] bg-white dark:bg-[#1A202C] shadow-sm">
        <Activity className="w-4 h-4 text-blue-500" />
        <span className="text-xs font-bold text-slate-600 dark:text-gray-300">오늘 누적:</span>
        <span className="text-sm font-black font-mono text-blue-600 dark:text-blue-400">{stats.total}건</span>
      </div>

      {/* Main Reason Badge */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2D3748] bg-white dark:bg-[#1A202C] shadow-sm">
        <Zap className="w-4 h-4 text-amber-500" />
        <span className="text-xs font-bold text-slate-600 dark:text-gray-300">LULD 킷:</span>
        <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">{stats.volatilityLuld}건</span>
      </div>

      {/* Resumed Count Badge */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2D3748] bg-white dark:bg-[#1A202C] shadow-sm">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        <span className="text-xs font-bold text-slate-600 dark:text-gray-300">재개 완료:</span>
        <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">{stats.resumed}건</span>
      </div>

      {/* Sync Time Badge */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2D3748] bg-white dark:bg-[#1A202C] shadow-sm">
        <Clock className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-bold text-slate-600 dark:text-gray-300">동기화:</span>
        <span className="text-sm font-black font-mono text-slate-800 dark:text-gray-200">{lastUpdatedText}</span>
      </div>
    </div>
  );
};

