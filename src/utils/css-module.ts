import { readFile } from 'node:fs/promises';
import camelcaseKeys from 'camelcase-keys';
import to from 'await-to-js';
import { transform } from 'lightningcss';
import MagicString from 'magic-string';
import type { StaticImport } from 'mlly';
import { parseStaticImport, resolvePath } from 'mlly';
import { stringToUint8Array, uint8ArrayToString } from 'uint8array-extras';

type getCssModuleImportsProps = {
	imports: StaticImport[];
	aliases: Record<string, string>;
	filename?: string;
};

type ResolvedModuleImport = {
	path: string;
	defaultImport: string;
	imp: StaticImport;
};

export async function getCssModuleImports(
	{
		imports,
		aliases,
		filename,
	}: getCssModuleImportsProps,
): Promise<ResolvedModuleImport[]> {
	const cssModules = await Promise.all(imports.map(async (imp) => {
		const {
			specifier,
			defaultImport,
		} = parseStaticImport(imp);

		if (defaultImport == null) {
			throw new Error(`Default import is required for css modules: ${specifier}`);
		}

		const aliasKey = Object.keys(aliases).find(a => specifier.startsWith(a));
		if (aliasKey == null) {
			const s = new MagicString(specifier);
			s.overwrite(0, specifier.length, specifier);
			return { path: s.toString(), defaultImport, imp };
		}

		const [err, resolved] = await to(resolvePath(specifier, { url: filename }));

		if (err != null) {
			console.error(`Failed to resolve path: ${specifier}`);
			return undefined;
		}

		return { path: resolved, defaultImport, imp };
	}));

	return cssModules.filter(i => i != null);
}

export type CssModule = {
	css?: string;
	exports: Record<string, string>;
} & ResolvedModuleImport;

export async function getCssModule({ path, ...rest }: ResolvedModuleImport): Promise<CssModule> {
	const [err, code] = await to(readFile(path, { encoding: 'utf-8' }));

	if (err != null) {
		console.error(`Failed to read css module: ${path}`);
		return { css: undefined, exports: {}, path, ...rest };
	}

	const { code: _css, exports: _exports } = transform({
		code: stringToUint8Array(code),
		cssModules: true,
		minify: false,
		sourceMap: false,
		filename: path,
	});

	const css = uint8ArrayToString(_css);

	if (_exports == null) {
		return { css, exports: {}, path, ...rest };
	}

	const __exports: Record<string, string> = {};
	for (const [key, value] of Object.entries(_exports)) {
		__exports[key] = value.name;
	}
	const exports = camelcaseKeys(__exports);

	return { css, exports, path, ...rest };
}