import { useVideoStore } from '../store/videoStore';
import { VideoClip } from '../types';
import './AudioControls.css';

interface AudioControlsProps {
  clip: VideoClip;
}

export function AudioControls({ clip }: AudioControlsProps) {
  const updateClip = useVideoStore((state) => state.updateClip);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseInt(e.target.value);
    updateClip(clip.id, {
      audioSettings: {
        ...clip.audioSettings,
        volume,
      },
    });
  };

  const handleMuteToggle = () => {
    updateClip(clip.id, {
      audioSettings: {
        ...clip.audioSettings,
        muted: !clip.audioSettings.muted,
      },
    });
  };

  const volume = clip.audioSettings.volume;
  const isMuted = clip.audioSettings.muted;

  return (
    <div className="audio-controls">
      <button
        className={`mute-button ${isMuted ? 'muted' : ''}`}
        onClick={handleMuteToggle}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>

      <input
        id={`volume-${clip.id}`}
        type="range"
        min="0"
        max="100"
        value={volume}
        onChange={handleVolumeChange}
        disabled={isMuted}
        className="volume-slider"
        title={`Volume: ${volume}%`}
      />
      
      <span className="volume-percentage">{volume}%</span>
    </div>
  );
}
