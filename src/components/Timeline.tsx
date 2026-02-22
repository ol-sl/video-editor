import { useVideoStore } from '../store/videoStore';
import { TimelineBlock } from './TimelineBlock';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { formatDuration } from '../utils/fileValidator';
import './Timeline.css';

export function Timeline() {
  const { timelineBlocks, clips, updateBlockOrder, playback } = useVideoStore();
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = timelineBlocks.findIndex((block) => block.id === active.id);
      const newIndex = timelineBlocks.findIndex((block) => block.id === over.id);

      const reorderedBlocks = arrayMove(timelineBlocks, oldIndex, newIndex).map(
        (block, index) => ({
          ...block,
          order: index,
        })
      );

      updateBlockOrder(reorderedBlocks);
    }
  };

  if (timelineBlocks.length === 0) {
    return (
      <div className="timeline empty">
        <p className="empty-message">
          No clips in timeline. Upload videos to get started.
        </p>
      </div>
    );
  }

  const totalDuration = timelineBlocks.reduce((sum, block) => sum + block.duration, 0);
  
  // Validate total duration and limit time markers
  const isValidDuration = isFinite(totalDuration) && totalDuration > 0 && !isNaN(totalDuration);
  const maxTimeMarkers = 100; // Limit to prevent performance issues
  const timeMarkerCount = isValidDuration 
    ? Math.min(Math.ceil(totalDuration) + 1, maxTimeMarkers)
    : 10;

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <h3>Timeline</h3>
        <div className="timeline-info">
          <span className="block-count">{timelineBlocks.length} clip{timelineBlocks.length !== 1 ? 's' : ''}</span>
          <span className="duration">Total: {isValidDuration ? formatDuration(totalDuration) : '0:00'}</span>
        </div>
      </div>

      <div className="timeline">
        <div className="time-ruler">
          {isValidDuration && Array.from({ length: timeMarkerCount }, (_, i) => (
            <div key={i} className="time-marker" style={{ left: `${(i / totalDuration) * 100}%` }}>
              <span>{formatDuration(i)}</span>
            </div>
          ))}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={timelineBlocks.map(b => b.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="timeline-track">
              {timelineBlocks
                .sort((a, b) => a.order - b.order)
                .map((block) => {
                  const clip = clips.find((c) => c.id === block.clipId);
                  const widthPercentage = totalDuration > 0 ? (block.duration / totalDuration) * 100 : 0;
                  return clip ? (
                    <TimelineBlock
                      key={block.id}
                      block={block}
                      clip={clip}
                      isActive={playback.activeBlockId === block.id}
                      widthPercentage={widthPercentage}
                    />
                  ) : null;
                })}
            </div>
          </SortableContext>
        </DndContext>

        {playback.currentTime > 0 && isValidDuration && (
          <div
            className="playhead"
            style={{ left: `${(playback.currentTime / totalDuration) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}
