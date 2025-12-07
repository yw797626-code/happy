import React, { useRef, useEffect, useState } from 'react';
import { Particle } from '../types';

interface ParticleCanvasProps {
  imageSrc: string | null;
  audioData: Uint8Array;
  isAudioPlaying: boolean;
}

const ParticleCanvas: React.FC<ParticleCanvasProps> = ({ imageSrc, audioData, isAudioPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, isHovering: false });
  const zoomRef = useRef(1.0); 
  
  // Initialize particles from image
  useEffect(() => {
    if (!imageSrc || !canvasRef.current) return;

    const img = new Image();
    img.src = imageSrc;
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Draw image small to sample data
      const maxDim = 800; // Increased resolution for better clarity
      const scale = Math.min(maxDim / img.width, maxDim / img.height);
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const offsetX = (canvas.width - drawWidth) / 2;
      const offsetY = (canvas.height - drawHeight) / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      const imageData = ctx.getImageData(offsetX, offsetY, drawWidth, drawHeight);
      const data = imageData.data;
      
      const particles: Particle[] = [];
      const density = 3; // Increased density (lower number) for clearer image

      const cx = drawWidth / 2;
      const cy = drawHeight / 2;
      
      // Calculate a "soft" boundary based on the image diagonal to keep more of it
      // Instead of Math.min (circle inside rect), we use a larger radius to cover corners
      const maxRadius = Math.sqrt(cx * cx + cy * cy) * 0.9; 

      for (let y = 0; y < drawHeight; y += density) {
        for (let x = 0; x < drawWidth; x += density) {
          const index = (y * Math.floor(drawWidth) + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const a = data[index + 3];

          // Calculate distance from center for organic culling
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Organic Edge Logic: 
          // Relaxed culling: allow particles further out, just add noise at the very edges
          const noise = Math.random() * 50;
          if (dist > maxRadius - 50 + noise) continue;

          if (a > 100) {
            particles.push({
              x: offsetX + x,
              y: offsetY + y,
              originX: offsetX + x,
              originY: offsetY + y,
              color: `rgba(${r},${g},${b}, ${0.7 + Math.random() * 0.3})`, // slightly higher opacity
              size: Math.random() * 1.5 + 0.5,
              baseSize: Math.random() * 1.5 + 0.5,
              vx: 0,
              vy: 0,
              depth: (Math.random() - 0.5) * 50 // moderate depth
            });
          }
        }
      }

      particlesRef.current = particles;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

  }, [imageSrc]);

  // Mouse move and Wheel handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.targetY = (e.clientY / window.innerHeight) * 2 - 1;
      mouseRef.current.isHovering = true;
    };

    const handleWheel = (e: WheelEvent) => {
      const delta = e.deltaY * -0.001;
      zoomRef.current = Math.min(Math.max(0.6, zoomRef.current + delta), 2.5);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('wheel', handleWheel);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Animation Loop
  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Smooth Mouse
    mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
    mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Audio Analysis
    let bass = 0;
    let mid = 0;
    if (audioData.length > 0) {
      // Average first few bins for bass
      for (let i = 0; i < 4; i++) bass += audioData[i];
      bass /= 4;
      // Average middle bins for mids
      for (let i = 4; i < 12; i++) mid += audioData[i];
      mid /= 8;
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const time = Date.now() * 0.001;

    particlesRef.current.forEach(p => {
      const dx = p.originX - centerX;
      const dy = p.originY - centerY;
      const distFromCenter = Math.sqrt(dx*dx + dy*dy);
      
      // Audio Reactivity: Edges move more
      const edgeFactor = Math.max(0, (distFromCenter - 100) / 100);
      const audioDisplacement = (bass / 255) * edgeFactor * 10 * Math.sin(time * 2 + distFromCenter * 0.1);

      // Interaction: 3D Tilt
      const angleY = mouseRef.current.x * 0.5; 
      const angleX = -mouseRef.current.y * 0.5;
      
      // Mouse Proximity wave
      const mouseInfluenceDist = 200;
      const mx = (mouseRef.current.x + 1) / 2 * canvas.width;
      const my = (mouseRef.current.y + 1) / 2 * canvas.height;
      const distToMouse = Math.sqrt(Math.pow(p.originX - mx, 2) + Math.pow(p.originY - my, 2));
      
      let hoverEffectX = 0;
      let hoverEffectY = 0;
      
      if (distToMouse < mouseInfluenceDist) {
        const force = (1 - distToMouse / mouseInfluenceDist) * 20;
        hoverEffectX = (p.originX - mx) / distToMouse * force;
        hoverEffectY = (p.originY - my) / distToMouse * force;
      }

      // 3D Projection
      let z = p.depth;
      // Add audio "Z-beat"
      z += (mid/255) * 50 * Math.cos(time + distFromCenter);

      let rotX = (dx + audioDisplacement) * Math.cos(angleY) - z * Math.sin(angleY);
      let rotZ = z * Math.cos(angleY) + (dx + audioDisplacement) * Math.sin(angleY);
      let rotY = (dy + audioDisplacement) * Math.cos(angleX) - rotZ * Math.sin(angleX);

      const perspective = 800;
      const scale = (perspective / (perspective + rotZ)) * zoomRef.current;

      const finalX = centerX + rotX * scale + hoverEffectX;
      const finalY = centerY + rotY * scale + hoverEffectY;

      // Render
      if (finalX > 0 && finalX < canvas.width && finalY > 0 && finalY < canvas.height) {
         ctx.fillStyle = p.color;
         // Dynamic size based on audio
         const pSize = p.baseSize * scale * (1 + (bass/500));
         ctx.fillRect(finalX, finalY, pSize, pSize);
      }
    });

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [audioData]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed top-0 left-0 w-full h-full pointer-events-auto z-0"
      style={{ touchAction: 'none' }}
    />
  );
};

export default ParticleCanvas;