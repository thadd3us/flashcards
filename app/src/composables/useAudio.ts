import type { SpeedTier } from '../types/answerEvent';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function envelope(
  osc: OscillatorNode,
  destination: AudioNode,
  ac: AudioContext,
  durationMs: number,
  peakGain = 0.2,
) {
  const gain = ac.createGain();
  const now = ac.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peakGain, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.05);
}

export function playTierSound(tier: SpeedTier) {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  switch (tier) {
    case 'instant':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ac.currentTime + 0.08);
      envelope(osc, ac.destination, ac, 120);
      break;
    case 'fast':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ac.currentTime);
      envelope(osc, ac.destination, ac, 150);
      break;
    case 'slow':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ac.currentTime);
      envelope(osc, ac.destination, ac, 220);
      break;
    case 'miss':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ac.currentTime + 0.3);
      envelope(osc, ac.destination, ac, 320, 0.15);
      break;
  }
}

export function playComboMilestone() {
  const ac = getCtx();
  if (!ac) return;
  const notes = [523, 659, 784, 1047]; // C-E-G-C
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ac.currentTime + i * 0.05);
    const gain = ac.createGain();
    const start = ac.currentTime + i * 0.05;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}
