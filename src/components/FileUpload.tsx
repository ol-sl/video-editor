import { useState, useRef, DragEvent } from 'react';
import toast from 'react-hot-toast';
import { useVideoStore } from '../store/videoStore';
import { useVideoProcessor } from '../hooks/useVideoProcessor';
import { VideoClip } from '../types';
import {
  validateVideoFile,
  extractVideoMetadata,
  probeVideoCodec,
  checkWebCodecsSupport,
  formatBytes,
} from '../utils/fileValidator';
import './FileUpload.css';

export function FileUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addClip = useVideoStore((state) => state.addClip);
  const updateClip = useVideoStore((state) => state.updateClip);
  const addBlockToTimeline = useVideoStore((state) => state.addBlockToTimeline);
  const processor = useVideoProcessor();

  // Check WebCodecs support on mount
  if (!checkWebCodecsSupport()) {
    return (
      <div className="file-upload error">
        <div className="error-message">
          <h3>⚠️ Browser Not Supported</h3>
          <p>
            This application requires WebCodecs API support.
            <br />
            Please use <strong>Chrome 94+</strong> or <strong>Edge 94+</strong>.
          </p>
        </div>
      </div>
    );
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsProcessing(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Validate file
        const validation = await validateVideoFile(file);
        
        if (!validation.valid) {
          toast.error(validation.error || 'Invalid file');
          continue;
        }
        
        if (validation.warning) {
          toast(validation.warning, { duration: 5000, icon: '⚠️' });
        }

        // Extract metadata
        const metadata = await extractVideoMetadata(file);
        
        // Validate metadata
        if (!isFinite(metadata.duration) || metadata.duration <= 0 || isNaN(metadata.duration)) {
          toast.error(`Invalid video duration in ${file.name}. Duration: ${metadata.duration}`);
          continue;
        }
        
        if (metadata.duration > 3600) {
          toast.error(`Video too long: ${file.name}. Maximum duration is 1 hour.`);
          continue;
        }
        
        // Probe codec support
        const codecCheck = await probeVideoCodec(file);
        if (!codecCheck.supported) {
          toast.error(`Unsupported codec in ${file.name}`);
          continue;
        }
        
        if (codecCheck.codec) {
          metadata.codec = codecCheck.codec;
        }

        // Create clip with unique ID
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        const clip: VideoClip = {
          id: `clip-${timestamp}-${random}-${i}`,
          file,
          metadata,
          startTime: 0,
          endTime: metadata.duration,
          audioSettings: {
            volume: 100,
            muted: false,
          },
        };

        // Add to store
        addClip(clip);
        
        // Generate thumbnail (async, don't wait)
        if (processor) {
          processor.generateThumbnail(file, 1)
            .then((thumbnailUrl) => {
              updateClip(clip.id, { thumbnailUrl });
            })
            .catch((error) => {
              console.error('Failed to generate thumbnail:', error);
              // Non-critical error, don't show to user
            });
        }
        
        // Add to timeline
        const existingBlocks = useVideoStore.getState().timelineBlocks;
        const order = existingBlocks.length;
        const blockTimestamp = Date.now();
        const blockRandom = Math.random().toString(36).substring(2, 9);
        
        addBlockToTimeline({
          id: `block-${blockTimestamp}-${blockRandom}-${i}`,
          clipId: clip.id,
          order,
          startTime: clip.startTime,
          endTime: clip.endTime,
          duration: clip.endTime - clip.startTime,
        });

        toast.success(`Added ${file.name} (${formatBytes(file.size)})`);
      } catch (error) {
        console.error('Error processing file:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Failed to process ${file.name}: ${errorMessage}`);
      }
    }

    setIsProcessing(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`file-upload ${isDragging ? 'dragging' : ''} ${isProcessing ? 'processing' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        multiple
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />
      
      {isProcessing ? (
        <div className="upload-content">
          <div className="spinner"></div>
          <p>Processing files...</p>
        </div>
      ) : (
        <div className="upload-content">
          <div className="upload-icon">📁</div>
          <h3>Drop video files here</h3>
          <p>or</p>
          <button onClick={handleButtonClick} className="upload-button">
            Browse Files
          </button>
          <p className="upload-hint">
            Supports MP4, WebM • Max 1GB per file • Recommended: under 500MB
          </p>
        </div>
      )}
    </div>
  );
}
