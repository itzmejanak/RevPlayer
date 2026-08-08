"use client";

import { useEffect, useState } from "react";
import { HardDrive, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatBytes, getStorageUsage, requestPersistentStorage } from "@/lib/storage/quota";
import type { StorageUsage } from "@/types/video";

const EMPTY: StorageUsage = { usedBytes: 0, quotaBytes: 0, persisted: false };

export function StorageMeter() {
  const [usage, setUsage] = useState<StorageUsage>(EMPTY);
  const [requesting, setRequesting] = useState(false);

  const refresh = async () => {
    setUsage(await getStorageUsage());
  };

  useEffect(() => {
    let cancelled = false;
    void getStorageUsage().then((usage) => {
      if (!cancelled) setUsage(usage);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const percent =
    usage.quotaBytes > 0
      ? Math.min(100, Math.round((usage.usedBytes / usage.quotaBytes) * 100))
      : 0;

  return (
    <div className="rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <HardDrive className="size-4 text-muted-foreground" />
          Device storage
        </div>
        {usage.persisted ? (
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="size-3" />
            Persistent
          </Badge>
        ) : (
          <Button
            variant="outline"
            size="xs"
            disabled={requesting}
            onClick={() => {
              setRequesting(true);
              void requestPersistentStorage().then(() => {
                setRequesting(false);
                void refresh();
              });
            }}
          >
            {requesting ? "Requesting…" : "Make persistent"}
          </Button>
        )}
      </div>
      <Progress value={percent} className="mt-3" aria-label="Storage used" />
      <p className="mt-2 text-xs text-muted-foreground">
        {formatBytes(usage.usedBytes)} of {formatBytes(usage.quotaBytes)} used
        {usage.quotaBytes > 0 ? ` (${percent}%)` : ""}
      </p>
    </div>
  );
}
