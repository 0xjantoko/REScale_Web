/* ==========================================================================
   REScale Web — Demo Logic (Dark Premium)
   ========================================================================== */

const state = {
  audioFile: null,
  audioBuffer: null,
  isPlaying: false,
  isBypassed: false,
  currentFrame: 0,
  totalFrames: 0,
  sampleRate: 44100,
  channels: 2,
  chain: [
    { type: 'gain', enabled: true, params: { gain_db: -3.0 } },
    { type: 'eq', enabled: true, params: { low_gain_db: 0, mid_freq: 1000, mid_gain_db: 0, high_gain_db: 0 } },
    { type: 'compressor', enabled: true, params: { threshold_db: -12, ratio: 4, attack_ms: 5, release_ms: 80 } },
    { type: 'limiter', enabled: true, params: { ceiling_db: -0.2, lookahead_ms: 2, release_ms: 50 } }
  ],
  preset: 'default'
};

const presets = {
  default: { gain: -3.0, compressor: { threshold: -12, ratio: 4, attack: 5, release: 80 }, limiter: { ceiling: -0.2, lookahead: 2 } },
  gentle: { gain: -1.0, compressor: { threshold: -18, ratio: 2, attack: 10, release: 120 }, limiter: { ceiling: -1.0, lookahead: 3 } },
  radio: { gain: -6.0, compressor: { threshold: -16, ratio: 6, attack: 3, release: 60 }, limiter: { ceiling: -0.5, lookahead: 4 } },
  warm: { gain: 0.0, eq: { low: 3, mid_gain: 0, mid_freq: 2500, high: -2 }, compressor: { threshold: -14, ratio: 3, attack: 8, release: 100 }, limiter: { ceiling: -0.8, lookahead: 2 } },
  max: { gain: -2.0, compressor: { threshold: -10, ratio: 8, attack: 2, release: 40 }, limiter: { ceiling: -0.1, lookahead: 5 } }
};

const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const waveformCanvas = document.getElementById('waveform-canvas');
const spectrumCanvas = document.getElementById('spectrum-canvas');
const waveformCtx = waveformCanvas ? waveformCanvas.getContext('2d') : null;
const btnPlay = document.getElementById('btn-play');
const btnExport = document.getElementById('btn-export');
const transportTime = document.getElementById('transport-time');
const transportInfo = document.getElementById('transport-info');
const chainList = document.getElementById('chain-list');
const bypassToggle = document.getElementById('bypass-toggle');

let meterLFill, meterRFill, meterLPeak, meterRPeak, meterLDbl, meterRDbl;

document.addEventListener('DOMContentLoaded', () => {
  meterLFill = document.getElementById('meter-l-fill');
  meterRFill = document.getElementById('meter-r-fill');
  meterLPeak = document.getElementById('meter-l-peak');
  meterRPeak = document.getElementById('meter-r-peak');
  meterLDbl = document.getElementById('meter-l-db');
  meterRDbl = document.getElementById('meter-r-db');
});

async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  await loadAudioFile(file);
}

function handleDrop(event) {
  event.preventDefault();
  uploadZone.classList.remove('upload-zone--drag');
  const files = event.dataTransfer.files;
  if (files.length > 0 && files[0].name.endsWith('.wav')) {
    loadAudioFile(files[0]);
  } else {
    showStatus('Please drop a .wav file', 'error');
  }
}

