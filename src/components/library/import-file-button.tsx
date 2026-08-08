"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { importLocalFile } from "@/lib/library/library";

const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-matroska",
  "video/mpeg",
  "video/avi",
];

export function ImportFileButton({
  variant = "outline",
  className,
}: {
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  className?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const video = await importLocalFile(file);
      router.push(`/video/${video.id}`);
    } catch {
      setError("Could not import that file.");
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_VIDEO_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <Button
        variant={variant}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="animate-spin" /> : <FileUp />}
        {busy ? "Importing…" : "Import file"}
      </Button>
      {error && (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
