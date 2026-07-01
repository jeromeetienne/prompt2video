import Fs from 'node:fs';
import Path from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;

export class Install {

	static async run(skillFolder: string): Promise<void> {
		const sourceSkillsDir = Path.resolve(__dirname, '../../skills');
		const targetSkillsDir = Path.resolve(skillFolder, 'skills');
		try {
			const entries = await Fs.promises.readdir(sourceSkillsDir, { withFileTypes: true });
			const skillDirs = entries.filter((entry) => entry.isDirectory() === true);
			if (skillDirs.length === 0) {
				console.error(`prompt2video error: no skills found in ${sourceSkillsDir}`);
				process.exit(1);
			}
			for (const skillDir of skillDirs) {
				const sourceDir = Path.join(sourceSkillsDir, skillDir.name);
				const targetDir = Path.join(targetSkillsDir, skillDir.name);
				await Fs.promises.cp(sourceDir, targetDir, { recursive: true });
				console.log(`Installed ${skillDir.name} skill at ${targetDir}`);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`prompt2video error: ${message}`);
			process.exit(1);
		}
	}
}
