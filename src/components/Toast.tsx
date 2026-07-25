import React from "react";
import { CheckCircle, AlertCircle, Info } from "lucide-react";

interface ToastProps {
  message: string | null;
  type?: "success" | "info" | "warning";
}

export const Toast: React.FC<ToastProps> = ({ message, type = "success" }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-full bg-[#1A202C] text-white shadow-2xl border border-blue-500/40 text-xs md:text-sm font-mono font-bold animate-fadeIn">
      {type === "success" && <CheckCircle className="w-4 h-4 text-emerald-400" />}
      {type === "warning" && <AlertCircle className="w-4 h-4 text-amber-400" />}
      {type === "info" && <Info className="w-4 h-4 text-blue-400" />}
      <span>{message}</span>
    </div>
  );
};
