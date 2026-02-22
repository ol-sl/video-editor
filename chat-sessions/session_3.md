# Session 3 - MP4/MOV Export Implementation & Blocker

**Date**: February 22, 2026  
**Status**: 🔴 BLOCKED - FFmpeg loading fails with 404 errors  
**Context**: Implementing multi-format export (MP4, MOV, WebM) using ffmpeg.wasm

---

## 🎯 Session Overview

### Completed in This Session
1. ✅ Fixed WebM import support (infinity duration issue)
2. ✅ Fixed volume controls (capped at 100%, removed >100% amplification)
3. ✅ Fixed export file picker security errors
4. ✅ Fixed estimated file size calculation
5. ✅ Fixed auto-restart playback loop behavior
6. ✅ Set WebM as default export format
7. ⚠️ **PARTIAL**: Implemented MP4/MOV export with ffmpeg.wasm

### Critical Blocker 🚨
**FFmpeg won't load** - Multiple 404 errors trying different package versions and configurations.

---

## 🔥 Current Blocker Details

### Problem
MP4 export fails at 65% with FFmpeg loading error. WebM export works perfectly.

### Error Evolution
```
Attempt 1: @ffmpeg/core@0.12.6/dist/umd
  ❌ 404: ffmpeg-core.worker.js not found

Attempt 2: @ffmpeg/core-st@0.12.6/dist/esm (single-threaded)
  ❌ 404: Package doesn't exist

Attempt 3: @ffmpeg/core-mt@0.12.6/dist/esm (CURRENT)
  ❌ Status: Testing now - likely same 404 worker issue
```

### Files Modified for FFmpeg
- `src/utils/ffmpegHelper.ts` - New utility with loadFFmpeg() and transcodeVideo()
- `src/components/ExportPanel.tsx` - Two-stage export: WebM → FFmpeg → MP4/MOV
- `src/types/video.ts` - Added 'mov' to ExportSettings format type
- `src/utils/downloadHelper.ts` - Added .mov MIME type support
- `vite.config.ts` - Added optimizeDeps.exclude for ffmpeg packages

### Packages Installed
```bash
npm install @ffmpeg/ffmpeg @ffmpeg/util
```

---

## 📋 Implementation Details

### Export Architecture
```typescript
// Fast path - WebM only
MediaRecorder → WebM blob → Download

// Transcode path - MP4/MOV
MediaRecorder → WebM blob (60%) → FFmpeg transcode (35%) → Download (5%)
```

### Format Support
- **WebM**: Browser-native MediaRecorder (fast, real-time)
- **MP4**: H.264/AAC via ffmpeg (universal compatibility)
- **MOV**: H.264/AAC via ffmpeg (Apple ecosystem)

### Quality Settings (CRF-based)
- Low: CRF 28, fast preset
- Medium: CRF 23, medium preset  
- High: CRF 18, slow preset

### First-Time UX
Shows toast: "First-time setup: ~5-10 seconds (downloads ~25MB)"

---

## 🐛 Other Bugs Fixed This Session

### 1. WebM Import (Infinity Duration)
**File**: `src/utils/fileValidator.ts`

Added handling for WebM files reporting `Infinity` duration:
- Seek to end to get actual duration
- 10-second timeout protection
- Fallback gracefully if seeking fails

### 2. Volume >100% Errors
**Changed**: Volume range from 0-200 to 0-100

Files modified:
- `src/types/video.ts` - Updated AudioSettings comment
- `src/components/AudioControls.tsx` - Max slider value 100
- `src/components/AudioControls.css` - Removed red amplification zone
- `src/components/VideoPlayer.tsx` - Updated comments

**Reason**: HTML video elements only support volume 0-1. Exceeding causes:
```
IndexSizeError: The volume provided (1.03) is outside range [0, 1]
```

### 3. File Picker Security Error
**File**: `src/utils/downloadHelper.ts`, `src/components/ExportPanel.tsx`

**Problem**: showSaveFilePicker() must be called from user gesture, but was called after async video processing.

**Solution**: 
1. Get file handle FIRST (during button click)
2. Store handle
3. Process video
4. Write to pre-acquired handle

New function: `getSaveFileHandle()` separates picker from download.

### 4. Playback Auto-Restart Issues

**Problem 1**: Video continued past trim endpoint  
**Fix**: Added `videoRef.current.pause()` + `setPlaying(false)` in handleTimeUpdate

**Problem 2**: Playback paused between segments  
**Fix**: Set `shouldAutoPlayRef.current = true` for ALL segment transitions, not just loop-back

**Problem 3**: Play button showed pause icon after restart  
**Fix**: Properly sync state in handleCanPlay with setPlaying() callbacks

