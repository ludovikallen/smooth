import React, {useState, useCallback, useEffect} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import TextInput from 'ink-text-input';
import util from 'node:util';
import child_process from 'node:child_process';
import Divider from 'ink-divider';

const execFile = util.promisify(child_process.execFile);

enum Step {
	TargetBookmark = 0,
	StackName = 1,
	BookmarkPrefix = 2,
	CommitPrefix = 3,
	EditingBlocks = 4,
}

const CreateStack: React.FC = () => {
	const [currentStep, setCurrentStep] = useState<Step>(Step.TargetBookmark);
	const [nextStep, setNextStep] = useState<Step | undefined>(
		Step.BookmarkPrefix,
	);
	const [previousStep, setPreviousStep] = useState<Step | undefined>();
	const [items, setItems] = useState<string[]>([]);
	const [targetBookmark, setTargetBookmark] = useState<string>('');
	const [bookmarkPrefix, setBookmarkPrefix] = useState<string>('');
	const [commitPrefix, setCommitPrefix] = useState<string>('');
	const [stackName, setStackName] = useState<string>('');
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

	useEffect(() => {
		const stepValues = Object.values(Step).filter(
			value => typeof value === 'number',
		) as Step[];

		const currentIndex = stepValues.indexOf(currentStep);

		const previousIndex =
			currentIndex > 0 ? stepValues[currentIndex - 1] : undefined;

		setPreviousStep(previousIndex);
		const nextIndex =
			currentIndex < stepValues.length - 1
				? stepValues[currentIndex + 1]
				: undefined;
		setNextStep(nextIndex);
	}, [currentStep]);

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
			if (
				!isFirstItem &&
				!isAdding &&
				!isEditing &&
				currentStep == Step.EditingBlocks
			) {
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
			} else if (isEditing && currentStep == Step.EditingBlocks) {
				if (key.upArrow) {
					handleMoveUp();
				}
				if (key.downArrow) {
					handleMoveDown();
				}
			} else {
				if (key.return && nextStep != undefined) {
					setCurrentStep(nextStep);
				} else if (key.tab && previousStep != undefined) {
					setCurrentStep(previousStep);
				}
			}
		},
	);

	switch (currentStep) {
		case Step.TargetBookmark: {
			return (
				<>
					<Box>
						<Text>Target bookmark: </Text>
						<TextInput value={targetBookmark} onChange={setTargetBookmark} />
					</Box>
					<ShortcutsMenu nextStep={nextStep} previousStep={previousStep} />
				</>
			);
		}

		case Step.StackName: {
			return (
				<>
					<Box flexDirection="row">
						<Text>Target bookmark: {targetBookmark}</Text>
					</Box>

					<Box>
						<Text>Stack name: </Text>
						<TextInput value={stackName} onChange={setStackName} />
					</Box>
					<ShortcutsMenu nextStep={nextStep} previousStep={previousStep} />
				</>
			);
		}

		case Step.BookmarkPrefix: {
			return (
				<>
					<Box flexDirection="column">
						<Text>Target bookmark: {targetBookmark}</Text>
						<Text>Stack name: {stackName}</Text>
					</Box>

					<Box>
						<Text>Bookmark prefix: </Text>
						<TextInput value={bookmarkPrefix} onChange={setBookmarkPrefix} />
					</Box>
					<ShortcutsMenu nextStep={nextStep} previousStep={previousStep} />
				</>
			);
		}

		case Step.CommitPrefix: {
			return (
				<>
					<Box flexDirection="column">
						<Text>Target bookmark: {targetBookmark}</Text>
						<Text>Stack name: {stackName}</Text>
						<Text>Bookmark prefix: {bookmarkPrefix}</Text>
					</Box>

					<Box>
						<Text>Commit prefix: </Text>
						<TextInput value={commitPrefix} onChange={setCommitPrefix} />
					</Box>
					<ShortcutsMenu nextStep={nextStep} previousStep={previousStep} />
				</>
			);
		}

		case Step.EditingBlocks: {
			return (
				<>
					<Box flexDirection="column">
						<Text>Target bookmark: {targetBookmark}</Text>
						<Text>Stack name: {stackName}</Text>
						<Text>Bookmark prefix: {bookmarkPrefix}</Text>
						<Text>Commit prefix: {commitPrefix}</Text>
					</Box>
					<Divider />
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
		}
	}
};

interface ShortcutsMenuProps {
	nextStep: Step | undefined;
	previousStep: Step | undefined;
}

const ShortcutsMenu = ({nextStep, previousStep}: ShortcutsMenuProps) => {
	if (nextStep !== undefined && previousStep !== undefined) {
		return <Text>↵ (next) | ↹ (previous)</Text>;
	} else if (nextStep !== undefined && previousStep == undefined) {
		return <Text>↵ (next)</Text>;
	} else {
		return <Text>↹ (previous)</Text>;
	}
};
export default CreateStack;
