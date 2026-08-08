"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileVideo, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DownloadButton } from "@/components/downloads/download-button";
import { hydrateDownloads } from "@/lib/download/download-manager";
import { useDownloadStore } from "@/lib/download/download-store";
import { listVideos } from "@/lib/storage/metadata-db";
import { deleteVideoData, formatBytes } from "@/lib/library/library";
import type { Video } from "@/types/video";

export function DownloadsList() {
  const [videos, setVideos] = useState<Video[]>([]);
  const downloads = useDownloadStore((state) => state.downloads);

  const refresh = async () => {
    const all = await listVideos();
    setVideos(all);
  };

  useEffect(() => {
    void hydrateDownloads().then(refresh);
  }, []);

  const rows = useMemo(
    () =>
      videos.filter(
        (video) =>
          video.sourceUrl ||
          video.status !== "not-downloaded" ||
          downloads[video.id],
      ),
    [videos, downloads],
  );

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center">
        <FileVideo className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Nothing downloaded yet.</p>
        <p className="text-xs text-muted-foreground/70">
          Add a video from your library or import a local file to get started.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((video) => {
        const progress = downloads[video.id];
        const percent =
          progress && progress.totalBytes > 0
            ? Math.min(
                100,
                Math.round((progress.receivedBytes / progress.totalBytes) * 100),
              )
            : 0;
        return (
          <li
            key={video.id}
            className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileVideo className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <Link
                  href={`/video/${video.id}`}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {video.title}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {formatBytes(video.sizeBytes ?? progress?.totalBytes)}
                  {video.sourceUrl ? " · " + video.sourceUrl : ""}
                </p>
                {progress &&
                  (progress.status === "downloading" ||
                    progress.status === "paused") && (
                    <div className="mt-2 flex items-center gap-2 sm:hidden">
                      <Progress
                        value={percent}
                        className="h-1.5 w-24"
                        aria-label={`${video.title} download progress`}
                      />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {percent}%
                      </span>
                    </div>
                  )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {progress &&
                (progress.status === "downloading" ||
                  progress.status === "paused") && (
                  <div className="hidden items-center gap-2 sm:flex">
                    <Progress
                      value={percent}
                      className="w-24"
                      aria-label={`${video.title} download progress`}
                    />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {percent}%
                    </span>
                  </div>
                )}
              {progress?.status === "failed" && (
                <span className="text-xs text-destructive" title={progress.error}>
                  Failed
                </span>
              )}
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
          </li>
        );
      })}
    </ul>
  );
}
