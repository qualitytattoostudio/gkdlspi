'use client';

// Web Audio API Synthesizer for UI Sound Effects
// No external assets required!

let audioCtx: AudioContext | null = null;

const getContext = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
};

// Generic beep function
const beep = (frequency: number, type: OscillatorType, duration: number, vol: number) => {
  const ctx = getContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  
  // Envelope
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
};

export const playClick = () => {
  // Short, high pitch, quiet "tick"
  beep(800, 'sine', 0.05, 0.4);
};

export const playToggle = () => {
  // Soft bubble "plop"
  beep(400, 'sine', 0.1, 0.5);
  setTimeout(() => beep(600, 'sine', 0.1, 0.3), 50);
};

export const playSuccess = () => {
  // Two-tone rising chime
  beep(523.25, 'sine', 0.15, 0.4); // C5
  setTimeout(() => beep(659.25, 'sine', 0.3, 0.6), 100); // E5
};

export const playError = () => {
  // Low buzz
  beep(150, 'sawtooth', 0.2, 0.4);
};