async function loadAudioFile(file) {
  showStatus(`Loading ${file.name}...`);
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const dataView = new DataView(arrayBuffer);
    
    const fourCC = String.fromCharCode(dataView.getUint8(0), dataView.getUint8(1), dataView.getUint8(2), dataView.getUint8(3));
    if (fourCC !== 'RIFF') throw new Error('Not a valid WAV file');
    
    const format = String.fromCharCode(dataView.getUint8(8), dataView.getUint8(9), dataView.getUint8(10), dataView.getUint8(11));
    if (format !== 'WAVE') throw new Error('Not a WAVE format');
    
    let offset = 12;
    let numChannels = 0, sampleRate = 44100, bitsPerSample = 16;
    let dataOffset = 0, dataSize = 0;
    
    while (offset < arrayBuffer.byteLength - 8) {
      const chunkId = String.fromCharCode(dataView.getUint8(offset), dataView.getUint8(offset+1), dataView.getUint8(offset+2), dataView.getUint8(offset+3));
      const chunkSize = dataView.getUint32(offset + 4, true);
      
      if (chunkId === 'fmt ') {
        numChannels = dataView.getUint16(offset + 8, true);
        sampleRate = dataView.getUint32(offset + 12, true);
        bitsPerSample = dataView.getUint16(offset + 22, true);
      } else if (chunkId === 'data') {
        dataOffset = offset + 8;
        dataSize = chunkSize;
        break;
      }
      offset += 8 + chunkSize;
    }
    
    if (bitsPerSample !== 16 && bitsPerSample !== 24 && bitsPerSample !== 32) {
      throw new Error(`Unsupported bit depth: ${bitsPerSample}bit`);
    }
    
    state.sampleRate = sampleRate;
    state.channels = numChannels;
    state.totalFrames = Math.floor(dataSize / (numChannels * (bitsPerSample / 8)));
    
    const audioData = decodeWavData(dataView, dataOffset, dataSize, numChannels, bitsPerSample);
    state.audioBuffer = audioData;
    
    updateFileInfo(file, sampleRate, numChannels, bitsPerSample);
    drawWaveform(audioData, numChannels);
    btnExport.disabled = false;
    
    showStatus(`${file.name} loaded — ${sampleRate}Hz / ${numChannels}ch / ${bitsPerSample}-bit`);
  } catch (error) {
    console.error('Failed to load audio:', error);
    showStatus(`Error: ${error.message}`, 'error');
  }
}

function decodeWavData(dataView, dataOffset, dataSize, numChannels, bitsPerSample) {
  const frames = Math.floor(dataSize / (numChannels * (bitsPerSample / 8)));
  const channels = [];
  
  for (let ch = 0; ch < numChannels; ch++) {
    const channel = [];
    for (let frame = 0; frame < frames; frame++) {
      const bytePos = dataOffset + (frame * numChannels + ch) * (bitsPerSample / 8);
      
      if (bitsPerSample === 16) {
        const int16 = dataView.getInt16(bytePos, true);
        channel.push(int16 / 32768.0);
      } else if (bitsPerSample === 24) {
        const b0 = dataView.getUint8(bytePos);
        const b1 = dataView.getUint8(bytePos + 1);
        const b2 = dataView.getUint8(bytePos + 2);
        const sign = b2 & 0x80 ? -1 : 1;
        let int24 = (b0 | (b1 << 8) | ((b2 & 0x7F) << 16));
        channel.push((int24 * sign) / 8388608.0);
      } else if (bitsPerSample === 32) {
        channel.push(dataView.getFloat32(bytePos, true));
      }
    }
    channels.push(channel);
  }
  
  return { channels, frames };
}

function updateFileInfo(file, sampleRate, numChannels, bitsPerSample) {
  uploadZone.style.display = 'none';
  
  const infoDiv = document.createElement('div');
  infoDiv.className = 'file-info';
  infoDiv.id = 'file-info';
  infoDiv.innerHTML = `
    <span class="file-info__name">${file.name}</span>
    <span class="file-info__meta">${sampleRate}Hz · ${numChannels}ch · ${bitsPerSample}-bit</span>
    <button class="file-info__remove" onclick="resetUpload()">×</button>
  `;
  
  uploadZone.parentNode.insertBefore(infoDiv, uploadZone.nextSibling);
  document.getElementById('waveform-container').style.display = 'block';
}

function resetUpload() {
  state.audioBuffer = null;
  state.currentFrame = 0;
  state.isPlaying = false;
  btnPlay.textContent = '▶';
  btnExport.disabled = true;
  transportTime.textContent = '0:00.0 / 0:00.0';
  transportInfo.textContent = 'Ready — Upload WAV';
  
  const fileInfo = document.getElementById('file-info');
  if (fileInfo) fileInfo.remove();
  uploadZone.style.display = '';
  document.getElementById('waveform-container').style.display = 'none';
  
  if (meterLFill && meterRFill) {
    meterLFill.style.width = '0%';
    meterRFill.style.width = '0%';
  }
}

