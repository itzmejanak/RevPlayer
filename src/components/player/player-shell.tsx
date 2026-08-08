"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import type { VideoPlayer } from "./video-player";

const DynamicVideoPlayer = dynamic(
  () => import("./video-player").then((module) => module.VideoPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        Loading player…
      </div>
    ),
  },
);

export function PlayerShell(props: ComponentProps<typeof VideoPlayer>) {
  return <DynamicVideoPlayer {...props} />;
}
