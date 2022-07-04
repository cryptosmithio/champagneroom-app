import fsm from 'svelte-fsm';
import { readable, writable } from 'svelte/store';

export type VideoStreamOptions = {
	video: {
		width: number;
		height: number;
		frameRate: {
			min: number;
			ideal: number;
		};
	};
	audio: boolean;
};

export const userStream = async (options: Partial<VideoStreamOptions> = {}) => {
	let videoTrack: MediaStreamTrack;
	let audioTrack: MediaStreamTrack;
	const _mediaStream = writable<MediaStream | null>(null);
	const mediaStream = readable<MediaStream | null>(null, (set) => {
		_mediaStream.subscribe((stream) => {
			set(stream);
		});
	});

	const ops = Object.assign(
		{
			video: {
				width: 1280,
				height: 720,
				frameRate: {
					ideal: 60,
					min: 15
				}
			},
			audio: true
		},
		options
	);

	const camState = fsm('uninitialized', {
		uninitialized: {
			initialized() {
				videoTrack.enabled = true;
				return 'CamOn';
			}
		},
		CamOn: {
			toggleCam() {
				videoTrack.enabled = !videoTrack.enabled;
				return 'CamOff';
			},
			turnCamOff() {
				videoTrack.enabled = false;
				return 'CamOff';
			}
		},
		CamOff: {
			toggleCam() {
				videoTrack.enabled = !videoTrack.enabled;
				return 'CamOn';
			},
			turnCamOn() {
				videoTrack.enabled = true;
				return 'CamOn';
			}
		}
	});

	const micState = fsm('uninitialized', {
		uninitialized: {
			initialized() {
				audioTrack.enabled = true;
				return 'MicOn';
			}
		},
		MicOn: {
			toggleMic() {
				audioTrack.enabled = !audioTrack.enabled;
				return 'MicOff';
			},
			turnMicOff() {
				audioTrack.enabled = false;
				return 'MicOff';
			}
		},
		MicOff: {
			toggleMic() {
				audioTrack.enabled = !audioTrack.enabled;
				return 'MicOn';
			},
			turnMicOn() {
				audioTrack.enabled = true;
				return 'MicOn';
			}
		}
	});

	try {
		const stream = await navigator.mediaDevices.getUserMedia(ops);
		_mediaStream.set(stream);
		const videoStreams = stream.getVideoTracks();
		const audioStreams = stream.getAudioTracks();
		videoTrack = videoStreams[0];
		audioTrack = audioStreams[0];
		camState.initialized();
		micState.initialized();
	} catch (error) {
		console.log('get UserStream error: ', error);
		throw error;
	}

	return {
		mediaStream,
		camState,
		micState
	};
};

export type UserStreamType = ReturnType<typeof userStream>;