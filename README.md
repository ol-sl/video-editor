# Video Editor

A modern, client-side video editor built with React, TypeScript, and the WebCodecs API. Edit videos entirely in your browser with no backend required.

## 🎬 Features

- **📁 File Upload**: Drag-and-drop or browse for video files (MP4, WebM, QuickTime)
  - Smart duration detection for WebM files (handles infinity duration edge case)
  - File size validation with 1GB hard limit
- **🎞️ Timeline Editor**: Visual timeline with drag-and-drop reordering
  - Smooth segment transitions
  - Auto-play between clips
- **✂️ Trim & Cut**: Precisely trim video clips (planned feature)
- **🎵 Audio Control**: Adjust volume (0-100%) and mute individual clips
  - Per-clip volume controls
  - Real-time audio preview
- **📺 Video Preview**: Real-time video playback with seek controls
  - Smooth playback across multiple clips
  - Loop playback support
- **📥 Multi-Format Export**: Download edited videos with quality settings
  - **WebM**: Fast, browser-native export (real-time performance)
  - **MP4**: Universal compatibility via FFmpeg transcoding
  - **MOV**: Apple ecosystem support via FFmpeg transcoding
  - Quality presets: Low (CRF 28), Medium (CRF 23), High (CRF 18)
- **⚡ Hardware Accelerated**: Uses WebCodecs API for fast processing
- **💾 Local Processing**: Everything runs client-side, no uploads needed
- **🔒 Private**: Your videos never leave your device

## 🚀 Quick Start

