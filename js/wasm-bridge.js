/* ==========================================================================
   REScale Web — WASM Bridge Layer
   Connects JS frontend to rescale-core WebAssembly module
   
   Build instructions:
   1. rustup target add wasm32-unknown-unknown
   2. cd ../REScale/crates/rescale-core
   3. wasm-pack build --target web --out-dir ../../web/wasm --scope 0xjantoko
   4. Files appear in web/wasm/ as rescale_core_bg.wasm + rescale_core.js
   ========================================================================== */

// ========== WASM Module Loader ==========

let wasmModule = null;
let wasmReady = false;

async function initWasm() {
  try {
    // Check if WASM file exists (it will be placed by wasm-pack during build)
    const resp = await fetch('wasm/rescale_core_bg.wasm');
    if (!resp.ok) {
      console.warn('[REScale WASM] Module not found — running in demo simulation mode');
      console.info('[REScale WASM] Run: wasm-pack build --target web --out-dir ./wasm');
      return;
    }
    
    const wasmBytes = await resp.arrayBuffer();
    
    // Instantiate WASM module
    const { instantiateWasm } = await import('./wasm/rescale_core.js');
    
    const instance = await WebAssembly.instantiate(wasmBytes, {
      // Import env for any WASI/env calls
      env: {
        memoryBase: 0,
        tableBase: 0,
        memory: new WebAssembly.Memory({ initial: 100 }),
        table: new WebAssembly.Table({ initial: 0, element: 'anyfunc' })
      }
    });
    
    wasmModule = instance.instance;
    wasmReady = true;
    
    console.log('%c[REScale WASM] ✓ Module loaded', 'color:#4a9eff; font-weight:bold');
    
  } catch (error) {
    console.warn('[REScale WASM] Failed to load:', error.message);
    console.info('[REScale WASM] Running in demo mode — DSP processing simulated');
    wasmReady = false;
  }
}

// ========== DSP Processing Bridge ==========

/**
 * Process audio buffer through the DSP chain
 * @param {Float32Array[]} channels - Input audio data (planar)
 * @returns {Promise<Float32Array[]>} Processed output
 */
async function processAudio(channels) {
  if (!wasmReady || !state?.audioBuffer) {
    // Demo mode: simulate processing with gain adjustment
    return simulateProcessing(channels);
  }
  
  // TODO: When WASM module is available, use actual Rust DSP:
  // 1. Create AudioBlock from input channels
  // 2. Initialize ProcessorChain with configured parameters
  // 3. Call process() on each block
  // 4. Return processed planar output
  
  console.log('[WASM Bridge] Processing via rescale-core...');
  
  // Placeholder — real implementation requires:
  // - AudioBlock creation in WASM heap
  // - Parameter serialization (gain_db, threshold, ratio, etc.)
  // - Block-by-block processing loop
  // - Result deserialization back to JS Float32Array
  
  return simulateProcessing(channels);
}

/**
 * Simulate DSP processing when WASM is not available
 * Applies a simple gain scaling to demonstrate UI behavior
 */
function simulateProcessing(inputChannels) {
  const gainDb = state.chain.find(p => p.type === 'gain')?.params.gain_db ?? -3.0;
  const gainLinear = Math.pow(10, gainDb / 20);
  
  return inputChannels.map(channel => {
    const output = new Float32Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      output[i] = channel[i] * gainLinear;
    }
    return output;
  });
}

// ========== Audio Processing Graph ==========

/**
 * Build and execute a complete DSP pipeline
 * @param {Uint8Array} wavData - Raw WAV file bytes
 * @returns {Promise<{data: Float32Array[], header: Object}>} Processed result
 */
