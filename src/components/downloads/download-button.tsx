"use client";

import { Check, CircleX, Download, Loader2, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  cancelDownload,
  isDownloadActive,
  pauseDownload,
  startDownload,
} from "@/lib/download/download-manager";
import { useDownloadStore } from "@/lib/download/download-store";
import { formatBytes } from "@/lib/library/library";
import type { Video } from "@/types/video";

export function DownloadButton({ video }: { video: Video }) {
  const progress = useDownloadStore((state) => state.downloads[video.id]);
  const liveStatus = progress?.status ?? video.status;
  const active = isDownloadActive(video.id);
  const percent =
    progress && progress.totalBytes > 0
      ? Math.min(100, Math.round((progress.receivedBytes / progress.totalBytes) * 100))
      : 0;

  if (liveStatus === "complete") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Check className="size-3" />
        Downloaded
      </Badge>
    );
  }

  if (liveStatus === "downloading") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {percent}%
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!active}
          onClick={() => pauseDownload(video.id)}
        >
          <Pause />
          Pause
        </Button>
      </div>
    );
  }

  if (liveStatus === "paused" || liveStatus === "failed") {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void startDownload(video.id)}
        >
          {liveStatus === "paused" ? <Play /> : <Loader2 />}
          {liveStatus === "paused" ? "Resume" : "Retry"}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Cancel download"
          onClick={() => cancelDownload(video.id)}
        >
          <CircleX />
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="sm">
            <Download />
            Download
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Quality</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => void startDownload(video.id)}
        >
          <span className="flex w-full items-center justify-between gap-3">
            <span>Original</span>
            <span className="text-xs text-muted-foreground">
              {formatBytes(video.sizeBytes)}
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
