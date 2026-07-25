import React, { useEffect } from "react";
import { X, Zap, CheckCircle2, Info } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { isTauriEnvironment } from "../utils/tauriWindow";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "halt" | "resume" | "info";
  symbol?: string;
}

interface ContainerProps {
  notifications: AppNotification[];
  removeNotification: (id: string) => void;
}

export const NotificationContainer: React.FC<ContainerProps> = ({ notifications, removeNotification }) => {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
      {notifications.map((n) => (
        <NotificationItem key={n.id} n={n} removeNotification={removeNotification} />
      ))}
    </div>
  );
};

const NotificationItem = ({ n, removeNotification }: { n: AppNotification; removeNotification: (id: string) => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => removeNotification(n.id), 8000); // 8 seconds visible
    return () => clearTimeout(timer);
  }, [n.id, removeNotification]);

  const handleClick = () => {
    if (n.symbol) {
      const url = `https://www.tossinvest.com/stocks/${encodeURIComponent(n.symbol)}`;
      if (isTauriEnvironment() && (window as any).__TAURI_INTERNALS__) {
        invoke("open_url", { url }).catch(console.error);
      } else {
        window.open(url, "_blank");
      }
    }
  };

  const isHalt = n.type === "halt";
  const isResume = n.type === "resume";

  return (
    <div 
      className={`pointer-events-auto relative w-72 md:w-[340px] p-4 rounded-xl shadow-2xl border backdrop-blur-md transition-all duration-300 animate-slideInRight overflow-hidden group ${
        isHalt ? "bg-red-950/90 border-red-500/50 hover:bg-red-900/90" :
        isResume ? "bg-emerald-950/90 border-emerald-500/50 hover:bg-emerald-900/90" :
        "bg-slate-800/90 border-slate-600 hover:bg-slate-700/90"
      } ${n.symbol ? "cursor-pointer" : "cursor-default"}`}
      onClick={handleClick}
    >
      {/* Icon and content */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {isHalt && <Zap className="w-5 h-5 text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]" />}
          {isResume && <CheckCircle2 className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
          {!isHalt && !isResume && <Info className="w-5 h-5 text-blue-400" />}
        </div>
        <div className="flex-1">
          <h4 className={`font-bold text-sm tracking-tight ${isHalt ? "text-red-100" : isResume ? "text-emerald-100" : "text-white"}`}>
            {n.title}
          </h4>
          <p className="text-xs text-slate-300 mt-1 font-medium">{n.message}</p>
          {n.symbol && (
            <p className={`text-[10px] mt-2 font-bold opacity-0 group-hover:opacity-100 transition-opacity ${isHalt ? "text-red-300" : "text-emerald-300"}`}>
              클릭하여 토스증권으로 이동 &rarr;
            </p>
          )}
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
