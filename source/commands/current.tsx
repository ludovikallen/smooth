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

const execFile = util.promisify(child_process.execFile);

const CurrentStack: React.FC = () => {
	const [currentChangeId, setCurrentChangeId] = useState<string>();
	const [currentStack, setCurrentStack] = useState<Stack>();
	const [currentBlocks, setCurrentBlocks] = useState<Block[]>([]);
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [currentInput, setCurrentInput] = useState('');
	const [isDescribing, setIsDescribing] = useState(false);

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
		const currentBlock = currentBlocks[selectedIndex];
		if (currentBlock == undefined) {
			return;
		}

		await execFile('jj', ['describe', '-m', currentInput]);
		await updateBlock(currentBlock!.id, {name: currentInput});

		currentBlocks[selectedIndex]!.name = currentInput;
	};

	const editBlock = async () => {
		const currentBlock = currentBlocks[selectedIndex];
		if (currentBlock == undefined) {
			return;
		}

		await execFile('jj', ['edit', currentBlock.change_id]);

		setCurrentChangeId(currentBlock.change_id);
	};

	const ShortcutsMenu = () => {
		if (isDescribing) {
			return <Text>Save (enter) | Move (↑↓)</Text>;
		}
		return <Text color="gray">Navigate (↑↓) | Describe (d) | Edit (e)</Text>;
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
								<Text>
									{index === selectedIndex ? '>' : ' '} {index}.{' '}
									{block.change_id}{' '}
								</Text>
								<TextInput value={currentInput} onChange={setCurrentInput} />
								<Text>
									{block.change_id === currentChangeId && ' (current)'}
								</Text>
							</Box>
						);
					} else {
						return (
							<Box key={index}>
								<Text>
									{index === selectedIndex ? '>' : ' '} {index}.{' '}
									{block.change_id} {block.name}{' '}
									{block.change_id === currentChangeId && '(current)'}
								</Text>
							</Box>
						);
					}
				})}
				<ShortcutsMenu />
			</Box>
		);
	}

	return <></>;
};
export default CurrentStack;
