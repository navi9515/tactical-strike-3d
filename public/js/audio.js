// Sound Engine using Web Audio API
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
  }

  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Create White/Pink Noise buffer
  createNoiseBuffer(duration = 0.5) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Play Gunshot (Rifle / Pistol / Sniper / Shotgun)
  playShoot(type = 'rifle') {
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Noise Source for muzzle blast punch
    const noiseDuration = type === 'sniper' ? 0.8 : (type === 'shotgun' ? 0.5 : 0.25);
    const noiseBuffer = this.createNoiseBuffer(noiseDuration);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = type === 'sniper' ? 'lowpass' : 'bandpass';
    noiseFilter.frequency.setValueAtTime(type === 'sniper' ? 800 : 2200, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(100, now + noiseDuration);

    const noiseGain = this.ctx.createGain();
    const peakVol = type === 'sniper' ? 1.2 : (type === 'shotgun' ? 1.0 : 0.7);
    noiseGain.gain.setValueAtTime(peakVol, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + noiseDuration);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseSource.start(now);

    // Low Frequency Oscillator for impact thud
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(type === 'sniper' ? 140 : 180, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);

    oscGain.gain.setValueAtTime(0.8, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Play Reload Sound
  playReload() {
    this.ensureContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Click 1 (Magazine Out)
    this.playTone(800, 'sine', 0.05, 0.2, now);
    // Click 2 (Magazine In)
    this.playTone(1200, 'sine', 0.05, 0.3, now + 0.4);
    // Slide Rack
    this.playTone(600, 'triangle', 0.08, 0.4, now + 0.8);
  }

  // Play Hitmarker Sound
  playHitmarker(isHeadshot = false) {
    this.ensureContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (isHeadshot) {
      // High metal ping for headshot
      this.playTone(2400, 'sine', 0.12, 0.4, now);
      this.playTone(3200, 'triangle', 0.15, 0.3, now + 0.04);
    } else {
      // Crisp tick for bodyshot
      this.playTone(1500, 'sine', 0.04, 0.25, now);
    }
  }

  // Play Footstep Sound
  playFootstep() {
    this.ensureContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freq = 100 + Math.random() * 40;
    this.playTone(freq, 'sine', 0.06, 0.15, now);
  }

  // Play Pickup sound
  playPickup() {
    this.ensureContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.playTone(523.25, 'sine', 0.08, 0.2, now); // C5
    this.playTone(659.25, 'sine', 0.08, 0.2, now + 0.08); // E5
    this.playTone(783.99, 'sine', 0.15, 0.3, now + 0.16); // G5
  }

  // Helper tone player
  playTone(freq, type, duration, vol, startTime) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }
}

window.soundEngine = new SoundEngine();