### Prerequisites
- **Chrome 94+** or **Edge 94+** (WebCodecs API required)
- Node.js 16+ and npm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173 in Chrome/Edge
```

### Build for Production

```bash
npm run build
npm run preview
```

## 📖 How to Use

1. **Upload Videos**: Drag and drop video files or click "Browse Files"
   - Supports MP4, WebM, and QuickTime formats
   - Files up to 1GB (500MB recommended for best performance)
2. **Arrange Timeline**: Drag blocks to reorder clips on the timeline
   - Drag and drop to reorder
   - Visual timeline with duration markers
3. **Adjust Audio**: Click "Audio" on any timeline block to adjust volume or mute
   - Volume range: 0-100%
   - Per-clip mute toggle
4. **Preview**: Use the video player controls to preview your edits
   - Play/pause, seek through timeline
   - Smooth playback across multiple clips
5. **Export**: Click "Export Video" to download your edited video
   - **WebM**: Fastest export, best for Chrome/Firefox playback
   - **MP4**: Universal compatibility (requires first-time FFmpeg download ~25MB)
   - **MOV**: Best for Apple ecosystem
   - Choose quality: Low, Medium, or High
   - Native file save dialog support

## 🏗️ Project Structure

```
src/
├── components/          # React UI components
│   ├── AudioControls.tsx      # Audio volume/mute controls
│   ├── ErrorBoundary.tsx      # Error handling wrapper
│   ├── ExportPanel.tsx        # Export settings and download
│   ├── FileUpload.tsx         # Drag-and-drop file upload
│   ├── Timeline.tsx           # Timeline container
│   ├── TimelineBlock.tsx      # Individual timeline clip
│   └── VideoPlayer.tsx        # Video preview player
├── hooks/              # Custom React hooks
│   └── useVideoProcessor.ts   # Hook for video worker
├── store/              # Zustand state management
│   └── videoStore.ts          # Global app state
├── types/              # TypeScript definitions
│   ├── index.ts
│   └── video.ts               # Core type definitions
├── utils/              # Utility functions
│   ├── downloadHelper.ts      # File System Access API
│   ├── ffmpegHelper.ts        # FFmpeg transcoding for MP4/MOV
│   ├── fileValidator.ts       # File validation & metadata
│   └── memoryMonitor.ts       # Memory usage monitoring
├── workers/            # Web Workers
│   └── videoProcessor.worker.ts  # Video processing (WebCodecs)
├── App.tsx             # Main app component
└── main.tsx            # Entry point
```

## 🛠️ Technical Details

### Key Technologies

- **React 18**: UI framework with hooks
- **TypeScript**: Type-safe development
- **Vite**: Lightning-fast build tool and dev server
- **WebCodecs API**: Hardware-accelerated video encode/decode
- **FFmpeg.wasm**: Browser-based video transcoding for MP4/MOV export
- **@dnd-kit**: Accessible drag-and-drop
- **Zustand**: Lightweight state management (~1KB)
- **IndexedDB**: Client-side storage (via idb)
- **Web Workers**: Background processing (via Comlink)
- **File System Access API**: Native file save dialogs
- **MediaRecorder API**: Real-time WebM video encoding

### Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **WebCodecs over FFmpeg.wasm** | Better performance, hardware acceleration, lower memory usage |
| **Chunked Processing** | Process 10-50MB chunks to prevent browser crashes |
| **Chrome/Edge Only** | Allows use of modern APIs without polyfills |
| **No Backend** | Fully client-side, no server costs or privacy concerns |
| **Custom Timeline** | Maximum flexibility for drag-and-drop and trim UI |
| **Zustand** | Simpler API than Redux, sufficient for this scope |

### Important Configuration

**COOP/COEP Headers** (in `vite.config.ts`):
```typescript
headers: {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}
```
These headers enable `SharedArrayBuffer` support required for optimal WebCodecs performance.

## 📏 File Size Limits

| Limit | Size | Notes |
|-------|------|-------|
| **Maximum** | 1GB | Hard limit per file |
| **Warning** | 500MB | Higher crash risk above this |
| **Recommended** | < 500MB | Best stability |
| **Chunk Size** | 10-50MB | Processing chunk size |

## 🌐 Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 94+ | ✅ Fully supported |
| Edge | 94+ | ✅ Fully supported |
| Firefox | Any | ❌ No WebCodecs support |
| Safari | Any | ❌ No WebCodecs support |

## 🔧 Development

### Available Scripts

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Adding Features

The architecture is designed for extensibility:

1. **State Management**: Add actions to `src/store/videoStore.ts`
2. **Video Processing**: Extend `src/workers/videoProcessor.worker.ts`
3. **UI Components**: Create new components in `src/components/`
4. **Utilities**: Add helpers to `src/utils/`

### Memory Management

The app monitors memory usage to prevent crashes:
- Checks every 5 seconds (if `performance.memory` available)
- Warns at 85% heap usage
- Processes videos in chunks to limit memory
- Revokes object URLs promptly

## ⚠️ Known Limitations

- **Browser Support**: Chrome/Edge only (WebCodecs requirement)
- **File Size**: 1GB hard limit, recommend < 500MB for stability
- **Mobile**: Not optimized for mobile devices
- **First Export (MP4/MOV)**: Requires ~25MB FFmpeg download (one-time, cached)
- **Trim Feature**: UI present but processing not yet implemented
- **WebM Duration**: Some WebM files may report infinity duration (handled with fallback)

## 🚧 Roadmap

### Completed
- ✅ File upload with validation
- ✅ Timeline with drag-and-drop reordering
- ✅ Video preview player with smooth playback
- ✅ Per-clip audio controls (volume 0-100%, mute)
- ✅ Multi-format export (WebM, MP4, MOV)
- ✅ Quality settings (Low, Medium, High)
- ✅ WebM import with infinity duration handling
- ✅ Native file save dialogs
- ✅ Estimated file size calculation

### Future Enhancements
- [ ] Full WebCodecs video trimming
- [ ] True video merging with re-encoding
- [ ] Thumbnail generation and caching
- [ ] Visual waveform display
- [ ] Keyboard shortcuts (Space, Arrow keys, Delete)
- [ ] Undo/Redo functionality
- [ ] Text overlays and filters
- [ ] Multiple audio tracks
- [ ] Batch processing

## 📝 Contributing

This is an educational/demonstration project. Contributions welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test in Chrome/Edge
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🤖 AI Development Workflow

This project uses GitHub Copilot Chat for development. To manage context across long development sessions:

### Session Management Prompts

Located in `.github/copilot-instructions.md` (for user-specific prompts, also in AppData):

- **`save-session.prompt.md`**: Generates a comprehensive handoff prompt capturing:
  - Current session accomplishments
  - Active blockers and bugs
  - Key architectural decisions
  - Next priority tasks
  - Relevant code snippets and file references
  
  Usage: Run when approaching Copilot's context limit or ending a work session.

- **`load-session.prompt.md`**: Loads the latest session file from `/chat-sessions/`
  - Continues development seamlessly
  - Restores full context without re-explaining
  - Numbered session files (session_1.md, session_2.md, etc.)
  
  Usage: Start new Copilot chat sessions with this prompt to restore context.

### Why Session Management?

Copilot Chat has token limits that can be reached during complex development sessions. These prompts enable:
- **Context Preservation**: Maintain detailed state across chat sessions
- **Efficient Handoffs**: New chat picks up exactly where you left off
- **Decision History**: Track architectural choices and rationale
- **Blocker Documentation**: Preserve attempted solutions and error patterns

### Session Files

Stored in `/chat-sessions/` directory:
- Markdown format for readability
- Chronological numbering
- Includes code snippets, error logs, and decision rationale
- Version controlled for project history

## 🙏 Acknowledgments

- WebCodecs API for modern video processing
- FFmpeg.wasm for browser-based transcoding
- @dnd-kit for accessible drag-and-drop
- Vite for blazing-fast development experience

---

**Note**: This is a client-side application requiring WebCodecs API. Use Chrome 94+ or Edge 94+ for the best experience.
