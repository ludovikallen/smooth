import {db} from './database.js';
import {Stack, NewStack, NewBlock, Block, BlockUpdate} from './types.js';

export async function findStackByChangeId(
	changeId: string,
): Promise<Stack | undefined> {
	return await db
		.selectFrom('stack')
		.innerJoin('block', 'block.stack_id', 'stack.id')
		.where('block.change_id', '=', changeId)
		.selectAll(['stack'])
		.executeTakeFirst();
}

export async function findAllBlocksByStackIdOrderedByIndex(
	stackId: number,
): Promise<Block[]> {
	return await db
		.selectFrom('block')
		.innerJoin('stack', 'stack.id', 'block.stack_id')
		.where('block.stack_id', '=', stackId)
		.orderBy('block.index asc')
		.selectAll(['block'])
		.execute();
}

export async function updateBlock(id: number, block: BlockUpdate) {
	return await db
		.updateTable('block')
		.set(block)
		.where('id', '=', id)
		.execute();
}

export async function createStack(stack: NewStack, blocks: NewBlock[]) {
	return await db.transaction().execute(async transaction => {
		const newStack = await transaction
			.insertInto('stack')
			.values(stack)
			.returning('id')
			.executeTakeFirstOrThrow();

		const newBlocks = blocks.map(block => {
			return {
				name: block.name,
				index: block.index,
				change_id: block.change_id,
				bookmark_name: block.bookmark_name,
				is_submitted: block.is_submitted,
				is_done: block.is_done,
				stack_id: newStack.id,
			};
		});

		return await transaction.insertInto('block').values(newBlocks).execute();
	});
}
