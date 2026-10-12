// Pure Web Audio API Procedural Synthesizer Engine
// Zero external asset dependencies, zero network latency, dynamic real-time synthesis

class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private clickBuffer: AudioBuffer | null = null;
  private beamHumOsc1: OscillatorNode | null = null;
  private beamHumOsc2: OscillatorNode | null = null;
  private beamHumGain: GainNode | null = null;
  private isHumming: boolean = false;

  private keyClickBuffers: AudioBuffer[] = [];
  private errorBuffer: AudioBuffer | null = null;
  private keyClickIndex: number = 0;

  public init(): void {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initClickBuffer();
      this.initKeyBuffers();
    } catch (e) {
      console.warn('Web Audio not supported or blocked:', e);
    }
  }

  private initClickBuffer(): void {
    if (!this.ctx || this.clickBuffer) return;
    try {
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * 0.018); // 18ms snappy click
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        data[i] = Math.sin(2 * Math.PI * 1100 * t) * Math.exp(-t * 220);
      }
      this.clickBuffer = buffer;
    } catch {
      // Buffer initialization fallback
    }
  }

  private initKeyBuffers(): void {
    if (!this.ctx || this.keyClickBuffers.length > 0) return;
    try {
      const sampleRate = this.ctx.sampleRate;
      // Pre-render 4 mechanical switch click variants for zero-allocation realistic keystrokes
      const frequencies = [720, 780, 840, 890];
      this.keyClickBuffers = frequencies.map((freq) => {
        const length = Math.floor(sampleRate * 0.025); // 25ms crisp mechanical snap
        const buffer = this.ctx!.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const tone = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 180);
          const snap = (Math.random() * 2 - 1) * Math.exp(-t * 300) * 0.35;
          data[i] = (tone + snap) * 0.4;
        }
        return buffer;
      });

      // Pre-render error crunch buffer (80ms sawtooth crunch)
      const errLength = Math.floor(sampleRate * 0.08);
      const errBuffer = this.ctx.createBuffer(1, errLength, sampleRate);
      const errData = errBuffer.getChannelData(0);
      for (let i = 0; i < errLength; i++) {
        const t = i / sampleRate;
        const tone = Math.sin(2 * Math.PI * (140 - t * 600) * t);
        const grit = (Math.random() * 2 - 1) * 0.3;
        errData[i] = (tone + grit) * Math.exp(-t * 30) * 0.45;
      }
      this.errorBuffer = errBuffer;
    } catch {
      // Buffer fallback
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public playUiClick(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (!this.clickBuffer) {
      this.initClickBuffer();
    }
    if (!this.clickBuffer) return;

    try {
      const source = ctx.createBufferSource();
      source.buffer = this.clickBuffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      source.connect(gain);
      gain.connect(this.masterGain!);
      source.start();
    } catch {
      // Silent fail
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.4, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Keystroke sound: plays only on typo errors for clean, non-distracting typing
  public playKeystroke(isError: boolean = false): void {
    if (!isError) return;
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted) return;

    if (!this.errorBuffer) {
      this.initKeyBuffers();
    }
    if (!this.errorBuffer) return;

    try {
      const source = ctx.createBufferSource();
      source.buffer = this.errorBuffer;
      source.playbackRate.setValueAtTime(0.95 + Math.random() * 0.1, ctx.currentTime);
      source.connect(this.masterGain!);
      source.onended = () => {
        try {
          source.disconnect();
        } catch {}
      };
      source.start();
    } catch {
      // Silent fallback
    }
  }

  // Laser blast firing sound with spatial stereo panning and rising combo scale
  public playWordFired(isP1: boolean, combo: number): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    // Pentatonic scale frequency offset based on combo streak
    const pentatonicRatios = [1.0, 1.189, 1.334, 1.498, 1.681, 2.0, 2.378, 2.669];
    const scaleIdx = Math.min(combo, pentatonicRatios.length - 1);
    const multiplier = pentatonicRatios[scaleIdx];

    const startFreq = (isP1 ? 880 : 720) * multiplier;
    const endFreq = isP1 ? 220 : 180;

    osc.type = combo > 4 ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.18);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    if (panner) {
      // Spatial pan: P1 on left (-0.65), P2 on right (+0.65)
      panner.pan.setValueAtTime(isP1 ? -0.65 : 0.65, now);
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(this.masterGain!);
    } else {
      osc.connect(gain);
      gain.connect(this.masterGain!);
    }

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
        panner?.disconnect();
      } catch {}
    };
    osc.start(now);
    osc.stop(now + 0.18);
  }

  // Clash explosion impact when words hit the nexus
  public playClashImpact(powerMultiplier: number = 1.0): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted) return;

    const now = ctx.currentTime;
    // Sub-bass hit
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160, now);
    subOsc.frequency.exponentialRampToValueAtTime(35, now + 0.28);
    subGain.gain.setValueAtTime(Math.min(0.4 * powerMultiplier, 0.7), now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain!);
    subOsc.onended = () => {
      try {
        subOsc.disconnect();
        subGain.disconnect();
      } catch {}
    };
    subOsc.start(now);
    subOsc.stop(now + 0.28);
  }

  // Overheat penalty sound when typo in Strict mode
  public playOverheatPenalty(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.setValueAtTime(140, now + 0.08);
    osc.frequency.setValueAtTime(80, now + 0.16);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
    };
    osc.start(now);
    osc.stop(now + 0.28);
  }

  // Match countdown beeps
  public playCountdownBeep(isFinal: boolean = false): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isFinal ? 880 : 440, now);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinal ? 0.35 : 0.15));

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
    };
    osc.start(now);
    osc.stop(now + (isFinal ? 0.35 : 0.15));
  }

  // Start continuous ambient clash drone
  public startBeamHum(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isHumming) return;

    const now = ctx.currentTime;
    this.beamHumOsc1 = ctx.createOscillator();
    this.beamHumOsc2 = ctx.createOscillator();
    this.beamHumGain = ctx.createGain();

    this.beamHumOsc1.type = 'sine';
    this.beamHumOsc1.frequency.setValueAtTime(65, now);

    this.beamHumOsc2.type = 'sawtooth';
    this.beamHumOsc2.frequency.setValueAtTime(130, now);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, now);

    this.beamHumGain.gain.setValueAtTime(0.01, now);
    this.beamHumGain.gain.linearRampToValueAtTime(0.12, now + 0.8);

    this.beamHumOsc1.connect(filter);
    this.beamHumOsc2.connect(filter);
    filter.connect(this.beamHumGain);
    this.beamHumGain.connect(this.masterGain!);

    this.beamHumOsc1.start(now);
    this.beamHumOsc2.start(now);
    this.isHumming = true;
  }

  public updateBeamHumTug(tugPosition: number): void {
    if (!this.ctx || !this.beamHumOsc1 || !this.beamHumOsc2) return;
    const now = this.ctx.currentTime;
    // Modulate pitch slightly as clash moves off-center
    const tension = Math.abs(tugPosition);
    this.beamHumOsc1.frequency.linearRampToValueAtTime(65 + tension * 30, now + 0.1);
    this.beamHumOsc2.frequency.linearRampToValueAtTime(130 + tension * 60, now + 0.1);
  }

  public stopBeamHum(): void {
    if (this.beamHumGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.beamHumGain.gain.linearRampToValueAtTime(0.001, now + 0.3);
      setTimeout(() => {
        try {
          this.beamHumOsc1?.stop();
          this.beamHumOsc2?.stop();
          this.beamHumOsc1?.disconnect();
          this.beamHumOsc2?.disconnect();
        } catch (_) {}
        this.isHumming = false;
      }, 350);
    }
  }

  // Triumphant victory fanfare & massive sub-bass explosion
  public playVictoryExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted) return;

    this.stopBeamHum();
    const now = ctx.currentTime;

    // Sub-bass drop
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(120, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.9);
    subGain.gain.setValueAtTime(0.6, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    subOsc.connect(subGain);
    subGain.connect(this.masterGain!);
    subOsc.start(now);
    subOsc.stop(now + 0.9);

    // Fanfare chord progression
    const chordFreqs = [523.25, 659.25, 783.99, 987.77, 1046.5]; // C Maj 7
    chordFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0.25, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 1.2);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 1.2);
    });
  }

  // Defeat meltdown sound
  public playDefeatSound(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted) return;

    this.stopBeamHum();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 1.0);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 1.0);
  }

  public setVolume(level: number): void {
    const clamped = Math.max(0, Math.min(1, level));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : clamped * 0.5, this.ctx.currentTime);
    }
  }

  // Triumphant power surge chime when hitting combo milestones (5, 10, 15, 20...)
  public playComboSurge(streak: number): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted) return;

    const now = ctx.currentTime;
    const baseFreq = 587.33; // D5
    const freqs = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2.0];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0.2, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.35);
    });
  }

  // Escape key tap and hold confirmation audio feedback
  public playEscapeBeep(isConfirm: boolean = false): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (isConfirm) {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(130, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.07);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.07);
    }
  }
}

export const soundEngine = new ProceduralSoundEngine();
