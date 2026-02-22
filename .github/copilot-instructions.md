# Video Editor - AI Agent Instructions

## Project Overview
Client-side video editor (Chrome/Edge 94+ only) using WebCodecs API for hardware-accelerated video processing. All video operations happen in-browser with no backend.

## Architecture & Data Flow

### State Management (Zustand)
Single store in `src/store/videoStore.ts` manages all state:
- **Clips**: Uploaded video files with metadata (`VideoClip[]`)
- **Timeline Blocks**: References to clips with order/duration (`TimelineBlock[]`)
- **Playback**: Current time, playing state, active block
- **Processing Queue**: Background task progress tracking

**Pattern**: Actions update state immutably. Timeline duration auto-calculates on block changes:
```typescript
addBlockToTimeline: (block) => set((state) => {
  const newBlocks = [...state.timelineBlocks, block];
  const totalDuration = newBlocks.reduce((sum, b) => sum + b.duration, 0);
  return { timelineBlocks: newBlocks, playback: { ...state.playback, totalDuration } };
})
```

Access store: `const addClip = useVideoStore((state) => state.addClip)` (selector pattern for performance)

### Component Architecture
- `App.tsx`: Conditional rendering - shows FileUpload, then VideoPlayer/Timeline/ExportPanel when clips exist
- `FileUpload.tsx`: Validates files, extracts metadata, adds clips + timeline blocks atomically
- `Timeline.tsx`: DndContext wrapper with drag-and-drop using @dnd-kit's `horizontalListSortingStrategy`
- `TimelineBlock.tsx`: Sortable items with embedded AudioControls
- `VideoPlayer.tsx`: Native `<video>` element with object URLs, syncs playback to store

### Web Workers (Planned)
`src/workers/videoProcessor.worker.ts` uses Comlink for type-safe communication. Currently returns mock data - full WebCodecs implementation pending.

## Critical Validation Pattern

**ALWAYS validate duration** - prevents "Invalid array length" errors:
```typescript
// In all components displaying duration
const isValidDuration = isFinite(duration) && duration > 0 && !isNaN(duration);
// Use: {isValidDuration ? formatDuration(duration) : '0:00'}
```

**File validation flow** (`src/utils/fileValidator.ts`):
1. Check file size: max 1GB, warn at 500MB
2. Check MIME type: `video/mp4`, `video/webm`, `video/quicktime` only
3. Extract metadata: must have finite, positive duration
4. Validate duration: max 3600s (1 hour)
5. Probe codec: `VideoDecoder.isConfigSupported()` check

**Array creation safety** (see `Timeline.tsx`):
```typescript
const maxTimeMarkers = 100; // Prevent performance issues
const timeMarkerCount = isValidDuration 
  ? Math.min(Math.ceil(totalDuration) + 1, maxTimeMarkers)
  : 10;
```

## Development Workflow

### Commands
```bash
npm run dev      # Start dev server (localhost:5173)
npm run build    # TypeScript check + Vite build
npm run preview  # Preview production build
```

### COOP/COEP Headers Required
`vite.config.ts` sets headers for SharedArrayBuffer support (WebCodecs requirement):
```typescript
headers: {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}
```
**Testing**: Must use Chrome/Edge 94+. Firefox/Safari lack WebCodecs support.

### Error Handling Pattern
Use `react-hot-toast` for user feedback:
```typescript
try {
  const metadata = await extractVideoMetadata(file);
  toast.success(`Added ${file.name}`);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  toast.error(`Failed: ${errorMessage}`);
}
```

## Project-Specific Conventions

### Type System (`src/types/video.ts`)
- All types exported from `src/types/index.ts`
- `VideoClip` holds File object + metadata (duration/codec/dimensions)
- `TimelineBlock` references clip by ID, stores order/startTime/endTime
- Separation allows multiple timeline blocks per clip (same video used twice)

### ID Generation
Timestamp-based: `` `clip-${Date.now()}-${index}` `` for uniqueness in loops

### CSS Pattern
Component-level CSS files (e.g., `Timeline.css` imported by `Timeline.tsx`). Dark theme via `:root` in `index.css`. Use `#646cff` brand color.

### File Size Limits
- Hard limit: 1GB (`VIDEO_CONSTRAINTS.MAX_FILE_SIZE`)
- Warning: 500MB (`VIDEO_CONSTRAINTS.WARNING_FILE_SIZE`)  
- Display: Use `formatBytes()` utility for human-readable sizes

### Duration Helpers
- `formatDuration(seconds)`: Returns "MM:SS" format with safety checks
- Always validate before calling: `isFinite()`, `> 0`, `!isNaN()`

## Known Issues & Solutions

### "Invalid array length" (FIXED)
Caused by invalid video duration creating arrays. **Solution in all components**:
1. Validate metadata duration after extraction
2. Check `isFinite(duration) && duration > 0 && !isNaN(duration)` before array operations
3. Limit array sizes (e.g., time markers capped at 100)
4. Use safe fallbacks in formatters

See `BUGFIXES.md` for detailed examples.

### WebCodecs API Availability
Check on component mount: `if (!checkWebCodecsSupport())` - show error UI for unsupported browsers

### Object URL Memory Leaks
Always revoke after use:
```typescript
const url = URL.createObjectURL(file);
// ... use url
URL.revokeObjectURL(url); // In cleanup or finally block
```

## Integration Points

### @dnd-kit Drag-and-Drop
Timeline uses:
- `DndContext` with `closestCenter` collision detection
- `SortableContext` with `horizontalListSortingStrategy`
- `useSortable()` hook in `TimelineBlock` for drag handles
- Update store on `handleDragEnd` with `arrayMove()` helper

### File System Access API
`src/utils/downloadHelper.ts` provides tiered download:
1. Preferred: `window.showSaveFilePicker()` for native save dialog
2. Fallback: Blob URL `<a download>` for browsers without API
3. Check support: `isFileSystemAccessSupported()`

### IndexedDB (idb)
Dependency installed but not yet integrated. Planned for thumbnail caching.

## When Adding Features

### New Component Checklist
1. Create component + CSS in `src/components/`
2. Extract Zustand actions via selectors (not full store)
3. Add corresponding CSS file with component-specific classes
4. Use `react-hot-toast` for user notifications
5. Validate all numeric inputs (especially durations)
6. Import types from `src/types`

### Extending Video Processing
1. Add method to `VideoProcessor` class in worker
2. Define interface for options (see `TrimOptions`, `MergeOptions`)
3. Use `AbortController` for cancellation support
4. Emit progress via `onProgress` callback
5. Handle errors and update `ProcessingProgress` in store

### Adding Validation
Place in `src/utils/fileValidator.ts`. Pattern:
```typescript
export function validate(input: Type): ValidationResult {
  if (/* check */) return { valid: false, error: 'Message' };
  if (/* warn */) return { valid: true, warning: 'Message' };
  return { valid: true };
}
```
