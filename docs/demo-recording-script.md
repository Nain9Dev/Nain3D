# Demo recording script (under 30 s)

Story: *"I upload a model, the AI proposes, the contract decides."* The contrast between a
conformant and a non-conformant asset is the hook. Total runtime of the built-in sequence: **20 s**.

## URLs

| Goal | URL |
|:---|:---|
| Vertical 9:16, Spanish (main take) | `https://3d.naindev.com/?mode=record` on a 1080x1920 viewport |
| Horizontal 16:9, Spanish | `https://3d.naindev.com/?mode=record` on a 1920x1080 viewport |
| English version (for subtitles) | add `&lang=en` |
| Force a format regardless of window size | add `&format=vertical` or `&format=horizontal` |
| A single sample instead of the sequence | add `&sample=sample-shoe` (or `sample-oversized-shoe`, `sample-industrial`, `sample-monitor`, `sample-chair`, `sample-oversized-chair`) |

Local run: `npm --prefix Nain3D.Client run dev` and open `http://localhost:5376/?mode=record`.

## Sequence (the page plays it by itself, no clicks)

Times are from the first rendered frame of the model.

| Time | What the viewer sees |
|:---|:---|
| **0.0-2.0 s (hook)** | Photoreal blue sneaker (22,700 triangles, PBR textures), lit by studio light, soft shadow, slow eased rotation. A one-line credit (*Modelo: Materials Variants Shoe · Shopify · CC BY 4.0*) sits in the corner of the frame. Large headline *La IA propone, el contrato dispone.* over the stage. Nothing else competes for attention. |
| 0.5 s | The *La IA propone* card fills in with the engine's proposal (88 % on the static site). |
| 1.3-3.3 s | The four checks are ticked one by one, every 0.65 s: triangle budget, physical extent, watertightness, degenerate faces. A thin green outline appears around the model at 1.95 s: *Dentro del límite*. The headline fades out at 2.6 s. |
| 3.95 s | Green badge **Conforme** pops in, the card shadow turns green. |
| 4.4-5.1 s | Latency counter *Evaluado en N ms* counts up, SHA-256 shown. |
| **7.0 s (cut)** | The same sneaker, scaled to 5 m, replaces the first. Same model, wrong scale. |
| 8.3-10.3 s | Checks tick again; the **Extensión física** row turns red (*5 m de 3 m* on the static site). From 8.95 s a red box shows the real size, a white box shows the profile limit, a ruler marks the metres and a red label reads *Excede el límite*. |
| 11.0 s | Red badge **No conforme**, red card shadow, *Incumple: Extensión física.* |
| **15.0-20.0 s (end)** | Opaque dark closing card (5 s): the tagline, **Aitor Nain**, *Arquitecto de software full stack · NainDev*, *Hablemos*, and four lines: `naindev.com`, `contact@naindev.com`, LinkedIn `in/aitor-nain-mendoza-vallejo`, `github.com/Nain9Dev/Nain3D`. English version: *Full stack software architect*, *Let's talk*. Contacts come from `src/contact/contacts.ts`. |

What the viewer ends with: the AI can be confident and still be vetoed; the contract has the last word.
The limit shown (3 m) depends on the category the engine proposes; any category rejects a 5 m object.

## Steps to record

1. Open a Chromium-based browser, set the window or device emulation to **1080x1920** (vertical) or
   **1920x1080** (horizontal). The layout is a fixed artboard: it scales, never scrolls.
2. Load the URL. Wait until the model is on screen (the sequence clock starts with the first frame).
3. Start the screen recorder, then **reload the page** (F5). The sequence restarts from zero.
   Alternatively start the recorder first and reload once; trim the lead-in.
4. Stop recording after the end card has shown for about a second (21 s from reload).
5. Repeat with `&lang=en` for the English take, or reuse the Spanish video and add English subtitles.
6. Do not move the mouse over the page: the cursor is hidden and nothing depends on hover.

## Export the video without screen recording

`npm --prefix Nain3D.Client run record:video -- --format vertical --lang es` renders the 20 s sequence frame
by frame with the manual clock and encodes it with ffmpeg (30 fps, H.264, `out/nain3d-vertical-es.mp4`, ignored
by git). Options: `--format vertical|horizontal`, `--lang es|en`, `--fps`, `--seconds` (render only the first
seconds), `--url` (default `http://localhost:5376`, so run `npm run build` and `npx vite preview --port 5376`
first). The result is identical on every run and never drops frames; it takes about five minutes with software
WebGL. The latency counter shows the evaluation time of that run.

## Safe zones (9:16)

Key content stays inside 1080x1920 minus **230 px top** and **340 px bottom** (platform UI), with
96 px side margins. The model stage, both cards and the verdict badge sit inside that box; the
end card is centred.

## Reproducible frames (stills for the video or the thumbnail)

The Playwright suite renders the same states with a manual clock, so every capture is identical:

```bash
npm --prefix Nain3D.Client run build
npm --prefix Nain3D.Client run test:e2e
```

Output: `docs/assets/visual-redesign/after/` (`record-vertical-{es,en}-1-hook` to `-5-end-card`,
`record-horizontal-...`, `standard-...`). Manual clock for your own frames:
`?mode=record&clock=manual`, then in the console `__nain.advance(3000)` moves the page forward 3 s.

## Notes

- The latency value is the real evaluation time reported by the engine, so it differs slightly per run.
- On 3d.naindev.com there is no API server: verdicts come from the in-browser evaluator
  (`src/services/mockEvaluator.ts`), which applies the same four contract checks to the figures it
  reads from the GLB. Mesh-defect checks (open surface, degenerate faces) can only fail with the
  Python engine (`npm run dev` plus `uvicorn`); the recording sequence uses the scale failure for that reason.
