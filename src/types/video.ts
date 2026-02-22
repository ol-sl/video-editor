// Core video-related type definitions

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  codec: string;
  frameRate: number;
  bitrate?: number;
}

export interface AudioSettings {
  volume: number; // 0-100 (0-100%)
  muted: boolean;
}

export interface VideoClip {
  id: string;
  file: File;
  metadata: VideoMetadata;
  startTime: number; // Trim start in seconds
  endTime: number; // Trim end in seconds
  audioSettings: AudioSettings;
  thumbnailUrl?: string;
}

export interface TimelineBlock {
  id: string;
  clipId: string;
  order: number;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface ProcessingProgress {
  taskId: string;
  operation: 'trim' | 'merge' | 'export' | 'thumbnail';
  progress: number; // 0-100
  currentStep: string;
  estimatedTimeRemaining?: number; // seconds
  completed: boolean;
  error?: string;
}

export interface ExportSettings {
  format: 'mp4' | 'webm' | 'mov';
  quality: 'low' | 'medium' | 'high';
  bitrate?: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  activeBlockId?: string;
}

export const VIDEO_CONSTRAINTS = {
  MAX_FILE_SIZE: 1024 * 1024 * 1024, // 1GB
  WARNING_FILE_SIZE: 500 * 1024 * 1024, // 500MB
  SUPPORTED_FORMATS: ['video/mp4', 'video/webm', 'video/quicktime'],
  CHUNK_SIZE: 10 * 1024 * 1024, // 10MB
} as const;
