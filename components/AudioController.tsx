import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, SkipForward, Music } from 'lucide-react';

interface AudioControllerProps {
  onAudioData: (data: Uint8Array) => void;
  isPlaying: boolean;
  onToggle: () => void;
}

const PLAYLIST = [
  { url: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=meditation-impromptu-01-12151.mp3", name: "Impromptu" },
  { url: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ambient-piano-12542.mp3", name: "Ambient Piano" },
  { url: "https://cdn.pixabay.com/download/audio/2022/10/25/audio_54714364b4.mp3?filename=ethereal-meditation-12495.mp3", name: "Ethereal" },
  { url: "https://cdn.pixabay.com/download/audio/2021/09/06/audio_349d970335.mp3?filename=relaxing-music-vol1-12198.mp3", name: "Deep Calm" }
];

const AudioController: React.FC<AudioControllerProps> = ({ onAudioData, isPlaying, onToggle }) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number>();
  
  const [currentTrack, setCurrentTrack] = useState(0);

  useEffect(() => {
    const audio = new Audio(PLAYLIST[currentTrack].url);
    audio.loop = true;
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    if (isPlaying) {
      audio.play().catch(e => console.log("Audio play blocked", e));
      setupAudioContext();
    }

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [currentTrack]);

  const setupAudioContext = () => {
    if (!audioRef.current) return;
    
    // Create Context if missing
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64; 
      analyserRef.current = analyser;
    }

    // Connect Source if not already connected
    // Note: Creating a new MediaElementSource for a new Audio element is necessary
    // But we need to handle the disconnection or reuse carefully.
    // Simpler approach for this demo: create context once, connect new audio element
    if (audioCtxRef.current && analyserRef.current) {
      // Disconnect old source if exists? 
      // Actually MediaElementSource is tied to the element. 
      // Since we recreate the Audio element, we need a new SourceNode.
      try {
        const source = audioCtxRef.current.createMediaElementSource(audioRef.current);
        source.connect(analyserRef.current);
        analyserRef.current.connect(audioCtxRef.current.destination);
        sourceRef.current = source;
      } catch (e) {
        // Source already connected or other issue
      }
    }
  };

  useEffect(() => {
    if (isPlaying && audioRef.current) {
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      audioRef.current.play().catch(() => {});
      setupAudioContext();
      
      const updateData = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          onAudioData(dataArray);
        }
        animationFrameRef.current = requestAnimationFrame(updateData);
      };
      updateData();

    } else if (audioRef.current) {
      audioRef.current.pause();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, onAudioData, currentTrack]);

  const nextTrack = () => {
    setCurrentTrack((prev) => (prev + 1) % PLAYLIST.length);
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 flex items-center gap-4 group">
      <button 
        onClick={onToggle}
        className="text-white/50 hover:text-white transition-colors duration-500"
        title="Toggle Sound"
      >
        {isPlaying ? <Volume2 size={24} /> : <VolumeX size={24} />}
      </button>
      
      <div className="flex items-center gap-3 overflow-hidden w-0 group-hover:w-auto transition-all duration-500 opacity-0 group-hover:opacity-100">
        <button 
          onClick={nextTrack}
          className="text-white/50 hover:text-white transition-colors"
          title="Next Track"
        >
          <SkipForward size={20} />
        </button>
        <div className="flex items-center gap-2 text-xs text-white/40 whitespace-nowrap">
          <Music size={12} />
          <span>{PLAYLIST[currentTrack].name}</span>
        </div>
      </div>
    </div>
  );
};

export default AudioController;