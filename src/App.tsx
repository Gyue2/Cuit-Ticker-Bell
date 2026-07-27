import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  HaltItem,
  SortConfig,
  SortColumn,
  StatsSummary,
  PerfStats,
} from "./types";
import { Header } from "./components/Header";
import { StatsCards } from "./components/StatsCards";
import { FilterBar } from "./components/FilterBar";
import { HaltTable } from "./components/HaltTable";
import { PopoutTimerView } from "./components/PopoutTimerView";
import { Toast } from "./components/Toast";
import { SettingsModal } from "./components/SettingsModal";
import { playNotificationChime, playResumeChime, initAudioContext, playTTSAnnouncement } from "./utils/sound";
import { pad2, updateServerTimeOffset, getKitIntervals, getSyncedNow, getHaltCountForSymbolToday } from "./utils/time";
import { isTauriEnvironment, createTauriPopoutWindow } from "./utils/tauriWindow";
import { isPermissionGranted, requestPermission, sendNotification, onAction } from "@tauri-apps/plugin-notification";
import { enable as autostartEnable, disable as autostartDisable, isEnabled as autostartIsEnabled } from "@tauri-apps/plugin-autostart";
import { generateKitCopyText } from "./utils/copyTextGenerator";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
const SETTINGS_KEY = "kitFairySettings_v2";

