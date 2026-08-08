"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format-time";
import { Button } from "@/components/ui/button";

import {
  Player,
  selectBuffer,
  selectControls,
  selectError,
  selectFullscreen,
  selectPiP,
  selectPlayback,
  selectPlaybackRate,
  selectSource,
  selectTextTrack,
  selectTime,
  selectVolume,
} from "./player-context";

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SEEK_SECONDS = 5;
const SEEK_SKIP_SECONDS = 10;
const VOLUME_STEP = 0.1;

interface PlayerControlsProps {
  title: string;
  thumbnailUrl?: string;
}

export function PlayerControls({ title, thumbnailUrl }: PlayerControlsProps) {
  const visible = Player.usePlayer((state) => selectControls(state)?.controlsVisible ?? true);

  return (
    <>
      <KeyboardShortcuts />
      <CenterOverlay />
      <ErrorOverlay title={title} />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-20 transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-3">
          <p className="line-clamp-1 text-sm font-medium text-white drop-shadow-sm">{title}</p>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-10">
          <SeekSlider thumbnailUrl={thumbnailUrl} />
          <div className="flex items-center gap-1.5">
            <PlayPauseButton />
            <TimeDisplay />
            <div className="flex-1" />
            <VolumeControl />
            <SpeedButton />
            <CaptionsButton />
            <PipButton />
            <FullscreenButton />
          </div>
        </div>
      </div>
    </>
  );
}

function KeyboardShortcuts() {
  const playback = Player.usePlayer(selectPlayback);
  const time = Player.usePlayer(selectTime);
  const volume = Player.usePlayer(selectVolume);
  const fullscreen = Player.usePlayer(selectFullscreen);
  const pip = Player.usePlayer(selectPiP);
  const textTrack = Player.usePlayer(selectTextTrack);

  const state = useRef({ playback, time, volume, fullscreen, pip, textTrack });
  useEffect(() => {
    state.current = { playback, time, volume, fullscreen, pip, textTrack };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.closest("input, textarea, select") || target.isContentEditable)) {
        return;
      }
      const { playback, time, volume, fullscreen, pip, textTrack } = state.current;
      const prevent = () => event.preventDefault();

      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          prevent();
          void playback?.togglePaused();
          break;
        case "j":
          prevent();
          void time?.seek(Math.max(0, time.currentTime - SEEK_SKIP_SECONDS));
          break;
        case "l":
          prevent();
          void time?.seek(Math.min(time.duration || Infinity, time.currentTime + SEEK_SKIP_SECONDS));
          break;
        case "arrowleft":
          prevent();
          void time?.seek(Math.max(0, time.currentTime - SEEK_SECONDS));
          break;
        case "arrowright":
          prevent();
          void time?.seek(Math.min(time.duration || Infinity, time.currentTime + SEEK_SECONDS));
          break;
        case "arrowup":
          prevent();
          volume?.setVolume(Math.min(1, volume.volume + VOLUME_STEP));
          break;
        case "arrowdown":
          prevent();
          volume?.setVolume(Math.max(0, volume.volume - VOLUME_STEP));
          break;
        case "m":
          prevent();
          volume?.toggleMuted();
          break;
        case "f":
          prevent();
          void fullscreen?.toggleFullscreen();
          break;
        case "p":
          prevent();
          void pip?.togglePictureInPicture();
          break;
        case "c":
          prevent();
          textTrack?.toggleSubtitles();
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}

