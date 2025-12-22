// Wrapper to expose spessasynth exports to globalThis for use in serialized functions
import {
	SpessaSynthProcessor,
	SoundBankLoader,
} from '../../../node_modules/spessasynth_core/dist/index.js';

// Expose to globalThis so the serialized getWamSoundFontProcessor function can access them
globalThis.SpessaSynthProcessor = SpessaSynthProcessor;
globalThis.SoundBankLoader = SoundBankLoader;

console.log(
	'[spessasynth_wrapper] Exposed SpessaSynthProcessor and SoundBankLoader to globalThis'
);
