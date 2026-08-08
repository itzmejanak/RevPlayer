"use client";

import type { Video as VideoRecord } from "@/types/video";

import { Player, HlsJsVideo, Video } from "./player-context";
import { MediaSession } from "./media-session";
import { PlayerControls } from "./player-controls";
import { ProgressSync } from "./progress-sync";

export interface VideoPlayerProps {
  video: VideoRecord;
  src?: string;
}

export function VideoPlayer({ video, src }: VideoPlayerProps) {
  const mediaSrc = src ?? video.sourceUrl;
  const isHls = Boolean(mediaSrc) && /\.m3u8(\?.*)?$/i.test(mediaSrc as string);
  const isRemote = video.sourceKind === "remote-url";

  return (
    <Player.Provider>
      <Player.Container className="group/player relative aspect-video w-full select-none overflow-hidden rounded-lg bg-black">
        {mediaSrc ? (
          isHls ? (
            <HlsJsVideo
              src={mediaSrc}
              preload="metadata"
              controls={false}
              playsInline
              crossOrigin={isRemote ? "anonymous" : undefined}
              poster={video.thumbnailUrl}
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <Video
              src={mediaSrc}
              preload="metadata"
              controls={false}
              playsInline
              crossOrigin={isRemote ? "anonymous" : undefined}
              poster={video.thumbnailUrl}
              className="absolute inset-0 h-full w-full"
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
            No source available for this video.
          </div>
        )}

        <PlayerControls title={video.title} thumbnailUrl={video.thumbnailUrl} />
        <MediaSession video={video} src={mediaSrc} />
        <ProgressSync videoId={video.id} durationSec={video.durationSec} />
      </Player.Container>
    </Player.Provider>
  );
}
