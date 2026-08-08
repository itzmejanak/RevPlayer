"use client";

import { useEffect, useRef } from "react";

import type { Video as VideoRecord } from "@/types/video";

import {
  Player,
  selectPlayback,
  selectPlaybackRate,
  selectTime,
  selectVolume,
} from "./player-context";

interface MediaSessionProps {
  video: VideoRecord;
  src?: string;
}

export function MediaSession({ video, src }: MediaSessionProps) {
  const playback = Player.usePlayer(selectPlayback);
  const time = Player.usePlayer(selectTime);
  const volume = Player.usePlayer(selectVolume);
  const rate = Player.usePlayer(selectPlaybackRate);

  const state = useRef({ playback, time, volume, rate });
  useEffect(() => {
    state.current = { playback, time, volume, rate };
  });

  const currentTime = time?.currentTime ?? 0;
  const duration = time?.duration ?? 0;

  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    const mediaSession = navigator.mediaSession;

    mediaSession.metadata = new MediaMetadata({
      title: video.title,
      artist: "RevPlayer",
      album: src ?? undefined,
      artwork: video.thumbnailUrl
        ? [{ src: video.thumbnailUrl, sizes: "512x512", type: "image/jpeg" }]
        : [],
    });

    const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ["play", () => void state.current.playback?.play()],
      ["pause", () => state.current.playback?.pause()],
      [
        "seekbackward",
        (details) => {
          const current = state.current.time;
          if (!current) {
            return;
          }
          void current.seek(Math.max(0, current.currentTime - (details.seekOffset ?? 10)));
        },
      ],
      [
        "seekforward",
        (details) => {
          const current = state.current.time;
          if (!current) {
            return;
          }
          void current.seek(
            Math.min(current.duration || Infinity, current.currentTime + (details.seekOffset ?? 10)),
          );
        },
      ],
      [
        "seekto",
        (details) => {
          if (details.seekTime == null) {
            return;
          }
          void state.current.time?.seek(details.seekTime);
        },
      ],
      ["previoustrack", null],
      ["nexttrack", null],
    ];

    for (const [action, handler] of handlers) {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {
        // Some platforms don't support every action.
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          mediaSession.setActionHandler(action, null);
        } catch {
          // Ignore cleanup failures.
        }
      }
    };
  }, [video.title, video.thumbnailUrl, src]);

  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator) || duration <= 0) {
      return;
    }
    try {
      navigator.mediaSession.setPositionState?.({
        duration,
        playbackRate: state.current.rate?.playbackRate ?? 1,
        position: Math.min(currentTime, duration),
      });
    } catch {
      // setPositionState throws if position briefly exceeds duration.
    }
  }, [currentTime, duration]);

  return null;
}
