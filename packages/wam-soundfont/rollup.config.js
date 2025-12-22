import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';

/** @type {import('rollup').RollupOptions[]} */
export default [
	// Spessasynth wrapper to expose exports to globalThis
	{
		input: 'src/spessasynth_wrapper.js',
		output: {
			file: 'dist/spessasynth_core.js',
			format: 'es',
			sourcemap: false,
		},
		plugins: [
			resolve({
				browser: true,
			}),
			commonjs(),
		],
	},
	// Main plugin bundle
	{
		input: 'src/index.js',
		external: [
			'./WamSoundFontProcessor.worklet.js',
			'./spessasynth_core.js',
		],
		output: {
			dir: 'dist/',
			format: 'es',
			sourcemap: false,
		},
		plugins: [
			resolve({
				browser: true,
			}),
			commonjs(),
			copy({
				targets: [
					{ src: 'src/descriptor.json', dest: 'dist/' },
					{ src: 'src/WamSoundFontNode.js', dest: 'dist/' },
					{
						src: 'src/WamSoundFontProcessor.worklet.js',
						dest: 'dist/',
					},
					{ src: 'src/Gui/**/*', dest: 'dist/Gui/' },
					{ src: 'lib/**/*', dest: 'dist/' },
				],
			}),
		],
	},
];
