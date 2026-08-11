import React, { useEffect, useState, useRef } from "react";
import { X, CheckCircle2, Copy, Check, Pin, PinOff } from "lucide-react";
import { HaltItem } from "../types";
import { remainingMs, pad2, getSyncedNow, updateServerTimeOffset, getKitIntervals, getHaltCountForSymbolToday } from "../utils/time";
import { invoke } from "@tauri-apps/api/core";
import { generateKitCopyText } from "../utils/copyTextGenerator";
import { isTauriEnvironment, setAlwaysOnTop, closeCurrentWindow } from "../utils/tauriWindow";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

const fmtDigitalTimer = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const msRem = Math.max(0, ms % 1000);
  const msStr = String(Math.floor(msRem / 100));
  return { main: `${pad2(m)}:${pad2(s)}`, ms: msStr };
};

/** Format epoch ms → "HH:MM:SS ET" */
const fmtTargetTime = (epochMs: number): string => {
  const d = new Date(epochMs);
  // Convert to US/Eastern (ET)
  const etStr = d.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${etStr} ET`;
};

const IconButton = ({ onClick, icon, activeIcon, active, title, className = "" }: any) => {
  const displayIcon = active && activeIcon ? activeIcon : icon;
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded transition-all duration-200 outline-none ${
        active
          ? "bg-blue-500/20 text-blue-400"
          : "bg-transparent hover:bg-white/10 text-slate-400 hover:text-white"
      } ${className}`}
    >
      {React.cloneElement(displayIcon, { className: "w-4 h-4" })}
    </button>
  );
};

const OPACITY_KEY = "ctb_widget_opacity";

