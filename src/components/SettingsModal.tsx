import React, { useEffect, useState } from 'react';
import { Settings, Volume2, VolumeX, Megaphone, MegaphoneOff, Zap, BellOff, X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Data
  intervalMs: number;
  onChangeInterval: (ms: number) => void;
  
  // Notification
  notificationStatus: PermissionState | null;
  onRequestNotification: () => void;
  
  // Sound
  soundEnabled: boolean;
  onToggleSound: () => void;
  soundType: "A" | "B" | "C";
  onChangeSoundType: (type: "A" | "B" | "C") => void;
  chimeVolume: number;
  onChangeChimeVolume: (volume: number) => void;
  
  // TTS
  ttsEnabled: boolean;
  onToggleTts: () => void;
  ttsVolume: number;
  onChangeTtsVolume: (volume: number) => void;
  
  // Autostart
  autostartEnabled: boolean;
  onToggleAutostart: () => void;
  
  // Update
  updateProgress?: { status: string; progress: number } | null;
  
  // Telegram
  telegramEnabled: boolean;
  onToggleTelegram: () => void;
  telegramToken: string;
  onChangeTelegramToken: (token: string) => void;
  telegramChatId: string;
  onChangeTelegramChatId: (chatId: string) => void;
  onTestTelegram: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  intervalMs,
  onChangeInterval,
  notificationStatus,
  onRequestNotification,
  soundEnabled,
  onToggleSound,
  soundType,
  onChangeSoundType,
  chimeVolume,
  onChangeChimeVolume,
  ttsEnabled,
  onToggleTts,
  ttsVolume,
  onChangeTtsVolume,
  autostartEnabled,
  onToggleAutostart,
  updateProgress,
  telegramEnabled,
  onToggleTelegram,
  telegramToken,
  onChangeTelegramToken,
  telegramChatId,
  onChangeTelegramChatId,
  onTestTelegram,
}) => {
  const [appVersion, setAppVersion] = useState<string>("1.0.7");

  useEffect(() => {
    if ((window as any).__TAURI_INTERNALS__) {
      import('@tauri-apps/api/app').then(m => m.getVersion()).then(setAppVersion).catch(() => {});
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1A202C] rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-full">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">설정 (Settings)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-8">
          
          {/* Section: Alerts & Sound */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">알림 및 소리 (Alerts)</h3>
            
            <div className="space-y-3">
              {/* Notification Permission */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#2D3748]/30 border border-slate-100 dark:border-slate-700/50">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">바탕화면 알림 권한</span>
                  <span className="text-[10px] text-slate-500">종목 정지/재개 시 팝업 알림을 띄웁니다.</span>
                </div>
                {notificationStatus === "granted" ? (
                  <span className="text-xs font-bold text-emerald-500 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">허용됨</span>
                ) : (
                  <button
                    onClick={onRequestNotification}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg transition-colors border border-rose-200 dark:border-rose-500/30"
                  >
                    <BellOff className="w-3.5 h-3.5" />
                    권한 요청
                  </button>
                )}
              </div>

              {/* Sound Settings */}
              <div className="flex flex-col gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#2D3748]/30 border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">알림음 (Chime)</span>
                    <span className="text-[10px] text-slate-500">이벤트 발생 시 효과음을 재생합니다.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {soundEnabled && (
                      <select
                        value={soundType}
                        onChange={(e) => onChangeSoundType(e.target.value as "A"|"B"|"C")}
                        className="text-xs font-bold bg-white dark:bg-[#1A202C] text-slate-700 dark:text-slate-300 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer"
                      >
                        <option value="A">소리 A</option>
                        <option value="B">소리 B</option>
                        <option value="C">소리 C</option>
                      </select>
                    )}
                    <button
                      onClick={onToggleSound}
                      className={`p-2 rounded-lg transition-colors border ${
                        soundEnabled 
                          ? "bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30" 
                          : "bg-slate-200 text-slate-500 border-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600"
                      }`}
                    >
                      {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {soundEnabled && (
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-8">음량</span>
                    <input 
                      type="range" 
                      min="0" max="1" step="0.05" 
                      value={chimeVolume}
                      onChange={(e) => onChangeChimeVolume(parseFloat(e.target.value))}
                      className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-blue-500"
                    />
                    <span className="text-[11px] font-mono text-slate-500 w-8 text-right">{Math.round(chimeVolume * 100)}%</span>
                  </div>
                )}
              </div>

              {/* TTS Settings */}
              <div className="flex flex-col gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#2D3748]/30 border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">음성 브리핑 (TTS)</span>
                    <span className="text-[10px] text-slate-500">이벤트 발생 시 종목명을 음성으로 알려줍니다.</span>
                  </div>
                  <button
                    onClick={onToggleTts}
                    className={`p-2 rounded-lg transition-colors border ${
                      ttsEnabled 
                        ? "bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30" 
                        : "bg-slate-200 text-slate-500 border-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600"
                    }`}
                  >
                    {ttsEnabled ? <Megaphone className="w-4 h-4" /> : <MegaphoneOff className="w-4 h-4" />}
                  </button>
                </div>
                {ttsEnabled && (
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-8">음량</span>
                    <input 
                      type="range" 
                      min="0" max="1" step="0.05" 
                      value={ttsVolume}
                      onChange={(e) => onChangeTtsVolume(parseFloat(e.target.value))}
                      className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-purple-500"
                    />
                    <span className="text-[11px] font-mono text-slate-500 w-8 text-right">{Math.round(ttsVolume * 100)}%</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section: Telegram Notifications */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">모바일 알림 (Telegram)</h3>
            <div className="space-y-3">
              <div className="flex flex-col gap-3 p-4 rounded-xl bg-slate-50 dark:bg-[#2D3748]/30 border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">텔레그램 봇 알림</span>
                    <span className="text-[10px] text-slate-500">외부에 있을 때도 폰으로 실시간 알림을 받습니다.</span>
                  </div>
                  <button
                    onClick={onToggleTelegram}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                      telegramEnabled 
                        ? "bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30" 
                        : "bg-slate-200 text-slate-500 border-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600"
                    }`}
                  >
                    {telegramEnabled ? "사용 중" : "사용 안 함"}
                  </button>
                </div>
                
                {telegramEnabled && (
                  <div className="flex flex-col gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Bot Token (봇 토큰)</label>
                      <input
                        type="password"
                        placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                        value={telegramToken}
                        onChange={(e) => onChangeTelegramToken(e.target.value)}
                        className="w-full text-sm bg-white dark:bg-[#1A202C] text-slate-800 dark:text-slate-200 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Chat ID (채팅방 ID)</label>
                      <input
                        type="text"
                        placeholder="123456789"
                        value={telegramChatId}
                        onChange={(e) => onChangeTelegramChatId(e.target.value)}
                        className="w-full text-sm bg-white dark:bg-[#1A202C] text-slate-800 dark:text-slate-200 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      onClick={onTestTelegram}
                      className="mt-1 w-full px-4 py-2 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 font-bold text-xs rounded-lg transition-colors border border-blue-200 dark:border-blue-500/30"
                    >
                      테스트 메시지 보내기
                    </button>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                      * 텔레그램에서 BotFather를 통해 봇을 생성한 후 Token을 입력하세요.<br/>
                      * 봇에게 말을 건 후 IDBot 등을 통해 자신의 Chat ID를 확인해 입력하세요.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section: System & Data */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">시스템 및 데이터 (System)</h3>
            
            <div className="space-y-3">
              {/* Autostart */}
              {(window as any).__TAURI_INTERNALS__ && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#2D3748]/30 border border-slate-100 dark:border-slate-700/50">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">윈도우 시작 시 자동실행</span>
                    <span className="text-[10px] text-slate-500">컴퓨터를 켜면 앱이 자동으로 실행됩니다.</span>
                  </div>
                  <button
                    onClick={onToggleAutostart}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                      autostartEnabled 
                        ? "bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30" 
                        : "bg-slate-200 text-slate-500 border-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {autostartEnabled ? "사용 중" : "사용 안 함"}
                  </button>
                </div>
              )}

              {/* Polling Interval */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#2D3748]/30 border border-slate-100 dark:border-slate-700/50">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">데이터 갱신 주기</span>
                  <span className="text-[10px] text-slate-500">HTTP 304 조건부 요청으로 1초도 안전합니다.</span>
                </div>
                <select
                  value={intervalMs}
                  onChange={(e) => onChangeInterval(Number(e.target.value))}
                  className="text-xs font-bold bg-white dark:bg-[#1A202C] text-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer"
                >
                  <option value={1000}>1초 (초고속)</option>
                  <option value={2000}>2초</option>
                  <option value={3000}>3초</option>
                  <option value={5000}>5초</option>
                </select>
              </div>
            </div>
          </section>

        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500">
              v{appVersion}
            </span>
            {updateProgress && (
              <div className="flex items-center gap-2 text-[10px] text-purple-600 dark:text-purple-400 font-bold bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-md">
                <span className="animate-pulse">{updateProgress.status}</span>
                <span className="font-mono">{Math.round(updateProgress.progress)}%</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-200 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold transition-colors shadow-sm"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
