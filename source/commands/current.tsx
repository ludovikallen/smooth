import React, {useEffect, useState} from 'react';
import util from 'node:util';
import child_process from 'node:child_process';
import {
	findAllBlocksByStackIdOrderedByIndex,
	findStackByChangeId,
	updateBlock,
} from '../repository.js';
import {Block, Stack} from '../types.js';
import {Box, Text, useApp, useInput} from 'ink';
import Divider from 'ink-divider';
import TextInput from 'ink-text-input';
import {Spinner} from '@inkjs/ui';

const execFile = util.promisify(child_process.execFile);

const CurrentStack: React.FC = () => {
	const [currentChangeId, setCurrentChangeId] = useState<string>();
	const [currentStack, setCurrentStack] = useState<Stack>();
	const [currentBlocks, setCurrentBlocks] = useState<Block[]>([]);
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [currentInput, setCurrentInput] = useState('');
	const [isDescribing, setIsDescribing] = useState(false);
	const [loadingMessage, setLoadingMessage] = useState<string | undefined>(
		undefined,
	);
	const [statusMessage, setStatusMessage] = useState<string | undefined>(
		undefined,
	);
	const getCurrentTime = (): string => {
		return new Date().toLocaleTimeString('en-GB', {hour12: false});
	};

	const changeStatusMessage = (message: string) => {
		setLoadingMessage(undefined);
		setStatusMessage(getCurrentTime() + ': ' + message);
	};

	const {exit} = useApp();

	const getCurrentStack = async () => {
		const {stdout} = await execFile('jj', [
			'show',
			'--template',
			'change_id ++ " "',
		]);
		const changeId = stdout.split(' ')[0];
		setCurrentChangeId(changeId);

		const stack = await findStackByChangeId(changeId!);
		if (stack == undefined || stack.id == undefined) {
			console.log(
				"Can't find your current commit in any stack. Make sure to be on a valid commit and try again.",
			);
			exit();
		}
		setCurrentStack(stack);

		const blocks = await findAllBlocksByStackIdOrderedByIndex(stack?.id!);
		setCurrentBlocks(blocks);

		const currentIndex = blocks.filter(block => block.change_id === changeId)[0]
			?.index;
		setSelectedIndex(currentIndex!);
	};

	const describeBlock = async () => {
		setLoadingMessage('Currently changing commit message...');
		const currentBlock = currentBlocks[selectedIndex];
		if (currentBlock == undefined) {
			return;
		}

		await execFile('jj', [
			'describe',
			'-m',
			currentStack?.commit_prefix + currentInput,
		]);
		await updateBlock(currentBlock!.id, {name: currentInput});

		currentBlocks[selectedIndex]!.name = currentInput;
		changeStatusMessage(
			'Changed "' +
				currentBlocks[selectedIndex]!.change_id +
				'" commit message.',
		);
	};

	const editBlock = async () => {
		setLoadingMessage('Currently changing current selected commit...');
		const currentBlock = currentBlocks[selectedIndex];
		if (currentBlock == undefined) {
			return;
		}

		await execFile('jj', ['edit', currentBlock.change_id]);

		setCurrentChangeId(currentBlock.change_id);
		changeStatusMessage('Currently editing ' + currentBlock.name);
	};

	const submitBlock = async () => {
		setLoadingMessage('Submitting changes to remote...');
		const currentBlock = currentBlocks[selectedIndex];
		if (currentBlock == undefined) {
			return;
		}

		if (currentBlock.is_submitted == 1) {
			resubmitBlock(currentBlock);
			changeStatusMessage(
				'Updated remote commit "' + currentBlock.name + '" successfully',
			);
		} else {
			await execFile('jj', [
				'bookmark',
				'create',
				currentBlock.bookmark_name,
				'-r',
				currentBlock.change_id,
			]);
			await execFile('jj', [
				'git',
				'push',
				'-b',
				currentBlock.bookmark_name,
				'--allow-new',
			]);
			await updateBlock(currentBlock!.id, {is_submitted: 1});
			setCurrentBlocks(
				currentBlocks.map(block =>
					block.id === currentBlock!.id ? {...block, is_submitted: 1} : block,
				),
			);
			changeStatusMessage(
				'Submitted commit "' + currentBlock.name + '" to remote successfully',
			);
		}
	};

	const resubmitBlock = async (currentBlock: Block) => {
		await execFile('jj', ['git', 'push', '-b', currentBlock.bookmark_name]);
	};

	const mergeBlock = async () => {
		setLoadingMessage('Merging and updating local commits...');
		const currentBlock = currentBlocks[selectedIndex];
		if (currentBlock == undefined) {
			return;
		}

		await execFile('jj', ['bookmark', 'delete', currentBlock.bookmark_name]);

		await updateBlock(currentBlock!.id, {is_done: 1});
		setCurrentBlocks(
			currentBlocks.map(block =>
				block.id === currentBlock!.id ? {...block, is_done: 1} : block,
			),
		);
		await execFile('jj', ['git', 'fetch']);
		const nextBlock = currentBlocks[selectedIndex + 1];
		if (nextBlock == undefined) {
			return;
		}

		await execFile('jj', [
			'rebase',
			'-s',
			nextBlock!.change_id,
			'-d',
			currentStack?.target_bookmark!,
		]);

		await execFile('jj', ['edit', nextBlock!.change_id]);
		setCurrentChangeId(nextBlock!.change_id);
		changeStatusMessage(
			'Successfully merged "' +
				currentBlock.name +
				'. Now editing "' +
				nextBlock?.name +
				'"',
		);
	};

	const syncStack = async () => {
		setLoadingMessage('Syncing local stack...');

		const currentBlock = currentBlocks[selectedIndex];
		if (currentBlock == undefined) {
			return;
		}

		await execFile('jj', ['git', 'fetch']);

		const nextBlock = currentBlocks.find(x => x.is_done != 1);
		if (nextBlock == undefined) {
			return;
		}
		await execFile('jj', [
			'rebase',
			'-s',
			nextBlock!.change_id,
			'-d',
			currentStack?.target_bookmark!,
		]);

		changeStatusMessage(
			'Successfully rebased ' +
				nextBlock!.name +
				' on ' +
				currentStack?.target_bookmark,
		);
	};

	const ShortcutsMenu = () => {
		const currentBlock = currentBlocks[selectedIndex];
		if (currentBlock == undefined) {
			return;
		}

		if (currentBlock.is_done) {
			return <Text color="gray">Navigate (↑↓) | Sync (s)</Text>;
		} else if (currentBlock.is_submitted == 1) {
			return (
				<Text color="gray">
					Navigate (↑↓) | Describe (d) | Edit (e) | Resubmit (s) | Merge (m) |
					Sync (y)
				</Text>
			);
		}

		if (isDescribing) {
			return <Text color="gray">Save (enter) | Move (↑↓)</Text>;
		}

		return (
			<Text color="gray">
				Navigate (↑↓) | Describe (d) | Edit (e) | Submit (s) | Merge (m) | Sync
				(y)
			</Text>
		);
	};

	useInput(
		(
			input: string,
			key: {
				upArrow: boolean;
				downArrow: boolean;
				return: boolean;
				tab: boolean;
			},
		) => {
			if (isDescribing) {
				if (key.return) {
					describeBlock().then(() => setIsDescribing(false));
				}
			} else {
				if (key.upArrow) {
					setSelectedIndex(Math.max(0, selectedIndex - 1));
				}

				if (key.downArrow) {
					setSelectedIndex(
						Math.min(currentBlocks.length - 1, selectedIndex + 1),
					);
				}

				if (input == 'd') {
					setCurrentInput(currentBlocks[selectedIndex]!.name);
					setIsDescribing(true);
				}

				if (input == 'e') {
					editBlock();
				}

				if (input == 's') {
					submitBlock();
				}

				if (input == 'm') {
					mergeBlock();
				}

				if (input == 'y') {
					syncStack();
				}
			}
		},
	);

	useEffect(() => {
		getCurrentStack();
	}, []);

	if (currentChangeId && currentStack) {
		return (
			<Box flexDirection="column">
				<Text>
					Name: {currentStack.name} | Target Bookmark:{' '}
					{currentStack.target_bookmark} | Commit Prefix:{' '}
					{currentStack.commit_prefix} | Bookmark Prefix:{' '}
					{currentStack.bookmark_prefix}
				</Text>
				<Divider />
				{currentBlocks.map((block, index) => {
					if (index === selectedIndex && isDescribing) {
						return (
							<Box key={index}>
								<Text
									color={
										block.is_done === 1
											? 'green'
											: block.is_submitted === 1
											? 'yellow'
											: ''
									}
								>
									{index === selectedIndex ? '>' : ' '} {index}.{' '}
									{block.change_id}{' '}
								</Text>
								<TextInput value={currentInput} onChange={setCurrentInput} />
								<Text
									color={
										block.is_done === 1
											? 'green'
											: block.is_submitted === 1
											? 'yellow'
											: ''
									}
								>
									{block.change_id === currentChangeId && ' (current)'}
								</Text>
							</Box>
						);
					} else {
						return (
							<Box key={index}>
								<Text
									color={
										block.is_done === 1
											? 'green'
											: block.is_submitted === 1
											? 'yellow'
											: ''
									}
								>
									{index === selectedIndex ? '>' : ' '} {index}.{' '}
									{block.change_id} {block.name}{' '}
									{block.change_id === currentChangeId && '(current)'}
								</Text>
							</Box>
						);
					}
				})}
				{loadingMessage != undefined ? (
					<Spinner label={loadingMessage} />
				) : (
					statusMessage != undefined && <Text>{statusMessage}</Text>
				)}
				<ShortcutsMenu />
			</Box>
		);
	}

	return <></>;
};
export default CurrentStack;