Modified: `src/components/VideoPlayer.tsx` (3 separate fixes)

---

## 🎯 Next Steps (Priority Order)

### IMMEDIATE - Fix FFmpeg Loading
**Options to try**:

1. **Use older stable version**
   ```typescript
   const baseURL = 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/umd';
   ```

2. **Bundle files locally** instead of CDN
   - Download ffmpeg-core.js and .wasm to `public/ffmpeg/`
   - Update paths to `/ffmpeg/ffmpeg-core.js`
   - Avoids CDN/CORS/worker issues

3. **Alternative library**: Consider mp4-muxer or media-chrome alternatives

4. **Simplify to WebM-only** + show conversion instructions to users

### If FFmpeg Works
- Test MP4 export end-to-end
- Test MOV export on Mac
- Verify quality settings mapping
- Check file size estimates accuracy
- Add progress logging

---

## 📊 Project State

### Files Structure
```
src/
├── components/
│   ├── ExportPanel.tsx ⚠️ (ffmpeg integration, partially working)
│   ├── VideoPlayer.tsx ✅ (playback fixed)
│   ├── AudioControls.tsx ✅ (volume capped at 100%)
│   └── ...
├── utils/
│   ├── ffmpegHelper.ts 🆕 (blocker preventing this from working)
│   ├── downloadHelper.ts ✅ (file picker fixed)
│   └── fileValidator.ts ✅ (WebM infinity duration fixed)
└── types/
    └── video.ts ✅ (updated for mov format)
```

### Build Status
- ✅ TypeScript compiles clean
- ✅ Vite builds successfully (243KB bundle)
- ✅ No runtime errors except ffmpeg loading
- ⚠️ FFmpeg worker URLs failing

### Testing Checklist
- [x] WebM export works perfectly
- [ ] MP4 export (BLOCKED)
- [ ] MOV export (BLOCKED)
- [x] Volume controls max at 100%
- [x] WebM file import
- [x] Auto-restart playback loop
- [x] Segment transitions smooth

---

## 🔧 Key Code Snippets

### FFmpeg Helper (Current - Not Working)
```typescript
// src/utils/ffmpegHelper.ts:57-64
const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';

await ffmpegInstance.load({
  coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
  wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
});
```

### Export Flow
```typescript
// src/components/ExportPanel.tsx:50-75
if (settings.format === 'webm') {
  // Fast path
  finalBlob = await processAndMergeSegments(...);
} else {
  // Transcode path
  const webmBlob = await processAndMergeSegments(...); // 0-60%
  finalBlob = await transcodeVideo(webmBlob, settings.format, ...); // 65-100%
}
```

---

## 💡 Decision Log

### Why Keep WebM Fast Path?
User chose to keep MediaRecorder for WebM exports because:
- Real-time performance
- No ffmpeg download delay
- Simpler, more reliable
- Only MP4/MOV need transcoding

### Why MOV Over AVI?
User selected MP4 + WebM + MOV (not AVI) for:
- Apple ecosystem compatibility more relevant than legacy Windows
- Cleaner UI with 3 formats instead of 4

### Why Not Amplification >100%?
Would require Web Audio API with GainNode:
- Significantly more complex architecture
- Audio routing complications
- User accepted 100% max limit

---

## 📝 Notes for Next Session

1. **Start here**: Fix FFmpeg loading - try bundling locally first (fastest path)
2. **If blocked again**: Consider pivot to WebM-only with user conversion instructions
3. **Reference**: All vite.config changes preserved for COOP/COEP headers
4. **Test files**: samples/ folder has test videos
5. **Segments work**: Auto-play between segments and loop restart both functioning

### Vite Config Optimizations Applied
```typescript
// vite.config.ts
optimizeDeps: {
  exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
}
```

Tried and removed (didn't help):
```typescript
worker: { format: 'es' } // Caused more issues
```

---

## 🎬 Quick Test Commands

```bash
# Start dev server
npm run dev

# Test WebM export (works)
1. Import videos
2. Select WebM format
3. Export → should complete in ~real-time

# Test MP4 export (blocked)
1. Select MP4 format  
2. Export → freezes at 65% with console error

# View errors
Open DevTools (F12) → Console + Network tabs
```

---

## 📚 External References

- FFmpeg.wasm docs: https://ffmpegwasm.netlify.app/
- @ffmpeg/core versions: https://www.npmjs.com/package/@ffmpeg/core
- Current issue similar to: https://github.com/ffmpegwasm/ffmpeg.wasm/issues/
- COOP/COEP headers required for SharedArrayBuffer

---

**Handoff Ready**: New agent can continue from here with full context of the blocker and next steps to try. Priority is unblocking MP4 export - most likely solution is bundling ffmpeg files locally instead of CDN loading.
