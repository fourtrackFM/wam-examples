import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';

/** @type {import('rollup').RollupOptions[]} */
export default [
	// Main plugin bundle - bundles everything including spessasynth
	{
		input: 'src/index.js',
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
					{
						src: '../../node_modules/spessasynth_lib/dist/spessasynth_processor.min.js',
						dest: 'dist/',
						rename: 'spessasynth_core.js',
					},
					{ src: 'src/Gui/**/*', dest: 'dist/Gui/' },
					{ src: 'lib/**/*', dest: 'dist/' },
				],
			}),
		],
	},
];
