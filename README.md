# Edge AI Screen & Audio Note Studio

A privacy-first, browser-based studio for capturing screen, video, and audio — transcribing it with on-device Whisper — and turning it into rich, timestamped Markdown notes with the help of a pretrained LLM that runs entirely in your browser.

**100% client-side. Zero external AI APIs. Zero backend. Zero data ever leaves the device.**

- **Live app:** [https://edge-ai-note-studio.vercel.app/](https://edge-ai-note-studio.vercel.app/)
- **Repository:** [https://github.com/AryanSehgal/edge-ai-note-studio](https://github.com/AryanSehgal/edge-ai-note-studio)

---

## Why this project exists

Most "AI note-taking" products quietly ship your recordings, transcripts, and notes to a cloud API. This studio is built on the opposite principle:

> **No external AI API is called at any point — regardless of how long the model weights take to download.**

All inference happens locally in the browser using WebGPU hardware acceleration when available, and a WASM (CPU-native) fallback when it is not. Model weights are streamed once into the browser cache; every session, transcript, and note is persisted in IndexedDB on your own device.

---

## Lighthouse report

Audited with **Lighthouse 13.4.1** (desktop, emulated, single-page session) against the production deployment on September 21, 2026:

| Category        | Score |
| --------------- | ----- |
| Performance     | 100   |
| Accessibility   | 92    |
| Best Practices  | 100   |
| SEO             | 92    |

Core Web Vitals from the same run:

| Metric                    | Value  |
| ------------------------- | ------ |
| First Contentful Paint    | 0.4 s  |
| Largest Contentful Paint  | 0.4 s  |
| Total Blocking Time       | 0 ms   |
| Cumulative Layout Shift   | 0.002  |
| Speed Index               | 0.4 s  |

Two implementation details explain these numbers:

- **Total Blocking Time of 0 ms** — all model inference (Whisper ASR and the LLM) runs inside dedicated [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API), so the main thread never blocks, even mid-transcription.
- **Tiny app shell** — the initial JavaScript payload is ~114 KB (gzipped). The "network payload" figure Lighthouse reports for a first visit is dominated by the *on-demand* model weight downloads (Whisper + the LLM), which stream in the background, are cached by the browser, and never recur on subsequent loads.

Download the complete [lighthouse report](https://github.com/user-attachments/files/32466330/Lighthouse.report.pdf) for detailed analysis.

---

## Key highlights

- **On-device speech recognition** — OpenAI Whisper (English), converted to ONNX and served through `@huggingface/transformers`, running in a Web Worker with WebGPU acceleration and a WASM fallback.
- **On-device LLM for notes** — `flan-t5-small` (`text2text-generation`) generates session titles, executive summaries, keynote highlights, and action items from your transcript. No API keys, no servers, no cost per call.
- **Interactive waveform scrubbing** — seek, zoom, change playback speed, and skip around a rendered waveform powered by [wavesurfer.js](https://wavesurfer-js.org/).
- **Timestamped, linked notes** — insert `[01:23]`-style audio timestamps into Markdown notes; clicking any timestamp jumps playback to that exact moment.
- **Rich export options** — transcripts export as `.txt`, `.srt`, `.vtt`, or `.json`; notes export as `.md` or copy straight to the clipboard.
- **Full session persistence** — recordings, transcripts, and notes survive refreshes and restarts via IndexedDB.
- **Responsive, touch-friendly UI** — verified layout from 360px phones to desktop (0 overflowing elements at 360 / 768 / 1280px), with tooltips and ARIA labels on icon-only controls.
- **Deployable anywhere static files are served** — the production build is a plain static bundle, hosted free on Vercel.

---

## Feature tour

### Capture

- **Recording Studio** — capture screen/tab video with system or tab audio, mix in your microphone, or record mic-only. Includes a clear recovery path when browser security policies block screen capture inside iframes.
- **Media Upload** — drag & drop or pick any audio/video file; it is decoded and resampled entirely in the browser (16 kHz mono via Web Audio) — never uploaded.
- **Instant samples** — one-click sample keynote audio/video to try the full pipeline without sharing your screen or granting permissions.

### Transcribe

- Live progress while Whisper downloads and loads, with a model selector (**Whisper Tiny ~75MB • fast** / **Whisper Base ~140MB • higher accuracy**).
- Real-time streaming transcription with per-segment timestamps.
- Search and filter across transcript segments.
- Export as `.txt`, `.srt` (subtitles), `.vtt` (web captions), or `.json`.
- Per-segment actions to quote any line straight into your notes.

### Take notes

- Split-pane Markdown editor with live preview (edit-only / split / preview-only modes).
- One-click insertion of the current playback position as a clickable timestamp.
- Structured meeting-notes template.
- **"Edge LLM Title & Notes"** — one click and the on-device LLM drafts a session heading, executive summary, keynote highlights, and action items from the transcript, streamed directly into the editor.
- Copy Markdown or download the note as a `.md` file.

### Organize

- Multi-session sidebar with search; rename and revisit any past session with its recording, transcript, and notes intact.
- All data stored locally in **IndexedDB** — nothing touches a server.

### Transparency

- A live **Model Status Bar** shows the active compute backend (WebGPU hardware-accelerated vs. WASM CPU), per-model download progress, and a "Models Ready Locally" indicator that appears only when *both* the speech model and the LLM have finished loading.

---

## How it works

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (client only)                     │
│                                                                  │
│  Capture / Upload                                                │
│   Screen + mic / tab audio / file upload / samples               │
│        │                                                         │
│        ▼                                                         │
│  Web Audio API ──► decode & resample to 16 kHz mono              │
│        │                                                         │
│        ▼                    ┌──────────────────────────┐         │
│  ┌─────────────┐  postMessage│  transcriber.worker.ts   │         │
│  │  React App  │◄───────────►│  Whisper (ONNX) ASR      │         │
│  │  (main thr) │             │  WebGPU │ WASM fallback  │         │
│  └──────┬──────┘             └──────────────────────────┘         │
│         │                     ┌──────────────────────────┐         │
│         │      postMessage    │  llm.worker.ts          │         │
│         │◄───────────────────►│  flan-t5-small           │         │
│         │                     │  text2text-generation    │         │
│         │                     └──────────────────────────┘         │
│         ▼                                                        │
│  Transcript segments + Markdown notes + audio blob               │
│         │                                                        │
│         ▼                                                        │
│  IndexedDB (sessions persist across restarts)                    │
└─────────────────────────────────────────────────────────────────┘
```

1. **Ingest** — audio arrives from screen/tab capture, microphone, an uploaded file, or a built-in sample.
2. **Resample** — `src/lib/audioResampler.ts` normalizes anything to the 16 kHz mono PCM Whisper expects.
3. **Transcribe** — audio is transferred (zero-copy) to a Web Worker running the ONNX Whisper pipeline; segments stream back to the UI.
4. **Augment** — when asked, a second worker runs `flan-t5-small` over the transcript text to produce titles, summaries, and keynotes.
5. **Persist** — the session (audio blob, segments, notes) is written to IndexedDB and restored on the next visit.

---

## On-device AI models

| Model                             | Task                       | Runtime                       | Size (approx.) |
| --------------------------------- | -------------------------- | ----------------------------- | -------------- |
| `onnx-community/whisper-tiny.en`  | Automatic speech recognition | WebGPU, WASM fallback       | ~75 MB         |
| `onnx-community/whisper-base.en`  | Automatic speech recognition (higher accuracy) | WebGPU, WASM fallback | ~140 MB |
| `Xenova/flan-t5-small`            | Text2text generation (titles, summaries, keynotes) | WebGPU, WASM fallback | downloaded once, cached |

Weights are fetched from the Hugging Face Hub on first use, cached by the browser, and loaded locally from then on. Both models share the same device-selection strategy: **WebGPU first, WASM (CPU) otherwise** — the app never degrades to a cloud API.

---

## Tech stack

| Layer      | Technology                                                        |
| ---------- | ----------------------------------------------------------------- |
| Framework  | React 19 + TypeScript                                             |
| Tooling    | Vite 8                                                            |
| Styling    | Tailwind CSS v4                                                   |
| AI runtime | `@huggingface/transformers` 4.3 (ONNX Runtime Web — WebGPU/WASM)  |
| Inference  | Web Workers (ASR + LLM)                                           |
| Waveform   | wavesurfer.js 7                                                   |
| Icons      | lucide-react                                                      |
| Storage    | IndexedDB (sessions, transcripts, notes, audio)                   |
| Hosting    | Vercel (static, free tier)                                        |

---

## Getting started

Prerequisites: **Node.js 18+** and npm.

```bash
# 1. Clone the repository
git clone https://github.com/AryanSehgal/edge-ai-note-studio.git
cd edge-ai-note-studio

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Then open the printed URL (default `http://localhost:5173`).

Other scripts:

```bash
npm run build    # type-check (tsc --noEmit) is available via:
npm run lint     # tsc --noEmit
npm run preview  # serve the production build locally
```

> **First-load note:** on the first run, the app downloads the Whisper and LLM weights in the background with live progress in the status bar. Subsequent loads are instant — weights are served from the browser cache. WebGPU gives the fastest experience in Chrome/Edge; other browsers automatically use the WASM CPU path.

---

## Deployment

The app is a fully static SPA with **no serverless functions, no environment variables, and no secrets**. `vercel.json` pins the framework (Vite), build command, output directory, and SPA rewrites.

Deploy your own copy free on Vercel:

1. Push the source to a GitHub repo (`dist/` is gitignored — it is rebuilt on Vercel).
2. In Vercel: **Add New → Project** → import the repo (Vite is auto-detected; no settings to change).
3. Deploy. That's it.

---

## Project structure

```
├── index.html                  # App shell + SEO/OG meta
├── vercel.json                 # Vite framework config + SPA rewrites
├── public/                     # Static assets (sample media, images)
├── src/
│   ├── main.tsx                # Entry point
│   ├── App.tsx                 # Studio layout, state orchestration, model wiring
│   ├── index.css               # Tailwind v4 theme
│   ├── types.ts                # Shared domain types
│   ├── components/
│   │   ├── Header.tsx          # Brand bar, guide & sessions toggles
│   │   ├── ModelStatusBar.tsx  # Backend badge, model picker, download progress
│   │   ├── SessionSidebar.tsx  # Session list, search, mobile drawer
│   │   ├── WaveformScrubber.tsx# Seek/zoom/rate/skip playback controls
│   │   ├── TranscriptView.tsx  # Segments, search, export menu
│   │   ├── NoteEditor.tsx      # Markdown editor, preview, templates, Edge LLM
│   │   ├── RecordingStudioModal.tsx  # Screen/mic capture UX
│   │   ├── MediaUploadModal.tsx      # Drag & drop file ingest
│   │   ├── UserGuideModal.tsx  # In-app product guide
│   │   └── Footer.tsx
│   ├── lib/
│   │   ├── transcriptionService.ts   # ASR worker lifecycle & progress
│   │   ├── llmService.ts             # LLM worker lifecycle & generation jobs
│   │   ├── audioResampler.ts         # Browser-side decode → 16 kHz mono
│   │   ├── indexedDb.ts              # Session persistence layer
│   │   ├── studioNotesGenerator.ts   # Markdown report builder
│   │   └── sampleAudio.ts            # Built-in demo assets
│   └── workers/
│       ├── transcriber.worker.ts     # Whisper pipeline (off main thread)
│       └── llm.worker.ts             # flan-t5-small pipeline (off main thread)
└── package.json
```

---

## Privacy & security

- No backend, no database server, no analytics, no tracking.
- No API keys or environment variables exist in the deployment.
- Screen, microphone, and file access use standard browser permission prompts; capture runs through the browser's own secure picker.
- Recordings, transcripts, and notes live exclusively in your browser's IndexedDB — clear site data and they're gone.

## Browser support

- **Best experience:** Chrome or Edge on a WebGPU-capable machine (hardware-accelerated inference).
- **Fully supported:** any modern browser via the WASM CPU path (Firefox, Safari, older Chromium).
- Screen/tab capture requires a Chromium-based browser or Firefox; the app detects iframe-imposed restrictions and guides you to a working path.

---

## Author

Built by **[Aryan Sehgal](https://github.com/AryanSehgal)**.

- Live product: [edge-ai-note-studio.vercel.app](https://edge-ai-note-studio.vercel.app/)
- Source: [github.com/AryanSehgal/edge-ai-note-studio](https://github.com/AryanSehgal/edge-ai-note-studio)

Standing on the shoulders of excellent open-source projects: [OpenAI Whisper](https://github.com/openai/whisper), [Hugging Face Transformers.js](https://github.com/huggingface/transformers.js), [ONNX Runtime Web](https://github.com/microsoft/onnxruntime), and [wavesurfer.js](https://wavesurfer-js.org/).

---

## Roadmap ideas

- Additional Whisper languages and model sizes
- Local speaker diarization
- Vector search across past sessions (still fully on-device)
- PWA/offline install support
