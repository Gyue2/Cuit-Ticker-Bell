import React, { useEffect, useState } from "react";
import { X, Zap, ExternalLink, SquareArrowOutUpRight } from "lucide-react";
import { HaltItem } from "../types";
import { fmtMinSecFromMs, remainingMs, pad2, getSyncedNow, getKitIntervals } from "../utils/time";
import { openPopoutTimerWindow } from "../utils/popout";

interface MiniTimerModalProps {
  haltItem: HaltItem | null;
  onClose: () => void;
}

export const MiniTimerModal: React.FC<MiniTimerModalProps> = ({ haltItem, onClose }) => {
  const [nowMs, setNowMs] = useState(getSyncedNow());

  useEffect(() => {
    if (!haltItem) return;
    const interval = setInterval(() => {
      setNowMs(getSyncedNow());
    }, 1000);
    return () => clearInterval(interval);
  }, [haltItem]);

  if (!haltItem) return null;

  const handlePopout = () => {
    openPopoutTimerWindow(haltItem);
    onClose();
  };

  const haltedEpoch = haltItem.halted_at_epoch_ms || Date.now();
  
  // Calculate next target 5min / 10min / 15min interval
  let targetM = 5;
  while (haltedEpoch + targetM * 60 * 1000 <= nowMs) {
    targetM += 5;
  }
  const targetEpoch = haltedEpoch + targetM * 60 * 1000;
  const rem = remainingMs(targetEpoch, nowMs);

  const intervals = getKitIntervals(haltedEpoch, nowMs);
  const tList = intervals.map((mn) => haltedEpoch + mn * 60 * 1000);

  const fmtTimeOfDay = (epoch: number) => {
    const d = new Date(epoch);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-xl bg-white dark:bg-[#1A202C] border border-slate-200 dark:border-[#2D3748] p-6 shadow-2xl text-center transition-colors"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#2D3748] transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center gap-2 mb-2 text-blue-600 dark:text-blue-400">
          <Zap className="w-5 h-5 animate-bounce" />
          <span className="text-xs font-mono font-bold tracking-wider uppercase">실시간 킷 카운트다운 타이머</span>
        </div>

        <h3 className="text-3xl font-mono font-black text-slate-900 dark:text-white mb-1 tracking-tight">
          {haltItem.symbol}
        </h3>
        <p className="text-xs font-bold text-slate-600 dark:text-gray-300 mb-6 truncate px-2">
          {haltItem.name} ({haltItem.market})
        </p>

        {/* Big Timer Badge */}
        <div className="py-5 px-4 rounded-xl bg-slate-50 dark:bg-[#111318] text-slate-900 dark:text-white border border-blue-300 dark:border-blue-500/40 shadow-inner mb-6">
          <div className="text-4xl font-extrabold font-mono tracking-tight text-blue-600 dark:text-blue-400 mb-1">
            {fmtMinSecFromMs(rem)}
          </div>
          <div className="text-xs font-mono font-semibold text-slate-600 dark:text-gray-300">
            ({targetM}분 후 거래 재개 예상 창)
          </div>
        </div>

        {/* Estimated times list */}
        <div className="space-y-2 text-xs font-mono font-semibold text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-[#171923] p-3.5 rounded-xl border border-slate-200 dark:border-[#2D3748] mb-6">
          {intervals.map((mn, idx) => (
            <div
              key={mn}
              className={`flex justify-between items-center py-1 ${
                idx < intervals.length - 1 ? "border-b border-slate-200 dark:border-[#2D3748]" : ""
              }`}
            >
              <span className="text-slate-500 dark:text-gray-400">{mn}분 후 예상 재개:</span>
              <span className="font-bold text-slate-900 dark:text-white">{fmtTimeOfDay(tList[idx])}</span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={handlePopout}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-extrabold text-xs tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
          >
            <SquareArrowOutUpRight className="w-4 h-4" />
            <span>새 창(팝업)으로 분리해서 보기</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-xl bg-slate-100 dark:bg-[#171923] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-gray-300 font-bold text-xs transition-all cursor-pointer border border-slate-200 dark:border-[#2D3748]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

