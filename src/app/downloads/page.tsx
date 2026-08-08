import { Suspense } from "react";

import { DownloadsList } from "@/components/downloads/downloads-list";
import { StorageMeter } from "@/components/downloads/storage-meter";

export const metadata = {
  title: "Downloads",
};

export default function DownloadsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Downloads</h1>
        <p className="text-sm text-muted-foreground">
          Manage your offline videos and device storage.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <DownloadsList />
      </Suspense>
      <StorageMeter />
    </div>
  );
}
