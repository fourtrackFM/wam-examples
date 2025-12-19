# sound font wam processor

- using only SharedArrayBuffer and WamProcessor which is a kind of AudioWorklet
- make a SoundFont WAM that can read sf3 files as soundfonts and trigger them as envelopes
- the soundfont URL should be parameterized and default to this: https://static.fourtrack.fm/GeneralUser-GS-3.sf3
- it should have up to 16 voices of polyphony
- we should read the whole soundfont file into memory using sharedbufferarray
- the WamProcessor must allow us to change the program of the soundfont to change instruments
- the WamProcessor must support wam-midi events to trigger the playback of the soundfont


## sustaining sounds 
- loop points are found in the pdta chunk corresponding to the program
- for the synth, we need to implement sustain during note on. you are looping in a weird way. there is an onset at the beginning of the program. once we reach loopEnd, we must go back to loopStart and keep looping between loopStart and loopEnd until note off, at which point we keep looping with the release time applied to the gain envelope
- we should interpolate between loopEnd and loopStart to avoid artifacts
