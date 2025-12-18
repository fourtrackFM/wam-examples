# sound font wam processor

- using only SharedArrayBuffer and WamProcessor which is a kind of AudioWorklet
- make a SoundFont WAM that can read sf3 files as soundfonts and trigger them as envelopes
- the soundfont URL should be parameterized and default to this: https://static.fourtrack.fm/GeneralUser-GS-3.sf3
- it should have up to 16 voices of polyphony
- we should read the whole soundfont file into memory using sharedbufferarray
- the WamProcessor must allow us to change the program of the soundfont to change instruments
- the WamProcessor must support wam-midi events to trigger the playback of the soundfont
