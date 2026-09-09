export function playPunchInSound() {
  if (typeof window === 'undefined') return;
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    
    // Play a crisp, cheerful ascending double chime
    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.6, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = audioCtx.currentTime;
    playNote(784.00, now, 0.18);        // G5
    playNote(1046.50, now + 0.12, 0.45); // C6
  } catch (e) {
    console.error("Audio playback failed", e);
  }
}

export function playPunchOutSound() {
  if (typeof window === 'undefined') return;
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    
    // Play a distinct descending chime
    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.6, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = audioCtx.currentTime;
    playNote(1046.50, now, 0.16);       // C6
    playNote(784.00, now + 0.12, 0.18);  // G5
    playNote(523.25, now + 0.24, 0.45);  // C5
  } catch (e) {
    console.error("Audio playback failed", e);
  }
}
