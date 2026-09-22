"use client";

class AudioAlarmController {
  private ctx: AudioContext | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenTimer: NodeJS.Timeout | null = null;
  private isSirenPlaying = false;
  private unlocked = false;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopSiren();
    }
    return this.muted;
  }

  private initCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public unlock(): boolean {
    const ctx = this.initCtx();
    if (ctx) {
      this.unlocked = true;
      // Play a short silent click to satisfy autoplay policies
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(ctx.currentTime + 0.05);
      return true;
    }
    return false;
  }

  public isAudioUnlocked(): boolean {
    return this.unlocked;
  }

  public startSiren() {
    if (this.isSirenPlaying) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    this.isSirenPlaying = true;

    try {
      this.sirenOsc = ctx.createOscillator();
      this.sirenGain = ctx.createGain();

      this.sirenOsc.type = "sawtooth";
      this.sirenOsc.frequency.setValueAtTime(650, ctx.currentTime);

      this.sirenGain.gain.setValueAtTime(0.18, ctx.currentTime);
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(ctx.destination);

      this.sirenOsc.start();

      // Alternate frequencies every 450ms for industrial siren sweep
      let toggle = false;
      this.sirenTimer = setInterval(() => {
        if (!this.ctx || !this.sirenOsc) return;
        toggle = !toggle;
        const targetFreq = toggle ? 920 : 620;
        this.sirenOsc.frequency.exponentialRampToValueAtTime(targetFreq, this.ctx.currentTime + 0.35);
      }, 400);
    } catch (err) {
      console.error("Audio error starting siren", err);
    }
  }

  public stopSiren() {
    if (!this.isSirenPlaying) return;
    this.isSirenPlaying = false;

    if (this.sirenTimer) {
      clearInterval(this.sirenTimer);
      this.sirenTimer = null;
    }

    if (this.sirenGain && this.ctx) {
      try {
        this.sirenGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.2);
        setTimeout(() => {
          this.sirenOsc?.stop();
          this.sirenOsc?.disconnect();
          this.sirenGain?.disconnect();
          this.sirenOsc = null;
          this.sirenGain = null;
        }, 250);
      } catch {
        this.sirenOsc?.stop();
        this.sirenOsc = null;
        this.sirenGain = null;
      }
    }
  }

  public playAckChime() {
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.12); // E5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (err) {
      console.warn("Could not play ack chime", err);
    }
  }

  public playCompliancePing() {
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (err) {
      console.warn("Could not play compliance ping", err);
    }
  }
}

export const audioController = new AudioAlarmController();
