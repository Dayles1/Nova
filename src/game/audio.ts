export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  unlock(): void {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!this.ctx) {
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.noise = this.makeNoise(this.ctx);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
  }

  resume(): void {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  laser(): void {
    const ctx = this.ctx;
    const bus = this.sfx;
    if (!ctx || !bus) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(920 + Math.random() * 80, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + 0.11);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  explosion(heavy = false): void {
    const ctx = this.ctx;
    const bus = this.sfx;
    const noise = this.noise;
    if (!ctx || !bus || !noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = 0.7 + Math.random() * 0.4;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(heavy ? 900 : 1400, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + (heavy ? 0.45 : 0.22));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(heavy ? 0.55 : 0.28, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (heavy ? 0.5 : 0.28));
    src.connect(filter);
    filter.connect(g);
    g.connect(bus);
    src.start(t);
    src.stop(t + 0.55);
    const thud = ctx.createOscillator();
    thud.type = "sine";
    thud.frequency.setValueAtTime(heavy ? 70 : 110, t);
    thud.frequency.exponentialRampToValueAtTime(32, t + 0.18);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(heavy ? 0.35 : 0.16, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    thud.connect(tg);
    tg.connect(bus);
    thud.start(t);
    thud.stop(t + 0.22);
  }

  hit(): void {
    const ctx = this.ctx;
    const bus = this.sfx;
    if (!ctx || !bus) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.14);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  pickup(): void {
    const ctx = this.ctx;
    const bus = this.sfx;
    if (!ctx || !bus) return;
    const t = ctx.currentTime;
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const start = t + i * 0.05;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(g);
      g.connect(bus);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  ui(): void {
    const ctx = this.ctx;
    const bus = this.sfx;
    if (!ctx || !bus) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 660;
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  wave(): void {
    const ctx = this.ctx;
    const bus = this.sfx;
    if (!ctx || !bus) return;
    const t = ctx.currentTime;
    [392, 523].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const start = t + i * 0.12;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.1, start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(g);
      g.connect(bus);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  extraLife(): void {
    const ctx = this.ctx;
    const bus = this.sfx;
    if (!ctx || !bus) return;
    const t = ctx.currentTime;
    [523, 659, 784, 1046].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = t + i * 0.07;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.11, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(g);
      g.connect(bus);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}
