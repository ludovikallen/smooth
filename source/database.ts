import {Database} from './types.js';
import SQLite from 'better-sqlite3';
import {Kysely, SqliteDialect} from 'kysely';

const dialect = new SqliteDialect({
	database: new SQLite('./.smooth/smooth.sqlite'),
});

// Database interface is passed to Kysely's constructor, and from now on, Kysely
// knows your database structure.
// Dialect is passed to Kysely's constructor, and from now on, Kysely knows how
// to communicate with your database.
export const db = new Kysely<Database>({
	dialect,
});
