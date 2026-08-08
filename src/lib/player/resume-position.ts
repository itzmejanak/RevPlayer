export const MIN_RESUME_SECONDS = 5;
export const MIN_SAVE_INTERVAL_MS = 5_000;

export function computeResumePosition(
  positionSec: number | undefined,
  durationSec: number,
): number {
  if (!positionSec || positionSec < MIN_RESUME_SECONDS) {
    return 0;
  }
  if (durationSec > 0) {
    if (positionSec >= Math.max(0, durationSec - MIN_RESUME_SECONDS)) {
      return 0;
    }
    return Math.min(positionSec, durationSec);
  }
  return positionSec;
}

export function shouldSaveProgress(
  positionSec: number,
  nowMs: number,
  lastSavedMs: number | null,
  intervalMs = MIN_SAVE_INTERVAL_MS,
): boolean {
  if (positionSec < MIN_RESUME_SECONDS) {
    return false;
  }
  if (lastSavedMs === null) {
    return true;
  }
  return nowMs - lastSavedMs >= intervalMs;
}
