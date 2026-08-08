import { Suspense } from "react";

import { LibraryView } from "@/components/library/library-view";

export const metadata = {
  title: "Library",
};

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <LibraryView />
    </Suspense>
  );
}
