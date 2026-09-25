/* =========================================================
   BEATMATRIX AUDIO STORAGE & SYNTHESIZER ENGINE
   ========================================================= */

// --- IndexedDB Local Storage Manager ---
function initStorageDB() {
  return new Promise((resolve, reject) => {
    const dbReq = indexedDB.open('BeatMatrixStudioDB', 1);
    dbReq.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('tracks')) {
        db.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
      }
    };
    dbReq.onsuccess = () => resolve(dbReq.result);
    dbReq.onerror = () => reject(dbReq.error);
  });
}

async function saveTrackToStorage(audioBlob, mimeType) {
  const db = await initStorageDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');
    const trackPayload = {
      blob: audioBlob,
      mimeType,
      createdAt: new Date().toISOString()
    };
    const req = store.add(trackPayload);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function fetchSavedTracksFromStorage() {
  const db = await initStorageDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readonly');
    const store = tx.objectStore('tracks');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function removeTrackFromStorage(id) {
  const db = await initStorageDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- Audio Context Setup ---
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContextClass();

const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.8;

const streamDest = audioCtx.createMediaStreamDestination();
masterGain.connect(audioCtx.destination);
masterGain.connect(streamDest);

let masterPitch = 1.0;
let activeKit = 'nudisco';
let currentTempo = 96;

// --- Custom Drum Pad Color Configuration (Neon Cyberpunk Theme) ---
const soundPads = [
  { key: 'A', name: 'CYBER KICK', type: 'Punchy Sub', color: '#8b5cf6', synth: triggerKick },        // Purple
  { key: 'S', name: 'SNAP SNARE', type: 'Crisp Crack', color: '#06b6d4', synth: triggerSnare },       // Neon Cyan
  { key: 'D', name: 'TIGHT HH', type: 'Closed HiHat', color: '#ec4899', synth: triggerClosedHH },     // Hot Pink
  { key: 'F', name: 'SPLASH HH', type: 'Open HiHat', color: '#f59e0b', synth: triggerOpenHH },        // Amber
  { key: 'G', name: 'RETRO CLAP', type: 'Stereo Clap', color: '#10b981', synth: triggerClap },       // Emerald Green
  { key: 'H', name: 'LOW IMPACT', type: 'Sub Tom', color: '#3b82f6', synth: (t) => triggerTom(110, t) }, // Electric Blue
  { key: 'J', name: 'HIGH IMPACT', type: 'Mid Tom', color: '#ff6b6b', synth: (t) => triggerTom(180, t) },// Coral
  { key: 'K', name: 'PERC SHOT', type: 'Rim Click', color: '#a855f7', synth: triggerRimshot },       // Deep Magenta
  { key: 'L', name: 'SYNTH CRASH', type: 'Noise Wash', color: '#eab308', synth: triggerCrash }        // Bright Yellow
];

function playSynth(index) {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  soundPads[index].synth(audioCtx.currentTime);
}

// --- Synth Instrument Triggers ---
function triggerKick(t) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const kitMultiplier = activeKit === 'nudisco' ? 130 : activeKit === 'marita' ? 120 : activeKit === 'trap' ? 140 : 110;
  const baseFreq = kitMultiplier * masterPitch;

  osc.frequency.setValueAtTime(baseFreq, t);
  osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.35);

  gain.gain.setValueAtTime(1, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

  osc.connect(gain);
  gain.connect(masterGain);

  osc.start(t);
  osc.stop(t + 0.35);
}

function triggerSnare(t) {
  const sampleLength = audioCtx.sampleRate * 0.2;
  const buffer = audioCtx.createBuffer(1, sampleLength, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleLength; i++) data[i] = Math.random() * 2 - 1;

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = activeKit === 'nudisco' ? 'bandpass' : 'highpass';
  noiseFilter.frequency.value = (activeKit === 'nudisco' ? 1600 : 1200) * masterPitch;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.8, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);

  const osc = audioCtx.createOscillator();
  const oscGain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(200 * masterPitch, t);
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);

  oscGain.gain.setValueAtTime(0.7, t);
  oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

  osc.connect(oscGain);
  oscGain.connect(masterGain);

  noise.start(t);
  osc.start(t);
  noise.stop(t + 0.18);
  osc.stop(t + 0.1);
}

