# prompt2video

Promptable, AI-automated video generation. Give it a prompt describing what you want, and it drives [Claude Code](https://claude.com/claude-code) to build a [Remotion](https://www.remotion.dev/) project and render a short **narrated video** — MP4 + per-scene voice-over + a multi-page slides PDF.

You describe the topic; Claude writes the scenes, the narration, wires up the composition, and renders. You get the artifacts.

## How it works

`prompt2video build` does the orchestration:

1. Scaffolds a blank Remotion project (`npx create-video`)
2. Installs the Remotion `claude-code` skill (`npx skills add remotion-dev/skills`)
3. Copies the bundled [`prompt2video` skill](skills/prompt2video/SKILL.md) into the project
4. Runs `claude -p "<your prompt>"` with streaming output piped through [`claude_stream_viewer`](https://www.npmjs.com/package/claude_stream_viewer)
5. Copies the generated `video.mp4`, `slides.pdf`, and the raw Claude event log to your output directory

The [SKILL.md](skills/prompt2video/SKILL.md) is what teaches Claude the actual craft: budgeting narration to a 1–2 minute target, generating per-scene voice-over with macOS `say` + `ffmpeg`, sizing each Remotion `<Sequence>` from its measured MP3 duration, and assembling still frames into a PDF with ImageMagick.

## Usage

The user prompt is read from **stdin**:

```bash
echo "Generate a short narrated video about my latest CLI release" \
  | npx tsx src/prompt2video.ts build

# or pipe a prompt file
cat prompt.txt | npx tsx src/prompt2video.ts build

# with custom directories
echo "my prompt" \
  | npx tsx src/prompt2video.ts build --tmp-dir /tmp --output-dir ~/Videos
```

A richer prompt with a topic and source material:

```bash
USER_PROMPT=$(cat <<'EOF'
Generate a short narrated video

topic: why fastbrowser + a11y_parse are great to scrape the web with AI
description: |
  Based on those 2 folders, in a monorepo
  - https://github.com/jeromeetienne/skillmd_collection/tree/main/packages/a11y_parse
  - https://github.com/jeromeetienne/skillmd_collection/tree/main/packages/fastbrowser_cli
EOF
)

echo "$USER_PROMPT" | npx tsx src/prompt2video.ts build
```

The `build` command exits with an error if no prompt is piped on stdin.

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
  -o, --output-dir <dir>  output directory for the generated video (mp4/pdf/log) (default: "/tmp")
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
npx tsx src/prompt2video.ts install ~/.claude
# installs skills/prompt2video into ~/.claude/skills/prompt2video
```

## License

MIT © Jerome Etienne
