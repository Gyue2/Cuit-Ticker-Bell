import { HaltItem } from "../types";
import { isTauriEnvironment, createTauriPopoutWindow } from "./tauriWindow";

export async function openPopoutTimerWindow(item: HaltItem) {
  const code = item.reasons && item.reasons[0] ? item.reasons[0].code : "LUDP";
  const params = new URLSearchParams({
    view: "timer",
    symbol: item.symbol,
    name: item.name || "",
    market: item.market || "NASDAQ",
    halted: String(item.halted_at_epoch_ms || Date.now()),
    reason: code,
  });

  const windowLabel = `timer_${item.symbol}_${Date.now()}`;
  const title = `🧚 [항상위] 킷 타이머 - ${item.symbol}`;

  // Use the root URL with URL query parameters
  const url = `/?view=timer&${params.toString()}`;

  // Track that this symbol has an active/tracked popout
  try {
    const existing = JSON.parse(localStorage.getItem("trackedPopouts") || "[]");
    if (!existing.includes(item.symbol)) {
      existing.push(item.symbol);
      localStorage.setItem("trackedPopouts", JSON.stringify(existing));
    }
  } catch (e) {}

  if (isTauriEnvironment()) {
    const success = await createTauriPopoutWindow(windowLabel, url, title, 240, 160);
    if (success) return;
  }

  const features = "width=240,height=160,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no";
  window.open(url, windowLabel, features);
}

