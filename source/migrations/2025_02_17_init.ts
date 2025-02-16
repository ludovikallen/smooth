import {Kysely} from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('stack')
		.addColumn('id', 'numeric', col => col.primaryKey().autoIncrement())
		.addColumn('name', 'text')
		.addColumn('target_bookmark', 'text')
		.addColumn('bookmark_prefix', 'text')
		.addColumn('commit_prefix', 'text')
		.execute();

	await db.schema
		.createTable('block')
		.addColumn('id', 'numeric', col => col.primaryKey().autoIncrement())
		.addColumn('stack_id', 'numeric')
		.addColumn('index', 'numeric')
		.addColumn('name', 'text')
		.addColumn('commit_id', 'text')
		.addColumn('is_submitted', 'boolean')
		.addColumn('is_done', 'boolean')
		.addForeignKeyConstraint('fk_stack_id', ['stack_id'], 'stack', ['id'])
		.execute();

	await db.schema
		.createIndex('block_commit_id_unique_index')
		.on('block')
		.columns(['commit_id'])
		.execute();

	await db.schema
		.createIndex('block_stack_id_unique_index')
		.on('block')
		.columns(['stack_id'])
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('block').execute();
	await db.schema.dropTable('stack').execute();
}