function drawWaveform(audioData, numChannels) {
  if (!waveformCanvas || !waveformCtx) return;
  
  const rect = waveformCanvas.getBoundingClientRect();
  waveformCanvas.width = rect.width * 2;
  waveformCanvas.height = rect.height * 2;
  
  const ctx = waveformCtx;
  const w = waveformCanvas.width;
  const h = waveformCanvas.height;
  
  ctx.clearRect(0, 0, w, h);
  
  ctx.strokeStyle = 'rgba(34, 34, 34, 0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  
  const ch0 = audioData.channels[0] || [];
  drawChannelWaveform(ctx, ch0, w, h, '#0ea5e9', 0.6);
  
  if (numChannels >= 2 && audioData.channels[1]) {
    drawChannelWaveform(ctx, audioData.channels[1], w, h, '#4b5563', 0.4);
  }
}

function drawChannelWaveform(ctx, channel, width, height, color, alpha) {
  if (channel.length === 0) return;
  
  const step = Math.max(1, Math.floor(channel.length / width));
  
  let fillColor;
  if (color === '#0ea5e9') {
    fillColor = `rgba(14, 165, 233, ${alpha})`;
  } else {
    fillColor = `rgba(75, 85, 99, ${alpha})`;
  }
  
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  
  for (let i = 0; i < width; i++) {
    const idx = i * step;
    const val = channel[idx] || 0;
    const y = height / 2 - val * height / 2;
    
    if (i === 0) ctx.moveTo(i, y);
    else ctx.lineTo(i, y);
  }
  
  ctx.lineTo(width, height / 2);
  ctx.lineTo(0, height / 2);
  ctx.closePath();
  ctx.fill();
}

function updateParam(type, value, unit) {
  const v = parseFloat(value);
  
  switch(type) {
    case 'gain':
      document.getElementById('slider-gain-val').textContent = v.toFixed(1);
      document.getElementById('param-gain-value').textContent = v.toFixed(1) + ' dB';
      state.chain[0].params.gain_db = v;
      break;
      
    case 'compressor':
      const thresh = parseFloat(document.getElementById('slider-comp-thresh').value);
      const ratio = parseFloat(document.getElementById('slider-comp-ratio').value);
      const attack = parseFloat(document.getElementById('slider-comp-attack').value);
      const release = parseFloat(document.getElementById('slider-comp-release').value);
      
      if (document.activeElement.id === 'slider-comp-thresh') {
        document.getElementById('slider-comp-thresh-val').textContent = v.toFixed(1);
        document.getElementById('param-comp-threshold').textContent = v.toFixed(0) + ' dB';
      }
      
      state.chain[2].params = { threshold_db: thresh, ratio, attack_ms: attack, release_ms: release };
      break;
      
    case 'limiter':
      if (document.activeElement.id === 'slider-limit-ceiling') {
        document.getElementById('slider-limit-ceiling-val').textContent = v.toFixed(1);
        document.getElementById('param-limit-ceiling').textContent = v.toFixed(1) + ' dB';
      }
      state.chain[3].params.ceiling_db = v;
      break;
  }
  
  updateLatencyDisplay();
}

function updateLatencyDisplay() {
  const limiterParams = state.chain.find(c => c.type === 'limiter');
  const lookaheadMs = limiterParams?.params.lookahead_ms || 2;
  const latencySamples = Math.round(state.sampleRate * lookaheadMs * 0.001);
  const latencyMs = (latencySamples / state.sampleRate * 1000).toFixed(1);
  
  const badge = document.getElementById('chain-latency');
  if (badge) badge.textContent = `latency: ~${latencyMs}ms`;
}

function addProcessor(type) {
  const existing = state.chain.findIndex(p => p.type === type);
  if (existing >= 0) {
    showStatus(`${type.charAt(0).toUpperCase() + type.slice(1)} already in chain`);
    return;
  }
  
  const defaults = {
    gain: { type: 'gain', enabled: true, params: { gain_db: 0 } },
    eq: { type: 'eq', enabled: true, params: { low_gain_db: 0, mid_freq: 1000, mid_gain_db: 0, high_gain_db: 0 } },
    compressor: { type: 'compressor', enabled: true, params: { threshold_db: -12, ratio: 4, attack_ms: 5, release_ms: 80 } },
    limiter: { type: 'limiter', enabled: true, params: { ceiling_db: -0.2, lookahead_ms: 2, release_ms: 50 } },
    delay: { type: 'delay', enabled: true, params: { delay_ms: 100, feedback: 0.3 } },
    saturator: { type: 'saturator', enabled: true, params: { drive: 0.5 } }
  };
  
  if (defaults[type]) {
    state.chain.push(defaults[type]);
    renderChainUI();
    updateLatencyDisplay();
  }
}

