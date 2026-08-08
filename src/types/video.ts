export type DownloadStatus =
  | "not-downloaded"
  | "downloading"
  | "paused"
  | "complete"
  | "failed";

export type SourceKind = "local-file" | "remote-url" | "blob";

export interface DownloadRecord {
  videoId: string;
  sourceUrl: string;
  totalBytes: number;
  receivedBytes: number;
  quality?: string;
  status: DownloadStatus;
  rangeSupported: boolean;
  updatedAt: number;
}

export interface QualityOption {
  id: string;
  label: string;
  height?: number;
  bitrateKbps?: number;
  estimatedSizeBytes?: number;
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  durationSec?: number;
  thumbnailUrl?: string;
  sizeBytes?: number;
  quality?: string;
  tags: string[];
  sourceKind: SourceKind;
  sourceUrl?: string;
  createdAt: number;
  downloadedAt?: number;
  status: DownloadStatus;
}

export interface WatchProgress {
  videoId: string;
  positionSec: number;
  durationSec?: number;
  updatedAt: number;
}

export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number;
  usageDetails?: { [key: string]: number };
  persisted: boolean;
}
