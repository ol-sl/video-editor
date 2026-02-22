/**
 * FFmpeg helper for video transcoding
 * Uses @ffmpeg/ffmpeg for browser-based video conversion
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let isLoading = false;
let isLoaded = false;

/**
 * Load FFmpeg (downloads ~25-30MB on first call)
 */
export async function loadFFmpeg(onProgress?: (progress: number) => void): Promise<FFmpeg> {
  if (ffmpegInstance && isLoaded) {
    return ffmpegInstance;
  }

  if (isLoading) {
    // Wait for ongoing load
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (isLoaded && ffmpegInstance) {
          clearInterval(checkInterval);
          resolve(ffmpegInstance);
        }
      }, 100);
    });
  }

  isLoading = true;

  try {
    ffmpegInstance = new FFmpeg();

    // Set up logging for debugging
    ffmpegInstance.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    // Track progress during ffmpeg load
    if (onProgress) {
      let progressValue = 0;
      const progressInterval = setInterval(() => {
        progressValue += 5;
        if (progressValue <= 90) {
          onProgress(progressValue);
        } else {
          clearInterval(progressInterval);
        }
      }, 200);
    }

    // Load FFmpeg core from CDN (multi-threaded version)
    const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';
    
    try {
      await ffmpegInstance.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
      });
    } catch (loadError) {
      console.error('FFmpeg load error details:', loadError);
      throw loadError;
    }

    if (onProgress) onProgress(100);

    isLoaded = true;
    isLoading = false;

    return ffmpegInstance;
  } catch (error) {
    isLoading = false;
    throw new Error(`Failed to load FFmpeg: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get quality settings for different formats
 */
function getQualitySettings(format: 'mp4' | 'mov', quality: 'low' | 'medium' | 'high'): string[] {
  const baseSettings = {
    low: ['-crf', '28', '-preset', 'fast'],
    medium: ['-crf', '23', '-preset', 'medium'],
    high: ['-crf', '18', '-preset', 'slow'],
  };

  if (format === 'mp4') {
    return [
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-b:a', '128k',
      ...baseSettings[quality],
    ];
  } else if (format === 'mov') {
    return [
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      ...baseSettings[quality],
    ];
  }

  return [];
}

/**
 * Transcode WebM to target format using FFmpeg
 */
export async function transcodeVideo(
  webmBlob: Blob,
  targetFormat: 'mp4' | 'mov',
  quality: 'low' | 'medium' | 'high',
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const ffmpeg = await loadFFmpeg();

  try {
    // Write input file to FFmpeg virtual filesystem
    const inputFileName = 'input.webm';
    const outputFileName = `output.${targetFormat}`;

    await ffmpeg.writeFile(inputFileName, await fetchFile(webmBlob));

    // Set up progress tracking
    // Note: FFmpeg progress uses ratio (0-1) in newer versions
    if (onProgress) {
      ffmpeg.on('progress', ({ progress, time }) => {
        // Use progress ratio if valid (0-1 range), otherwise estimate from time
        let progressPercent = 0;
        
        if (typeof progress === 'number' && progress >= 0 && progress <= 1) {
          progressPercent = Math.round(progress * 100);
        } else if (typeof time === 'number' && time > 0) {
          // Fallback: time is in microseconds, estimate based on typical processing
          // This is rough but prevents negative values
          progressPercent = Math.min(99, Math.floor(time / 100000));
        }
        
        onProgress(Math.max(0, Math.min(100, progressPercent)));
      });
    }

    // Get quality settings
    const qualityArgs = getQualitySettings(targetFormat, quality);

    // Run FFmpeg transcode
    await ffmpeg.exec([
      '-i', inputFileName,
      ...qualityArgs,
      outputFileName,
    ]);

    // Read output file
    const outputData = await ffmpeg.readFile(outputFileName);

    // Clean up
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);

    // Convert to Blob (FileData can be Uint8Array or string)
    const mimeType = targetFormat === 'mp4' ? 'video/mp4' : 'video/quicktime';
    
    if (typeof outputData === 'string') {
      // String response - shouldn't happen for video but handle it
      const encoder = new TextEncoder();
      const data = encoder.encode(outputData);
      return new Blob([data], { type: mimeType });
    }
    
    // Uint8Array - create a plain copy to avoid SharedArrayBuffer issues
    const plainArray = new Uint8Array(outputData.slice(0));
    const outputBlob = new Blob([plainArray], { type: mimeType });

    return outputBlob;
  } catch (error) {
    throw new Error(`FFmpeg transcoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if FFmpeg is already loaded
 */
export function isFFmpegLoaded(): boolean {
  return isLoaded;
}

/**
 * Get estimated load time message
 */
export function getLoadTimeEstimate(): string {
  return 'First-time setup: ~5-10 seconds (downloads ~25MB)';
}
