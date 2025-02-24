import {useEffect, useState} from 'react';
import {
	findAllStacks,
	findStackByChangeId,
	getStacksStats,
} from '../repository.js';
import util from 'node:util';
import child_process from 'node:child_process';
import {Stack} from '../types.js';
import {Box, render, Text, useApp, useInput} from 'ink';
import React from 'react';
import CurrentStack from './current.js';

const execFile = util.promisify(child_process.execFile);

const List: React.FC = () => {
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [stacks, setStacks] = useState<Stack[]>([]);
	const [, setSelectedStack] = useState<Stack>();
	const [selectedStackStats, setSelectedStackStats] = useState<{
		stack_id: number;
		total: string | number | bigint;
		totalDone: string | number | bigint;
		firstNotDoneBlockChangeId: string | null;
	}>();
	const [currentStackId, setCurrentStackId] = useState<number>();
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [, setSelected] = useState<boolean>(false);
	const [stacksStats, setStacksStats] = useState<
		{
			stack_id: number;
			total: string | number | bigint;
			totalDone: string | number | bigint;
			firstNotDoneBlockChangeId: string | null;
		}[]
	>([]);
	const {exit} = useApp();

	const getStacks = async () => {
		try {
			const {stdout} = await execFile('jj', [
				'show',
				'--template',
				'change_id ++ " "',
			]);
			const changeId = stdout.split(' ')[0];
			const currentStack = await findStackByChangeId(changeId!);

			if (currentStack != undefined) {
				setCurrentStackId(currentStack?.id!);
			}

			setStacks(await findAllStacks());
			setStacksStats(await getStacksStats());
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		getStacks();
	}, []);

	useEffect(() => {
		const currentStack = stacks[selectedIndex];
		setSelectedStack(currentStack);
		const currentStats = stacksStats.find(x => x.stack_id === currentStack!.id);
		setSelectedStackStats(currentStats);
	}, [selectedIndex]);

	useInput(
		async (
			input: string,
			key: {
				upArrow: boolean;
				downArrow: boolean;
				return: boolean;
				tab: boolean;
			},
		) => {
			if (input === 'q') {
				exit();
			}
			if (key.upArrow) {
				setSelectedIndex(Math.max(0, selectedIndex - 1));
			}
			if (key.downArrow) {
				setSelectedIndex(Math.min(stacks.length - 1, selectedIndex + 1));
			}

			if (
				selectedStackStats?.total !== selectedStackStats?.totalDone &&
				selectedStackStats?.firstNotDoneBlockChangeId != null &&
				input === 's'
			) {
				editBlock();
			}
		},
	);

	const editBlock = async () => {
		await execFile('jj', [
			'edit',
			selectedStackStats?.firstNotDoneBlockChangeId!,
		]);
		render(<CurrentStack />);
		setSelected(true);
	};

	if (isLoading) {
		return <Text>Loading stacks...</Text>;
	}

	if (stacks.length == 0) {
		return (
			<Text>
				No stack found in this repo. Use 'smooth create' to start using smooth.
			</Text>
		);
	}

	const ShortcutsMenu = () => {
		if (selectedStackStats?.total === selectedStackStats?.totalDone) {
			return <Text color="gray">Navigate (↑↓) | Quit (q)</Text>;
		}

		return <Text color="gray">Navigate (↑↓) | Select (s) | Quit (q)</Text>;
	};

	return (
		<Box flexDirection="column">
			{stacks.map((s, index) => {
				const currentStats = stacksStats.find(x => x.stack_id === s.id);
				return (
					<Box key={index}>
						<Text
							color={
								currentStats?.total === currentStats?.totalDone ? 'green' : ''
							}
						>
							{index === selectedIndex ? '>' : ' '} {index}.{' '}
							{currentStats?.totalDone!.toString()}/
							{currentStats?.total!.toString()} {s.name}
							{s.id === currentStackId && ' (current)'}
						</Text>
					</Box>
				);
			})}
			<ShortcutsMenu />
		</Box>
	);
};

export default List;
