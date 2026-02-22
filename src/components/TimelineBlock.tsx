import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useRef, useEffect, useCallback } from 'react';
import { TimelineBlock as TimelineBlockType, VideoClip } from '../types';
import { useVideoStore } from '../store/videoStore';
import { AudioControls } from './AudioControls';
import { formatDuration } from '../utils/fileValidator';
import './TimelineBlock.css';

interface TimelineBlockProps {
  block: TimelineBlockType;
  clip: VideoClip;
  isActive: boolean;
  widthPercentage: number;
}

type TrimHandle = 'start' | 'end' | null;

export function TimelineBlock({ block, clip, isActive, widthPercentage }: TimelineBlockProps) {
  const removeBlockFromTimeline = useVideoStore((state) => state.removeBlockFromTimeline);
  const updateBlock = useVideoStore((state) => state.updateBlock);
  const setActiveBlock = useVideoStore((state) => state.setActiveBlock);
  
  const [trimming, setTrimming] = useState<TrimHandle>(null);
  const [tempTrimTime, setTempTrimTime] = useState<{ start: number; end: number }>({
    start: block.startTime,
    end: block.endTime,
  });
  const blockRef = useRef<HTMLDivElement | null>(null);
  
  // Sync tempTrimTime with block props when not actively trimming
  useEffect(() => {
    if (!trimming) {
      setTempTrimTime({
        start: block.startTime,
        end: block.endTime,
      });
    }
  }, [block.startTime, block.endTime, trimming]);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: block.id,
  });

  // Callback ref to handle both sortable and our ref
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    blockRef.current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: `${Math.max(widthPercentage, 10)}%`, // Minimum 10% width
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeBlockFromTimeline(block.id);
  };

  const handleBlockClick = (e: React.MouseEvent) => {
    // Don't activate if clicking on controls or during drag
    if ((e.target as HTMLElement).closest('.block-remove, .trim-handle, .trim-zone, .drag-handle, .audio-controls')) {
      return;
    }
    setActiveBlock(block.id);
    
    // Calculate cumulative time to this block and seek to it
    const allBlocks = useVideoStore.getState().timelineBlocks;
    const sortedBlocks = [...allBlocks].sort((a, b) => a.order - b.order);
    const blockIndex = sortedBlocks.findIndex(b => b.id === block.id);
    const cumulativeTime = sortedBlocks.slice(0, blockIndex).reduce((sum, b) => sum + b.duration, 0);
    useVideoStore.getState().setCurrentTime(cumulativeTime);
  };

  const duration = block.endTime - block.startTime;
  const isMuted = clip.audioSettings.muted;
  const volume = clip.audioSettings.volume;
  
  // Validate duration
  const isValidDuration = isFinite(duration) && duration > 0 && !isNaN(duration);

  // Handle trim start
  const handleTrimStart = (e: React.MouseEvent, handle: 'start' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    setTrimming(handle);
    setTempTrimTime({ start: block.startTime, end: block.endTime });
  };

  // Handle mouse move during trim
  useEffect(() => {
    if (!trimming || !blockRef.current) return;

    // Set cursor for entire document during trim
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (e: MouseEvent) => {
      const rect = blockRef.current!.getBoundingClientRect();
      const blockWidth = rect.width;
      const mouseX = e.clientX - rect.left;
      
      // For untrimming: allow mouse position outside block boundaries
      // Don't clamp to 0-1 - let it go negative or beyond for expansion
      const clipDuration = clip.metadata.duration;
      const currentDuration = block.endTime - block.startTime;
      
      if (trimming === 'start') {
        // Map mouse X to clip time: left edge of block = current startTime
        // Moving left (negative) = earlier time (toward 0)
        // Moving right = later time (toward current startTime)
        const ratio = mouseX / blockWidth; // Can be negative or > 1
        const timeRange = currentDuration;
        const offset = ratio * timeRange;
        const newStartTime = block.startTime + offset;
        
        // Clamp to valid range: 0 to (endTime - 0.1)
        const maxStart = tempTrimTime.end - 0.1;
        setTempTrimTime(prev => ({
          ...prev,
          start: Math.max(0, Math.min(newStartTime, maxStart)),
        }));
      } else if (trimming === 'end') {
        // Map mouse X to clip time: right edge of block = current endTime
        // Moving right (beyond block) = later time (toward clipDuration)
        // Moving left = earlier time
        const ratio = mouseX / blockWidth; // Can be negative or > 1
        const timeRange = currentDuration;
        const offset = ratio * timeRange;
        const newEndTime = block.startTime + offset;
        
        // Clamp to valid range: (startTime + 0.1) to clipDuration
        const minEnd = tempTrimTime.start + 0.1;
        setTempTrimTime(prev => ({
          ...prev,
          end: Math.max(minEnd, Math.min(newEndTime, clipDuration)),
        }));
      }
    };

    const handleMouseUp = () => {
      if (trimming) {
        // Update the block with new trim times
        const newDuration = tempTrimTime.end - tempTrimTime.start;
        updateBlock(block.id, {
          startTime: tempTrimTime.start,
          endTime: tempTrimTime.end,
          duration: newDuration,
        });
        setTrimming(null);
        // Restore cursor
        document.body.style.cursor = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Restore cursor on cleanup
      document.body.style.cursor = '';
    };
  }, [trimming, tempTrimTime, block.id, clip.metadata.duration, updateBlock]);

  // Calculate trim visual indicators (as percentage of CURRENT block, not original clip)
  // When trimming, calculate how much of the current block will be trimmed
  const currentDuration = block.endTime - block.startTime;
  const startTrimPercentage = trimming === 'start' 
    ? ((tempTrimTime.start - block.startTime) / currentDuration) * 100 
    : 0;
  const endTrimPercentage = trimming === 'end' 
    ? ((block.endTime - tempTrimTime.end) / currentDuration) * 100 
    : 0;
  
  // Handle position during trimming - allow full range for visibility
  // Don't clamp so handle can be positioned outside for untrimming feedback
  let handlePosition = 0;
  if (trimming === 'start') {
    // For start: can go negative (left of block) or positive
    handlePosition = startTrimPercentage;
  } else if (trimming === 'end') {
    // For end: 100 = right edge, > 100 = beyond right edge
    handlePosition = 100 - endTrimPercentage;
  }

  return (
    <div
      ref={setRefs}
      style={style}
      className={`timeline-block ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${trimming ? 'trimming' : ''}`}
      onClick={handleBlockClick}
      {...attributes}
    >
      {/* Trim overlay - shows dimmed areas (only during active trimming) */}
      {trimming && startTrimPercentage > 0 && (
        <div
          className="trim-overlay trim-overlay-start"
          style={{ width: `${startTrimPercentage}%` }}
        />
      )}
      {trimming && endTrimPercentage > 0 && (
        <div
          className="trim-overlay trim-overlay-end"
          style={{ width: `${endTrimPercentage}%` }}
        />
      )}

      {/* Trim handles - visible during trimming */}
      {trimming === 'start' && (
        <div
          className={`trim-handle trim-handle-start ${startTrimPercentage < 0 ? 'expanding' : ''}`}
          style={{ left: `${handlePosition}%` }}
        >
          <div className="trim-handle-line" />
        </div>
      )}
      {trimming === 'end' && (
        <div
          className={`trim-handle trim-handle-end ${endTrimPercentage < 0 ? 'expanding' : ''}`}
          style={{ left: `${handlePosition}%` }}
        >
          <div className="trim-handle-line" />
        </div>
      )}

      {/* Invisible trim zones for initiating trim (always present) */}
      <div
        className="trim-zone trim-zone-start"
        onMouseDown={(e) => handleTrimStart(e, 'start')}
        onPointerDown={(e) => e.stopPropagation()}
        title="Drag to trim start"
      />
      <div
        className="trim-zone trim-zone-end"
        onMouseDown={(e) => handleTrimStart(e, 'end')}
        onPointerDown={(e) => e.stopPropagation()}
        title="Drag to trim end"
      />

      <div className="block-header" {...listeners}>
        <div className="drag-handle" title="Drag to reorder">⋮⋮</div>
        <div className="block-name" title={clip.file.name}>
          {clip.file.name.length > 20
            ? `${clip.file.name.substring(0, 20)}...`
            : clip.file.name}
        </div>
        <button
          className="block-remove"
          onClick={handleRemove}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          title="Remove from timeline"
        >
          ×
        </button>
      </div>

      <div className="block-preview">
        {clip.thumbnailUrl ? (
          <img src={clip.thumbnailUrl} alt="Thumbnail" />
        ) : (
          <div className="block-placeholder">🎬</div>
        )}
      </div>

      <div className="block-info">
        <div className="block-duration">
          {isValidDuration ? formatDuration(duration) : '0:00'}
        </div>
        <div className="block-audio">
          {isMuted ? '🔇' : volume !== 100 ? `🔊 ${volume}%` : '🔊'}
        </div>
      </div>

      {(block.startTime > 0 || block.endTime < clip.metadata.duration) && !trimming && (
        <div className="block-trim-indicator" title="Trimmed clip">
          ✂️ {formatDuration(block.startTime)} - {formatDuration(block.endTime)}
        </div>
      )}

      {trimming && (
        <div className="block-trim-feedback">
          {startTrimPercentage < 0 || endTrimPercentage < 0 
            ? `Expanding: ${formatDuration(tempTrimTime.start)} - ${formatDuration(tempTrimTime.end)}`
            : `Trimming: ${formatDuration(tempTrimTime.start)} - ${formatDuration(tempTrimTime.end)}`
          }
        </div>
      )}

      <AudioControls clip={clip} />
    </div>
  );
}
