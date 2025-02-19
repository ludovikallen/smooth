import {useEffect} from 'react';
import {useApp} from 'ink';
import {migrateToLatest} from '../migrate-to-lastest.js';

export default function Migrate() {
	const {exit} = useApp();

	useEffect(() => {
		migrateToLatest().then(() => {
			console.log('Smooth migrate went smoothly. Fired up and ready to serve!');
			exit();
		});
	}, []);
}
