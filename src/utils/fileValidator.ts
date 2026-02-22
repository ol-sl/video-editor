import { VIDEO_CONSTRAINTS, VideoMetadata } from '../types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Validate video file size and format
 */
export async function validateVideoFile(file: File): Promise<ValidationResult> {
  // Check file size
  if (file.size > VIDEO_CONSTRAINTS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of ${formatBytes(VIDEO_CONSTRAINTS.MAX_FILE_SIZE)}. Selected file is ${formatBytes(file.size)}.`,
    };
  }
  
  // Check MIME type
  if (!VIDEO_CONSTRAINTS.SUPPORTED_FORMATS.includes(file.type as any)) {
    return {
      valid: false,
      error: `Unsupported file format: ${file.type}. Supported formats: MP4, WebM, QuickTime.`,
    };
  }
  
  // Warning for large files
  if (file.size > VIDEO_CONSTRAINTS.WARNING_FILE_SIZE) {
    return {
      valid: true,
      warning: `File size is ${formatBytes(file.size)}. Large files may cause browser instability. Recommended: under 500MB.`,
    };
  }
  
  return { valid: true };
}

/**
 * Check if the browser supports WebCodecs API
 */
export function checkWebCodecsSupport(): boolean {
  return 'VideoDecoder' in window && 'VideoEncoder' in window;
}

/**
 * Probe video codec support using VideoDecoder
 */
export async function probeVideoCodec(file: File): Promise<{ supported: boolean; codec?: string }> {
  try {
    // Create a video element to extract codec information
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.src = url;
    
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = reject;
    });
    
    // Try to determine codec from file
    // This is a simplified check - real implementation would need more robust codec detection
    const codec = await detectCodec(file.type);
    
    URL.revokeObjectURL(url);
    
    if (!codec) {
      return { supported: false };
    }
    
    // Check if VideoDecoder supports this codec
    const config = {
      codec,
      codedWidth: video.videoWidth,
      codedHeight: video.videoHeight,
    };
    
    const support = await VideoDecoder.isConfigSupported(config);
    
    return {
      supported: support.supported || false,
      codec,
    };
  } catch (error) {
    console.error('Error probing codec:', error);
    return { supported: false };
  }
}

/**
 * Extract video metadata from file
 */
export async function extractVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.src = url;
    
    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error('Timeout loading video metadata'));
    }, 10000); // 10 second timeout
    
    video.onloadedmetadata = async () => {
      try {
        let duration = video.duration;
        
        // Handle Infinity duration (common with some WebM files)
        if (!isFinite(duration)) {
          // Try seeking to the end to get actual duration
          video.currentTime = 1e101; // Seek to end
          await new Promise<void>((res) => {
            video.onseeked = () => {
              duration = video.currentTime;
              res();
            };
            // Fallback if seeking doesn't work
            setTimeout(() => res(), 2000);
          });
        }
        
        // Validate duration
        if (!isFinite(duration) || duration <= 0 || isNaN(duration)) {
          clearTimeout(timeout);
          URL.revokeObjectURL(url);
          reject(new Error('Invalid video duration'));
          return;
        }

        const metadata: VideoMetadata = {
          duration: duration,
          width: video.videoWidth,
          height: video.videoHeight,
          codec: 'unknown', // Will be determined by probeVideoCodec
          frameRate: 30, // Default, may need MediaSource API for accurate detection
        };
        
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        resolve(metadata);
      } catch (error) {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    
    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video metadata'));
    };
  });
}

/**
 * Detect codec from MIME type
 */
async function detectCodec(mimeType: string): Promise<string | null> {
  // Common codec mappings
  const codecMap: Record<string, string> = {
    'video/mp4': 'avc1.42E01E', // H.264 Baseline
    'video/webm': 'vp8',
    'video/quicktime': 'avc1.42E01E',
  };
  
  return codecMap[mimeType] || null;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration to human-readable string (MM:SS)
 */
export function formatDuration(seconds: number): string {
  // Handle invalid values
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
