/* ==========================================================================
   REScale Web — Spectrum Analyzer (Dark Premium)
   ========================================================================== */

const SPECTRUM_BINS = [
  { label: '63', center: 63 },
  { label: '125', center: 125 },
  { label: '250', center: 250 },
  { label: '500', center: 500 },
  { label: '1k', center: 1000 },
  { label: '2k', center: 2000 },
  { label: '4k', center: 4000 },
  { label: '8k', center: 8000 },
  { label: '16k', center: 16000 }
];

const COLORS = {
  bg: '#030303',
  grid: 'rgba(34, 34, 34, 0.8)',
  text: '#4b5563',
  bars: ['#22c55e', '#22c55e', '#34d399', '#6ee7b7', '#facc15', '#fbbf24', '#fb923c', '#f87171', '#ef4444'],
  dominant: '#0ea5e9'
};

let spectrumCanvas, spectrumCtx;

document.addEventListener('DOMContentLoaded', () => {
  spectrumCanvas = document.getElementById('spectrum-canvas');
  if (!spectrumCanvas || !spectrumCanvas.getContext) return;
  
  spectrumCtx = spectrumCanvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = spectrumCanvas.getBoundingClientRect();
  spectrumCanvas.width = rect.width * dpr;
  spectrumCanvas.height = rect.height * dpr;
  spectrumCtx.scale(dpr, dpr);
  
  drawIdleSpectrum();
});

function drawIdleSpectrum() {
  if (!spectrumCtx) return;
  
  const w = spectrumCanvas.width / (window.devicePixelRatio || 1);
  const h = spectrumCanvas.height / (window.devicePixelRatio || 1);
  
  spectrumCtx.clearRect(0, 0, w, h);
  spectrumCtx.fillStyle = COLORS.bg;
  spectrumCtx.fillRect(0, 0, w, h);
  
  // Grid
  spectrumCtx.strokeStyle = COLORS.grid;
  spectrumCtx.lineWidth = 0.5;
  
  const gridLines = [-48, -36, -24, -12, 0];
  gridLines.forEach(db => {
    const y = dbToY(db, h);
    spectrumCtx.beginPath();
    spectrumCtx.moveTo(30, y);
    spectrumCtx.lineTo(w - 10, y);
    spectrumCtx.stroke();
    
    spectrumCtx.fillStyle = COLORS.text;
    spectrumCtx.font = '9px JetBrains Mono, monospace';
    spectrumCtx.fillText(`${db}`, 2, y + 3);
  });
  
  const binWidth = (w - 50) / SPECTRUM_BINS.length;
  SPECTRUM_BINS.forEach((bin, i) => {
    const x = 40 + i * binWidth + binWidth / 2;
    spectrumCtx.beginPath();
    spectrumCtx.moveTo(x, 10);
    spectrumCtx.lineTo(x, h - 20);
    spectrumCtx.stroke();
  });
  
  spectrumCtx.fillStyle = COLORS.text;
  spectrumCtx.font = '10px JetBrains Mono, monospace';
  SPECTRUM_BINS.forEach((bin, i) => {
    const x = 40 + i * binWidth + binWidth / 2;
    spectrumCtx.fillText(bin.label, x - 8, h - 6);
  });
  
  // Flat bars (idle)
  const meterBottom = h - 20;
  SPECTRUM_BINS.forEach((bin, i) => {
    const x = 40 + i * binWidth + 4;
    const bw = binWidth - 8;
    spectrumCtx.fillStyle = COLORS.bars[i];
    spectrumCtx.globalAlpha = 0.15;
    spectrumCtx.fillRect(x, meterBottom - 6, bw, 6);
    spectrumCtx.globalAlpha = 1;
  });
}

