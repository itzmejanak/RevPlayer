import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <WifiOff className="size-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This page isn&apos;t available offline yet. Pages you&apos;ve already
        visited — and every video you&apos;ve downloaded — keep working without a
        connection.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Go to library
      </Link>
    </div>
  );
}
