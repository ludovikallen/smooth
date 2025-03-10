import {db} from './database.js';
import {Migrator} from 'kysely';
import {ESMFileMigrationProvider} from './ESMFileMigrationProvider.js';

export async function migrateToLatest() {
	const migrator = new Migrator({
		db,
		provider: new ESMFileMigrationProvider('migrations'),
	});

	const {error, results} = await migrator.migrateToLatest();

	results?.forEach(it => {
		if (it.status === 'Success') {
			console.log(`migration "${it.migrationName}" was executed successfully`);
		} else if (it.status === 'Error') {
			console.error(`failed to execute migration "${it.migrationName}"`);
		}
	});

	if (error) {
		console.error('failed to migrate');
		console.error(error);
		process.exit(1);
	}

	await db.destroy();
}
