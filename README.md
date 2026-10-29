# REScale Web — Browser-Based Audio DSP Playground

**Live Demo:** `https://0xjantoko.github.io/REScale` (GitHub Pages)

A zero-dependency frontend for [REScale](https://github.com/0xjantoko/REScale) — a pure Rust audio DSP engine. Upload WAV files, apply real-time DSP processing via WebAssembly, and export results entirely in your browser.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    REScale Web                       │
├──────────┬──────────────────────────────────────────┤
│  Landing  │  Interactive WASM Demo                   │
│  Page     │  ┌─────────┐ ┌────────┐ ┌───────────┐   │
│  (A)      │  │ Upload   │ │ DSP    │ │ Export    │   │
│           │  │ WAV File │ │ Chain  │ │ Processed │   │
│            │  └─────────┘ └────────┘ └───────────┘   │
├──────────┴──────────────────────────────────────────┤
│  Design System: Dark · Cyan-Blue · White (RE Logo)  │
│  Tech: Vanilla HTML/CSS/JS + WebAssembly (Rust)      │
└─────────────────────────────────────────────────────┘
```

### Design System

Based on REScale RE Logo aesthetic:
- **Background**: `#050505` → `#161616` (dark black scale)
- **Accent**: Cyan-blue gradient `#7ba7cc` → `#0ea5e9` (from logo gradient)
- **Text**: White `#ffffff` with gray secondary `#9ca3af`
- **Typography**: Inter (body) + JetBrains Mono (data/code)
- **Logo**: Actual RE logo image from `RE logo.jpg`
- **Vibe**: Dark, premium, minimalist, tech-forward

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--color-black-deep` | `#050505` | Deepest background |
| `--color-black` | `#0a0a0a` | Primary background |
| `--color-black-panel` | `#161616` | Cards/panels |
| `--color-black-muted` | `#2a2a2a` | Borders/dividers |
| `--color-cyan` | `#7ba7cc` | Logo top-left gradient |
| `--color-blue-bright` | `#0ea5e9` | Primary accent |
| `--color-white` | `#ffffff` | Text, buttons |

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Shell** | HTML5 + CSS3 | Semantic markup, CSS variables design system |
| **Styling** | CSS Grid/Flexbox + Custom Properties | Layout, animations, responsive breakpoints |
| **Logic** | Vanilla JavaScript (ES2021) | No frameworks — follows REScale's zero-dep philosophy |
| **DSP Core** | Rust → WASM (wasm-pack) | Actual DSP processing (Gain, EQ, Compressor, Limiter) |
| **Canvas** | HTML5 Canvas API | VU meters, spectrum analyzer, waveform visualization |
| **Deploy** | GitHub Actions → GitHub Pages | CI/CD with automatic preview on PRs |

### Project Structure

```
web/
├── index.html              # Single-page app (Landing A + Demo B)
├── css/
│   ├── main.css            # Design system tokens, layout, components
│   └── demo.css            # Demo-specific: chain builder, meters, controls
├── js/
│   ├── app.js              # Smooth scroll, nav, animations, terminal effects
│   ├── demo.js             # File I/O, DSP chain state, playback simulation
│   ├── spectrum.js         # FFT spectrum canvas visualization (9-band)
│   └── wasm-bridge.js      # WASM module loader + DSP processing bridge
├── wasm/                   # Pre-compiled WASM from wasm-pack build
│   ├── rescale_core_bg.wasm
│   └── rescale_core.js
├── .github/workflows/
│   └── deploy.yml          # GitHub Pages CI/CD pipeline
└── .gitignore
```

## Development

### Prerequisites

- Node.js 20+ (for any future build tools)
- Rust toolchain + wasm-pack (for WASM compilation)

### Local Development

```bash
# Start local server
cd web
python3 -m http.server 8080
# or
npx serve . -p 8080

# Visit http://localhost:8080
```

### Building WASM Module

To connect to the actual Rust DSP engine:

```bash
# From the REScale repo root:
cd crates/rescale-core

# Add WASM target
rustup target add wasm32-unknown-unknown

# Build to web output directory
wasm-pack build --target web --out-dir ../../web/wasm --scope 0xjantoko

# Files now appear in web/wasm/ as rescale_core_bg.wasm
```

The WASM bridge (`js/wasm-bridge.js`) will automatically detect and load the module.

## Deployment

GitHub Actions handles deployment automatically:

1. Push to `main` branch triggers the `deploy.yml` workflow
2. Artifacts are built and uploaded as a Pages artifact
3. GitHub deploys to `0xjantoko.github.io/REScale`

Manual trigger: `Actions tab → Deploy REScale Web → Run workflow`

## Features

### Opsi A — Landing Page
- Hero section with TUI-style terminal preview
- Feature cards with hover animations
- Processor chain diagram visualization
- Performance metrics & known limitations
- Quick install guide (cargo / crates.io / docs.rs)

### Opsi B — Interactive Demo
- Drag-and-drop WAV file upload
- Configurable DSP chain builder (add/remove/reorder processors)
- Real-time parameter sliders per processor
- VU meters with peak hold (LED gradient style)
- Spectrum analyzer (9-band matching TUI dashboard)
- Waveform preview canvas
- Bypass toggle
- Preset configurations
- WAV export (demo mode, full mode requires WASM)

### Design System
Based on REScale TUI color palette:
- **Background**: `#0d0f13` → `#1c222b` (panel depth scale)
- **Accent**: Neon cyan `#4a9eff` (headers, active states)
- **VU Meter Gradient**: Green `#3ddc84` → Yellow `#ffb830` → Red `#ff4757`
- **Typography**: JetBrains Mono (data/code), Inter (body text)

## License

MIT OR Apache-2.0 (same as REScale core)
