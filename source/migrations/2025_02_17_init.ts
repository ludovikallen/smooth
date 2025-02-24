import {Kysely, sql} from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('stack')
		.ifNotExists()
		.addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
		.addColumn('name', 'text')
		.addColumn('target_bookmark', 'text')
		.addColumn('bookmark_prefix', 'text')
		.addColumn('commit_prefix', 'text')
		.execute();

	await db.schema
		.createTable('block')
		.ifNotExists()
		.addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
		.addColumn('stack_id', 'numeric')
		.addColumn('index', 'numeric')
		.addColumn('name', 'text')
		.addColumn('change_id', 'text')
		.addColumn('bookmark_name', 'text')
		.addColumn('is_submitted', 'boolean')
		.addColumn('is_done', 'boolean')
		.addColumn('updated_at', 'text', col =>
			col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
		)
		.addForeignKeyConstraint('fk_stack_id', ['stack_id'], 'stack', ['id'])
		.execute();

	await db.schema
		.createIndex('block_change_id_unique_index')
		.on('block')
		.columns(['change_id'])
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
