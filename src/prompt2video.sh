#!/usr/bin/env bash

# Bash equivalent of prompt2video.ts build
# Creates a Remotion video project, adds skills, and streams Claude output through the viewer.

set -euo pipefail

###############################################################################
# Configuration
###############################################################################

# The prompt sent to Claude — describes the video to generate.
USER_PROMPT='Generate a short narrated video

topic: why fastbrowser + a11y_parse are great to scrape the web with AI
description: |
  Based on those 2 folders, in a monorepo
  - https://github.com/jeromeetienne/skillmd_collection/tree/main/packages/a11y_parse
  - https://github.com/jeromeetienne/skillmd_collection/tree/main/packages/fastbrowser_cli
'

# Resolve the directory of this script.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

###############################################################################
# Project setup
###############################################################################

# Build a unique project name using an ISO timestamp (colons/dots replaced for filesystem safety).
TMP_DIR='/tmp'
SUFFIX="$(date -u +'%Y-%m-%dT%H-%M-%S-%3NZ')"
PROJECT_NAME="prompt2video_${SUFFIX}"
PROJECT_DIR="${TMP_DIR}/${PROJECT_NAME}"

echo "Creating project in ${PROJECT_DIR}..."

# Scaffold a blank Remotion project in /tmp.
(cd "${TMP_DIR}" && npx create-video@latest --yes --blank "${PROJECT_NAME}")

echo "Adding claude-code skill to project..."

# Install the upstream claude-code skill into the new project.
(cd "${PROJECT_DIR}" && npx skills add remotion-dev/skills -a claude-code --yes)

echo "Copying prompt2video skill to project..."

# Copy the local prompt2video skill into the project's .claude/skills directory.
SKILL_SOURCE="${SCRIPT_DIR}/../skills/prompt2video"
SKILL_DEST="${PROJECT_DIR}/.claude/skills/prompt2video"
mkdir -p "$(dirname "${SKILL_DEST}")"
cp -Rp "${SKILL_SOURCE}" "${SKILL_DEST}"

###############################################################################
# Stream Claude output to the viewer
###############################################################################

echo "Streaming Claude output to viewer..."

# Pipe Claude's stream-json output into the viewer process.
# - Claude stdout -> viewer stdin
# - Viewer stdout/stderr -> terminal
# `set -o pipefail` ensures we surface a non-zero exit if either side fails.
(
	cd "${PROJECT_DIR}" && \
	claude \
		--output-format stream-json \
		--verbose \
		--include-partial-messages \
		--allowed-tools 'Bash,Read,Write,WebFetch' \
		--permission-mode auto \
		-p "${USER_PROMPT}" \
	| npx --yes claude_stream_viewer@latest
)

echo 'Done!'
