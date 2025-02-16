import React, {useState, useCallback} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import TextInput from 'ink-text-input';
import util from 'node:util';
import child_process from 'node:child_process';

const execFile = util.promisify(child_process.execFile);

const CreateStack: React.FC = () => {
	const [items, setItems] = useState<string[]>([]);
	const [currentInput, setCurrentInput] = useState('');
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [isFirstItem, setIsFirstItem] = useState(true);
	const [isAdding, setIsAdding] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const {exit} = useApp();

	const handleCompletion = async () => {
		await execFile('jj', ['git', 'fetch']);

		let index = 0;
		for (const item of items) {
			if (index == 0) {
				await execFile('jj', ['new', '@', 'main', '-m', item]);
			} else {
				await execFile('jj', ['new', '-m', item]);
			}

			index++;
		}
		if (items.length > 0) {
			const {stdout, stderr} = await execFile('jj', [
				'prev',
				(items.length - 1).toString(),
				'--edit',
			]);

			console.log(stdout);
			console.log(stderr);
		}

		exit();
	};

	const handleSubmit = useCallback(
		(value: string) => {
			if (value.trim() === '') {
				setIsAdding(false);
				setIsEditing(false);
				return;
			}
			if (isEditing) {
				const newItems = [...items];
				newItems[selectedIndex] = value;
				setItems(newItems);
				setIsEditing(false);
			} else if (isFirstItem) {
				setItems([value]);
				setIsFirstItem(false);
			}
			setCurrentInput('');
			setIsAdding(false);
		},
		[items, selectedIndex, isFirstItem, isEditing],
	);

	const handleMoveUp = () => {
		if (selectedIndex > 0) {
			const newItems = [...items];
			const [movedItem] = newItems.splice(selectedIndex, 1);
			newItems.splice(selectedIndex - 1, 0, movedItem!);
			setItems(newItems);
			setSelectedIndex(selectedIndex - 1);
		}
	};

	const handleMoveDown = () => {
		if (selectedIndex < items.length - 1) {
			const newItems = [...items];
			const [movedItem] = newItems.splice(selectedIndex, 1);
			newItems.splice(selectedIndex + 1, 0, movedItem!);
			setItems(newItems);
			setSelectedIndex(selectedIndex + 1);
		}
	};

	useInput((input: string, key: {upArrow: boolean; downArrow: boolean}) => {
		if (!isFirstItem && !isAdding && !isEditing) {
			if (key.upArrow) {
				setSelectedIndex(Math.max(0, selectedIndex - 1));
			}
			if (key.downArrow) {
				setSelectedIndex(Math.min(items.length - 1, selectedIndex + 1));
			}
			if (input === 'a') {
				const newItems = [...items];
				const newLength = items.length;
				newItems.splice(newLength, 0, '');
				setSelectedIndex(newLength);
				setItems(newItems);
				setIsEditing(true);
			}
			if (input === 'e') {
				setCurrentInput(items[selectedIndex]!);
				setIsEditing(true);
			}
			if (input === 'c') {
				handleCompletion();
			}

			if (input === 'd') {
				const newItems = [...items];
				newItems.splice(selectedIndex, 1);
				setItems(newItems);

				if (newItems.length === 0) {
					setIsFirstItem(true);
				} else {
					setSelectedIndex(selectedIndex == 0 ? 0 : selectedIndex - 1);
				}
			}
		} else if (isEditing) {
			if (key.upArrow) {
				handleMoveUp();
			}
			if (key.downArrow) {
				handleMoveDown();
			}
		}
	});

	return (
		<>
			{!isFirstItem && (
				<>
					{items.map((item, index) => (
						<Box key={index}>
							{index === selectedIndex && isEditing ? (
								<Box>
									<Text color="yellow">
										{'>'} {index}.{' '}
									</Text>
									<TextInput
										value={currentInput}
										onChange={setCurrentInput}
										onSubmit={handleSubmit}
									/>
								</Box>
							) : (
								<Text>
									{index === selectedIndex ? '>' : ' '} {index}. {item}
								</Text>
							)}
						</Box>
					))}
					{isEditing ? (
						<Text>Save (enter) | Move (↑↓)</Text>
					) : (
						<Text>
							Navigate (↑↓) | Add (a) | Edit (e) | Delete (d) | Complete (c)
						</Text>
					)}
				</>
			)}
			{isFirstItem && (
				<>
					<Text>What should the first block be named?</Text>
					<TextInput
						value={currentInput}
						onChange={setCurrentInput}
						onSubmit={handleSubmit}
					/>
				</>
			)}
		</>
	);
};

export default CreateStack;