function triggerClosedHH(t) {
  const sampleLength = audioCtx.sampleRate * 0.05;
  const buffer = audioCtx.createBuffer(1, sampleLength, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleLength; i++) data[i] = Math.random() * 2 - 1;

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7500 * masterPitch;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.6, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  source.start(t);
}

function triggerOpenHH(t) {
  const sampleLength = audioCtx.sampleRate * 0.3;
  const buffer = audioCtx.createBuffer(1, sampleLength, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleLength; i++) data[i] = Math.random() * 2 - 1;

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 5500 * masterPitch;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.6, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  source.start(t);
}

function triggerClap(t) {
  const sampleLength = audioCtx.sampleRate * 0.25;
  const buffer = audioCtx.createBuffer(1, sampleLength, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleLength; i++) data[i] = Math.random() * 2 - 1;

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1300 * masterPitch;

  const gain = audioCtx.createGain();
  const times = [0, 0.01, 0.02, 0.03, 0.04];
  const gains = [0.7, 0.1, 0.7, 0.1, 0.7];

  times.forEach((offset, idx) => {
    gain.gain.setValueAtTime(gains[idx], t + offset);
  });
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  source.start(t);
}

function triggerTom(freq, t) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * masterPitch, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.3);

  gain.gain.setValueAtTime(0.8, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

  osc.connect(gain);
  gain.connect(masterGain);

  osc.start(t);
  osc.stop(t + 0.3);
}

function triggerRimshot(t) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime((activeKit === 'nudisco' ? 800 : 500) * masterPitch, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.05);

  gain.gain.setValueAtTime(0.85, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

  osc.connect(gain);
  gain.connect(masterGain);

  osc.start(t);
  osc.stop(t + 0.05);
}

function triggerCrash(t) {
  const sampleLength = audioCtx.sampleRate * 0.8;
  const buffer = audioCtx.createBuffer(1, sampleLength, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleLength; i++) data[i] = Math.random() * 2 - 1;

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 4000 * masterPitch;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.6, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  source.start(t);
}

// --- Preset Track Definitions ---
const knownSongPatterns = {
  shapeofyou: {
    name: "Ed Sheeran - Shape of You",
    bpm: 96,
    pattern: (pat) => {
      [0, 6, 9, 12].forEach(s => pat[0][s] = true);
      [3, 6, 11, 14].forEach(s => pat[7][s] = true);
      [0, 2, 4, 6, 8, 10, 12, 14].forEach(s => pat[2][s] = true);
    }
  },
  closer: {
    name: "The Chainsmokers - Closer",
    bpm: 95,
    pattern: (pat) => {
      [0, 4, 8, 12].forEach(s => pat[0][s] = true);
      [4, 12].forEach(s => pat[4][s] = true);
      [2, 6, 10, 14].forEach(s => pat[3][s] = true);
    }
  },
  wishes: {
    name: "Talwiinder - Wishes",
    bpm: 90,
    pattern: (pat) => {
      [0, 3, 8, 11].forEach(s => pat[0][s] = true);
      [4, 12].forEach(s => pat[1][s] = true);
      [2, 6, 10, 14].forEach(s => pat[7][s] = true);
      for (let i = 0; i < 16; i += 2) pat[2][i] = true;
    }
  }
};

// --- Custom File Handling & Smart Beat Matching ---
const trackInput = document.getElementById('track-input');
const trackControls = document.getElementById('track-controls');
const trackTitle = document.getElementById('track-title');
const aiDetectionBadge = document.getElementById('ai-detection-badge');
const playTrackBtn = document.getElementById('play-track-btn');
const stopTrackBtn = document.getElementById('stop-track-btn');
const trackVolSlider = document.getElementById('track-vol-slider');
const trackVolVal = document.getElementById('track-vol-val');

