# prompt2video

Promptable, AI-automated video generation. Give it a prompt describing what you want, and it drives [Claude Code](https://claude.com/claude-code) to build a [Remotion](https://www.remotion.dev/) project and render a short **narrated video** — MP4 + per-scene voice-over + a multi-page slides PDF.

You describe the topic; Claude writes the scenes, the narration, wires up the composition, and renders. You get the artifacts.

## How it works

`prompt2video build` does the orchestration:

1. Scaffolds a blank Remotion project (`npx create-video`)
2. Installs the Remotion `claude-code` skill (`npx skills add remotion-dev/skills`)
3. Copies the bundled [`prompt2video` skill](skills/prompt2video/SKILL.md) into the project
4. Wraps your stdin as the **video topic** in an explicit "generate a narrated video" instruction (so the `prompt2video` skill always triggers) and runs `claude -p "<wrapped prompt>"` with streaming output piped through [`claude_stream_viewer`](https://www.npmjs.com/package/claude_stream_viewer)
5. Copies the generated `video.mp4`, `slides.pdf`, and the raw Claude event log to your output directory

The [SKILL.md](skills/prompt2video/SKILL.md) is what teaches Claude the actual craft: budgeting narration to a 1–2 minute target, generating per-scene voice-over with macOS `say` + `ffmpeg`, sizing each Remotion `<Sequence>` from its measured MP3 duration, and assembling still frames into a PDF with ImageMagick.

## Usage

Run it straight from npm — no install needed. Your stdin is read as the **video topic** — you don't need to spell out "generate a video", `build` wraps it into a video-generation instruction for you:

```bash
echo "Tell me about quantum physics like I'm 10" \
  | npx prompt2video build

# or pipe a prompt file
cat prompt.txt | npx prompt2video build

# with custom directories
echo "my prompt" \
  | npx prompt2video build --tmp-dir /tmp --output-dir ~/Videos
```

Or install it globally:

```bash
npm install -g prompt2video
echo "my prompt" | prompt2video build
```

A richer prompt with a topic and source material:

```bash
USER_PROMPT=$(cat <<'EOF'
topic: why fastbrowser + a11y_parse are great to scrape the web with AI
description: |
  Based on those 2 folders, in a monorepo
  - https://github.com/jeromeetienne/skillmd_collection/tree/main/packages/a11y_parse
  - https://github.com/jeromeetienne/skillmd_collection/tree/main/packages/fastbrowser_cli
EOF
)

echo "$USER_PROMPT" | npx prompt2video build
```

The `build` command exits with an error if no prompt is piped on stdin.

## Prompt controls

The prompt isn't just a topic — you can steer the render with optional `key: value` control lines alongside `topic:`/`description:`. Every key is optional; omit one and the skill falls back to a sensible default. You can also just write the instruction in plain English ("make it about a minute, vertical, for kids") and the skill infers the equivalent controls.

| Key | Controls | Example | Default |
|---|---|---|---|
| `duration` | target total length | `90s`, `2m` | 1–2 min |
| `scenes` | number of scenes / slides | `5` | ~4–6 |
| `aspect` | frame shape | `16:9`, `9:16`, `1:1` | `16:9` |
| `style` | visual look — a preset and/or free-form descriptors | `dark, neon accents` | `clean` |
| `voice` | macOS `say` voice | `Samantha`, `Daniel` | system default |
| `rate` | speech rate (words per minute) | `160` | 175 |
| `tone` | narration register | `casual`, `formal` | neutral |
| `audience` | reading level / who it's for | `kids`, `experts` | general |
| `language` | narration + on-screen language | `French` | English |
| `captions` | burn per-scene subtitles on screen | `on`, `off` | `off` |
| `music` | background-music mood, or `off` | `upbeat`, `off` | `off` |

Built-in `style` presets are `clean`, `dark`, `corporate`, `playful`, and `cinematic`; each fixes a palette, font, and transition style so the look stays cohesive across scenes. Free-form descriptors (e.g. brand hex colors, `hand-drawn`) layer on top.

A prompt exercising several controls:

```bash
USER_PROMPT=$(cat <<'EOF'
topic: why fastbrowser + a11y_parse are great to scrape the web with AI
description: |
  Based on those 2 folders, in a monorepo
  - https://github.com/jeromeetienne/skillmd_collection/tree/main/packages/a11y_parse
  - https://github.com/jeromeetienne/skillmd_collection/tree/main/packages/fastbrowser_cli
duration: 90s
scenes: 5
aspect: 9:16
style: dark, neon accents
voice: Samantha
tone: casual, like explaining to a friend
EOF
)

echo "$USER_PROMPT" | npx prompt2video build
```

Controls are interpreted by the bundled [skill](skills/prompt2video/SKILL.md), so they're best-effort — the deterministic ones (`aspect`, `scenes`, `voice`) are honored exactly, while `duration` is verified against the measured voice-over length and adjusted to land within ±10% of the target.

## Commands

```
Usage: prompt2video [options] [command]

Scaffold a Remotion project and stream Claude Code to generate a narrated AI
video from a prompt.

Commands:
  install [skill-folder]  Install all bundled skills into <skill-folder>/skills/
                          (default: .)
  build [options]         Scaffold the Remotion project, run Claude, and copy
                          the generated artifacts.
  help [command]          display help for command
```

### `build` options

```
Options:
  -t, --tmp-dir <dir>     parent directory for the generated project (default: "/tmp")
  -o, --output-dir <dir>  output directory for the generated video (mp4/pdf/log) (default: "./outputs")
  -h, --help              display help for command
```

## Requirements

This tool orchestrates several external programs. You need them on your `PATH`:

- **[Claude Code](https://claude.com/claude-code)** CLI (`claude`), authenticated
- **Node.js** (runs `npx create-video`, `npx skills`, `npx claude_stream_viewer`)
- **[ffmpeg](https://ffmpeg.org/)** / **ffprobe** — voice-over encoding and duration measurement
- **[ImageMagick](https://imagemagick.org/)** (`magick`) — assembling slide PNGs into a PDF
- **macOS `say`** — text-to-speech for the narration (this piece is macOS-specific)

## Skill-only install

The bundled skill can be dropped into any Claude Code agent on its own:

```bash
npx prompt2video install ~/.claude
# installs skills/prompt2video into ~/.claude/skills/prompt2video
```

## License

MIT © Jerome Etienne
