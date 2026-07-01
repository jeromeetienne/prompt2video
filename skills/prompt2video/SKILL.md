---
name: prompt2video
description: Generate a short narrated video from a prompt using Remotion. The video topic is provided in the first prompt. Produces an MP4, per-scene MP3 voice-over (macOS `say` + ffmpeg), and a multi-page slides PDF (one still per scene via ImageMagick). Trigger when the user asks to "generate/render/build a video", "make a video from a prompt", "render with Remotion", "create voice-over", or to produce slides/PDF from the video scenes.
---

# prompt2video
- Generate a video based on the user description
- Add a voice-over narration track.
- make it 1-2 minutes long (may be overridden by the user)
- generate a PDF of slides

### Hitting the 1–2 min target
Total video length is driven by total voice-over length (each `<Sequence>` is sized from its MP3's duration). Default macOS `say` runs ~175 wpm, so:
- 1 minute → ~175 words across all scene `.txt` files combined
- 2 minutes → ~350 words combined

Budget words per scene roughly proportional to its importance, then verify with `ffprobe` after generating MP3s and adjust the scripts if the sum falls outside the target.

## Workflow
Run these steps in order:
1. Write per-scene narration text and generate per-scene MP3s (see "How to Generate Voice-over Narration" below).
2. Wire each `<Audio>` + `<Sequence>` pair into `src/Composition.tsx`, using the measured per-scene durations.
3. Render the MP4 with `npx remotion render` (see "Render Video" in misc Remarks).
4. Extract one still per scene and assemble them into `out/slides.pdf` (see "Slides Generation into PDF").

## How to Generate Voice-over Narration
Generate a voice-over audio track for the video, split per scene. Use the macOS `say` command (so it can be customized via system speech settings), then convert each clip to MP3 with ffmpeg.

Steps:
1. Write one text file per scene under `public/scenes/` (e.g. `scene1.txt` … `sceneN.txt`). Use short, spoken-friendly sentences. Replace symbols and underscores with spoken forms (e.g. write "a11y parse" instead of "a11y_parse").

2. For each scene file, generate the audio:
   say -f public/scenes/sceneN.txt -o public/scenes/sceneN.aiff
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