function updateSpectrumFromAudio() {
  if (!state?.audioBuffer || !spectrumCtx) return;
  
  const audioData = state.audioBuffer;
  const w = spectrumCanvas.width / (window.devicePixelRatio || 1);
  const h = spectrumCanvas.height / (window.devicePixelRatio || 1);
  
  spectrumCtx.clearRect(0, 0, w, h);
  drawGrid(w, h);
  
  const frames = audioData.channels[0] || [];
  const binSize = Math.floor(frames.length / SPECTRUM_BINS.length);
  let maxEnergy = 0;
  let dominantFreq = 0;
  
  const energies = SPECTRUM_BINS.map((bin, i) => {
    const start = Math.min(i * binSize, frames.length - 1);
    const end = Math.min(start + binSize, frames.length);
    
    let energy = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      const sample = frames[j] || 0;
      energy += sample * sample;
      count++;
    }
    
    const rms = Math.sqrt(energy / Math.max(count, 1));
    if (rms > maxEnergy) {
      maxEnergy = rms;
      dominantFreq = bin.center;
    }
    
    return rms;
  });
  
  const normalizedEnergies = energies.map(e => {
    if (e === 0) return -Infinity;
    return 20 * Math.log10(Math.max(e, 0.0001));
  });
  
  const binWidth = (w - 50) / SPECTRUM_BINS.length;
  const meterBottom = h - 20;
  
  SPECTRUM_BINS.forEach((bin, i) => {
    const x = 40 + i * binWidth + 4;
    const bw = binWidth - 8;
    
    const db = normalizedEnergies[i];
    const pct = dbToPercentage(db, h);
    const barHeight = Math.max(0, pct);
    
    const gradient = spectrumCtx.createLinearGradient(0, meterBottom, 0, meterBottom - barHeight);
    gradient.addColorStop(0, COLORS.bars[i]);
    gradient.addColorStop(1, hexToRgba(COLORS.bars[i], 0.2));
    
    spectrumCtx.fillStyle = gradient;
    spectrumCtx.fillRect(x, meterBottom - barHeight, bw, barHeight);
    
    if (barHeight > (h - 30) * 0.5) {
      spectrumCtx.shadowColor = COLORS.bars[i];
      spectrumCtx.shadowBlur = 6;
      spectrumCtx.fillRect(x, meterBottom - barHeight, bw, 2);
      spectrumCtx.shadowBlur = 0;
    }
    
    if (bin.center === dominantFreq && energies[i] > maxEnergy * 0.5) {
      spectrumCtx.fillStyle = COLORS.dominant;
      spectrumCtx.beginPath();
      spectrumCtx.arc(x + bw / 2, meterBottom - barHeight - 4, 3, 0, Math.PI * 2);
      spectrumCtx.fill();
      
      const infoEl = document.getElementById('spectrum-info');
      if (infoEl) infoEl.textContent = `DOMINANT: ${dominantFreq.toFixed(1)} Hz`;
    }
  });
}

function drawGrid(w, h) {
  spectrumCtx.strokeStyle = COLORS.grid;
  spectrumCtx.lineWidth = 0.5;
  
  const gridLines = [-48, -36, -24, -12, 0];
  gridLines.forEach(db => {
    const y = dbToY(db, h);
    spectrumCtx.beginPath();
    spectrumCtx.moveTo(30, y);
    spectrumCtx.lineTo(w - 10, y);
    spectrumCtx.stroke();
    
    spectrumCtx.fillStyle = COLORS.text;
    spectrumCtx.font = '9px JetBrains Mono, monospace';
    spectrumCtx.fillText(`${db}`, 2, y + 3);
  });
  
  const binWidth = (w - 50) / SPECTRUM_BINS.length;
  SPECTRUM_BINS.forEach((bin, i) => {
    const x = 40 + i * binWidth + binWidth / 2;
    spectrumCtx.beginPath();
    spectrumCtx.moveTo(x, 10);
    spectrumCtx.lineTo(x, h - 20);
    spectrumCtx.stroke();
  });
  
  spectrumCtx.fillStyle = COLORS.text;
  spectrumCtx.font = '10px JetBrains Mono, monospace';
  SPECTRUM_BINS.forEach((bin, i) => {
    const x = 40 + i * binWidth + binWidth / 2;
    spectrumCtx.fillText(bin.label, x - 8, h - 6);
  });
}

function dbToY(db, height) {
  const meterTop = 10;
  const meterBottom = height - 20;
  const meterHeight = meterBottom - meterTop;
  const pct = Math.max(0, Math.min(100, (db + 60) / 60 * 100));
  return meterBottom - (pct / 100 * meterHeight);
}

function dbToPercentage(db, height) {
  const meterTop = 10;
  const meterBottom = height - 20;
  const meterHeight = meterBottom - meterTop;
  
  if (db === -Infinity) return 0;
  
  const pct = Math.max(0, Math.min(100, (db + 60) / 60 * 100));
  return (pct / 100 * meterHeight);
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

window.addEventListener('resize', () => {
  if (!spectrumCanvas || !spectrumCtx) return;
  
  const dpr = window.devicePixelRatio || 1;
  const rect = spectrumCanvas.getBoundingClientRect();
  spectrumCanvas.width = rect.width * dpr;
  spectrumCanvas.height = rect.height * dpr;
  spectrumCtx.scale(dpr, dpr);
  
  if (state?.isPlaying) {
    updateSpectrumFromAudio();
  } else {
    drawIdleSpectrum();
  }
});
