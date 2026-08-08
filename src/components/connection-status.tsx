"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function ConnectionStatus() {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      title={online ? "Online" : "Offline"}
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${
          online ? "bg-emerald-500" : "bg-destructive"
        }`}
      />
      {online ? "Online" : "Offline"}
    </span>
  );
}
