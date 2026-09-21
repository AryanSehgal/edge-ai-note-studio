# Edge AI Screen & Audio Note Studio

Privacy-first studio that turns **audio / video / screen recordings** into timestamped
transcripts and rich Markdown "Studio Notes" — **100% on-device, with zero external API
calls**.

- **Speech-to-text:** OpenAI Whisper (ONNX) via `@huggingface/transformers`, running in a
  Web Worker. Uses **WebGPU** when the browser supports it, otherwise falls back to
  **WebAssembly (CPU)**. Model weights are downloaded once and cached in the browser.
- **Headings & summaries:** a **pretrained on-device LLM** (`Xenova/flan-t5-small`, ONNX)
  generates the session title, an executive summary, keynote highlights, and action items
  — no Gemini, no server, no network AI calls.
- **Storage:** recordings, transcripts, and notes are persisted locally in **IndexedDB**.
  Nothing is uploaded anywhere.

There is **no backend**. The whole app is a static Vite SPA.

## Run locally

Prerequisites: Node.js 18+ (Node 20+ recommended).

```bash
npm install
npm run dev
```

Then open the printed URL (default http://localhost:5173).

On first load the app downloads the Whisper and LLM weights into your browser cache
(tens of MB). Wait for the status bar to show **"Models Ready Locally"**, then record /
upload media or click **Sample Audio**.

Other scripts:

```bash
npm run build     # production build to dist/
npm run preview   # serve the production build locally
npm run lint      # TypeScript typecheck
```

### Browser notes
- WebGPU acceleration requires a recent Chrome/Edge. Without it the app automatically
  uses WASM CPU inference (slower, but fully functional).
- Multi-threaded WASM needs cross-origin isolation (COOP/COEP). Without those headers the
  workers automatically run single-threaded, so everything still works.

## Deploy to Vercel (free, static)

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project**, import the repo. Vercel auto-detects **Vite**.
   - Build command: `npm run build`
   - Output directory: `dist`
   - No environment variables and no serverless functions are required.
3. Deploy. The included `vercel.json` configures the static SPA rewrite.

Model weights are fetched from the Hugging Face CDN by the browser at runtime and cached
locally — the deployed site itself makes no AI/backend API calls.
