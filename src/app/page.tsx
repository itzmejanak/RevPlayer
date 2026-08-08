import { Download, FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Library",
};

export default function LibraryPage() {
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
        <Button disabled>
          <FolderOpen />
          Import file
        </Button>
        <Button variant="outline" disabled>
          <Download />
          Add from URL
        </Button>
      </div>
    </div>
  );
}
