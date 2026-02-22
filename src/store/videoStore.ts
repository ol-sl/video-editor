import { create } from 'zustand';
import { VideoClip, TimelineBlock, PlaybackState, ProcessingProgress } from '../types';

interface VideoStore {
  // Clips state
  clips: VideoClip[];
  timelineBlocks: TimelineBlock[];
  
  // Playback state
  playback: PlaybackState;
  
  // Processing state
  processingQueue: ProcessingProgress[];
  
  // Actions - Clips
  addClip: (clip: VideoClip) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<VideoClip>) => void;
  
  // Actions - Timeline
  addBlockToTimeline: (block: TimelineBlock) => void;
  removeBlockFromTimeline: (blockId: string) => void;
  updateBlockOrder: (blocks: TimelineBlock[]) => void;
  updateBlock: (blockId: string, updates: Partial<TimelineBlock>) => void;
  
  // Actions - Playback
  setPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setActiveBlock: (blockId?: string) => void;
  
  // Actions - Processing
  addProcessingTask: (task: ProcessingProgress) => void;
  updateProcessingTask: (taskId: string, updates: Partial<ProcessingProgress>) => void;
  removeProcessingTask: (taskId: string) => void;
  
  // Computed
  getTotalDuration: () => number;
  getClipById: (clipId: string) => VideoClip | undefined;
}

export const useVideoStore = create<VideoStore>((set, get) => ({
  // Initial state
  clips: [],
  timelineBlocks: [],
  playback: {
    isPlaying: false,
    currentTime: 0,
    totalDuration: 0,
  },
  processingQueue: [],
  
  // Clip actions
  addClip: (clip) => set((state) => ({
    clips: [...state.clips, clip],
  })),
  
  removeClip: (clipId) => set((state) => ({
    clips: state.clips.filter((c) => c.id !== clipId),
    timelineBlocks: state.timelineBlocks.filter((b) => b.clipId !== clipId),
  })),
  
  updateClip: (clipId, updates) => set((state) => ({
    clips: state.clips.map((c) => 
      c.id === clipId ? { ...c, ...updates } : c
    ),
  })),
  
  // Timeline actions
  addBlockToTimeline: (block) => set((state) => {
    const newBlocks = [...state.timelineBlocks, block];
    const totalDuration = newBlocks.reduce((sum, b) => sum + b.duration, 0);
    
    return {
      timelineBlocks: newBlocks,
      playback: { ...state.playback, totalDuration },
    };
  }),
  
  removeBlockFromTimeline: (blockId) => set((state) => {
    const newBlocks = state.timelineBlocks.filter((b) => b.id !== blockId);
    const totalDuration = newBlocks.reduce((sum, b) => sum + b.duration, 0);
    
    return {
      timelineBlocks: newBlocks,
      playback: { ...state.playback, totalDuration },
    };
  }),
  
  updateBlockOrder: (blocks) => set((state) => {
    const totalDuration = blocks.reduce((sum, b) => sum + b.duration, 0);
    
    return {
      timelineBlocks: blocks,
      playback: { ...state.playback, totalDuration },
    };
  }),
  
  updateBlock: (blockId, updates) => set((state) => {
    const newBlocks = state.timelineBlocks.map((b) =>
      b.id === blockId ? { ...b, ...updates } : b
    );
    const totalDuration = newBlocks.reduce((sum, b) => sum + b.duration, 0);
    
    return {
      timelineBlocks: newBlocks,
      playback: { ...state.playback, totalDuration },
    };
  }),
  
  // Playback actions
  setPlaying: (isPlaying) => set((state) => ({
    playback: { ...state.playback, isPlaying },
  })),
  
  setCurrentTime: (time) => set((state) => ({
    playback: { ...state.playback, currentTime: time },
  })),
  
  setActiveBlock: (blockId) => set((state) => ({
    playback: { ...state.playback, activeBlockId: blockId },
  })),
  
  // Processing actions
  addProcessingTask: (task) => set((state) => ({
    processingQueue: [...state.processingQueue, task],
  })),
  
  updateProcessingTask: (taskId, updates) => set((state) => ({
    processingQueue: state.processingQueue.map((t) =>
      t.taskId === taskId ? { ...t, ...updates } : t
    ),
  })),
  
  removeProcessingTask: (taskId) => set((state) => ({
    processingQueue: state.processingQueue.filter((t) => t.taskId !== taskId),
  })),
  
  // Computed methods
  getTotalDuration: () => {
    const { timelineBlocks } = get();
    return timelineBlocks.reduce((sum, block) => sum + block.duration, 0);
  },
  
  getClipById: (clipId) => {
    const { clips } = get();
    return clips.find((c) => c.id === clipId);
  },
}));