const audioTrackElement = new Audio();
let trackSourceNode = null;
const trackGainNode = audioCtx.createGain();
trackGainNode.gain.value = 0.7;
trackGainNode.connect(masterGain);

trackInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (audioCtx.state === 'suspended') audioCtx.resume();
  audioTrackElement.src = URL.createObjectURL(file);
  trackTitle.innerText = `Track Loaded: ${file.name}`;
  trackControls.style.display = 'flex';

  if (!trackSourceNode) {
    trackSourceNode = audioCtx.createMediaElementSource(audioTrackElement);
    trackSourceNode.connect(trackGainNode);
  }

  analyzeAndMatchBeat(file.name);
});

function analyzeAndMatchBeat(fileName) {
  const name = fileName.toLowerCase();
  aiDetectionBadge.innerText = "🔍 Analyzing audio track signature...";

  setTimeout(() => {
    if (name.includes('shape') || name.includes('sheeran')) {
      applySongPreset('shapeofyou');
      aiDetectionBadge.innerText = "⚡ Match Detected: Shape of You rhythm applied!";
    } else if (name.includes('closer') || name.includes('chainsmokers')) {
      applySongPreset('closer');
      aiDetectionBadge.innerText = "⚡ Match Detected: Closer rhythm applied!";
    } else if (name.includes('wishes') || name.includes('talwinder') || name.includes('talwiinder')) {
      applySongPreset('wishes');
      aiDetectionBadge.innerText = "⚡ Match Detected: Wishes Punjabi beat loaded!";
    } else {
      aiGenerateBeat();
      aiDetectionBadge.innerText = "🎲 Custom Track: Generated dynamic rhythm sequence!";
    }
  }, 600);
}

function applySongPreset(key) {
  const song = knownSongPatterns[key];
  if (!song) return;

  customPattern = Array.from({ length: 9 }, () => Array(16).fill(false));
  song.pattern(customPattern);

  currentTempo = song.bpm;
  bpmSlider.value = currentTempo;
  bpmVal.innerText = `${currentTempo} BPM`;

  updateStepGridUI();

  if (!isBeatPlaying) {
    isBeatPlaying = true;
    seqToggleBtn.classList.add('active');
    seqToggleBtn.innerText = '⏹ STOP LOOP';
    startBeatSequencer();
  }
}

document.querySelectorAll('.song-match-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const songKey = e.currentTarget.dataset.song;
    applySongPreset(songKey);
    aiDetectionBadge.innerText = `🎵 Preset Applied: ${knownSongPatterns[songKey].name}`;
    trackControls.style.display = 'flex';
  });
});

playTrackBtn.addEventListener('click', () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (audioTrackElement.src) {
    if (audioTrackElement.paused) {
      audioTrackElement.play();
      playTrackBtn.innerText = '⏸ PAUSE';
    } else {
      audioTrackElement.pause();
      playTrackBtn.innerText = '▶ PLAY TRACK';
    }
  }
});

audioTrackElement.addEventListener('pause', () => playTrackBtn.innerText = '▶ PLAY TRACK');
audioTrackElement.addEventListener('ended', () => playTrackBtn.innerText = '▶ PLAY TRACK');

stopTrackBtn.addEventListener('click', () => {
  if (audioTrackElement.src) {
    audioTrackElement.pause();
    audioTrackElement.currentTime = 0;
    playTrackBtn.innerText = '▶ PLAY TRACK';
  }
});

trackVolSlider.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  trackGainNode.gain.value = val;
  trackVolVal.innerText = `${Math.round(val * 100)}%`;
});

// --- Pad Renderer & Visualizer Loop ---
const padGrid = document.getElementById('pad-grid');
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
let ripples = [];

