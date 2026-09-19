// Web Audio API based Sound Synthesizer for high-performance interactive gameshow sound effects

let audioCtx: AudioContext | null = null;
let isMuted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function setSoundMuted(muted: boolean) {
  isMuted = muted;
}

export function getSoundMuted(): boolean {
  return isMuted;
}

// 1. Crisp clicking / ticking for Wheel of Fortune & Slot Machine
export function playTick(pitch = 600) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.4, ctx.currentTime + 0.04);
    
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.045);
  } catch (e) {
    console.debug('Audio error', e);
  }
}

// 2. Triumphant Fanfare for Winner Selection (Trumpet/Brass chord progression)
export function playWinnerFanfare() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [
      { freq: 392.00, time: 0, dur: 0.15 },    // G4
      { freq: 523.25, time: 0.16, dur: 0.15 }, // C5
      { freq: 659.25, time: 0.32, dur: 0.18 }, // E5
      { freq: 783.99, time: 0.50, dur: 0.45 }, // G5
      { freq: 1046.50, time: 0.70, dur: 0.8 }, // C6 (Grand finish)
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + time);
      
      // Filter to soften brass
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now + time);

      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(0.22, now + time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  } catch (e) {
    console.debug('Audio error', e);
  }
}

// 3. Question Card Entrance Chime
export function playQuestionEnter() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C - E - G - C arpeggio
    
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.6);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.65);
    });
  } catch (e) {
    console.debug('Audio error', e);
  }
}

// 4. Dramatic Suspense Chime before revealing answer
export function playSuspenseTension() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(140, now + 1.2);
    
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 1.0);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 1.35);
  } catch (e) {
    console.debug('Audio error', e);
  }
}

// 5. Correct Answer Celebration Sound (Upbeat bells & sparkles)
export function playCorrectAnswerSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const bells = [
      { f: 587.33, t: 0, d: 0.3 },   // D5
      { f: 739.99, t: 0.1, d: 0.3 }, // F#5
      { f: 880.00, t: 0.2, d: 0.4 }, // A5
      { f: 1174.66, t: 0.35, d: 0.9 } // D6
    ];

    bells.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + t);
      
      gain.gain.setValueAtTime(0, now + t);
      gain.gain.linearRampToValueAtTime(0.25, now + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + t);
      osc.stop(now + t + d);
    });
  } catch (e) {
    console.debug('Audio error', e);
  }
}

// 6. Magic Swirl / Whoosh for VTS Balls & Mystery Chest
export function playMagicWhoosh() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(950, now + 0.3);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.6);
    
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.65);
  } catch (e) {
    console.debug('Audio error', e);
  }
}

// 7. Space Rocket Thruster / Countdown Beep
export function playRocketBeep(final = false) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(final ? 880 : 440, now);
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (final ? 0.4 : 0.12));
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + (final ? 0.45 : 0.15));
  } catch (e) {
    console.debug('Audio error', e);
  }
}

// 8. Crisp Click / Chime when student selects an answer option
export function playOptionSelectSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, now); // E5
    osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12); // A5

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  } catch (e) {
    console.debug('Audio error', e);
  }
}

// 9. Dramatic Tension & Heartbeat Suspense during answer locking
export function playDramaticLockingLoop(): () => void {
  if (isMuted) return () => {};
  const ctx = getAudioContext();
  if (!ctx) return () => {};

  let isStopped = false;
  const scheduledTimeouts: ReturnType<typeof setTimeout>[] = [];

  try {
    // Pulse every 320ms with rising intensity
    const totalBeats = 7;
    for (let i = 0; i < totalBeats; i++) {
      const delay = i * 340;
      const t = setTimeout(() => {
        if (isStopped || !ctx) return;
        try {
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'triangle';
          const freq = 120 + i * 25; // Accelerating pitch
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.18);

          gain.gain.setValueAtTime(0.2 + i * 0.04, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.26);
        } catch (err) {
          console.debug(err);
        }
      }, delay);
      scheduledTimeouts.push(t);
    }
  } catch (e) {
    console.debug('Audio error', e);
  }

  return () => {
    isStopped = true;
    scheduledTimeouts.forEach(clearTimeout);
  };
}

// 10. Gameshow Wrong Answer Buzzer / Empathy Sound
export function playWrongAnswerSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    
    // Two descending buzzer tones
    [
      { freq: 220, time: 0, dur: 0.2 },
      { freq: 174, time: 0.24, dur: 0.45 },
    ].forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + time);
      osc.frequency.linearRampToValueAtTime(freq * 0.85, now + time + dur);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, now + time);

      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(0.2, now + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  } catch (e) {
    console.debug('Audio error', e);
  }
}