function removeProcessor(type) {
  state.chain = state.chain.filter(p => p.type !== type);
  renderChainUI();
  updateLatencyDisplay();
}

function renderChainUI() {
  if (!chainList) return;
  chainList.innerHTML = '';
  
  state.chain.forEach((proc, index) => {
    const item = document.createElement('div');
    item.className = `chain-item ${proc.enabled ? 'chain-item--active' : ''}`;
    item.dataset.type = proc.type;
    
    const icons = { gain: '↕', eq: '〰', compressor: '◐', limiter: '█', delay: '↻', saturator: '⋈' };
    const icon = icons[proc.type] || '?';
    
    let displayValue = '';
    if (proc.type === 'gain') displayValue = proc.params.gain_db?.toFixed(1) + ' dB';
    else if (proc.type === 'compressor') displayValue = 'R' + proc.params.ratio?.toFixed(1);
    else if (proc.type === 'limiter') displayValue = proc.params.ceiling_db?.toFixed(1) + ' dB';
    else displayValue = proc.enabled ? 'on' : 'off';
    
    item.innerHTML = `
      <span>${icon}</span>
      <span class="chain-item__name">${proc.type.charAt(0).toUpperCase() + proc.type.slice(1)}</span>
      <span class="chain-item__value">${displayValue}</span>
      <button class="chain-item__remove" onclick="removeProcessor('${proc.type}')">×</button>
    `;
    
    chainList.appendChild(item);
    
    if (index < state.chain.length - 1) {
      const arrow = document.createElement('div');
      arrow.style.cssText = 'height:1px; width:calc(100% - 20px); margin-left:10px; background:var(--border);';
      chainList.appendChild(arrow);
    }
  });
}

function togglePlayback() {
  if (!state.audioBuffer) {
    showStatus('Upload a WAV file first');
    return;
  }
  
  state.isPlaying = !state.isPlaying;
  btnPlay.textContent = state.isPlaying ? '❚❚' : '▶';
  
  if (state.isPlaying) {
    transportInfo.textContent = 'Processing...';
    startPlaybackLoop();
  } else {
    stopPlaybackLoop();
    transportInfo.textContent = 'Paused';
  }
}

function resetTransport() {
  state.isPlaying = false;
  state.currentFrame = 0;
  btnPlay.textContent = '▶';
  if (state.audioBuffer) {
    transportTime.textContent = `0:00.0 / ${formatTime(state.audioBuffer.frames, state.sampleRate)}`;
    transportInfo.textContent = 'Reset';
  }
  stopPlaybackLoop();
}

let playbackRAF = null;
let lastTime = 0;

function startPlaybackLoop() {
  if (!state.audioBuffer || !state.isPlaying) return;
  
  lastTime = performance.now();
  
  function animate(time) {
    if (!state.isPlaying) return;
    
    const delta = time - lastTime;
    lastTime = time;
    
    const framesPerSecond = state.sampleRate;
    const framesDelta = Math.floor(delta / 1000 * framesPerSecond);
    state.currentFrame = Math.min(state.currentFrame + framesDelta, state.totalFrames);
    
    const currentTime = formatTime(state.currentFrame, state.sampleRate);
    const totalTime = formatTime(state.totalFrames, state.sampleRate);
    transportTime.textContent = `${currentTime} / ${totalTime}`;
    
    updateMetersFromAudio();
    updateSpectrumFromAudio();
    
    if (state.currentFrame >= state.totalFrames) {
      state.isPlaying = false;
      btnPlay.textContent = '▶';
      transportInfo.textContent = 'Done ✓';
      showStatus('Processing complete');
      return;
    }
    
    playbackRAF = requestAnimationFrame(animate);
  }
  
  playbackRAF = requestAnimationFrame(animate);
}

