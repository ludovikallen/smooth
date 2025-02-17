import {db} from './database.js';
import {Stack, NewStack, NewBlock, Block} from './types.js';

export async function findStackByCommitId(
	commitId: string,
): Promise<Stack | undefined> {
	return await db
		.selectFrom('stack')
		.innerJoin('block', 'block.stack_id', 'stack.id')
		.where('block.commit_id', '=', commitId)
		.selectAll(['stack'])
		.executeTakeFirst();
}

export async function findAllBlocksByStackId(
	stackId: number,
): Promise<Block[]> {
	return await db
		.selectFrom('block')
		.innerJoin('stack', 'stack.id', 'block.stack_id')
		.where('block.stack_id', '=', stackId)
		.selectAll(['block'])
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
				commit_id: block.commit_id,
				is_submitted: block.is_submitted,
				is_done: block.is_done,
				stack_id: newStack.id,
			};
		});

		return await transaction.insertInto('block').values(newBlocks).execute();
	});
}
