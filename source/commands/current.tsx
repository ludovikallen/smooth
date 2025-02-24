import React, {useEffect, useState} from 'react';
import util from 'node:util';
import child_process from 'node:child_process';
import {
	deleteBlock,
	findAllBlocksByStackIdOrderedByIndex,
	findStackByChangeId,
	insertBlockAtIndex,
	updateBlock,
} from '../repository.js';
import {Block, NewBlock, Stack} from '../types.js';
import {Box, Text, useApp, useInput} from 'ink';
import Divider from 'ink-divider';
import TextInput from 'ink-text-input';
import {Spinner} from '@inkjs/ui';
import {formatCurrentTime} from '../utils.js';

const execFile = util.promisify(child_process.execFile);

const CurrentStack: React.FC = () => {
	const [currentChangeId, setCurrentChangeId] = useState<string>();
	const [currentStack, setCurrentStack] = useState<Stack>();
	const [currentBlocks, setCurrentBlocks] = useState<Block[]>([]);
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [currentInput, setCurrentInput] = useState('');
	const [newBlockInput, setNewBlockInput] = useState('');
	const [isDescribing, setIsDescribing] = useState(false);
	const [isAdding, setIsAdding] = useState(false);
	const [addingIndex, setAddingIndex] = useState(0);
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
		setAddingIndex(blocks.length);

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
			currentBlock.change_id,
			'-m',
			currentStack?.commit_prefix + currentInput,
		]);
		await updateBlock(currentBlock!.id, {
			name: currentInput,
			updated_at: formatCurrentTime(),
		});

		currentBlocks[selectedIndex]!.name = currentInput;
		changeStatusMessage(
			'"' + currentBlocks[selectedIndex]!.name + '" is the new commit message.',
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
			await updateBlock(currentBlock!.id, {
				is_submitted: 1,
				updated_at: formatCurrentTime(),
			});
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

		await updateBlock(currentBlock!.id, {
			is_done: 1,
			updated_at: formatCurrentTime(),
		});
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
				'". Now editing "' +
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

	const addBlock = async (index: number, name: string) => {
		setLoadingMessage('Adding block to local stack...');

		const basedOnCommit = currentBlocks.find(x => x.index == index - 1);
		if (
			basedOnCommit == undefined ||
			index == 0 ||
			basedOnCommit.is_done == 1
		) {
			await execFile('jj', [
				'new',
				'@',
				currentStack!.target_bookmark,
				'-m',
				currentStack?.commit_prefix + name,
			]);
		} else {
			await execFile('jj', [
				'new',
				basedOnCommit.change_id,
				'-m',
				currentStack?.commit_prefix + name,
			]);
		}

		const {stdout} = await execFile('jj', [
			'show',
			'--template',
			'change_id ++ " "',
		]);
		const changeId = stdout.split(' ')[0];

		const block = {
			index: index,
			is_done: 0,
			is_submitted: 0,
			name: name,
			change_id: changeId!,
			bookmark_name: currentStack?.bookmark_prefix! + index,
		} as NewBlock;

		await insertBlockAtIndex(block, currentStack?.id!);
		const blocks = await findAllBlocksByStackIdOrderedByIndex(
			currentStack?.id!,
		);

		setCurrentBlocks(blocks);
		setCurrentChangeId(changeId);
		setAddingIndex(blocks.length);
		setNewBlockInput('');

		changeStatusMessage('Successfully added ' + name + ' at index ' + index);
	};

	const removeBlock = async () => {
		setLoadingMessage('Removing selected block...');
		const currentBlock = currentBlocks[selectedIndex];
		if (currentBlock == undefined) {
			return;
		}

		await execFile('jj', ['abandon', currentBlock.change_id]);

		await deleteBlock(currentBlock!);
		const filteredBlocks = currentBlocks.filter(x => x.id !== currentBlock!.id);
		setCurrentBlocks(filteredBlocks);

		let nextBlock = filteredBlocks[selectedIndex];
		if (nextBlock == undefined) {
			nextBlock = filteredBlocks[selectedIndex - 1];
		}
		if (nextBlock == undefined || nextBlock.is_done == 1) {
			for (let secondsLeft = 10; secondsLeft > 0; secondsLeft--) {
				changeStatusMessage(
					`No commit left to work on for this stack. Command will exit in ${secondsLeft} seconds...`,
				);

				await new Promise(resolve => setTimeout(resolve, 1000));
			}
			exit();
			return;
		}

		await execFile('jj', ['edit', nextBlock!.change_id]);
		setCurrentChangeId(nextBlock!.change_id);
		changeStatusMessage(
			'Successfully removed "' +
				currentBlock.name +
				'. Now editing "' +
				nextBlock?.name +
				'"',
		);
	};

	const ShortcutsMenu = () => {
		const currentBlock = currentBlocks[selectedIndex];
		if (currentBlock == undefined) {
			return;
		}
		if (isAdding) {
			return <Text>Save (enter) | Move (↑↓) | Back (esc)</Text>;
		}

		if (currentBlock.is_done) {
			return <Text color="gray">Navigate (↑↓) | Sync (y) | Add (a)</Text>;
		} else if (currentBlock.is_submitted == 1) {
			return (
				<Text color="gray">
					Navigate (↑↓) | Describe (d) | Edit (e) | Resubmit (s) | Merge (m) |
					Sync (y) | Add (a) | Remove (r)
				</Text>
			);
		}

		if (isDescribing) {
			return <Text color="gray">Save (enter) | Move (↑↓)</Text>;
		}

		return (
			<Text color="gray">
				Navigate (↑↓) | Describe (d) | Edit (e) | Submit (s) | Merge (m) | Sync
				(y) | Add (a) | Remove (r)
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
				escape: boolean;
			},
		) => {
			const currentBlock = currentBlocks[selectedIndex];
			if (currentBlock == undefined) {
				return;
			}
			if (isDescribing) {
				if (key.return) {
					describeBlock().then(() => setIsDescribing(false));
				}
			} else if (isAdding) {
				if (key.return) {
					addBlock(addingIndex, newBlockInput).then(() => setIsAdding(false));
				}

				if (key.escape) {
					setIsAdding(false);
					setAddingIndex(currentBlocks.length);
					setNewBlockInput('');
				}

				if (key.upArrow) {
					const newIndex = Math.max(0, addingIndex - 1);
					setAddingIndex(newIndex);
				}

				if (key.downArrow) {
					const newIndex = Math.min(currentBlocks.length, addingIndex + 1);
					setAddingIndex(newIndex);
				}
			} else if (currentBlock.is_done == 1) {
				if (key.upArrow) {
					setSelectedIndex(Math.max(0, selectedIndex - 1));
				}

				if (key.downArrow) {
					setSelectedIndex(
						Math.min(currentBlocks.length - 1, selectedIndex + 1),
					);
				}

				if (input == 'y') {
					syncStack();
				}

				if (input == 'a') {
					setIsAdding(true);
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

				if (input == 'a') {
					setIsAdding(true);
				}

				if (input == 'r') {
					removeBlock();
				}
			}
		},
	);

	const AddingBlock = () => {
		const newBlocks = currentBlocks.map(x => x.name);
		newBlocks.splice(addingIndex, 0, newBlockInput);

		return newBlocks.map((block, index) => {
			if (index === addingIndex) {
				return (
					<Box key={index}>
						<Text>
							{'>'} {index}.{' '}
						</Text>
						<TextInput value={newBlockInput} onChange={setNewBlockInput} />
					</Box>
				);
			} else {
				return (
					<Box key={index}>
						<Text>
							{'  '}
							{index}. {block}
						</Text>
					</Box>
				);
			}
		});
	};

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
				{isAdding ? (
					<AddingBlock />
				) : (
					currentBlocks.map((block, index) => {
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
					})
				)}
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
