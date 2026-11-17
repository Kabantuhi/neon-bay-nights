// Synthesized sound for Neon Bay Nights. No audio files: every effect and the music loop
// are built from WebAudio oscillators and filtered noise, so the game loads nothing over
// the network and works fully offline.
export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let step = 0;

  // A simple late-night synthwave loop: Am – F – C – G, a bass note plus a soft pad.
  const CHORDS = [
    [110, 130.8, 164.8],
    [87.3, 110, 130.8],
    [130.8, 164.8, 196],
    [98, 123.5, 146.8],
  ];

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineGain.connect(master);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineOsc.start();
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenGain.connect(master);
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 750;
      sirenOsc.connect(sirenGain);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure()) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  function playChord(notes) {
    if (!ensure()) return;
    for (const freq of notes) {
      const osc = context.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = context.createGain();
      const now = context.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.4);
      gain.gain.linearRampToValueAtTime(0.0001, now + 1.9);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(now);
      osc.stop(now + 2);
    }
    const bass = context.createOscillator();
    bass.type = 'sine';
    bass.frequency.value = notes[0] / 2;
    const bassGain = context.createGain();
    const now = context.currentTime;
    bassGain.gain.setValueAtTime(0.0001, now);
    bassGain.gain.linearRampToValueAtTime(0.9, now + 0.1);
    bassGain.gain.linearRampToValueAtTime(0.0001, now + 1.9);
    bass.connect(bassGain);
    bassGain.connect(musicGain);
    bass.start(now);
    bass.stop(now + 2);
  }

  return {
    unlock() {
      ensure();
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      playChord(CHORDS[0]);
      step = 1;
      musicTimer = window.setInterval(() => {
        playChord(CHORDS[step % CHORDS.length]);
        step += 1;
      }, 2000);
    },
    stopMusic() {
      if (musicTimer) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    gunshot() {
      noise(0.18, 0.9, 1800);
      tone(160, 0.12, 'square', 0.25, 60);
    },
    punch() {
      noise(0.12, 0.6, 500);
      tone(90, 0.1, 'sine', 0.4, 50);
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.35);
      window.setTimeout(() => tone(990, 0.18, 'sine', 0.35), 90);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        window.setTimeout(() => tone(freq, 0.25, 'triangle', 0.4), i * 110);
      });
    },
    missionFail() {
      tone(220, 0.5, 'sawtooth', 0.3, 110);
    },
    siren(on) {
      if (!ensure()) return;
      sirenGain.gain.linearRampToValueAtTime(on ? 0.05 : 0, context.currentTime + 0.3);
    },
    sirenWail(time) {
      if (!ensure() || !sirenOsc) return;
      sirenOsc.frequency.value = 700 + 180 * Math.sin(time * 4);
    },
    engine(speed, driving) {
      if (!ensure()) return;
      engineGain.gain.linearRampToValueAtTime(driving ? 0.05 + speed * 0.002 : 0, context.currentTime + 0.1);
      engineOsc.frequency.value = 50 + speed * 3.2;
    },
    crash() {
      noise(0.35, 0.8, 900);
    },
    hurt() {
      tone(140, 0.25, 'sawtooth', 0.35, 70);
    },
    busted() {
      tone(440, 0.2, 'square', 0.3);
      window.setTimeout(() => tone(330, 0.35, 'square', 0.3), 180);
    },
    click() {
      tone(800, 0.06, 'sine', 0.25);
    },
  };
}
