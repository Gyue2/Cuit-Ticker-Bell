import React, { useState, useEffect } from "react";
import { Sun, Moon, RefreshCw, Volume2, VolumeX, Zap, ShieldCheck, Activity, Bell, BellOff, Megaphone, MegaphoneOff } from "lucide-react";
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
          {/* Refresh Interval Selector & RSS Safety Indicator */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#171923] p-1.5 rounded-lg border border-slate-200 dark:border-[#2D3748]">
            <label htmlFor="poll-interval" className="text-[11px] font-mono font-bold text-slate-700 dark:text-gray-300 pl-1 whitespace-nowrap">
              화면 갱신:
            </label>
            <select
              id="poll-interval"
              value={intervalMs}
              onChange={(e) => onChangeInterval(Number(e.target.value))}
              className="text-xs font-mono font-bold bg-white dark:bg-[#1A202C] text-slate-800 dark:text-gray-200 px-2 py-1 rounded border border-slate-300 dark:border-[#2D3748] focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value={1000}>1초 (초고속 · RSS Safe)</option>
              <option value={2000}>2초</option>
              <option value={3000}>3초</option>
              <option value={5000}>5초</option>
            </select>
            <span
              title="화면을 1초마다 갱신하더라도 백엔드 서버가 NASDAQ RSS를 HTTP 304(캐시) 조건부 요청으로 1초당 1회만 단일 수집하므로 RSS 과부하가 0%입니다."
              className="hidden lg:inline-flex items-center text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50 cursor-help"
            >
              🛡️ RSS 100% 안전
            </span>
          </div>

          {/* Notification Permission Button (Only show if default/denied) */}
          {notificationStatus !== "granted" && (
            <button
              onClick={onRequestNotification}
              title="윈도우 바탕화면 알림 허용하기"
              className="p-2 rounded-lg border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-all flex items-center gap-1.5 text-xs font-mono font-bold cursor-pointer shadow-sm animate-pulse"
            >
              <BellOff className="w-4 h-4" />
              <span className="hidden sm:inline">알림 권한 필요</span>
            </button>
          )}

            {/* Sound Toggle */}
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleSound}
                title={soundEnabled ? "소리 끄기" : "소리 켜기"}
                className={`p-2 rounded-lg border transition-all cursor-pointer ${
                  soundEnabled
                    ? "bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              
              {/* Sound Type Selection */}
              {soundEnabled && (
                <select
                  value={soundType}
                  onChange={(e) => onChangeSoundType(e.target.value as "A"|"B"|"C")}
                  className="bg-slate-100 dark:bg-[#1A202C] border border-slate-300 dark:border-[#2D3748] text-slate-700 dark:text-gray-300 rounded px-1.5 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  title="알람 소리 종류 변경"
                >
                  <option value="A">소리 A</option>
                  <option value="B">소리 B</option>
                  <option value="C">소리 C</option>
                </select>
              )}
            </div>

            {/* TTS Toggle */}
            <button
              onClick={onToggleTts}
              title={ttsEnabled ? "음성 브리핑(TTS) 끄기" : "음성 브리핑(TTS) 켜기"}
              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                ttsEnabled
                  ? "bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
              }`}
            >
              {ttsEnabled ? <Megaphone className="w-4 h-4" /> : <MegaphoneOff className="w-4 h-4" />}
            </button>

            {/* Autostart Toggle (Windows Only) */}
            {window.__TAURI_INTERNALS__ && (
              <button
                onClick={onToggleAutostart}
                title={autostartEnabled ? "윈도우 시작 시 자동실행 끄기" : "윈도우 시작 시 자동실행 켜기"}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  autostartEnabled
                    ? "bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">자동실행</span>
              </button>
            )}

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


