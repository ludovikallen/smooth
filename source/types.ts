import {Generated, Insertable, Selectable, Updateable} from 'kysely';

export interface Database {
	block: BlockTable;
	stack: StackTable;
}

export interface BlockTable {
	id: Generated<number>;
	stack_id: number;
	index: number;
	name: string;
	change_id: string;
	bookmark_name: string;
	is_submitted: 0 | 1;
	is_done: 0 | 1;
	updated_at: string;
}

export type Block = Selectable<BlockTable>;
export type NewBlock = Omit<BlockTable, 'id' | 'stack_id' | 'updated_at'>;
export type BlockUpdate = Updateable<BlockTable>;

export interface StackTable {
	id: Generated<number>;
	name: string;
	target_bookmark: string;
	bookmark_prefix: string;
	commit_prefix: string;
}

export type Stack = Selectable<StackTable>;
export type NewStack = Insertable<StackTable>;
export type StackUpdate = Updateable<StackTable>;
