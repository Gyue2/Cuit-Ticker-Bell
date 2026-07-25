import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";

export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;
}

export async function setAlwaysOnTop(isAlwaysOnTop: boolean): Promise<boolean> {
  if (!isTauriEnvironment()) {
    return false;
  }
  try {
    const appWindow = getCurrentWindow();
    await appWindow.setAlwaysOnTop(isAlwaysOnTop);
    return true;
  } catch (err) {
    console.error("Failed to set always-on-top:", err);
    return false;
  }
}

export async function closeCurrentWindow() {
  if (isTauriEnvironment()) {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (err) {
      console.error("Failed to close Tauri window:", err);
      window.close();
    }
  } else {
    window.close();
  }
}

export async function createTauriPopoutWindow(
  label: string,
  url: string,
  title: string,
  width = 420,
  height = 620
): Promise<boolean> {
  if (!isTauriEnvironment()) {
    return false;
  }
  try {
    const sanitizeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_");
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    
    const webview = new WebviewWindow(sanitizeLabel, {
      url,
      title,
      width,
      height,
      alwaysOnTop: true,
      resizable: true,
      center: true,
      decorations: false,
      transparent: true,
    });

    return new Promise((resolve) => {
      webview.once("tauri://created", () => {
        resolve(true);
      });
      webview.once("tauri://error", (e) => {
        console.error("Webview creation error:", e);
        resolve(false);
      });
    });
  } catch (err) {
    console.error("Failed to create Tauri window:", err);
    return false;
  }
}
