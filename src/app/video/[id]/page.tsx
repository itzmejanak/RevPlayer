"use client";

import { use, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { PlayerShell } from "@/components/player/player-shell";
import { getVideo } from "@/lib/storage/metadata-db";
import { getBlobStore } from "@/lib/storage/opfs";
import type { Video as VideoRecord } from "@/types/video";

type LoadState = "loading" | "ready" | "missing" | "error";

function deriveIdFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    return lastSegment ?? parsed.hostname;
  } catch {
    return url.slice(-24);
  }
}

export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [src, setSrc] = useState<string>();
  const [state, setState] = useState<LoadState>("loading");
  const blobUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const urlOverride = new URLSearchParams(window.location.search).get("url");

        if (urlOverride) {
          if (!cancelled) {
            setVideo({
              id,
              title: deriveIdFromUrl(urlOverride),
              tags: [],
              sourceKind: "remote-url",
              sourceUrl: urlOverride,
              createdAt: Date.now(),
              status: "not-downloaded",
            });
            setState("ready");
          }
          return;
        }

        const record = await getVideo(id);
        if (!record) {
          if (!cancelled) {
            setState("missing");
          }
          return;
        }

        let resolvedSrc = record.sourceUrl;
        if (record.status === "complete") {
          try {
            const store = getBlobStore();
            const blob = await store.read(record.id);
            if (blob) {
              const blobUrl = URL.createObjectURL(blob);
              blobUrlRef.current = blobUrl;
              resolvedSrc = blobUrl;
            }
          } catch {
            // Fall back to the original source URL, if any.
          }
        }

        if (!cancelled) {
          setVideo(record);
          setSrc(resolvedSrc);
          setState("ready");
        }
      } catch {
        if (!cancelled) {
          setState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = undefined;
      }
    };
  }, [id]);

  if (state === "loading") {
    return <div className="py-24 text-center text-muted-foreground">Loading video…</div>;
  }

  if (state === "missing") {
    return (
      <div className="py-24 text-center">
        <p className="font-medium">Video not found</p>
        <p className="text-sm text-muted-foreground">
          It may have been removed from your library.
        </p>
      </div>
    );
  }

  if (state === "error" || !video) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="font-medium">Couldn&apos;t load this video</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return <PlayerShell video={video} src={src} />;
}
