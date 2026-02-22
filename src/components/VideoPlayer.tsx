import { useEffect, useRef, useState } from 'react';
import { useVideoStore } from '../store/videoStore';
import { formatDuration } from '../utils/fileValidator';
import './VideoPlayer.css';

export function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [volume, setVolume] = useState(100);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const shouldAutoPlayRef = useRef(false);
  
  const {
    clips,
    timelineBlocks,
    playback,
    setPlaying,
    setCurrentTime,
    setActiveBlock,
  } = useVideoStore();

  // Get sorted blocks and calculate cumulative times
  const sortedBlocks = [...timelineBlocks].sort((a, b) => a.order - b.order);
  const totalDuration = sortedBlocks.reduce((sum, block) => sum + block.duration, 0);

  // Apply audio settings for the current block
  useEffect(() => {
    if (!videoRef.current || sortedBlocks.length === 0 || clips.length === 0) return;

    const currentBlock = sortedBlocks[currentBlockIndex];
    if (!currentBlock) return;

    const clip = clips.find((c) => c.id === currentBlock.clipId);
    if (!clip) return;

    // Apply clip's audio settings to video element
    const masterVolume = volume / 100; // Master volume (0-1)
    const clipVolume = clip.audioSettings.volume / 100; // Clip volume (0-1)
    const finalVolume = Math.min(masterVolume * clipVolume, 1); // Combined, capped at 1

    videoRef.current.volume = finalVolume;
    videoRef.current.muted = clip.audioSettings.muted;
  }, [currentBlockIndex, sortedBlocks, clips, volume]);

  // Load the current block based on playback time or active block
  useEffect(() => {
    if (sortedBlocks.length === 0 || clips.length === 0) return;

    const currentBlock = sortedBlocks[currentBlockIndex];
    if (!currentBlock) return;
    
    const clip = clips.find((c) => c.id === currentBlock.clipId);
    
    if (clip && videoRef.current) {
      const url = URL.createObjectURL(clip.file);
      const wasPlaying = playback.isPlaying;
      
      videoRef.current.src = url;
      videoRef.current.currentTime = currentBlock.startTime;
      
      // Apply clip's audio settings
      const masterVolume = volume / 100;
      const clipVolume = clip.audioSettings.volume / 100;
      const finalVolume = Math.min(masterVolume * clipVolume, 1);
      videoRef.current.volume = finalVolume;
      videoRef.current.muted = clip.audioSettings.muted;
      
      // Only update active block if it's actually different
      // This prevents triggering effects that watch activeBlockId
      if (playback.activeBlockId !== currentBlock.id) {
        setActiveBlock(currentBlock.id);
      }
      
      // Resume playback after video is loaded
      const handleCanPlay = () => {
        // If we're seeking to a specific time within this block, restore it
        const currentBlock = sortedBlocks[currentBlockIndex];
        if (currentBlock) {
          const timeBeforeCurrentBlock = sortedBlocks
            .slice(0, currentBlockIndex)
            .reduce((sum, b) => sum + b.duration, 0);
          
          // If playback.currentTime is within this block's range, seek to it
          if (playback.currentTime >= timeBeforeCurrentBlock && 
              playback.currentTime < timeBeforeCurrentBlock + currentBlock.duration) {
            const timeInBlock = playback.currentTime - timeBeforeCurrentBlock;
            const videoTime = currentBlock.startTime + timeInBlock;
            if (videoRef.current) {
              videoRef.current.currentTime = videoTime;
            }
          }
        }
        
        setIsTransitioning(false);
        
        // Auto-play if we were playing before OR if auto-loop brought us here
        if ((wasPlaying || shouldAutoPlayRef.current) && videoRef.current) {
          shouldAutoPlayRef.current = false; // Reset the flag
          videoRef.current.play()
            .then(() => {
              setPlaying(true); // Ensure state is synced
            })
            .catch(() => {
              setPlaying(false); // Update state if play fails
              setIsTransitioning(false);
            });
        } else {
          // Not auto-playing, ensure state is correct
          setPlaying(false);
        }
      };
      
      videoRef.current.addEventListener('canplay', handleCanPlay, { once: true });

      return () => {
        videoRef.current?.removeEventListener('canplay', handleCanPlay);
        URL.revokeObjectURL(url);
      };
    }
  }, [currentBlockIndex, sortedBlocks.length, clips.length, playback.isPlaying, playback.activeBlockId, setActiveBlock]);

  // When active block changes externally (e.g., user clicks a timeline block),
  // update our index - but don't do this during automatic playback transitions
  useEffect(() => {
    if (!playback.activeBlockId || sortedBlocks.length === 0 || isTransitioning) return;
    
    const blockIndex = sortedBlocks.findIndex(b => b.id === playback.activeBlockId);
    if (blockIndex !== -1 && blockIndex !== currentBlockIndex) {
      // Only change if not transitioning to avoid conflicts
      setCurrentBlockIndex(blockIndex);
    }
  }, [playback.activeBlockId, sortedBlocks, currentBlockIndex, isTransitioning]);

  // Handle play/pause
  const handlePlayPause = () => {
    if (!videoRef.current) return;

    if (playback.isPlaying) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      videoRef.current.play();
      setPlaying(true);
    }
  };

  // Handle time update - track cumulative time and advance to next block
  const handleTimeUpdate = () => {
    if (!videoRef.current || sortedBlocks.length === 0 || isTransitioning) return;
    
    const currentBlock = sortedBlocks[currentBlockIndex];
    if (!currentBlock) return;
    
    const videoTime = videoRef.current.currentTime;
    
    // Check if we've reached the end of this block (with small tolerance)
    if (videoTime >= currentBlock.endTime - 0.05) {
      // Pause the video immediately to prevent it from continuing past the trim point
      videoRef.current.pause();
      setPlaying(false); // Update state to reflect paused video
      
      // Move to next block
      if (currentBlockIndex < sortedBlocks.length - 1) {
        shouldAutoPlayRef.current = true; // Signal to auto-play next segment
        setIsTransitioning(true); // Prevent further updates during transition
        setCurrentBlockIndex(prev => prev + 1);
        return;
      } else {
        // End of last block - restart from beginning
        shouldAutoPlayRef.current = true; // Signal to auto-play when we loop back
        setIsTransitioning(true);
        setCurrentBlockIndex(0);
        setCurrentTime(0);
        return;
      }
    }
    
    // Only update time if we're within valid range
    if (videoTime < currentBlock.startTime) {
      // Somehow we're before the start - jump to start
      videoRef.current.currentTime = currentBlock.startTime;
      return;
    }
    
    // Calculate cumulative time
    const timeBeforeCurrentBlock = sortedBlocks
      .slice(0, currentBlockIndex)
      .reduce((sum, b) => sum + b.duration, 0);
    const timeInCurrentBlock = videoTime - currentBlock.startTime;
    const cumulativeTime = timeBeforeCurrentBlock + timeInCurrentBlock;
    
    setCurrentTime(cumulativeTime);
  };

  // Handle seeking across block boundaries
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current || sortedBlocks.length === 0) return;
    
    const targetCumulativeTime = parseFloat(e.target.value);
    
    // Find which block this time falls into
    let accumulatedTime = 0;
    for (let i = 0; i < sortedBlocks.length; i++) {
      const block = sortedBlocks[i];
      if (targetCumulativeTime < accumulatedTime + block.duration) {
        // Target time is in this block
        const timeInBlock = targetCumulativeTime - accumulatedTime;
        const videoTime = block.startTime + timeInBlock;
        
        if (i !== currentBlockIndex) {
          // Switching blocks - set transitioning flag
          setIsTransitioning(true);
          setCurrentBlockIndex(i);
          // The useEffect will load the new block and seek to the correct time
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.currentTime = videoTime;
              setCurrentTime(targetCumulativeTime);
            }
          }, 100);
        } else {
          // Same block - just seek
          videoRef.current.currentTime = videoTime;
          setCurrentTime(targetCumulativeTime);
        }
        return;
      }
      accumulatedTime += block.duration;
    }
    
    // If we get here, seek to the end
    setCurrentTime(totalDuration);
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
    }
  };

  // Handle video end - move to next block or restart from beginning
  const handleEnded = () => {
    if (currentBlockIndex < sortedBlocks.length - 1) {
      // Move to next block and keep playing
      setIsTransitioning(true);
      setCurrentBlockIndex(prev => prev + 1);
    } else {
      // End of timeline - restart from beginning and continue playing
      shouldAutoPlayRef.current = true; // Signal to auto-play when we loop back
      setIsTransitioning(true);
      setCurrentBlockIndex(0);
      setCurrentTime(0);
    }
  };

  const hasVideo = timelineBlocks.length > 0 && clips.length > 0;

  if (!hasVideo) {
    return (
      <div className="video-player empty">
        <div className="empty-player">
          <div className="empty-icon">🎬</div>
          <p>No video loaded</p>
          <p className="empty-hint">Add clips to the timeline to preview them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-player">
      <div className="player-viewport">
        <video
          ref={videoRef}
          className="video-element"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
        />
      </div>

      <div className="player-controls">
        <button
          className="control-button play-button"
          onClick={handlePlayPause}
          title={playback.isPlaying ? 'Pause' : 'Play'}
        >
          {playback.isPlaying ? '⏸' : '▶'}
        </button>

        <div className="time-display">
          {formatDuration(playback.currentTime)} / {formatDuration(totalDuration)}
        </div>

        <input
          type="range"
          className="seek-bar"
          min={0}
          max={totalDuration}
          step="0.1"
          value={playback.currentTime}
          onChange={handleSeek}
        />

        <div className="volume-control">
          <span className="volume-icon">
            {volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
          </span>
          <input
            type="range"
            className="volume-slider"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
          />
          <span className="volume-value">{volume}%</span>
        </div>
      </div>
    </div>
  );
}
