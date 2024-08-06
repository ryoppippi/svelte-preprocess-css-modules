import path from 'node:path';
import { preprocess } from 'svelte/compiler';
import { cssModules } from '../src';

type Params = {
	source: string;
	preprocessOptions: Parameters<typeof preprocess>[2];
};

export async function compiler({
	source,
	preprocessOptions,
}: Params) {
	const { code } = await preprocess(
		source,
		[cssModules()],
		preprocessOptions,
	);

	return code;
};
