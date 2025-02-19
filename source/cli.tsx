#!/usr/bin/env node
import {existsSync, mkdirSync, writeFileSync} from 'fs';
import Pastel from 'pastel';

const app = new Pastel({
	importMeta: import.meta,
});
const directoryPath = './.smooth';

if (!existsSync(directoryPath)) {
	mkdirSync(directoryPath);
	writeFileSync(directoryPath + '/.gitignore', '/*');
	console.log(
		'Created .smooth folder. Make sure to run the migrate command before running anything else.',
	);
}

await app.run();