export const PopoutTimerView: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const [nowMs, setNowMs] = useState(getSyncedNow());
  const [isPinned, setIsPinned] = useState(true);
  const [liveItem, setLiveItem] = useState<HaltItem | null>(null);
  const [allData, setAllData] = useState<HaltItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [opacity, setOpacity] = useState<number>(() => {
    const saved = localStorage.getItem(OPACITY_KEY);
    return saved ? parseFloat(saved) : 0.92;
  });
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);

  // Ensure body is transparent for frameless widget, and resize window if in Tauri
  useEffect(() => {
    document.body.className = "dark bg-transparent text-white overflow-hidden";
    if (isTauriEnvironment()) {
      getCurrentWindow().setSize(new LogicalSize(240, 160)).catch(console.error);
    }
    
    // Clean up trackedPopouts when window closes
    const handleUnload = () => {
      try {
        const symbol = new URLSearchParams(window.location.search).get("symbol");
        if (symbol) {
          const existing = JSON.parse(localStorage.getItem("trackedPopouts") || "[]");
          const updated = existing.filter((s: string) => s !== symbol);
          localStorage.setItem("trackedPopouts", JSON.stringify(updated));
        }
      } catch (e) {}
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // Set initial always-on-top if in Tauri
  useEffect(() => {
    if (isTauriEnvironment()) setAlwaysOnTop(isPinned);
  }, [isPinned]);

  const handleTogglePin = async () => {
    const next = !isPinned;
    setIsPinned(next);
    if (isTauriEnvironment()) await setAlwaysOnTop(next);
  };

  // Live timer tick using synced server time (30ms for smooth ms rendering)
  useEffect(() => {
    const timer = setInterval(() => setNowMs(getSyncedNow()), 30);
    return () => clearInterval(timer);
  }, []);

  const symbol = params.get("symbol") || "UNKNOWN";
  const initialName = params.get("name") || "";
  const initialHalted = parseInt(params.get("haltedAt") || params.get("halted") || Date.now().toString(), 10);
  const reasonCode = params.get("reason") || "LUDP";

  // Listen to Tauri events or poll server for status updates
  useEffect(() => {
    let unlistenTauri: (() => void) | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const handleNewData = (data: HaltItem[], serverTime?: number) => {
      if (serverTime) {
        updateServerTimeOffset(serverTime);
        setNowMs(getSyncedNow());
      }
      setAllData(data);
      const found = data.find((h) => h.symbol === symbol);
      setLiveItem((prevLiveItem) => {
        if (found) {
          return found;
        } else if (data.length > 0 && prevLiveItem) {
          return { ...prevLiveItem, status: "resumed" };
        }
        return prevLiveItem;
      });
    };

    const setup = async () => {
      if (isTauriEnvironment()) {
        try {
          const { listen } = await import("@tauri-apps/api/event");
          unlistenTauri = await listen("halt-data-update", (event: any) => {
            const msg = event.payload;
            if (msg.type === "data" && Array.isArray(msg.data)) {
              handleNewData(msg.data, msg.serverTime);
            }
          });
        } catch (e) {
          console.error("Popout tauri listen error:", e);
        }
      } else {
        const checkStatus = async () => {
          try {
            const res = await fetch("/halts", { cache: "no-store" });
            if (res.ok) {
              const json = await res.json();
              if (Array.isArray(json.data)) {
                handleNewData(json.data, json.serverTime);
              }
            }
          } catch (e) {
            console.error("Popout poll error:", e);
          }
        };

        checkStatus();
        pollInterval = setInterval(checkStatus, 300);
      }
    };

    setup();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (unlistenTauri) unlistenTauri();
    };
  }, [symbol]);

  const prevIdRef = useRef<string | null>(null);
  const [showNewHaltFlash, setShowNewHaltFlash] = useState(false);

  // Detect when a completely new halt starts for the same symbol (ID change)
  useEffect(() => {
    if (liveItem) {
      if (prevIdRef.current && prevIdRef.current !== liveItem.id) {
        setShowNewHaltFlash(true);
        // Play notification chime for the new halt
        invoke("play_sound", { name: "notification" }).catch(() => {});
        setTimeout(() => setShowNewHaltFlash(false), 3000);
      }
      prevIdRef.current = liveItem.id;
    }
  }, [liveItem?.id]);

  const name = liveItem?.name || initialName;
  const status = liveItem?.status || "halted";
  const haltedEpoch = liveItem?.halted_at_epoch_ms || initialHalted;

  // Auto-close when resumed
  useEffect(() => {
    if (status === "resumed" || status === "quote_resumed") {
      const closeTimer = setTimeout(() => closeCurrentWindow(), 2000);
      return () => clearTimeout(closeTimer);
    }
  }, [status]);

  // Countdown calculations
  const GRACE_PERIOD_MS = 20000;
  let targetM = 5;
  while (haltedEpoch + targetM * 60 * 1000 + GRACE_PERIOD_MS <= nowMs) targetM += 5;
  const targetEpoch = haltedEpoch + targetM * 60 * 1000;
  const rem = remainingMs(targetEpoch, nowMs);

  const intervals = getKitIntervals(haltedEpoch, nowMs);
  const tList = intervals.map((mn) => haltedEpoch + mn * 60 * 1000);

  const handleCopy = () => {
    const targetCount = getHaltCountForSymbolToday(allData, symbol, haltedEpoch);
    const text = generateKitCopyText(symbol, name, targetCount, tList, intervals, reasonCode);
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  const handleOpacityChange = (val: number) => {
    setOpacity(val);
    localStorage.setItem(OPACITY_KEY, String(val));
  };

  return (
    <div
      style={{ opacity }}
      className="h-screen w-full flex flex-col text-white overflow-hidden relative selection:bg-blue-500/30 rounded-xl border border-white/10 shadow-2xl"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-[#0A0D14]/95 backdrop-blur-lg rounded-xl" />
      <div className="absolute top-[-50%] left-[-20%] w-[140%] h-[100%] bg-blue-600/10 blur-[80px] rounded-full pointer-events-none" />

      {/* Header Bar */}
      <div className="relative z-10 flex items-center justify-between px-3 py-1.5 bg-black/20 border-b border-white/5" data-tauri-drag-region>
        <div className="flex items-center gap-2 pointer-events-none">
          <span className="font-black text-lg tracking-tight text-blue-400 drop-shadow-sm">{symbol}</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30">
            {reasonCode}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Opacity toggle */}
          <button
            onClick={() => setShowOpacitySlider(p => !p)}
            title="투명도 조절"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-white transition-all text-[10px] font-bold"
          >
            {Math.round(opacity * 100)}%
          </button>
          <IconButton active={isPinned} onClick={handleTogglePin} icon={<Pin />} activeIcon={<PinOff />} title="항상 위 고정" />
          <IconButton onClick={handleCopy} icon={copied ? <Check className="text-emerald-400" /> : <Copy />} title="복사" />
          <IconButton onClick={() => closeCurrentWindow()} icon={<X />} className="hover:bg-red-500/20 hover:text-red-400 ml-1" title="닫기" />
        </div>
      </div>

      {/* Opacity slider (shown on demand) */}
      {showOpacitySlider && (
        <div className="relative z-20 flex items-center gap-2 px-3 py-1.5 bg-black/30 border-b border-white/5">
          <span className="text-[10px] text-slate-400 whitespace-nowrap">투명도</span>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={opacity}
            onChange={e => handleOpacityChange(parseFloat(e.target.value))}
            className="flex-1 h-1 accent-blue-400 cursor-pointer"
          />
          <span className="text-[10px] text-blue-400 font-mono w-8 text-right">{Math.round(opacity * 100)}%</span>
        </div>
      )}

      {/* Main Timer Body */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-1 sm:p-2 min-h-0 @container" data-tauri-drag-region>
        {showNewHaltFlash ? (
          <div className="flex flex-col items-center justify-center h-full animate-pulse pointer-events-none">
            <span className="text-[min(8cqw,20cqh)] font-black text-rose-400 tracking-tight mb-1 text-center leading-tight">
              {getHaltCountForSymbolToday(allData, symbol, haltedEpoch)}회 킷 발동!
            </span>
          </div>
        ) : status === "resumed" || status === "quote_resumed" ? (
          <div className="flex flex-col items-center justify-center h-full animate-fadeIn pointer-events-none">
            <CheckCircle2 className="w-[min(15cqw,30cqh)] h-[min(15cqw,30cqh)] text-emerald-400 mb-1 sm:mb-2 drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]" />
            <span className="text-[min(8cqw,20cqh)] font-black text-emerald-400 tracking-tight">
              {status === "quote_resumed" ? "호가 재개" : "재개 완료"}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center w-full h-full pointer-events-none">
            {/* 목표 시각 (작게) */}
            <div className="text-[min(3.5cqw,9cqh)] font-mono text-slate-400/70 tracking-widest mb-[-2px]">
              {fmtTargetTime(targetEpoch)}
            </div>

            {/* 카운트다운 숫자 */}
            <div
              onClick={() => {
                const url = `https://www.tossinvest.com/stocks/${encodeURIComponent(symbol)}`;
                if (isTauriEnvironment()) {
                  invoke("open_url", { url }).catch(console.error);
                } else {
                  window.open(url, "_blank");
                }
              }}
              className="flex items-baseline justify-center text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 drop-shadow-lg pointer-events-auto cursor-pointer hover:scale-[1.03] hover:from-blue-200 hover:to-blue-500 active:scale-[0.97] transition-all"
              title="토스증권에서 확인하기"
            >
              <span className="text-[min(24cqw,58cqh)] leading-none font-black font-mono tracking-tighter">{fmtDigitalTimer(rem).main}</span>
              <span className="text-[min(10cqw,25cqh)] leading-none font-bold font-mono tracking-tighter opacity-70 ml-1 mb-[min(2cqw,4cqh)]">.{fmtDigitalTimer(rem).ms}</span>
            </div>

            {/* 몇 분 킷 */}
            <div className="text-[min(5cqw,13cqh)] font-bold tracking-widest text-blue-400/80 uppercase mt-0.5">
              {rem === 0 ? "데이터 동기화 중..." : `${targetM}분 예상`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