export default function App() {
  const isPopoutView = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("view") === "timer";
  }, []);

  if (isPopoutView) {
    return <PopoutTimerView />;
  }

  // Application Data & Connectivity State
  const [data, setData] = useState<HaltItem[]>([]);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [lastUpdatedMs, setLastUpdatedMs] = useState<number>(Date.now());
  const dataRef = useRef<HaltItem[]>([]);
  const [perfStats, setPerfStats] = useState<PerfStats | null>(null);

  // UI State
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [intervalMs, setIntervalMs] = useState<number>(1000);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [chimeVolume, setChimeVolume] = useState<number>(1.0);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [ttsVolume, setTtsVolume] = useState<number>(1.0);
  const [soundType, setSoundType] = useState<"A" | "B" | "C">("A");
  const [watchlistOnly, setWatchlistOnly] = useState<boolean>(false);
  const [watchedSymbols, setWatchedSymbols] = useState<Set<string>>(new Set());
  const [ignoredSymbols, setIgnoredSymbols] = useState<Set<string>>(new Set());
  const [showIgnored, setShowIgnored] = useState<boolean>(false);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>("default");
  const [isFlashing, setIsFlashing] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [marketFilter, setMarketFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [reasonFilter, setReasonFilter] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: "halted_at_epoch_ms",
    direction: "desc",
  });

  // Modals & Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "warning" | "info">("success");

  // Track known halts and resumes for notification diffing
  const knownHaltsRef = useRef<Set<string>>(new Set());
  const statusMapRef = useRef<Map<string, string>>(new Map());
  const notifiedResumesRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef<boolean>(true);
  const wsRef = useRef<WebSocket | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const soundEnabledRef = useRef<boolean>(true);
  const chimeVolumeRef = useRef<number>(1.0);
  const soundTypeRef = useRef<"A" | "B" | "C">("A");
  const ttsEnabledRef = useRef<boolean>(true);
  const ttsVolumeRef = useRef<number>(1.0);
  const watchedSymbolsRef = useRef<Set<string>>(new Set());
  const ignoredSymbolsRef = useRef<Set<string>>(new Set());
  
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { chimeVolumeRef.current = chimeVolume; }, [chimeVolume]);
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);
  useEffect(() => { ttsVolumeRef.current = ttsVolume; }, [ttsVolume]);
  useEffect(() => { soundTypeRef.current = soundType; }, [soundType]);
  useEffect(() => { watchedSymbolsRef.current = watchedSymbols; }, [watchedSymbols]);
  useEffect(() => { ignoredSymbolsRef.current = ignoredSymbols; }, [ignoredSymbols]);

  // Clear tracked popouts on app startup
  useEffect(() => {
    localStorage.removeItem("trackedPopouts");
  }, []);

  // Global user interaction listener to unlock Web Audio API Context
  useEffect(() => {
    const unlockAudio = () => {
      initAudioContext();
    };
    window.addEventListener("click", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);
    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  // Helper for toast notifications
  const showToast = useCallback((msg: string, type: "success" | "warning" | "info" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  }, []);

  // Load initial settings from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.theme) setTheme(parsed.theme);
        if (parsed.intervalMs) setIntervalMs(parsed.intervalMs);
        if (typeof parsed.soundEnabled === "boolean") setSoundEnabled(parsed.soundEnabled);
        if (typeof parsed.chimeVolume === "number") setChimeVolume(parsed.chimeVolume);
        if (typeof parsed.ttsEnabled === "boolean") setTtsEnabled(parsed.ttsEnabled);
        if (typeof parsed.ttsVolume === "number") setTtsVolume(parsed.ttsVolume);
        if (typeof parsed.watchlistOnly === "boolean") setWatchlistOnly(parsed.watchlistOnly);
        if (Array.isArray(parsed.watchedSymbols)) {
          setWatchedSymbols(new Set(parsed.watchedSymbols));
        }
        if (Array.isArray(parsed.ignoredSymbols)) {
          setIgnoredSymbols(new Set(parsed.ignoredSymbols));
        }
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  }, []);

  // Sync theme class to html document and body
  useEffect(() => {
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    if (theme === "light") {
      htmlEl.classList.remove("dark");
      htmlEl.classList.add("light");
      bodyEl.classList.remove("dark", "bg-[#0F1115]");
      bodyEl.classList.add("light", "bg-[#F8FAFC]");
    } else {
      htmlEl.classList.remove("light");
      htmlEl.classList.add("dark");
      bodyEl.classList.remove("light", "bg-[#F8FAFC]");
      bodyEl.classList.add("dark", "bg-[#0F1115]");
    }
  }, [theme]);

  // Save settings to LocalStorage
  const saveSettings = useCallback(
    (newSettings: Record<string, any>) => {
      try {
        const current = {
          theme,
          intervalMs,
          soundEnabled,
          chimeVolume,
          ttsEnabled,
          ttsVolume,
          watchlistOnly,
          watchedSymbols: Array.from(watchedSymbols),
          ignoredSymbols: Array.from(ignoredSymbols),
          ...newSettings,
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
      } catch (e) {
        console.error("Failed to save settings:", e);
      }
    },
    [theme, intervalMs, soundEnabled, chimeVolume, ttsEnabled, ttsVolume, watchlistOnly, watchedSymbols, ignoredSymbols]
  );

  // Autostart init
  useEffect(() => {
    if (isTauriEnvironment()) {
      autostartIsEnabled().then(setAutostartEnabled).catch(() => {});
    }
  }, []);

  // Check for post-update notes
  useEffect(() => {
    const notes = localStorage.getItem("cuit_update_notes");
    if (notes) {
      setTimeout(() => {
        window.alert(`🎉 앱이 성공적으로 업데이트되었습니다!\n\n[업데이트 내용]\n${notes}`);
        localStorage.removeItem("cuit_update_notes");
      }, 500);
    }
  }, []);

  // Auto-Updater check on mount
  useEffect(() => {
    const checkForUpdates = async () => {
      if (!isTauriEnvironment()) return;
      try {
        const update = await check();
        if (update) {
          showToast("새 버전 업데이트를 백그라운드에서 설치 중입니다...", "info");
          await update.downloadAndInstall();
          localStorage.setItem("cuit_update_notes", update.body || "기능 개선 및 안정성이 향상되었습니다.");
          await relaunch();
        }
      } catch (err) {
        console.error("Failed to check for updates:", err);
      }
    };
    checkForUpdates();
  }, [showToast]);

  const handleToggleAutostart = useCallback(async () => {
    try {
      if (autostartEnabled) {
        await autostartDisable();
        setAutostartEnabled(false);
        showToast("자동 실행이 비활성화되었습니다.", "info");
      } else {
        await autostartEnable();
        setAutostartEnabled(true);
        showToast("윈도우 시작 시 자동 실행이 활성화되었습니다!", "success");
      }
    } catch (e) {
      console.error("Autostart toggle error:", e);
    }
  }, [autostartEnabled, showToast]);

  // Request browser Notification permissions
  useEffect(() => {
    if (isTauriEnvironment()) {
      // 앱 시작 시 자동으로 알림 권한 요청
      isPermissionGranted().then(async (granted) => {
        if (granted) {
          setNotificationStatus("granted");
        } else {
          // 권한이 없으면 자동으로 요청
          try {
            const perm = await requestPermission();
            setNotificationStatus(perm as NotificationPermission);
          } catch (e) {
            console.error("Notification permission error:", e);
          }
        }
      });
      // Handle native desktop notification clicks
      onAction((notification: any) => {
        try {
          let symbol = "";
          let isResume = false;

          // 1. Try parsing from custom actionTypeId (if it comes through)
          if (notification?.actionTypeId?.startsWith("open-toss:")) {
            symbol = notification.actionTypeId.split(":")[1];
          } 
          // 2. Fallback: Parse from Title
          else if (notification?.title) {
            // Regex to extract symbol (e.g. "🔔 ADVB 거래정지 해제!" or "🧚 ADVB 킷 발동!")
            const match = notification.title.match(/(?:🧚|🔔)\s+([A-Z0-9.\-]+)/);
            if (match && match[1]) {
              symbol = match[1];
            }
            if (notification.title.includes("해제")) {
              isResume = true;
            }
          }

          if (symbol) {
            if (!isResume) {
              // Open Timer Popout Widget for active halts
              const h = dataRef.current.find(item => item.symbol === symbol);
              if (h) {
                const url = `/?view=timer&symbol=${encodeURIComponent(h.symbol)}&name=${encodeURIComponent(h.name)}&market=${encodeURIComponent(h.market)}&haltedAt=${h.halted_at_epoch_ms || 0}`;
                createTauriPopoutWindow(`timer-${h.symbol}-${Date.now()}`, url, `${h.symbol} - Cuit Ticker Bell`, 240, 160);
                return;
              }
            }
            
            // Fallback or Resume -> Open Toss Invest
            const url = `https://www.tossinvest.com/stocks/${encodeURIComponent(symbol)}`;
            invoke("open_url", { url }).catch(console.error);
          }
        } catch (err) {
          console.error("Action error:", err);
        }
      }).catch(console.error);
    } else if ("Notification" in window) {
      setNotificationStatus(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    try {
      let perm: NotificationPermission;
      if (isTauriEnvironment()) {
        const granted = await requestPermission();
        perm = granted as NotificationPermission; // Usually "granted" | "denied"
      } else {
        if (!("Notification" in window)) return;
        perm = await Notification.requestPermission();
      }
      
      setNotificationStatus(perm);
      if (perm === "granted") {
        showToast("알림 권한이 허용되었습니다!", "success");
      } else {
        showToast("알림 권한이 거부되었습니다. 윈도우/브라우저 알림 설정을 확인해주세요.", "warning");
      }
    } catch (e) {
      console.error(e);
    }
  }, [showToast]);

  // Process incoming halt dataset
  const handleIncomingData = useCallback(
    (newItems: HaltItem[], timestamp?: number, stats?: PerfStats) => {
      if (stats) {
        setPerfStats(stats);
      }
      if (!Array.isArray(newItems)) return;

      if (isFirstLoadRef.current) {
        // Seed ALL currently known halt IDs so we never alert on them
        const seen = new Set<string>();
        newItems.forEach((h) => {
          knownHaltsRef.current.add(h.id);
          if (!seen.has(h.symbol)) {
            statusMapRef.current.set(h.symbol, h.status);
            seen.add(h.symbol);
          }
        });
        isFirstLoadRef.current = false;
      } else {
        const seen = new Set<string>();
        newItems.forEach((h) => {
          // Detect new volatility halts (킷) only — no resume notification
          if (!knownHaltsRef.current.has(h.id)) {
            knownHaltsRef.current.add(h.id);

            const code = h.reasons && h.reasons[0] ? h.reasons[0].code : "";
            const isVolatility = ["LUDP", "M", "LU", "DP"].includes(code.toUpperCase());
            const prevStatus = statusMapRef.current.get(h.symbol);

            if (isVolatility && h.status === "halted" && prevStatus !== "halted") {
              const isIgnored = ignoredSymbolsRef.current.has(h.symbol);
              if (!isIgnored) {
                // Sound alert
                if (soundEnabledRef.current) {
                  const isWatched = watchedSymbolsRef.current.has(h.symbol);
                  playNotificationChime(soundTypeRef.current, isWatched, chimeVolumeRef.current);
                }
                // Screen flash
                setIsFlashing(true);
                setTimeout(() => setIsFlashing(false), 800);
                showToast(`🚀 ${h.symbol} 킷(거래정지) 신규 감지!`, "info");
                
                // TTS
                if (ttsEnabledRef.current) {
                  playTTSAnnouncement(h.symbol, "halted", false, soundEnabledRef.current ? 600 : 0, ttsVolumeRef.current);
                }

                // Desktop Notification & Auto-popout (Tauri native)
                if (isTauriEnvironment()) {
                  sendNotification({
                    title: `🧚 ${h.symbol} 킷 발동!`,
                    body: `${h.name} (${h.market}) — ${h.reasons[0]?.title || code}`,
                  });
                  
                  // Auto open popout timer widget only if the user has manually opened it before in this session
                  try {
                    const existing = JSON.parse(localStorage.getItem("trackedPopouts") || "[]");
                    if (existing.includes(h.symbol)) {
                      const url = `/?view=timer&symbol=${encodeURIComponent(h.symbol)}&name=${encodeURIComponent(h.name)}&market=${encodeURIComponent(h.market)}&haltedAt=${h.halted_at_epoch_ms || 0}&reason=${encodeURIComponent(code)}`;
                      createTauriPopoutWindow(`timer-${h.symbol}-${Date.now()}`, url, `${h.symbol} - Cuit Ticker Bell`, 240, 160);
                    }
                  } catch(e) {}
                }
              }
            }
          }

          // Track status changes (for popout auto-close, etc.) only for the newest item of each symbol
          if (!seen.has(h.symbol)) {
            statusMapRef.current.set(h.symbol, h.status);
            seen.add(h.symbol);
          }
        });
      }

      // Resume chime (sound only, no OS notification)
      newItems.forEach((h) => {
        const prevStatus = statusMapRef.current.get(h.symbol);
        if (
          (prevStatus === "halted" || prevStatus === undefined) &&
          (h.status === "resumed" || h.status === "quote_resumed")
        ) {
          const isIgnored = ignoredSymbolsRef.current.has(h.symbol);
          const resumeKey = `${h.symbol}_${h.resumed_at_epoch_ms || h.id}_resumed`;
          if (!notifiedResumesRef.current.has(resumeKey)) {
            notifiedResumesRef.current.add(resumeKey);
            if (!isIgnored) {
              try {
                const existing = JSON.parse(localStorage.getItem("trackedPopouts") || "[]");
                if (existing.includes(h.symbol) && soundEnabledRef.current) {
                  playResumeChime(soundTypeRef.current, chimeVolumeRef.current);
                }
              } catch (e) {}
              showToast(`🔔 ${h.symbol} 거래정지 해제!`, "success");
            }
          }
        }
      });

      dataRef.current = newItems;
      setData(newItems);
      setLastUpdatedMs(timestamp || Date.now());
    },
    [showToast]
  );

  // HTTP Fetch Halts
  const fetchHalts = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await fetch("/halts", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json) {
        if (json.serverTime) updateServerTimeOffset(json.serverTime);
        if (Array.isArray(json.data)) {
          handleIncomingData(json.data, json.timestamp, json.perfStats);
        }
      }
    } catch (err) {
      console.error("Fetch halts error:", err);
    } finally {
      setIsFetching(false);
    }
  }, [handleIncomingData]);

  // Setup WebSocket / Tauri connection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let unlistenTauri: (() => void) | null = null;

    const connectTauri = async () => {
      try {
        if (isTauriEnvironment()) {
          unlistenTauri = await listen("halt-data-update", (event: any) => {
            const msg = event.payload;
            if (msg.serverTime) updateServerTimeOffset(msg.serverTime);
            if (msg.type === "data" && Array.isArray(msg.data)) {
              handleIncomingData(msg.data, msg.timestamp, msg.perfStats);
            }
          });
          setIsWsConnected(true);
          setIsPolling(false);
          showToast("실시간 피드 연결 완료 (Tauri 백그라운드 스레드)", "success");
          return true;
        }
      } catch (e) {
        console.error("Tauri connect error:", e);
      }
      return false;
    };

    const connectWs = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}`;
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsWsConnected(true);
          setIsPolling(false);
          showToast("실시간 피드 연결 완료 (WebSocket)", "success");
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.serverTime) updateServerTimeOffset(msg.serverTime);
            if (msg.type === "data" && Array.isArray(msg.data)) {
              handleIncomingData(msg.data, msg.timestamp, msg.perfStats);
            }
          } catch (e) {
            console.error("WS parse error:", e);
          }
        };

        ws.onerror = () => {
          setIsWsConnected(false);
        };

        ws.onclose = () => {
          setIsWsConnected(false);
          // Retry WS in 1 second
          reconnectTimeout = setTimeout(connectWs, 1000);
        };
      } catch (e) {
        setIsWsConnected(false);
        reconnectTimeout = setTimeout(connectWs, 1000);
      }
    };

    connectTauri().then((isTauri) => {
      if (!isTauri) {
        connectWs();
      }
    });

    return () => {
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          try {
            ws.close();
          } catch (e) {
            // Ignore socket closure error during unmount
          }
        }
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (unlistenTauri) unlistenTauri();
    };
  }, [handleIncomingData, showToast]);

  // HTTP Polling fallback timer
  useEffect(() => {
    // Initial fetch
    fetchHalts();

    // Fallback polling loop if WS is disconnected or for polling mode
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => {
      // Skip HTTP polling if Tauri backend is connected
      if (isTauriEnvironment()) return;
      
      fetchHalts();
      if (!isWsConnected) setIsPolling(true);
    }, intervalMs);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchHalts, intervalMs, isWsConnected]);

  // Handlers
  const handleToggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    saveSettings({ theme: next });
  };

  const handleChangeInterval = (val: number) => {
    setIntervalMs(val);
    saveSettings({ intervalMs: val });
    showToast(`폴링 간격이 ${val / 1000}초로 변경되었습니다.`, "info");
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    saveSettings({ soundEnabled: next });
    if (next) {
      playNotificationChime(soundType, false, chimeVolume);
    }
    showToast(next ? "알림음이 켜졌습니다 🔔 (소리 테스트)" : "알림음이 꺼졌습니다 🔇", "info");
  };

  const handleToggleTts = () => {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    saveSettings({ ttsEnabled: next });
    showToast(next ? "TTS 안내가 켜졌습니다." : "TTS 안내가 꺼졌습니다.", "info");
  };

  const handleToggleWatchlistOnly = () => {
    const next = !watchlistOnly;
    setWatchlistOnly(next);
    saveSettings({ watchlistOnly: next });
  };

  const handleToggleWatch = (symbol: string) => {
    setWatchedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
        showToast(`${symbol} 관심종목 해제`, "info");
      } else {
        next.add(symbol);
        showToast(`${symbol} 관심종목 추가! ⭐`, "success");
      }
      const newArray = Array.from(next);
      saveSettings({ watchedSymbols: newArray });
      
      // Send filter update to Tauri backend if running in desktop
      if (isTauriEnvironment()) {
        invoke('set_filters', { filters: newArray }).catch(e => console.error("Tauri set_filters error:", e));
      }
      
      return next;
    });
  };

  const handleToggleIgnore = (symbol: string) => {
    setIgnoredSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
        showToast(`${symbol} 숨김 해제됨`, "info");
      } else {
        next.add(symbol);
        showToast(`${symbol} 숨김 처리됨 (알림 및 목록에서 제외)`, "warning");
      }
      saveSettings({ ignoredSymbols: Array.from(next) });
      return next;
    });
  };

  const handleSort = (column: SortColumn) => {
    setSortConfig((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { column, direction: "desc" };
    });
  };

  const handleCopyKitText = (item: HaltItem) => {
    const haltedEpoch = item.halted_at_epoch_ms || getSyncedNow();
    const intervals = getKitIntervals(haltedEpoch, getSyncedNow());
    const addMs = intervals.map((mn) => haltedEpoch + mn * 60 * 1000);
    const targetCount = getHaltCountForSymbolToday(data, item.symbol, haltedEpoch);
    const reasonCode = item.reasons && item.reasons[0] ? item.reasons[0].code : undefined;

    const text = generateKitCopyText(item.symbol, item.name, targetCount, addMs, intervals, reasonCode);

    try {
      navigator.clipboard.writeText(text);
      showToast(`${item.symbol} (오늘 ${targetCount}번째 킷) 킷 알림문구가 클립보드에 복사되었습니다! 📋`, "success");
    } catch (e) {
      showToast("복사 실패", "warning");
    }
  };

  // Stats calculation
  const stats: StatsSummary = useMemo(() => {
    let activeHalted = 0;
    let volatilityLuld = 0;
    let resumed = 0;

    data.forEach((item) => {
      if (item.status === "halted") activeHalted++;
      if (item.status === "resumed") resumed++;

      const code = item.reasons && item.reasons[0] ? item.reasons[0].code : "";
      if (["LUDP", "M", "LU", "DP"].includes(code.toUpperCase())) {
        volatilityLuld++;
      }
    });

    return {
      total: data.length,
      activeHalted,
      volatilityLuld,
      resumed,
      lastUpdatedMs,
    };
  }, [data, lastUpdatedMs]);

  // Filtered & Sorted Dataset
  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = data.filter((item) => {
      if (!showIgnored && ignoredSymbols.has(item.symbol)) return false;
      if (watchlistOnly && !watchedSymbols.has(item.symbol)) return false;
      if (marketFilter && item.market !== marketFilter) return false;
      if (statusFilter && item.status !== statusFilter) return false;

      if (reasonFilter) {
        const code = (item.reasons && item.reasons[0] ? item.reasons[0].code : "").toUpperCase();
        if (reasonFilter === "KIT_VOLATILITY") {
          if (!["LUDP", "M", "LU", "DP"].includes(code)) return false;
        } else if (code !== reasonFilter) {
          return false;
        }
      }

      if (q) {
        const match = `${item.symbol} ${item.name}`.toLowerCase();
        if (!match.includes(q)) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      const { column, direction } = sortConfig;
      let valA: any = 0;
      let valB: any = 0;

      if (column === "reason_code") {
        valA = a.reasons && a.reasons[0] ? a.reasons[0].code : "";
        valB = b.reasons && b.reasons[0] ? b.reasons[0].code : "";
      } else {
        valA = a[column] ?? 0;
        valB = b[column] ?? 0;
      }

      if (typeof valA === "string") {
        return direction === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return direction === "asc" ? valA - valB : valB - valA;
    });
  }, [
    data,
    searchQuery,
    marketFilter,
    statusFilter,
    reasonFilter,
    watchlistOnly,
    watchedSymbols,
    ignoredSymbols,
    showIgnored,
    sortConfig,
  ]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F1115] text-slate-900 dark:text-[#E2E8F0] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-2.5 py-4 sm:px-4 md:px-6 md:py-8 overflow-hidden">
        {/* Header */}
        <Header
          theme={theme}
          onToggleTheme={handleToggleTheme}
          isWsConnected={isWsConnected}
          isPolling={isPolling}
          isFetching={isFetching}
          intervalMs={intervalMs}
          onChangeInterval={handleChangeInterval}
          onRefresh={fetchHalts}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          ttsEnabled={ttsEnabled}
          onToggleTts={handleToggleTts}
          perfStats={perfStats}
          notificationStatus={notificationStatus as any}
          onRequestNotification={requestNotificationPermission}
          soundType={soundType}
          onChangeSoundType={setSoundType}
          autostartEnabled={autostartEnabled}
          onToggleAutostart={handleToggleAutostart}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
        
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          intervalMs={intervalMs}
          onChangeInterval={handleChangeInterval}
          notificationStatus={notificationStatus as any}
          onRequestNotification={requestNotificationPermission}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          soundType={soundType}
          onChangeSoundType={setSoundType}
          chimeVolume={chimeVolume}
          onChangeChimeVolume={(v) => { setChimeVolume(v); saveSettings({ chimeVolume: v }); }}
          ttsEnabled={ttsEnabled}
          onToggleTts={handleToggleTts}
          ttsVolume={ttsVolume}
          onChangeTtsVolume={(v) => { setTtsVolume(v); saveSettings({ ttsVolume: v }); }}
          autostartEnabled={autostartEnabled}
          onToggleAutostart={handleToggleAutostart}
        />

        {/* Stats Summary Cards */}
        <StatsCards stats={stats} />

        {/* Filter Bar */}
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          marketFilter={marketFilter}
          onMarketChange={setMarketFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          reasonFilter={reasonFilter}
          onReasonChange={setReasonFilter}
          watchlistOnly={watchlistOnly}
          onToggleWatchlistOnly={handleToggleWatchlistOnly}
          watchedCount={watchedSymbols.size}
          showIgnored={showIgnored}
          onToggleShowIgnored={() => setShowIgnored(!showIgnored)}
          ignoredCount={ignoredSymbols.size}
        />

        {/* Main Data Table */}
        <HaltTable
          data={filteredData}
          allData={data}
          sortConfig={sortConfig}
          onSort={handleSort}
          watchedSymbols={watchedSymbols}
          onToggleWatch={handleToggleWatch}
          ignoredSymbols={ignoredSymbols}
          onToggleIgnore={handleToggleIgnore}
          onCopyKitText={handleCopyKitText}
          onSelectSymbol={(sym) => setSearchQuery(sym)}
          onRefresh={fetchHalts}
          soundEnabled={soundEnabled}
        />

        {/* Footer info */}
        <div className="mt-8 pt-4 border-t border-slate-200 dark:border-[#2D3748] text-center text-xs text-slate-500 dark:text-gray-400 font-sans space-y-1">
          <p className="font-semibold text-slate-600 dark:text-gray-400 font-mono text-[11px]">
            © 2026 Cuit Ticker Bell (CTB) · US Equities Real-Time Volatility Halt Monitor
          </p>
        </div>
      </div>

      {/* Toast Notification */}
      <Toast message={toastMessage} type={toastType} />

      {/* Screen Flash Overlay — 킷 발동 시 빨간 테두리 번쩍 */}
      {isFlashing && (
        <div
          className="pointer-events-none fixed inset-0 z-[9999] rounded-none"
          style={{
            boxShadow: "inset 0 0 0 6px rgba(239,68,68,0.85)",
            animation: "ctb-flash 0.8s ease-out forwards",
          }}
        />
      )}
    </div>
  );
}