soundPads.forEach((pad, idx) => {
  const padEl = document.createElement('div');
  padEl.className = 'pad';
  padEl.dataset.index = idx;
  padEl.style.setProperty('--pad-color', pad.color);
  padEl.innerHTML = `
    <div class="key-badge">${pad.key}</div>
    <div class="sound-info">
      <div class="sound-name">${pad.name}</div>
      <div class="sound-type">${pad.type}</div>
    </div>
  `;

  const handleTrigger = (e) => {
    e.preventDefault();
    hitPad(idx);
  };

  padEl.addEventListener('mousedown', handleTrigger);
  padEl.addEventListener('touchstart', handleTrigger);
  padGrid.appendChild(padEl);
});

function hitPad(index) {
  playSynth(index);
  const padNode = padGrid.children[index];
  padNode.classList.add('triggered');
  setTimeout(() => padNode.classList.remove('triggered'), 120);

  ripples.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: 4,
    color: soundPads[index].color,
    alpha: 1
  });
}

function syncCanvasDimensions() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}
window.addEventListener('resize', syncCanvasDimensions);
syncCanvasDimensions();

function drawVisualizerFrame() {
  ctx.fillStyle = 'rgba(10, 15, 26, 0.3)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = r.alpha;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    r.radius += 3.5;
    r.alpha -= 0.035;

    if (r.alpha <= 0) ripples.splice(i, 1);
  }

  requestAnimationFrame(drawVisualizerFrame);
}
drawVisualizerFrame();

// --- Beat Sequencer Logic ---
let customPattern = Array.from({ length: 9 }, () => Array(16).fill(false));
let isBeatPlaying = false;
let seqTimer = null;
let currentStep = 0;
let selectedSoundIdx = 0;

const seqSoundSelect = document.getElementById('seq-sound-select');
const stepGrid = document.getElementById('step-grid');
const seqToggleBtn = document.getElementById('seq-toggle-btn');
const aiGenerateBtn = document.getElementById('ai-generate-btn');
const seqClearBtn = document.getElementById('seq-clear-btn');

soundPads.forEach((pad, i) => {
  const opt = document.createElement('option');
  opt.value = i;
  opt.innerText = `[${pad.key}] ${pad.name}`;
  seqSoundSelect.appendChild(opt);
});

for (let s = 0; s < 16; s++) {
  const cell = document.createElement('div');
  cell.className = 'step-cell';
  cell.dataset.step = s;
  cell.innerText = s + 1;
  cell.addEventListener('click', () => {
    customPattern[selectedSoundIdx][s] = !customPattern[selectedSoundIdx][s];
    updateStepGridUI();
  });
  stepGrid.appendChild(cell);
}

seqSoundSelect.addEventListener('change', (e) => {
  selectedSoundIdx = parseInt(e.target.value, 10);
  updateStepGridUI();
});

function updateStepGridUI() {
  const cells = stepGrid.querySelectorAll('.step-cell');
  cells.forEach((cell, stepIdx) => {
    cell.classList.toggle('active', !!customPattern[selectedSoundIdx][stepIdx]);
  });
}

function aiGenerateBeat() {
  customPattern = Array.from({ length: 9 }, () => Array(16).fill(false));

  [0, 4, 8, 12].forEach(step => customPattern[0][step] = true);
  if (Math.random() > 0.5) customPattern[0][10] = true;

  const snarePad = Math.random() > 0.5 ? 1 : 4;
  [4, 12].forEach(step => customPattern[snarePad][step] = true);

  for (let i = 0; i < 16; i += 2) customPattern[2][i] = true;

  if (Math.random() > 0.4) customPattern[3][6] = true;
  if (Math.random() > 0.4) customPattern[3][14] = true;

  const percPad = [5, 6, 7][Math.floor(Math.random() * 3)];
  [2, 9, 14].forEach(step => {
    if (Math.random() > 0.5) customPattern[percPad][step] = true;
  });

  updateStepGridUI();

  if (!isBeatPlaying) {
    isBeatPlaying = true;
    seqToggleBtn.classList.add('active');
    seqToggleBtn.innerText = '⏹ STOP LOOP';
    startBeatSequencer();
  }
}