function stopPlaybackLoop() {
  if (playbackRAF) {
    cancelAnimationFrame(playbackRAF);
    playbackRAF = null;
  }
}

function updateMetersFromAudio() {
  if (!state.audioBuffer) return;
  
  const ch0 = state.audioBuffer.channels[0] || [];
  const ch1 = state.audioBuffer.channels[1] || [];
  
  const startPos = Math.floor(state.currentFrame / state.sampleRate * 20);
  const blockSize = 20;
  const lEnd = Math.min(startPos + blockSize, ch0.length);
  
  let lRms = 0, rRms = 0;
  for (let i = Math.max(0, lEnd - blockSize); i < lEnd; i++) {
    lRms += (ch0[i] || 0) ** 2;
    if (ch1[i] !== undefined) rRms += (ch1[i] || 0) ** 2;
  }
  lRms = Math.sqrt(lRms / blockSize);
  rRms = Math.sqrt(rRms / blockSize);
  
  setMeterLevels(lRms, rRms);
}

function setMeterLevels(lRms, rRms) {
  if (!meterLFill || !meterRFill) return;
  
  const lDb = 20 * Math.log10(Math.max(lRms, 0.0001));
  const rDb = 20 * Math.log10(Math.max(rRms, 0.0001));
  
  const lPct = Math.max(0, Math.min(100, (lDb + 60) / 60 * 100));
  const rPct = Math.max(0, Math.min(100, (rDb + 60) / 60 * 100));
  
  meterLFill.style.width = lPct + '%';
  meterRFill.style.width = rPct + '%';
  meterLPeak.style.left = (lPct - 0.3) + '%';
  meterRPeak.style.left = (rPct - 0.3) + '%';
  
  meterLDbl.textContent = lDb.toFixed(1) + ' dBFS';
  meterRDbl.textContent = rDb.toFixed(1) + ' dBFS';
}

function toggleBypass() {
  state.isBypassed = !state.isBypassed;
  bypassToggle.classList.toggle('toggle-switch--active', !state.isBypassed);
  showStatus(state.isBypassed ? 'All processors bypassed' : 'Processing enabled');
}

function loadPreset(name) {
  const preset = presets[name];
  if (!preset) return;
  
  state.preset = name;
  
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.classList.toggle('preset-chip--active', chip.textContent.toLowerCase().includes(name) ||
      (name === 'default' && chip.textContent === 'Default'));
  });
  
  if (preset.gain !== undefined) {
    document.getElementById('slider-gain').value = preset.gain;
    updateParam('gain', preset.gain, 'dB');
  }
  
  if (preset.compressor) {
    const c = preset.compressor;
    document.getElementById('slider-comp-thresh').value = c.threshold;
    document.getElementById('slider-comp-ratio').value = c.ratio;
    document.getElementById('slider-comp-attack').value = c.attack;
    document.getElementById('slider-comp-release').value = c.release;
    updateParam('compressor', c.threshold, 'dB');
  }
  
  if (preset.limiter) {
    const l = preset.limiter;
    document.getElementById('slider-limit-ceiling').value = l.ceiling;
    document.getElementById('slider-limit-lookahead').value = l.lookahead;
    updateParam('limiter', l.ceiling, 'dB');
  }
  
  showPresetApplied(name);
}

function showPresetApplied(name) {
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  showStatus(`${label} preset applied`);
}

function exportResult() {
  if (!state.audioBuffer) {
    showStatus('No audio loaded');
    return;
  }
  
  showStatus('Encoding output WAV...');
  
  setTimeout(() => {
    showStatus('Export ready! (WASM bridge required for real processing)');
  }, 500);
}

function showStatus(message, type = 'info') {
  if (!transportInfo) return;
  transportInfo.textContent = message;
  transportInfo.style.color = type === 'error' ? '#ef4444' : 
                              type === 'success' ? '#22c55e' : 
                              '#6b7280';
}

function formatTime(frames, sampleRate) {
  const seconds = frames / sampleRate;
  const minutes = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${minutes}:${secs.padStart(4, '0')}`;
}

window.addEventListener('resize', () => {
  if (state.audioBuffer) {
    drawWaveform(state.audioBuffer, state.channels);
  }
});
