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

export async function insertBlockAtIndex(block: NewBlock, stackId: number) {
	const blocks = await db
		.selectFrom('block')
		.where('block.stack_id', '=', stackId)
		.where('block.index', '>=', block.index)
		.selectAll()
		.execute();

	const currentStack = await db
		.selectFrom('stack')
		.where('id', '=', stackId)
		.selectAll()
		.executeTakeFirst();

	for (const currentBlock of blocks) {
		currentBlock.index++;
		currentBlock.bookmark_name =
			currentStack?.bookmark_prefix! + currentBlock.index;
		await db
			.updateTable('block')
			.set(currentBlock)
			.where('id', '=', currentBlock.id)
			.execute();
	}

	await db
		.insertInto('block')
		.values({
			name: block.name,
			index: block.index,
			change_id: block.change_id,
			bookmark_name: block.bookmark_name,
			is_submitted: block.is_submitted,
			is_done: block.is_done,
			stack_id: stackId,
		})
		.execute();
}

export async function updateBlock(id: number, block: BlockUpdate) {
	return await db
		.updateTable('block')
		.set(block)
		.where('id', '=', id)
		.execute();
}

export async function deleteBlock(block: Block) {
	const blocks = await db
		.selectFrom('block')
		.where('block.stack_id', '=', block.stack_id)
		.where('block.index', '>=', block.index)
		.selectAll()
		.execute();

	const currentStack = await db
		.selectFrom('stack')
		.where('id', '=', block.stack_id)
		.selectAll()
		.executeTakeFirst();

	for (const currentBlock of blocks) {
		currentBlock.index--;
		currentBlock.bookmark_name =
			currentStack?.bookmark_prefix! + currentBlock.index;
		await db
			.updateTable('block')
			.set(currentBlock)
			.where('id', '=', currentBlock.id)
			.execute();
	}

	return await db.deleteFrom('block').where('id', '=', block.id).execute();
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