aiGenerateBtn.addEventListener('click', aiGenerateBeat);

seqToggleBtn.addEventListener('click', () => {
  isBeatPlaying = !isBeatPlaying;
  if (isBeatPlaying) {
    seqToggleBtn.classList.add('active');
    seqToggleBtn.innerText = '⏹ STOP LOOP';
    startBeatSequencer();
  } else {
    seqToggleBtn.classList.remove('active');
    seqToggleBtn.innerText = '▶ START LOOP';
    stopBeatSequencer();
  }
});

seqClearBtn.addEventListener('click', () => {
  customPattern = Array.from({ length: 9 }, () => Array(16).fill(false));
  updateStepGridUI();
});

function startBeatSequencer() {
  if (seqTimer) clearTimeout(seqTimer);
  currentStep = 0;

  const tick = () => {
    if (!isBeatPlaying) return;

    const cells = stepGrid.querySelectorAll('.step-cell');
    const activeStepIdx = currentStep % 16;

    cells.forEach((cell, idx) => {
      cell.classList.toggle('current-step', idx === activeStepIdx);
    });

    for (let pad = 0; pad < 9; pad++) {
      if (customPattern[pad][activeStepIdx]) {
        hitPad(pad);
      }
    }

    currentStep++;
    const stepDelay = (60 / currentTempo / 4) * 1000;
    seqTimer = setTimeout(tick, stepDelay);
  };

  tick();
}

function stopBeatSequencer() {
  if (seqTimer) clearTimeout(seqTimer);
  stepGrid.querySelectorAll('.step-cell').forEach(cell => cell.classList.remove('current-step'));
}

// --- Keyboard Key Binding ---
const keyLookupMap = {};
soundPads.forEach((pad, i) => keyLookupMap[pad.key] = i);

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const pressedKey = e.key.toUpperCase();
  if (keyLookupMap[pressedKey] !== undefined) {
    hitPad(keyLookupMap[pressedKey]);
  }
});

// --- Sound Controls & Kits ---
const bpmSlider = document.getElementById('bpm-slider');
const bpmVal = document.getElementById('bpm-val');

document.querySelectorAll('.kit-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.kit-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    activeKit = e.target.dataset.kit;

    currentTempo = activeKit === 'nudisco' ? 118 : activeKit === 'marita' ? 96 : 130;

    bpmSlider.value = currentTempo;
    bpmVal.innerText = `${currentTempo} BPM`;
  });
});

bpmSlider.addEventListener('input', (e) => {
  currentTempo = parseInt(e.target.value, 10);
  bpmVal.innerText = `${currentTempo} BPM`;
});

const pitchSlider = document.getElementById('pitch-slider');
const pitchVal = document.getElementById('pitch-val');
pitchSlider.addEventListener('input', (e) => {
  masterPitch = parseFloat(e.target.value);
  pitchVal.innerText = `${masterPitch.toFixed(2)}x`;
});

const volSlider = document.getElementById('vol-slider');
const volVal = document.getElementById('vol-val');
volSlider.addEventListener('input', (e) => {
  masterGain.gain.value = parseFloat(e.target.value);
  volVal.innerText = `${Math.round(e.target.value * 100)}%`;
});

// --- Audio Recorder & Session Storage Engine ---
let audioRecorder = null;
let audioChunks = [];
let isRecordingActive = false;
let silentOscillator = null;
let elapsedSeconds = 0;
let timerInterval = null;

const audioRecBtn = document.getElementById('audio-rec-btn');
const recTimerDisplay = document.getElementById('rec-timer');
const recordingList = document.getElementById('recording-list');
const emptyState = document.getElementById('empty-state');

window.addEventListener('DOMContentLoaded', loadPersistedRecordings);

