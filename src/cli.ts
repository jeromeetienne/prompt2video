#!/usr/bin/env node

import Fs from 'node:fs';
import Path from 'node:path';
import * as Commander from 'commander';

import { Build } from './commands/build.js';
import { Install } from './commands/install.js';

const __dirname = new URL('.', import.meta.url).pathname;

export class Cli {

	static async main(): Promise<void> {
		const packageJsonPath = Path.resolve(__dirname, '../package.json');
		const packageJson = JSON.parse(await Fs.promises.readFile(packageJsonPath, 'utf8')) as { version: string };

		const program = new Commander.Command();
		program
			.name('prompt2video')
			.description('Scaffold a Remotion project and stream Claude Code to generate a narrated AI video from a prompt.')
			.version(packageJson.version, '-V, --version', 'display the version number');

		program
			.command('install [agents-folder]')
			.description('Install all bundled skills into the ai-agents folder, e.g. <agents-folder>/skills/ (default: .)')
			.action(async (agentsFolder: string | undefined) => {
				await Install.run(agentsFolder ?? '.');
			});

		program
			.command('build')
			.description('Scaffold the Remotion project, run Claude, and copy the generated artifacts.')
			.option('-t, --tmp-dir <dir>', 'parent directory for the generated project', '/tmp')
			.option('-o, --output-dir <dir>', 'output directory for the generated video (mp4/pdf/log)', '.')
			.action(async (options: { tmpDir: string; outputDir: string }) => {
				await Build.run(options);
			});

		await program.parseAsync(process.argv);
	}
}

void Cli.main();
