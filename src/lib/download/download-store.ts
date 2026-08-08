import { create } from "zustand";

import type { DownloadStatus } from "@/types/video";

export interface DownloadProgress {
  videoId: string;
  status: DownloadStatus;
  receivedBytes: number;
  totalBytes: number;
  error?: string;
}

interface DownloadStoreState {
  downloads: Record<string, DownloadProgress>;
  setProgress: (progress: Partial<DownloadProgress>) => void;
  remove: (videoId: string) => void;
  hydrate: (entries: DownloadProgress[]) => void;
}

export const useDownloadStore = create<DownloadStoreState>((set) => ({
  downloads: {},
  setProgress: (progress) =>
    set((state) => {
      const videoId = progress.videoId!;
      return {
        downloads: {
          ...state.downloads,
          [videoId]: {
            ...state.downloads[videoId],
            ...progress,
            videoId,
          },
        },
      };
    }),
  remove: (videoId) =>
    set((state) => {
      const downloads = { ...state.downloads };
      delete downloads[videoId];
      return { downloads };
    }),
  hydrate: (entries) =>
    set((state) => {
      const downloads = { ...state.downloads };
      for (const entry of entries) {
        downloads[entry.videoId] = { ...downloads[entry.videoId], ...entry };
      }
      return { downloads };
    }),
}));
