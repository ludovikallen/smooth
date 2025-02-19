import {Migration, MigrationProvider} from 'kysely';
import path from 'path';
import {fileURLToPath} from 'url';
import {readdir} from 'fs';
import {promisify} from 'util';

const asyncReaddir = promisify(readdir);
export class ESMFileMigrationProvider implements MigrationProvider {
	constructor(private relativePath: string) {}

	async getMigrations(): Promise<Record<string, Migration>> {
		const migrations: Record<string, Migration> = {};
		const __dirname = fileURLToPath(new URL('.', import.meta.url));
		const resolvedPath = path.resolve(__dirname, this.relativePath);

		const files = await asyncReaddir(resolvedPath);

		for (const fileName of files) {
			if (!fileName.endsWith('.js')) {
				continue;
			}

			const importPath = path
				.join(this.relativePath, fileName)
				.replaceAll('\\', '/');
			const migration = await import(`./${importPath}`);
			const migrationKey = fileName.substring(0, fileName.lastIndexOf('.'));

			migrations[migrationKey] = migration;
		}

		return migrations;
	}
}
