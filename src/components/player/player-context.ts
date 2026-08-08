import { createPlayer } from "@videojs/react";
import { videoFeatures, Video, type VideoProps } from "@videojs/react/video";
import {
  HlsJsVideo,
  type HlsJsVideoProps,
} from "@videojs/react/media/hlsjs-video";
import {
  selectBuffer,
  selectControls,
  selectError,
  selectFullscreen,
  selectPiP,
  selectPlayback,
  selectPlaybackRate,
  selectSource,
  selectTextTrack,
  selectTime,
  selectVolume,
} from "@videojs/core/dom";
import type {
  MediaBufferState,
  MediaControlsState,
  MediaErrorState,
  MediaFullscreenState,
  MediaPictureInPictureState,
  MediaPlaybackRateState,
  MediaPlaybackState,
  MediaTextTrackState,
  MediaTimeState,
  MediaVolumeState,
} from "@videojs/media";

export const Player = createPlayer({
  features: videoFeatures,
  displayName: "RevPlayer",
});

export { Video, HlsJsVideo };
export type { VideoProps, HlsJsVideoProps };

export {
  selectBuffer,
  selectControls,
  selectError,
  selectFullscreen,
  selectPiP,
  selectPlayback,
  selectPlaybackRate,
  selectSource,
  selectTextTrack,
  selectTime,
  selectVolume,
};

export type {
  MediaBufferState,
  MediaControlsState,
  MediaErrorState,
  MediaFullscreenState,
  MediaPictureInPictureState,
  MediaPlaybackRateState,
  MediaPlaybackState,
  MediaTextTrackState,
  MediaTimeState,
  MediaVolumeState,
};
