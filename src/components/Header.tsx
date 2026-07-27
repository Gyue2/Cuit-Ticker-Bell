import React, { useState, useEffect } from "react";
import { Sun, Moon, RefreshCw, Volume2, VolumeX, Zap, ShieldCheck, Activity, Bell, BellOff, Megaphone, MegaphoneOff, Settings } from "lucide-react";
import { PerfStats } from "../types";

interface HeaderProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  isWsConnected: boolean;
  isPolling: boolean;
  isFetching: boolean;
  intervalMs: number;
  onChangeInterval: (val: number) => void;
  onRefresh: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  perfStats?: PerfStats | null;
  notificationStatus: NotificationPermission;
  onRequestNotification: () => void;
  soundType: "A" | "B" | "C";
  onChangeSoundType: (val: "A" | "B" | "C") => void;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  autostartEnabled: boolean;
  onToggleAutostart: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  onToggleTheme,
  isWsConnected,
  isPolling,
  isFetching,
  intervalMs,
  onChangeInterval,
  onRefresh,
  soundEnabled,
  onToggleSound,
  perfStats,
  notificationStatus,
  onRequestNotification,
  soundType,
  onChangeSoundType,
  ttsEnabled,
  onToggleTts,
  autostartEnabled,
  onToggleAutostart,
  onOpenSettings,
}) => {
  const [countdownMs, setCountdownMs] = useState(intervalMs);

  // Reset countdown when manual refresh occurs or intervalMs changes
  useEffect(() => {
    setCountdownMs(intervalMs);
  }, [intervalMs, isFetching]);

  // Tick countdown timer smoothly
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownMs((prev) => {
        if (prev <= 100) return intervalMs;
        return prev - 100;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [intervalMs]);

  const handleManualRefresh = () => {
    setCountdownMs(intervalMs);
    onRefresh();
  };

  const remainingSec = (countdownMs / 1000).toFixed(1);

  return (
    <header className="flex flex-col gap-3 p-4 md:px-6 rounded-xl bg-white dark:bg-[#1A202C] border border-slate-200 dark:border-[#2D3748] shadow-md mb-6 transition-colors">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title and Connection Badge */}
        <div className="flex items-center justify-between sm:justify-start gap-3 flex-wrap w-full md:w-auto">
          <div className="flex items-center space-x-3">
            <img
              src="/icon.png"
              alt="Cuit Ticker Bell"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-md object-cover"
            />
            <div>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Cuit Ticker Bell
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-slate-100 dark:bg-[#2D3748]/80 px-2.5 py-1 rounded-full border border-slate-200 dark:border-gray-700">
            <span
              className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${
                isWsConnected
                  ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                  : isPolling
                  ? "bg-amber-400 animate-pulse"
                  : "bg-gray-400"
              }`}
            ></span>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 tracking-wide">
              {isWsConnected
                ? "LIVE 연결"
                : isPolling
                ? "자동 수집 중"
                : "연결 준비 중..."}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between sm:justify-end">
          
          {/* Countdown Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={isFetching}
            title="클릭 시 즉시 갱신합니다"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400 active:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span className="font-mono">{isFetching ? "갱신 중..." : `${remainingSec}s`}</span>
          </button>

          {/* Theme and Settings Group */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <button
              onClick={onToggleTheme}
              title={theme === "dark" ? "라이트 모드로 변경" : "다크 모드로 변경"}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#171923] dark:hover:bg-[#2D3748] text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-[#2D3748] transition-all cursor-pointer"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            {/* Settings Button */}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                title="설정 (Settings)"
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#171923] dark:hover:bg-[#2D3748] text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-[#2D3748] transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Optimization Performance Badges */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-[#2D3748]/60 text-[11px] font-mono text-slate-700 dark:text-gray-300">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 dark:bg-[#171923] border border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
          <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>조건부 GET:</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {perfStats ? `${perfStats.hit304Count}회 (${Math.round((perfStats.totalBytesSaved || 0) / 1024)}KB 절약)` : "작동 중"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 dark:bg-[#171923] border border-blue-300 dark:border-blue-500/30 text-blue-700 dark:text-blue-400">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>소켓 유지:</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {perfStats?.lastLatencyMs ? `${perfStats.lastLatencyMs}ms` : "연결됨"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 dark:bg-[#171923] border border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400">
          <Activity className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>비동기 파이프라인:</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {perfStats?.totalPolls ? `${perfStats.totalPolls}회 수집 (평균 ${perfStats.avgLatencyMs || 15}ms)` : "실행 중"}
          </span>
        </div>
      </div>
    </header>
  );
};


