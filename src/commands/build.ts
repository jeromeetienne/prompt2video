import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Path from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;

export class Build {

	static async run(options: { tmpDir: string; outputDir: string }): Promise<void> {
		///////////////////////////////////////////////////////////////////////////////
		///////////////////////////////////////////////////////////////////////////////
		//	Read user prompt from stdin
		///////////////////////////////////////////////////////////////////////////////
		///////////////////////////////////////////////////////////////////////////////

		const userPrompt = (await Build.readStdin()).trim();
		if (userPrompt.length === 0) {
			console.error('Error: no user prompt provided on stdin.');
			console.error('Usage: echo "my prompt" | npx tsx prompt2video.ts build');
			process.exit(1);
		}

		// Wrap the user's topic in an explicit instruction so Claude triggers the
		// prompt2video skill and generates a video, instead of just answering the
		// topic as text when the stdin reads like a plain question.
		const claudePrompt = `Use the prompt2video skill to generate a narrated video with slides about the following topic:\n\n${userPrompt}`;

		///////////////////////////////////////////////////////////////////////////////
		///////////////////////////////////////////////////////////////////////////////
		//
		///////////////////////////////////////////////////////////////////////////////
		///////////////////////////////////////////////////////////////////////////////


		const tmpDir = options.tmpDir;
		const suffix = (new Date()).toISOString().replace(/[:.]/g, '-');
		const projectName = `prompt2video_${suffix}`;
		const projectDir = Path.join(tmpDir, projectName);

		///////////////////////////////////////////////////////////////////////////////
		///////////////////////////////////////////////////////////////////////////////
		//	Creating the folder
		///////////////////////////////////////////////////////////////////////////////
		///////////////////////////////////////////////////////////////////////////////

		console.log(`Creating project in ${projectDir}...`);

		ChildProcess.execSync(`npx create-video@latest --yes --blank ${projectName}`, {
			cwd: tmpDir,
			stdio: 'inherit',
		});

		///////////////////////////////////////////////////////////////////////////////
		///////////////////////////////////////////////////////////////////////////////
		//	Add the SKILL.md from remotion and prompt2video
		///////////////////////////////////////////////////////////////////////////////
		///////////////////////////////////////////////////////////////////////////////

		console.log('Adding claude-code skill to project...');
		ChildProcess.execSync('npx skills add remotion-dev/skills -a claude-code --yes', {
			cwd: projectDir,
			stdio: 'inherit',
		});

		// FIXME use --install
		console.log('Copying prompt2video skill to project...');
		const skillSource = Path.resolve(__dirname, '../../skills/prompt2video');
		const skillDest = Path.join(projectDir, '.claude/skills/prompt2video');
		Fs.cpSync(skillSource, skillDest, { recursive: true, preserveTimestamps: true });

		///////////////////////////////////////////////////////////////////////////////
		///////////////////////////////////////////////////////////////////////////////
		//	Launch claude
		///////////////////////////////////////////////////////////////////////////////
		///////////////////////////////////////////////////////////////////////////////

		console.log('Streaming Claude output to viewer...');
		const eventLogPath = Path.join(projectDir, 'out', 'video.claude_events.jsonl');

		// create the ./out directory if it doesn't exist, since claude will write the event log before the directory is created
		Fs.mkdirSync(Path.dirname(eventLogPath), { recursive: true });

		// This will run the claude command with the user prompt, and stream the output to the viewer.
		// - It will also save the raw event stream to a log file for later analysis.
		await Build.streamClaudeToViewer(claudePrompt, projectDir, eventLogPath);

		///////////////////////////////////////////////////////////////////////////////
		///////////////////////////////////////////////////////////////////////////////
		//	Copy output
		///////////////////////////////////////////////////////////////////////////////
		///////////////////////////////////////////////////////////////////////////////

		// copy the generated video, pdf and log files to the output directory. Using async Fs
		// {projectDir}/out/video.mp4
		// {projectDir}/out/slides.pdf
		// {projectDir}/out/video.claude_events.jsonl
		const outputFiles = ['video.mp4', 'slides.pdf', 'video.claude_events.jsonl'];
		await Fs.promises.mkdir(options.outputDir, { recursive: true });
		for (const outputFile of outputFiles) {
			const pathSrc = Path.join(projectDir, 'out', outputFile);
			const pathDest = Path.join(options.outputDir, `${projectName}_${outputFile}`);

			const fileExists = await Fs.promises.access(pathSrc, Fs.constants.F_OK).then(() => true).catch(() => false);
			if (fileExists === false) {
				console.warn(`Output file not found: ${pathSrc}`);
				continue;
			}

			// copy the file
			await Fs.promises.copyFile(pathSrc, pathDest);

			// log the copy
			console.log(`Copied ${pathSrc} to ${pathDest}`);
		}

		///////////////////////////////////////////////////////////////////////////////
		///////////////////////////////////////////////////////////////////////////////
		//
		///////////////////////////////////////////////////////////////////////////////
		///////////////////////////////////////////////////////////////////////////////

		console.log('Done!');
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Reads all data from stdin and returns it as a string.
	 * If stdin is a TTY, returns an empty string.
	 * - it is used to read the user prompt for the claude agent from the command line.
	 *
	 * @returns {Promise<string>} The data read from stdin.
	 */
	static async readStdin(): Promise<string> {
		if (process.stdin.isTTY === true) {
			return '';
		}
		const chunks: Buffer[] = [];
		for await (const chunk of process.stdin) {
			chunks.push(chunk as Buffer);
		}
		return Buffer.concat(chunks).toString('utf8');
	}

	/**
	 * Spawns the claude process with the given user prompt, and streams the output to the viewer.
	 * - It also saves the raw event stream to a log file for later analysis.
	 *
	 * @param userPrompt The prompt to send to the claude agent.
	 * @param cwd The working directory to run the claude process in. This should be the root of the
	 * Remotion project, where the .claude folder is located.
	 * @param eventLogPath The path to save the raw event stream from claude. This will be a JSONL file where
	 * each line is a JSON object representing an event.
	 * @returns A promise that resolves when both the claude process and the viewer process have exited
	 * successfully, or rejects if either process exits with an error.
	 */
	static streamClaudeToViewer(userPrompt: string, cwd: string, eventLogPath: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const claude = ChildProcess.spawn(
				'claude',
				[
					'--output-format', 'stream-json',
					'--verbose',
					'--include-partial-messages',
					'--allowed-tools', 'Bash,Read,Write,WebFetch',
					'--permission-mode', 'auto',
					'-p', userPrompt,
				],
				{ cwd, stdio: ['ignore', 'pipe', 'inherit'] },
			);

			const streamViewerCmd = 'npx';
			const streamViewerArgs = ['--yes', 'claude_stream_viewer@latest'];

			const viewer = ChildProcess.spawn(streamViewerCmd, streamViewerArgs, {
				cwd,
				stdio: ['pipe', 'inherit', 'inherit'],
			});

			Fs.mkdirSync(Path.dirname(eventLogPath), { recursive: true });
			const eventLog = Fs.createWriteStream(eventLogPath);
			eventLog.on('error', reject);

			claude.stdout.pipe(eventLog);
			claude.stdout.pipe(viewer.stdin);

			let claudeCode: number | null = null;
			let viewerCode: number | null = null;

			const settle = (): void => {
				if (claudeCode === null || viewerCode === null) {
					return;
				}
				if (claudeCode === 0 && viewerCode === 0) {
					resolve();
					return;
				}
				reject(new Error(`pipeline failed: claude=${claudeCode} viewer=${viewerCode}`));
			};

			claude.on('error', reject);
			viewer.on('error', reject);
			claude.on('close', (code: number | null) => {
				claudeCode = code ?? 1;
				settle();
			});
			viewer.on('close', (code: number | null) => {
				viewerCode = code ?? 1;
				settle();
			});
		});
	}
}
