#!/usr/bin/env node
import {existsSync, mkdirSync, writeFileSync} from 'fs';
import Pastel from 'pastel';

const app = new Pastel({
	importMeta: import.meta,
});

const runMigration = async () => {
	console.log('Test');
};

const directoryPath = './.smooth';
if (!existsSync(directoryPath) && !process.argv.includes('init')) {
	console.log(
		"\x1b[33mRun '\x1b[1msmooth init\x1b[0m\x1b[33m' to start using smooth on this repo!\x1b[0m",
	);
} else if (!existsSync(directoryPath) && process.argv.includes('init')) {
	console.log('Currently initializing smooth...');
	mkdirSync(directoryPath);
	writeFileSync(directoryPath + '/.gitignore', '/*');
	runMigration().then(() => {
		console.log('Smooth initialization was successful! 🎊');
	});
} else if (existsSync(directoryPath) && process.argv.includes('init')) {
	console.log('Init was already done on this repo.');
} else {
	await app.run();
}
