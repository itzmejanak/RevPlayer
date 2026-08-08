"use client";

import { useEffect } from "react";

import { deleteProgress, getProgress, putProgress } from "@/lib/storage/metadata-db";
import { computeResumePosition, shouldSaveProgress } from "@/lib/player/resume-position";

import { Player } from "./player-context";

interface ProgressSyncProps {
  videoId: string;
  durationSec?: number;
}

export function ProgressSync({ videoId, durationSec }: ProgressSyncProps) {
  const media = Player.useMedia();
  // The store's media is the attached <video> element.
  const element = media as HTMLVideoElement | null;

  useEffect(() => {
    if (!element) {
      return;
    }
    const controller = new AbortController();
    let lastSavedMs: number | null = null;
    let didResume = false;

    const resume = async () => {
      if (didResume) {
        return;
      }
      try {
        const progress = await getProgress(videoId);
        if (!progress) {
          didResume = true;
          return;
        }
        const duration = element.duration || durationSec || 0;
        const target = computeResumePosition(progress.positionSec, duration);
        if (target > 0 && element.duration > 0 && target < element.duration) {
          element.currentTime = target;
        }
        didResume = true;
      } catch {
        // A failed resume should never block playback.
      }
    };

    const save = (force: boolean) => {
      const current = element.currentTime;
      if (!Number.isFinite(current) || current <= 0) {
        return;
      }
      if (!force && !shouldSaveProgress(current, Date.now(), lastSavedMs)) {
        return;
      }
      lastSavedMs = Date.now();
      void putProgress({
        videoId,
        positionSec: current,
        durationSec: Number.isFinite(element.duration) ? element.duration : undefined,
        updatedAt: Date.now(),
      }).catch(() => {
        // A failed write should never break playback.
      });
    };

    const maybeResume = () => {
      if (element.readyState >= 1) {
        void resume();
      }
    };

    element.addEventListener("loadedmetadata", maybeResume, { signal: controller.signal });
    element.addEventListener("durationchange", maybeResume, { signal: controller.signal });
    element.addEventListener("timeupdate", () => save(false), { signal: controller.signal });
    element.addEventListener("pause", () => save(true), { signal: controller.signal });
    element.addEventListener(
      "ended",
      () => {
        void deleteProgress(videoId).catch(() => {
          // Ignore cleanup failures.
        });
      },
      { signal: controller.signal },
    );

    // Metadata may already be loaded before this effect attaches listeners
    // (fast local files on reload), so check the current state immediately.
    maybeResume();

    return () => {
      controller.abort();
      save(true);
    };
  }, [element, videoId, durationSec]);

  return null;
}