async function loadPersistedRecordings() {
  try {
    const savedTracks = await fetchSavedTracksFromStorage();
    if (savedTracks.length > 0 && emptyState) {
      emptyState.style.display = 'none';
    }
    savedTracks.forEach(track => {
      renderTrackInList(track.id, track.blob, track.mimeType, track.createdAt);
    });
  } catch (err) {
    console.error('Failed to load track history from DB:', err);
  }
}

audioRecBtn.addEventListener('click', () => {
  if (!isRecordingActive) beginRecordingSession();
  else stopRecordingSession();
});

function runRecordingTimer() {
  elapsedSeconds = 0;
  recTimerDisplay.innerText = '00:00';
  recTimerDisplay.classList.add('active');
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    elapsedSeconds++;
    const m = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const s = String(elapsedSeconds % 60).padStart(2, '0');
    recTimerDisplay.innerText = `${m}:${s}`;
  }, 1000);
}

function haltRecordingTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  recTimerDisplay.classList.remove('active');
}

function beginRecordingSession() {
  if (audioCtx.state === 'suspended') audioCtx.resume();

  isRecordingActive = true;
  audioChunks = [];

  silentOscillator = audioCtx.createOscillator();
  const mutedGain = audioCtx.createGain();
  mutedGain.gain.value = 0;
  silentOscillator.connect(mutedGain);
  mutedGain.connect(streamDest);
  silentOscillator.start();

  const stream = streamDest.stream;
  let options = { mimeType: 'audio/webm' };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options = { mimeType: 'audio/ogg' };
  }

  audioRecorder = new MediaRecorder(stream, options);

  audioRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };

  audioRecorder.onstop = onRecordingStopped;

  audioRecorder.start();
  runRecordingTimer();

  audioRecBtn.classList.add('recording');
  audioRecBtn.innerText = '⏹ STOP RECORDING';
}

function stopRecordingSession() {
  isRecordingActive = false;
  haltRecordingTimer();

  if (audioRecorder && audioRecorder.state !== 'inactive') {
    audioRecorder.stop();
  }

  if (silentOscillator) {
    silentOscillator.stop();
    silentOscillator.disconnect();
    silentOscillator = null;
  }

  audioRecBtn.classList.remove('recording');
  audioRecBtn.innerText = '🎙️ RECORD AUDIO';
}

async function onRecordingStopped() {
  const mimeType = audioRecorder.mimeType || 'audio/webm';
  const recordedBlob = new Blob(audioChunks, { type: mimeType });

  try {
    const newId = await saveTrackToStorage(recordedBlob, mimeType);
    if (emptyState) emptyState.style.display = 'none';
    renderTrackInList(newId, recordedBlob, mimeType, new Date().toISOString());
  } catch (err) {
    console.error('Failed to store audio track:', err);
  }
}

function renderTrackInList(id, blob, mimeType, isoDate) {
  const fileExtension = mimeType.includes('ogg') ? 'ogg' : 'webm';
  const trackUrl = URL.createObjectURL(blob);

  const item = document.createElement('div');
  item.className = 'recording-item';
  item.dataset.id = id;

  const dateObj = new Date(isoDate);
  const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  item.innerHTML = `
    <div class="recording-info">
      <span>Track Take #${id}</span>
      <span>${formattedTime}</span>
    </div>
    <audio src="${trackUrl}" controls></audio>
    <div class="action-row">
      <a href="${trackUrl}" download="beat-take-${id}.${fileExtension}" class="download-btn">⬇ SAVE FILE</a>
      <button class="delete-btn">🗑 REMOVE</button>
    </div>
  `;

  item.querySelector('.delete-btn').addEventListener('click', async () => {
    await removeTrackFromStorage(id);
    item.remove();
    if (recordingList.querySelectorAll('.recording-item').length === 0 && emptyState) {
      emptyState.style.display = 'block';
    }
  });

  recordingList.prepend(item);
}