function CenterOverlay() {
  const paused = Player.usePlayer((state) => selectPlayback(state)?.paused ?? true);
  const waiting = Player.usePlayer((state) => selectPlayback(state)?.waiting ?? false);
  const togglePaused = Player.usePlayer(selectPlayback)?.togglePaused;
  const visible = Player.usePlayer((state) => selectControls(state)?.controlsVisible ?? true);

  if (waiting) {
    return (
      <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/40">
        <span className="size-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={paused ? "Play" : "Pause"}
      onClick={() => void togglePaused?.()}
      className={cn(
        "absolute inset-0 z-10 grid place-items-center transition-opacity duration-200",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <span className="grid size-16 place-items-center rounded-full bg-white/15 backdrop-blur-sm">
        {paused ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 size-8 text-white" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        ) : null}
      </span>
    </button>
  );
}

function ErrorOverlay({ title }: { title: string }) {
  const error = Player.usePlayer(selectError);
  const source = Player.usePlayer(selectSource);
  const currentSource = source?.source;
  if (!error?.error) {
    return null;
  }
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-4">
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-lg border bg-background p-4 text-center">
        <p className="font-medium">Couldn&apos;t play {title}</p>
        <p className="text-sm text-muted-foreground">{error.error.message}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => error.dismissError()}>
            Dismiss
          </Button>
          {currentSource ? (
            <Button size="sm" onClick={() => source.loadSource(currentSource)}>
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PlayPauseButton() {
  const paused = Player.usePlayer((state) => selectPlayback(state)?.paused ?? true);
  const togglePaused = Player.usePlayer(selectPlayback)?.togglePaused;
  return (
    <ControlButton onClick={() => void togglePaused?.()} title={paused ? "Play (K)" : "Pause (K)"}>
      {paused ? <PlayIcon className="size-5" /> : <PauseIcon className="size-5" />}
    </ControlButton>
  );
}

function TimeDisplay() {
  const currentTime = Player.usePlayer((state) => selectTime(state)?.currentTime ?? 0);
  const duration = Player.usePlayer((state) => selectTime(state)?.duration ?? 0);
  return (
    <span className="px-1 font-mono text-xs text-white/90 tabular-nums">
      {formatTime(currentTime)} / {formatTime(duration)}
    </span>
  );
}

function SeekSlider({ thumbnailUrl }: { thumbnailUrl?: string }) {
  const currentTime = Player.usePlayer((state) => selectTime(state)?.currentTime ?? 0);
  const duration = Player.usePlayer((state) => selectTime(state)?.duration ?? 0);
  const seek = Player.usePlayer(selectTime)?.seek;
  const buffered = Player.usePlayer(selectBuffer)?.buffered ?? [];

  const [scrubValue, setScrubValue] = useState<number | null>(null);
  const [hovering, setHovering] = useState(false);

  const shown = scrubValue ?? currentTime;
  const percent = duration > 0 ? (shown / duration) * 100 : 0;
  const bufferEnd =
    buffered.find(([start, end]) => shown >= start && shown <= end)?.[1] ?? buffered.at(-1)?.[1] ?? 0;
  const bufferedPercent = duration > 0 ? (bufferEnd / duration) * 100 : 0;

  const commit = () => {
    if (scrubValue == null) {
      return;
    }
    void seek?.(scrubValue);
    setScrubValue(null);
  };

  return (
    <div
      className="group relative flex h-4 w-full cursor-pointer touch-none items-center"
      onPointerDown={() => setScrubValue(currentTime)}
      onPointerUp={commit}
      onPointerLeave={() => {
        commit();
        setHovering(false);
      }}
      onMouseEnter={() => setHovering(true)}
    >
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={shown}
        onInput={(event) => setScrubValue(Number(event.currentTarget.value))}
        onChange={commit}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        aria-label="Seek"
      />
      {thumbnailUrl && (hovering || scrubValue != null) ? (
        <div
          className="pointer-events-none absolute -top-20 z-10 overflow-hidden rounded-md border border-white/20 shadow-lg"
          style={{ left: `clamp(3%, ${percent}%, 97%)`, transform: "translateX(-50%)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- live scrub-frame proxy */}
          <img src={thumbnailUrl} alt="" className="h-16 w-28 object-cover" />
        </div>
      ) : null}
      <div className="relative h-1 w-full rounded-full bg-white/25">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/40"
          style={{ width: `${bufferedPercent}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div
        className={cn(
          "pointer-events-none absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-white shadow",
          hovering || scrubValue != null ? "opacity-100" : "opacity-0",
        )}
        style={{ left: `calc(${percent}% - 7px)` }}
      />
    </div>
  );
}

function VolumeControl() {
  const volume = Player.usePlayer((state) => selectVolume(state)?.volume ?? 1);
  const muted = Player.usePlayer((state) => selectVolume(state)?.muted ?? false);
  const vol = Player.usePlayer(selectVolume);
  const [scrubValue, setScrubValue] = useState<number | null>(null);

  const effective = muted ? 0 : volume;
  const shown = scrubValue ?? effective;

  const commit = () => {
    if (scrubValue == null) {
      return;
    }
    vol?.setVolume(scrubValue);
    if (muted && scrubValue > 0) {
      vol?.toggleMuted();
    }
    setScrubValue(null);
  };

  return (
    <div className="flex items-center gap-1.5">
      <ControlButton
        onClick={() => vol?.toggleMuted()}
        title={muted ? "Unmute (M)" : "Mute (M)"}
        active={muted || volume === 0}
      >
        {muted || volume === 0 ? (
          <VolumeOffIcon className="size-5" />
        ) : volume < 0.5 ? (
          <VolumeLowIcon className="size-5" />
        ) : (
          <VolumeHighIcon className="size-5" />
        )}
      </ControlButton>
      <div
        className="group/volume relative flex h-4 w-20 cursor-pointer touch-none items-center max-sm:hidden"
        onPointerDown={() => setScrubValue(shown)}
        onPointerUp={commit}
        onPointerLeave={commit}
      >
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={shown}
          onInput={(event) => setScrubValue(Number(event.currentTarget.value))}
          onChange={commit}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          aria-label="Volume"
        />
        <div className="relative h-1 w-full rounded-full bg-white/25">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white"
            style={{ width: `${shown * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function SpeedButton() {
  const rate = Player.usePlayer((state) => selectPlaybackRate(state)?.playbackRate ?? 1);
  const availableRates =
    Player.usePlayer((state) => selectPlaybackRate(state)?.playbackRates) ?? PLAYBACK_RATES;
  const setPlaybackRate = Player.usePlayer(selectPlaybackRate)?.setPlaybackRate;

  const cycle = () => {
    const next = availableRates.find((candidate) => candidate > rate + 1e-9) ?? availableRates[0] ?? 1;
    setPlaybackRate?.(next);
  };

  return (
    <ControlButton onClick={cycle} title={`Playback speed (${rate}×)`}>
      <span className="px-1 font-mono text-xs font-semibold tabular-nums">{rate}×</span>
    </ControlButton>
  );
}

function CaptionsButton() {
  const hasTracks = Player.usePlayer((state) => {
    const tracks = selectTextTrack(state)?.textTrackList ?? [];
    return tracks.some((track) => track.kind === "subtitles" || track.kind === "captions");
  });
  const showing = Player.usePlayer((state) => selectTextTrack(state)?.subtitlesShowing ?? false);
  const toggleSubtitles = Player.usePlayer(selectTextTrack)?.toggleSubtitles;

  if (!hasTracks) {
    return null;
  }
  return (
    <ControlButton
      onClick={() => toggleSubtitles?.()}
      title={showing ? "Hide captions (C)" : "Show captions (C)"}
      active={showing}
    >
      <CaptionsIcon className="size-5" />
    </ControlButton>
  );
}

function PipButton() {
  const pip = Player.usePlayer((state) => selectPiP(state)?.pip ?? false);
  const availability = Player.usePlayer((state) => selectPiP(state)?.pipAvailability);
  const toggle = Player.usePlayer(selectPiP)?.togglePictureInPicture;

  if (availability === "unavailable") {
    return null;
  }
  return (
    <ControlButton
      onClick={() => void toggle?.()}
      title={pip ? "Exit picture-in-picture (P)" : "Picture-in-picture (P)"}
      active={pip}
    >
      <PipIcon className="size-5" />
    </ControlButton>
  );
}

function FullscreenButton() {
  const fullscreen = Player.usePlayer((state) => selectFullscreen(state)?.fullscreen ?? false);
  const availability = Player.usePlayer((state) => selectFullscreen(state)?.fullscreenAvailability);
  const toggle = Player.usePlayer(selectFullscreen)?.toggleFullscreen;

  if (availability === "unavailable") {
    return null;
  }
  return (
    <ControlButton
      onClick={() => void toggle?.()}
      title={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
      active={fullscreen}
    >
      {fullscreen ? <MinimizeIcon className="size-5" /> : <MaximizeIcon className="size-5" />}
    </ControlButton>
  );
}

interface ControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

function ControlButton({ className, active, children, ...props }: ControlButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-md text-white transition-colors",
        active ? "bg-white/15" : "hover:bg-white/10",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

interface IconProps {
  className?: string;
}

function PlayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
    </svg>
  );
}

function VolumeHighIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function VolumeLowIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  );
}

function VolumeOffIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="m16 9 5 5" />
      <path d="m21 9-5 5" />
    </svg>
  );
}

function MaximizeIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function MinimizeIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function PipIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="18" height="14" x="3" y="5" rx="2" />
      <path d="M12 14h6v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function CaptionsIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="18" height="14" x="3" y="5" rx="2" />
      <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
    </svg>
  );
}
