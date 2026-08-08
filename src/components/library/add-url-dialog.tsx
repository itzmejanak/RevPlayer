"use client";

import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { addFromUrl } from "@/lib/library/library";

export function AddUrlDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = url.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const video = await addFromUrl(trimmed);
      setOpen(false);
      setUrl("");
      router.push(`/video/${video.id}`);
    } catch {
      setError("Could not reach that URL.");
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Link2 />
            Add from URL
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add from URL</DialogTitle>
          <DialogDescription>
            Paste a direct link to a video file. It will be added to your library
            and made available for offline download.
          </DialogDescription>
        </DialogHeader>
        <input
          autoFocus
          type="url"
          value={url}
          placeholder="https://example.com/video.mp4"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button onClick={() => void submit()} disabled={busy || !url.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : <Link2 />}
            {busy ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
