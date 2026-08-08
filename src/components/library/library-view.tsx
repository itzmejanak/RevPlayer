"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileVideo, FolderOpen, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImportFileButton } from "@/components/library/import-file-button";
import { AddUrlDialog } from "@/components/library/add-url-dialog";
import { DownloadButton } from "@/components/downloads/download-button";
import { listVideos } from "@/lib/storage/metadata-db";
import {
  deleteVideoData,
  formatBytes,
  formatDuration,
} from "@/lib/library/library";
import { useDownloadStore } from "@/lib/download/download-store";
import type { Video } from "@/types/video";

export function LibraryView() {
  const [videos, setVideos] = useState<Video[]>([]);
  const downloads = useDownloadStore((state) => state.downloads);

  const refresh = async () => {
    setVideos(await listVideos());
  };

  useEffect(() => {
    let cancelled = false;
    void listVideos().then((videos) => {
      if (!cancelled) setVideos(videos);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (videos.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
          <FolderOpen className="size-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-semibold">Your library is empty</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Import local video files or download from a URL to build your offline
          collection.
        </p>
        <div className="mt-2 flex gap-3">
          <ImportFileButton />
          <AddUrlDialog />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Library</h1>
        <div className="flex gap-2">
          <ImportFileButton variant="outline" />
          <AddUrlDialog />
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => {
          const progress = downloads[video.id];
          const status = progress?.status ?? video.status;
          return (
            <li
              key={video.id}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground"
            >
              <Link
                href={`/video/${video.id}`}
                className="flex items-center gap-3"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FileVideo className="size-6 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-medium group-hover:underline">
                    {video.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(video.sizeBytes)}
                    {video.durationSec ? ` · ${formatDuration(video.durationSec)}` : ""}
                  </p>
                </div>
              </Link>
              <div className="flex items-center justify-between gap-2">
                {status === "downloading" || status === "paused" ? (
                  <Badge variant="secondary">
                    {status === "downloading" ? "Downloading…" : "Paused"}
                  </Badge>
                ) : status === "complete" ? (
                  <Badge variant="secondary">On device</Badge>
                ) : status === "failed" ? (
                  <Badge variant="destructive">Failed</Badge>
                ) : (
                  <Badge variant="outline">Not downloaded</Badge>
                )}
                <div className="flex items-center gap-1.5">
                  <DownloadButton video={video} />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${video.title}`}
                    onClick={() => {
                      if (confirm(`Delete "${video.title}" from this device?`)) {
                        void deleteVideoData(video.id).then(refresh);
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
