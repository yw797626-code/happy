import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface AudioControllerProps {
  onAudioData: (data: Uint8Array) => void;
  isPlaying: boolean;
  onToggle: () => void;
}

const AudioController: React.FC<AudioControllerProps> = ({ onAudioData, isPlaying, onToggle }) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number>();

  // A soothing, ambient track (Public Domain or Creative Commons placeholder)
  // Using a reliable placeholder for "ethereal ambient"
  const MUSIC_URL = "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=meditation-impromptu-01-12151.mp3"; 

  useEffect(() => {
    const audio = new Audio(MUSIC_URL);
    audio.loop = true;
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  useEffect(() => {
    if (isPlaying && audioRef.current) {
      // Initialize Audio Context on first play (user interaction requirement)
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64; // Low resolution is fine for particles
        analyserRef.current = analyser;

        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        sourceRef.current = source;
      }

      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      audioRef.current.play().catch(e => console.log("Audio autoplay blocked", e));
      
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
  }, [isPlaying, onAudioData]);

  return (
    <button 
      onClick={onToggle}
      className="fixed bottom-6 left-6 z-50 text-white/50 hover:text-white transition-colors duration-500"
    >
      {isPlaying ? <Volume2 size={24} /> : <VolumeX size={24} />}
    </button>
  );
};

export default AudioController;