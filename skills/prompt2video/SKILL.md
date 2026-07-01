---
name: prompt2video
description: Generate a short narrated video from a prompt using Remotion. The video topic is provided in the first prompt. Produces an MP4, per-scene MP3 voice-over (macOS `say` + ffmpeg), and a multi-page slides PDF (one still per scene via ImageMagick). Trigger when the user asks to "generate/render/build a video", "make a video from a prompt", "render with Remotion", "create voice-over", or to produce slides/PDF from the video scenes.
---

# prompt2video
- Generate a video based on the user description, honoring any optional prompt controls (see "Prompt controls").
- Add a voice-over narration track.
- Default to 1–2 minutes long; override with the `duration` control.
- Generate a PDF of slides (one page per scene).

## Prompt controls
The prompt may include optional control keys, usually as `key: value` lines alongside `topic:`/`description:`. **Every key is optional** — when one is absent, use the default. Honor any that appear; if the prompt gives free-text instructions instead (e.g. "make it about a minute, vertical, for kids"), infer the equivalent controls.

| Key | Meaning | Default | How to apply |
|---|---|---|---|
| `duration` | target total length, e.g. `90s`, `2m` | 1–2 min | Drives the total word budget; verify with ffprobe (see "Hitting the target duration"). |
| `scenes` | number of scenes / slides | your choice, ~4–6 | Produce exactly this many `<Sequence>`s and PDF pages; split the word budget across them. |
| `aspect` | frame shape: `16:9`, `9:16`, `1:1` | `16:9` | Set the composition `width`/`height` (see table below) before writing components. |
| `style` | visual look — a preset name and/or free-form descriptors | `clean` preset | Apply the matching preset's design tokens; layer free-form descriptors on top. |
| `voice` | macOS `say` voice name, e.g. `Samantha`, `Daniel` | system default | Pass to `say -v <voice>`. |
| `rate` | speech rate in words-per-minute | 175 | Pass to `say -r <rate>`; also update the words↔seconds math. |
| `tone` | narration register, e.g. `casual`, `formal`, `enthusiastic` | neutral / explanatory | Shape the wording of the narration scripts. |
| `audience` | reading level / who it's for, e.g. `kids`, `experts` | general | Shape vocabulary and depth. |
| `language` | narration + on-screen language | English | Write scripts in this language; pick a matching `say -v` voice. |
| `captions` | burn per-scene subtitles on screen: `on` / `off` | `off` | Render the scene text as an on-screen caption element. |
| `music` | background-music mood, or `off` | `off` | If enabled, mix a bed track under the narration at low volume. |

### Aspect → composition size
Set these on the `<Composition>` (in `src/Root.tsx` / `src/index.ts`) before building scenes, and design each scene's layout for the chosen shape (e.g. stacked / centered for `9:16`):

| `aspect` | width × height |
|---|---|
| `16:9` (default) | 1920 × 1080 |
| `9:16` | 1080 × 1920 |
| `1:1` | 1080 × 1080 |

## Visual style presets
`style` selects a preset (and/or free-form descriptors). Apply the preset's tokens consistently across **every** scene so the video looks cohesive; free-form descriptors (e.g. `neon accents`, `hand-drawn`, specific brand hex colors) override individual tokens.

| Preset | Background | Text / accent | Font family | Transitions |
|---|---|---|---|---|
| `clean` (default) | white / very light gray | near-black text, one blue accent | system sans (Inter / Helvetica) | quick fade + subtle slide |
| `dark` | near-black / deep navy | off-white text, neon-cyan accent | geometric sans | fade + soft glow |
| `corporate` | white with thin rule lines | navy + slate, muted accent | serif headings + sans body | crisp cut / short fade |
| `playful` | warm pastel | high-contrast bold color, rounded shapes | rounded sans (Poppins) | bouncy spring |
| `cinematic` | black with letterbox bars | white serif, gold accent | display serif | slow fade + ken-burns zoom |

