import { useState } from 'react';
import toast from 'react-hot-toast';
import { useVideoStore } from '../store/videoStore';
import { ExportSettings } from '../types';
import { downloadBlob, getSuggestedFilename, getSaveFileHandle, isFileSystemAccessSupported } from '../utils/downloadHelper';
import { transcodeVideo, isFFmpegLoaded, getLoadTimeEstimate } from '../utils/ffmpegHelper';
import './ExportPanel.css';

export function ExportPanel() {
  const { timelineBlocks, clips } = useVideoStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [settings, setSettings] = useState<ExportSettings>({
    format: 'webm',
    quality: 'medium',
  });

  const hasClips = timelineBlocks.length > 0;

  const handleExport = async () => {
    if (!hasClips) {
      toast.error('No clips to export');
      return;
    }

    // Determine actual output extension
    const outputExtension = settings.format;
    const filename = getSuggestedFilename(outputExtension);
    let fileHandle = null;
    
    try {
      if (isFileSystemAccessSupported()) {
        fileHandle = await getSaveFileHandle(filename);
      }
    } catch (error) {
      // User cancelled or error getting file handle
      if (error instanceof Error && error.message.includes('cancelled')) {
        toast('Export cancelled');
      } else {
        console.error('Failed to get file handle:', error);
        toast.error('Failed to select save location');
      }
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Show loading message for first-time ffmpeg use
      if (settings.format !== 'webm' && !isFFmpegLoaded()) {
        toast(getLoadTimeEstimate(), { duration: 3000 });
      }

      // Get all blocks in timeline order with their trims
      const sortedBlocks = [...timelineBlocks].sort((a, b) => a.order - b.order);
      
      let finalBlob: Blob;

      if (settings.format === 'webm') {
        // Use MediaRecorder for WebM (fast, native)
        finalBlob = await processAndMergeSegments(
          sortedBlocks,
          clips,
          settings,
          (progress) => setExportProgress(progress)
        );
      } else {
        // Use FFmpeg for MP4/MOV (slower, requires transcoding)
        // Step 1: Create WebM with MediaRecorder
        const webmBlob = await processAndMergeSegments(
          sortedBlocks,
          clips,
          { ...settings, format: 'webm' }, // Force WebM intermediate
          (progress) => setExportProgress(Math.round(progress * 0.6)) // 0-60% for recording
        );

        setExportProgress(65);

        // Step 2: Transcode to target format with FFmpeg
        finalBlob = await transcodeVideo(
          webmBlob,
          settings.format as 'mp4' | 'mov',
          settings.quality,
          (progress) => setExportProgress(65 + Math.round(progress * 0.35)) // 65-100% for transcoding
        );
      }

      // Download using the file handle we got earlier (or fallback method)
      await downloadBlob(finalBlob, filename, undefined, fileHandle);

      setExportProgress(100);
      toast.success(`Video exported: ${filename}`);
      
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 1000);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(error instanceof Error ? error.message : 'Export failed');
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // Process and merge all video segments with trims applied
  const processAndMergeSegments = async (
    blocks: typeof timelineBlocks,
    allClips: typeof clips,
    exportSettings: ExportSettings,
    onProgress: (progress: number) => void
  ): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Create hidden video and canvas elements for processing
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: false });
        
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        // Determine output dimensions from first block
        const firstBlock = blocks[0];
        const firstClip = allClips.find(c => c.id === firstBlock.clipId);
        if (!firstClip) {
          throw new Error('First clip not found');
        }

        // Load first video to get dimensions
        video.src = URL.createObjectURL(firstClip.file);
        await new Promise((res) => video.addEventListener('loadedmetadata', res, { once: true }));
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Create audio context for mixing audio from segments
        const audioCtx = new AudioContext();
        const audioDestination = audioCtx.createMediaStreamDestination();
        
        // Create audio source once (reused for all blocks)
        let audioSource: MediaElementAudioSourceNode | null = null;

        // Determine mime type (MediaRecorder often doesn't support MP4 output directly)
        // We'll export as WebM and let the browser handle it
        const mimeType = 'video/webm;codecs=vp8,opus';
        
        // Determine bitrate based on quality
        const bitrates = { low: 2500000, medium: 5000000, high: 10000000 };
        const videoBitsPerSecond = bitrates[exportSettings.quality];

        // Combine video and audio streams
        const videoStream = canvas.captureStream(30); // 30 FPS
        const combinedStream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioDestination.stream.getAudioTracks()
        ]);

        const recorder = new MediaRecorder(combinedStream, {
          mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
          videoBitsPerSecond,
        });

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = () => {
          // Cleanup
          audioCtx.close();
          URL.revokeObjectURL(video.src);
          
          // Combine all chunks - always export as WebM since MP4 isn't supported by MediaRecorder
          const blob = new Blob(chunks, { type: 'video/webm' });
          resolve(blob);
        };

        recorder.onerror = (e) => {
          audioCtx.close();
          URL.revokeObjectURL(video.src);
          reject(new Error('MediaRecorder error: ' + e));
        };

        // Start recording
        recorder.start(100); // Collect data every 100ms

        // Process each block sequentially by playing them
        let processedDuration = 0;
        const totalDuration = blocks.reduce((sum, b) => sum + b.duration, 0);
        let currentBlockIndex = 0;

        const processNextBlock = async () => {
          if (currentBlockIndex >= blocks.length) {
            // All blocks processed - stop recording
            recorder.stop();
            return;
          }

          const block = blocks[currentBlockIndex];
          const clip = allClips.find(c => c.id === block.clipId);
          
          if (!clip) {
            console.warn(`Clip ${block.clipId} not found, skipping`);
            currentBlockIndex++;
            processNextBlock();
            return;
          }

          // Load this clip
          URL.revokeObjectURL(video.src);
          video.src = URL.createObjectURL(clip.file);
          
          await new Promise((res) => video.addEventListener('loadedmetadata', res, { once: true }));

          // Apply audio settings
          video.volume = clip.audioSettings.volume / 100;
          video.muted = clip.audioSettings.muted;

          // Connect audio (only create source once)
          if (!audioSource) {
            audioSource = audioCtx.createMediaElementSource(video);
            audioSource.connect(audioDestination);
          }

          // Seek to start time
          video.currentTime = block.startTime;
          await new Promise((res) => video.addEventListener('seeked', res, { once: true }));

          // Play and capture frames
          const segmentDuration = block.endTime - block.startTime;
          
          const captureLoop = () => {
            if (video.currentTime >= block.endTime || video.ended) {
              // Done with this block
              video.pause();
              processedDuration += segmentDuration;
              const progress = Math.min(95, (processedDuration / totalDuration) * 95);
              onProgress(progress);
              
              currentBlockIndex++;
              processNextBlock();
              return;
            }

            // Draw current frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Continue on next frame
            requestAnimationFrame(captureLoop);
          };

          // Start playing and capturing
          video.play().then(() => {
            requestAnimationFrame(captureLoop);
          });
        };

        // Start processing first block
        onProgress(5);
        processNextBlock();
        
      } catch (error) {
        reject(error);
      }
    });
  };

  const handleCancel = () => {
    setIsExporting(false);
    setExportProgress(0);
    toast('Export cancelled');
  };

  const totalDuration = timelineBlocks.reduce((sum, block) => sum + block.duration, 0);
  
  // Estimate output size based on quality and trimmed duration
  const bitrateEstimates = { low: 2.5, medium: 5, high: 10 }; // Mbps
  const estimatedSizeMB = (totalDuration * bitrateEstimates[settings.quality]) / 8; // Convert to MB
  const estimatedSize = estimatedSizeMB * 1024 * 1024; // Convert to bytes

  return (
    <div className="export-panel">
      <div className="panel-header">
        <h3>Export Video</h3>
        {isFileSystemAccessSupported() ? (
          <span className="api-badge">File System API ✓</span>
        ) : (
          <span className="api-badge fallback">Fallback Mode</span>
        )}
      </div>

      <div className="export-settings">
        <div className="setting-group">
          <label htmlFor="format">Format</label>
          <select
            id="format"
            value={settings.format}
            onChange={(e) => setSettings({ ...settings, format: e.target.value as 'mp4' | 'webm' | 'mov' })}
            disabled={isExporting}
          >
            <option value="webm">WebM - Fast (Browser Native)</option>
            <option value="mp4">MP4 - H.264 (Universal)</option>
            <option value="mov">MOV - QuickTime (Apple)</option>
          </select>
          <small style={{ color: '#888', marginTop: '0.25rem', display: 'block' }}>
            {settings.format === 'webm' 
              ? 'Fast export using browser MediaRecorder API' 
              : `Uses FFmpeg transcoding (first export: ~5-10s setup)`}
          </small>
        </div>

        <div className="setting-group">
          <label htmlFor="quality">Quality</label>
          <select
            id="quality"
            value={settings.quality}
            onChange={(e) => setSettings({ ...settings, quality: e.target.value as 'low' | 'medium' | 'high' })}
            disabled={isExporting}
          >
            <option value="low">Low (Faster, Smaller)</option>
            <option value="medium">Medium (Balanced)</option>
            <option value="high">High (Slower, Larger)</option>
          </select>
        </div>
      </div>

      {hasClips && (
        <div className="export-info">
          <div className="info-item">
            <span className="info-label">Clips:</span>
            <span className="info-value">{timelineBlocks.length}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Duration:</span>
            <span className="info-value">{Math.round(totalDuration)}s</span>
          </div>
          <div className="info-item">
            <span className="info-label">Est. Size:</span>
            <span className="info-value">{(estimatedSize / 1024 / 1024).toFixed(1)} MB</span>
          </div>
        </div>
      )}

      {isExporting && (
        <div className="export-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${exportProgress}%` }}
            />
          </div>
          <div className="progress-text">
            Exporting... {Math.round(exportProgress)}%
          </div>
        </div>
      )}

      <div className="export-actions">
        {isExporting ? (
          <button onClick={handleCancel} className="btn-cancel">
            Cancel Export
          </button>
        ) : (
          <button 
            onClick={handleExport} 
            disabled={!hasClips}
            className="btn-export"
          >
            {hasClips ? '📥 Export Video' : 'Add clips to export'}
          </button>
        )}
      </div>

      {!isFileSystemAccessSupported() && (
        <p className="export-hint">
          ⚠️ File System Access API not supported. Using fallback download method.
        </p>
      )}
    </div>
  );
}