async function buildAndProcessPipeline(wavData) {
  showStatus('Building DSP pipeline...');
  
  try {
    // 1. Decode WAV using JS fallback (in production, use WASM decoder)
    const decoded = decodeWavFromBuffer(new Uint8Array(wavData));
    
    // 2. Process through chain
    const output = await processAudio(decoded.channels);
    
    // 3. Encode WAV output
    const encoded = encodeWavToBuffer(output, decoded.sampleRate, decoded.bitsPerSample);
    
    // 4. Generate download
    const blob = new Blob([encoded], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    
    showStatus('Processing complete!');
    
    return { url, blob, channels: output };
    
  } catch (error) {
    console.error('[WASM Bridge] Pipeline error:', error);
    showStatus(`Error: ${error.message}`, 'error');
    throw error;
  }
}

// ========== Minimal WAV Codec for Demo Mode ==========

/**
 * Parse WAV header from raw bytes
 */
function parseWavHeader(data) {
  const view = new DataView(data.buffer);
  let offset = 0;
  
  // RIFF header
  if (readString(data, 0, 4) !== 'RIFF') throw new Error('Invalid RIFF header');
  if (readString(data, 8, 4) !== 'WAVE') throw new Error('Not WAVE format');
  
  let numChannels = 0, sampleRate = 44100, bitsPerSample = 16;
  let dataOffset = 0, dataSize = 0;
  
  // Find chunks
  while (offset < data.length - 8) {
    const chunkId = readString(data, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    
    if (chunkId === 'fmt ') {
      numChannels = view.getUint16(offset + 8, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize;
  }
  
  return { numChannels, sampleRate, bitsPerSample, dataOffset, dataSize };
}

/**
 * Decode WAV PCM data to planar Float32Array channels
 */
function decodeWavFromBuffer(data) {
  const header = parseWavHeader(data);
  const { numChannels, sampleRate, bitsPerSample, dataOffset, dataSize } = header;
  
  const frames = Math.floor(dataSize / (numChannels * (bitsPerSample / 8)));
  const channels = [];
  const view = new DataView(data.buffer, dataOffset, dataSize);
  
  for (let ch = 0; ch < numChannels; ch++) {
    const channel = new Float32Array(frames);
    for (let frame = 0; frame < frames; frame++) {
      const bytePos = (frame * numChannels + ch) * (bitsPerSample / 8);
      
      if (bitsPerSample === 16) {
        channel[frame] = view.getInt16(bytePos, true) / 32768.0;
      } else if (bitsPerSample === 24) {
        const b0 = view.getUint8(bytePos);
        const b1 = view.getUint8(bytePos + 1);
        const b2 = view.getUint8(bytePos + 2);
        const sign = b2 & 0x80 ? -1 : 1;
        let int24 = b0 | (b1 << 8) | ((b2 & 0x7F) << 16);
        channel[frame] = (int24 * sign) / 8388608.0;
      } else if (bitsPerSample === 32) {
        channel[frame] = view.getFloat32(bytePos, true);
      }
    }
    channels.push(channel);
  }
  
  return { channels, frames, sampleRate, bitsPerSample, numChannels };
}

/**
 * Encode planar Float32Array channels back to WAV buffer
 */
function encodeWavToBuffer(channels, sampleRate, targetBitsPerSample = 24) {
  const numChannels = channels.length;
  const frames = channels[0].length;
  const bytesPerSample = targetBitsPerSample / 8;
  const dataSize = frames * numChannels * bytesPerSample;
  const fileSize = 36 + dataSize;
  
  const buffer = new ArrayBuffer(fileSize + 8); // RIFF + size
  const view = new DataView(buffer);
  
  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeString(view, 8, 'WAVE');
  
  // fmt chunk
  let fmtOffset = 12;
  writeString(view, fmtOffset, 'fmt ');
  view.setUint32(fmtOffset + 4, 16, true);
  view.setUint16(fmtOffset + 8, 1, true);       // PCM
  view.setUint16(fmtOffset + 10, numChannels, true);
  view.setUint32(fmtOffset + 12, sampleRate, true);
  view.setUint32(fmtOffset + 16, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(fmtOffset + 20, numChannels * bytesPerSample, true);
  view.setUint16(fmtOffset + 22, targetBitsPerSample, true);
  
  // data chunk
  let dataOffset = fmtOffset + 24;
  writeString(view, dataOffset, 'data');
  view.setUint32(dataOffset + 4, dataSize, true);
  
  // Write samples
  let pos = dataOffset + 8;
  for (let frame = 0; frame < frames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = Math.max(-1, Math.min(1, channels[ch][frame]));
      
      if (targetBitsPerSample === 16) {
        const int16 = sample >= 0 
          ? Math.floor(sample * 32767) 
          : Math.floor(sample * 32768);
        view.setInt16(pos, int16, true);
        pos += 2;
      } else if (targetBitsPerSample === 24) {
        const int24 = sample >= 0
          ? Math.floor(sample * 8388607)
          : Math.floor(sample * 8388608);
        const bytes = [int24 & 0xFF, (int24 >> 8) & 0xFF, (int24 >> 16) & 0xFF];
        view.setUint8(pos, bytes[0]);
        view.setUint8(pos + 1, bytes[1]);
        view.setUint8(pos + 2, bytes[2]);
        pos += 3;
      } else if (targetBitsPerSample === 32) {
        view.setFloat32(pos, sample, true);
        pos += 4;
      }
    }
  }
  
  return buffer;
}

function readString(data, offset, length) {
  let str = '';
  for (let i = 0; i < length; i++) {
    str += String.fromCharCode(data[offset + i] || 0);
  }
  return str;
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// ========== Export Helper ==========

async function exportResultWasm() {
  if (!state?.audioBuffer) {
    showStatus('No audio loaded');
    return;
  }
  
  showStatus('Exporting WAV...');
  
  try {
    // Rebuild WAV from buffered data
    const originalWav = await getFileAsArrayBuffer(state.audioFile);
    const processed = await buildAndProcessPipeline(originalWav);
    
    // Trigger download
    const a = document.createElement('a');
    a.href = processed.url;
    a.download = 'rescale_output.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(processed.url);
    
  } catch (e) {
    showStatus(`Export failed: ${e.message}`, 'error');
  }
}

async function getFileAsArrayBuffer(file) {
  return await file.arrayBuffer();
}

// ========== Initialize ==========

initWasm();

// Listen for changes to chain config
document.addEventListener('change', (e) => {
  if (e.target.matches('input[type="range"]')) {
    // Debounced parameter update
    clearTimeout(window._paramUpdateTimer);
    window._paramUpdateTimer = setTimeout(() => {
      // Trigger re-processing if audio is loaded and playing
      if (state?.isPlaying && state?.audioBuffer) {
        // In production, this would restart with new params
      }
    }, 100);
  }
});