### Hitting the target duration
Total video length is driven by total voice-over length (each `<Sequence>` is sized from its MP3's duration). At narration rate `R` wpm (default 175), total words ≈ `duration_seconds × R / 60`:
- 60s @ 175 wpm → ~175 words across all scene `.txt` files combined
- 90s @ 175 wpm → ~260 words combined
- 120s @ 175 wpm → ~350 words combined

Budget words per scene roughly proportional to its importance, split across the requested `scenes` count. After generating the MP3s, sum the `ffprobe` durations and **verify against the target**: if the total falls outside `duration ± 10%`, edit the scene scripts (add or trim sentences) and regenerate the affected MP3s until it lands. Pinning `say -r <rate>` keeps the words↔seconds mapping predictable.

## Workflow
Run these steps in order:
1. **Read the prompt controls** (see "Prompt controls"): set the composition `width`/`height` from `aspect`, the target scene count from `scenes`, and the target length from `duration`; pick the `style` preset tokens.
2. Write per-scene narration text and generate per-scene MP3s (see "How to Generate Voice-over Narration" below), honoring `voice`, `rate`, `tone`, `audience`, and `language`.
3. Wire each `<Audio>` + `<Sequence>` pair into `src/Composition.tsx`, using the measured per-scene durations and the chosen `style` preset tokens.
4. Render the MP4 with `npx remotion render`.
5. Extract one still per scene and assemble them into `out/slides.pdf` (see "Slides Generation into PDF").

## How to Generate Voice-over Narration
Generate a voice-over audio track for the video, split per scene. Use the macOS `say` command (so it can be customized via system speech settings), then convert each clip to MP3 with ffmpeg.

Steps:
1. Write one text file per scene under `public/scenes/` (e.g. `scene1.txt` … `sceneN.txt`), one file per requested scene. Use short, spoken-friendly sentences shaped by any `tone`, `audience`, and `language` controls. Replace symbols and underscores with spoken forms (e.g. write "a11y parse" instead of "a11y_parse").

2. For each scene file, generate the audio. Add `-v <voice>` and/or `-r <rate>` when the prompt sets `voice`/`rate`:
   say [-v <voice>] [-r <rate>] -f public/scenes/sceneN.txt -o public/scenes/sceneN.aiff
   ffmpeg -y -i public/scenes/sceneN.aiff public/scenes/sceneN.mp3

3. Read each scene's duration with `ffprobe` (single numeric value, in seconds):
   `ffprobe -v error -show_entries format=duration -of csv=p=0 public/scenes/sceneN.mp3`
   Convert seconds → frames using the composition's `fps` (e.g. `Math.ceil(seconds * fps)`), then use those frame counts to size each `<Sequence>` in the Remotion composition. Layer each `public/scenes/sceneN.mp3` as an `<Audio>` (from `@remotion/media`) inside its corresponding `<Sequence>`, so each scene plays its own narration.

Output: `public/scenes/sceneN.mp3` files, one per scene.


## Slides Generation into PDF 
After the Remotion video is generated, create still slides at the end of each scene and assemble them into a PDF.

1. Read `src/Composition.tsx` to extract:
   - Each scene's duration in frames (e.g. SCENE1_FRAMES, SCENE2_FRAMES, …)
   - Each scene's offset in the composition (cumulative sum of prior durations)
   - The fade-out duration used by `fadeInOut(frame, durationInFrames, fadeFrames)` — typically 18 frames
   - The composition id and entry file (e.g. `MyComp` in `src/index.ts`)

2. For each scene N, compute the capture frame as the last fully-opaque frame BEFORE the fade-out begins:
   - `captureFrameN = sceneOffsetN + sceneDurationN - fadeFrames - 1`
   - This ensures the slide shows the scene fully rendered, with all in-scene animations settled and no fade transparency.

3. Render one PNG per scene with Remotion's still command:
    - `npx remotion still <entry> <comp-id> out/sceneN.png --frame=<captureFrameN> --image-format=png`
    - Run sequentially (or chained with &&) so the bundle is reused. 
    - Output goes to `out/scene1.png` … `out/sceneN.png` at the composition's native resolution (e.g. 1920×1080).

4. Combine the PNGs into a single multi-page PDF using ImageMagick, in scene order:
    - `magick out/scene1.png out/scene2.png … out/sceneN.png out/slides.pdf`

5. Verify `out/slides.pdf` exists and report the per-scene capture frames plus the PDF path back to the user.
