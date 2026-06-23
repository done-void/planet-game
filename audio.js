let audioCtx;
let masterGain;
let isMuted = false;
let bgmOscillators = [];

export function initAudio() {
  if (audioCtx) return; // 既に初期化済みの場合はスキップ
  
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContext();
  
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.5; // マスター音量
  masterGain.connect(audioCtx.destination);
  
  startBGM();
}

export function toggleMute() {
  isMuted = !isMuted;
  if (masterGain) {
    // ミュート切り替え時にノイズが乗らないように滑らかに音量変更
    masterGain.gain.setTargetAtTime(isMuted ? 0 : 0.5, audioCtx.currentTime, 0.1);
  }
  return isMuted;
}

export function playDropSound() {
  if (!audioCtx || isMuted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'sine';
  // 高い音から低い音へシュッと下がる
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
  
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  
  osc.connect(gain);
  gain.connect(masterGain);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

export function playMergeSound(planetIndex) {
  if (!audioCtx || isMuted) return;
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator(); // 豊かな響きにするために2音重ねる
  const gain = audioCtx.createGain();
  
  // 星が大きくなるほど基本音程を高くする
  const baseFreq = 400 + (planetIndex * 80);
  
  osc1.type = 'sine';
  osc2.type = 'triangle';
  
  osc1.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
  osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, audioCtx.currentTime + 0.1);
  
  osc2.frequency.setValueAtTime(baseFreq * 1.5, audioCtx.currentTime); // 完全5度上など
  osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2, audioCtx.currentTime + 0.1);
  
  gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(masterGain);
  
  osc1.start();
  osc2.start();
  osc1.stop(audioCtx.currentTime + 0.3);
  osc2.stop(audioCtx.currentTime + 0.3);
}

export function playExplosionSound() {
  if (!audioCtx || isMuted) return;
  // 超新星爆発用のノイズ音生成
  const bufferSize = audioCtx.sampleRate * 0.5; // 0.5秒
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buffer;
  
  // 低音を強調するフィルター
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1000;
  
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.8, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
  
  noiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  
  noiseSource.start();
}

function startBGM() {
  if (!audioCtx) return;
  
  // 宇宙の神秘的なアンビエント（和音のドローン）
  const frequencies = [220.00, 277.18, 329.63]; // A major chord (A3, C#4, E4)
  
  frequencies.forEach(freq => {
    const osc = audioCtx.createOscillator();
    const lfo = audioCtx.createOscillator(); // 揺らぎ用
    const oscGain = audioCtx.createGain();
    const lfoGain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = freq;
    
    // 音量をゆっくり揺らす (コーラス効果)
    lfo.type = 'sine';
    lfo.frequency.value = 0.1 + Math.random() * 0.1; // 0.1Hz〜0.2Hz
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain);
    
    // ベース音量
    oscGain.gain.value = 0.05;
    
    osc.connect(oscGain);
    lfoGain.connect(oscGain.gain); // 音量パラメータを変調
    oscGain.connect(masterGain);
    
    osc.start();
    lfo.start();
    
    bgmOscillators.push(osc);
  });
}
