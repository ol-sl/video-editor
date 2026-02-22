import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { FileUpload } from './components/FileUpload'
import { VideoPlayer } from './components/VideoPlayer'
import { Timeline } from './components/Timeline'
import { ExportPanel } from './components/ExportPanel'
import { useVideoStore } from './store/videoStore'
import './App.css'

function App() {
  const clips = useVideoStore((state) => state.clips)
  const hasClips = clips.length > 0
  const playback = useVideoStore((state) => state.playback)
  const setPlaying = useVideoStore((state) => state.setPlaying)
  const removeBlockFromTimeline = useVideoStore((state) => state.removeBlockFromTimeline)
  const updateBlock = useVideoStore((state) => state.updateBlock)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          if (hasClips) {
            setPlaying(!playback.isPlaying)
            toast.success(playback.isPlaying ? '⏸️ Paused' : '▶️ Playing', { duration: 1000 })
          }
          break

        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          if (playback.activeBlockId) {
            removeBlockFromTimeline(playback.activeBlockId)
            toast.success('🗑️ Block removed', { duration: 2000 })
          }
          break

        case 'KeyI':
          e.preventDefault()
          if (playback.activeBlockId && hasClips) {
            const block = useVideoStore.getState().timelineBlocks.find(b => b.id === playback.activeBlockId)
            if (block) {
              const newStartTime = playback.currentTime
              const newDuration = block.endTime - newStartTime
              if (newDuration > 0.1) {
                updateBlock(block.id, { startTime: newStartTime, duration: newDuration })
                toast.success(`✂️ Set in-point at ${newStartTime.toFixed(1)}s`, { duration: 2000 })
              }
            }
          }
          break

        case 'KeyO':
          e.preventDefault()
          if (playback.activeBlockId && hasClips) {
            const block = useVideoStore.getState().timelineBlocks.find(b => b.id === playback.activeBlockId)
            if (block) {
              const newEndTime = playback.currentTime
              const newDuration = newEndTime - block.startTime
              if (newDuration > 0.1) {
                updateBlock(block.id, { endTime: newEndTime, duration: newDuration })
                toast.success(`✂️ Set out-point at ${newEndTime.toFixed(1)}s`, { duration: 2000 })
              }
            }
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [hasClips, playback, setPlaying, removeBlockFromTimeline, updateBlock])

  return (
    <ErrorBoundary>
      <Toaster position="top-right" />
      <div className="app">
        <header className="app-header">
          <h1>Video Editor</h1>
          <p>Client-side video editing powered by WebCodecs API</p>
          {hasClips && (
            <div className="keyboard-shortcuts-hint">
              <span title="Keyboard shortcuts: Space=Play/Pause, Delete=Remove block, I=Set in-point, O=Set out-point">
                ⌨️ Shortcuts available
              </span>
            </div>
          )}
        </header>
        <main className="app-main">
          <FileUpload />
          
          {hasClips && (
            <>
              <VideoPlayer />
              <Timeline />
              <ExportPanel />
            </>
          )}
        </main>
      </div>
    </ErrorBoundary>
  )
}

export default App
