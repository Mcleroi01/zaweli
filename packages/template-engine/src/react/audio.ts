"use client";

/**
 * Bus audio de l'expérience (architecture §5.5).
 * - Un seul état « muet » partagé (effets, et plus tard musique).
 * - Le contexte audio ne démarre qu'après un geste du destinataire (iOS).
 * - Les templates fournissent leur palette de sons, construite avec
 *   les primitives `tone` et `noise` (reprises de Pauline).
 */
export type SoundScheduler = (t: number, kit: SoundKit) => void;

export type SoundKit = {
  ctx: AudioContext;
  tone: (freq: number, at: number, dur: number, gain?: number, type?: OscillatorType) => void;
  noise: (at: number, dur: number, opts?: { gain?: number; freq?: number; q?: number; type?: BiquadFilterType }) => void;
  out: AudioNode;
};

class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private readonly listeners = new Set<(muted: boolean) => void>();

  /** À appeler dans un gestionnaire de geste (tap, clic). */
  unlock(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  isMuted = () => this.muted;

  toggle = () => {
    this.muted = !this.muted;
    this.listeners.forEach((f) => f(this.muted));
    return this.muted;
  };

  subscribe = (f: (muted: boolean) => void) => {
    this.listeners.add(f);
    return () => {
      this.listeners.delete(f);
    };
  };

  play(scheduler: SoundScheduler) {
    if (this.muted) return;
    const ctx = this.unlock();
    if (!ctx || !this.master) return;
    scheduler(ctx.currentTime + 0.01, this.kit(ctx, this.master));
  }

  private kit(ctx: AudioContext, out: GainNode): SoundKit {
    const tone: SoundKit["tone"] = (freq, at, dur, gain = 0.2, type = "sine") => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, at);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(gain, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + dur + 0.05);
    };
    const noise: SoundKit["noise"] = (at, dur, { gain = 0.4, freq = 1400, q = 0.8, type = "bandpass" } = {}) => {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(f).connect(g).connect(out);
      src.start(at);
    };
    return { ctx, tone, noise, out };
  }
}

export const audioBus = new AudioBus();
