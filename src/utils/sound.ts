// Web Audio API notification sound synthesizer
let audioCtx: AudioContext | null = null;

export function initAudioContext() {
  try {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) audioCtx = new AudioCtx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  } catch (e) {
    console.log("Audio init error:", e);
  }
}

type SoundType = "A" | "B" | "C";

function getCtx(): AudioContext | null {
  initAudioContext();
  return audioCtx;
}

/** 킷 발동 알람 — 3종 선택 가능 */
export function playNotificationChime(type: SoundType = "A", boost = false) {
  const ctx = getCtx();
  if (!ctx) return;

  const vol = boost ? 0.7 : 0.35;

  const run = () => {
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === "A") {
      // 기존: 이중 차임 (880Hz → 1318.5Hz)
      playNote(ctx, "sine", 880, now, 0.35, vol);
      playNote(ctx, "sine", 1318.5, now + 0.12, 0.43, vol);
      if (boost) {
        playNote(ctx, "sine", 880, now + 0.5, 0.35, vol * 0.8);
        playNote(ctx, "sine", 1318.5, now + 0.62, 0.43, vol * 0.8);
      }
    } else if (type === "B") {
      // 빠른 3연음 경고음
      [660, 880, 1100].forEach((f, i) => {
        playNote(ctx, "square", f, now + i * 0.09, 0.18, vol * 0.4);
      });
      if (boost) {
        [660, 880, 1100].forEach((f, i) => {
          playNote(ctx, "square", f, now + 0.35 + i * 0.09, 0.18, vol * 0.3);
        });
      }
    } else {
      // C: 낮은 단음 "붐"
      playNote(ctx, "sine", 440, now, 0.5, vol);
      playNote(ctx, "triangle", 220, now, 0.6, vol * 0.5);
      if (boost) {
        playNote(ctx, "sine", 440, now + 0.6, 0.5, vol * 0.7);
      }
    }
  };

  if (ctx.state === "suspended") {
    ctx.resume().then(run).catch(() => {});
  } else {
    run();
  }
}

/** 재개 완료 알람 — 3종 선택 가능 */
export function playResumeChime(type: SoundType = "A") {
  const ctx = getCtx();
  if (!ctx) return;

  const run = () => {
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === "A") {
      // 기존: 상승 아르페지오
      [783.99, 1046.5, 1318.51, 1567.98].forEach((freq, idx) => {
        const t = now + idx * 0.07;
        playNote(ctx, "sine", freq, t, 0.45, 0.25);
        playNote(ctx, "triangle", freq * 2, t, 0.2, 0.06);
      });
    } else if (type === "B") {
      // 간단한 2음 상승
      playNote(ctx, "sine", 880, now, 0.3, 0.3);
      playNote(ctx, "sine", 1320, now + 0.18, 0.4, 0.3);
    } else {
      // C: 부드러운 단음
      playNote(ctx, "sine", 1046.5, now, 0.6, 0.28);
    }
  };

  if (ctx.state === "suspended") {
    ctx.resume().then(run).catch(() => {});
  } else {
    run();
  }
}

function playNote(
  ctx: AudioContext,
  type: OscillatorType,
  freq: number,
  start: number,
  duration: number,
  vol: number
) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  } catch (e) {}
}

/** TTS(음성 합성) 브리핑 */
export function playTTSAnnouncement(symbol: string, status: "halted" | "resumed", extension: boolean = false) {
  if (!("speechSynthesis" in window)) return;
  
  let text = "";
  if (status === "halted") {
    if (extension) {
      text = `${symbol}, 정지 연장.`;
    } else {
      text = `${symbol}, 변동성 정지.`; 
    }
  } else {
    text = `${symbol}, 거래 재개.`;
  }
  
  // Create an utterance object
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR"; // Korean
  utterance.rate = 1.1; // Slightly faster
  utterance.pitch = 1.0; 
  
  // Cancel any ongoing speech to prioritize the latest alert
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}