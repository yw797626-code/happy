import React, { useRef, useEffect } from 'react';
import { Particle, InteractionMode } from '../types';

interface ParticleCanvasProps {
  imageSrc: string | null;
  audioData: Uint8Array;
  isAudioPlaying: boolean;
  interactionMode?: InteractionMode;
}

const ParticleCanvas: React.FC<ParticleCanvasProps> = ({ 
  imageSrc, 
  audioData, 
  isAudioPlaying, 
  interactionMode = 'hover' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, isHovering: false });
  const zoomRef = useRef(1.0); 
  
  // Trail State
  const trailRef = useRef<{x: number, y: number, life: number}[]>([]);

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
      const maxDim = 800; // Resolution
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
      const density = 3; 

      const cx = drawWidth / 2;
      const cy = drawHeight / 2;
      
      // Calculate aspect ratio based cut
      // We want to keep more image, so use a softer edge calculation rather than strict circle
      
      for (let y = 0; y < drawHeight; y += density) {
        for (let x = 0; x < drawWidth; x += density) {
          const index = (y * Math.floor(drawWidth) + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const a = data[index + 3];
          
          // Vignette effect instead of hard crop
          const dx = (x - cx) / (drawWidth / 2);
          const dy = (y - cy) / (drawHeight / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Allow some transparency at edges
          if (dist > 1.2 && Math.random() > 0.2) continue;

          if (a > 50) {
            particles.push({
              x: offsetX + x,
              y: offsetY + y,
              originX: offsetX + x,
              originY: offsetY + y,
              color: `rgba(${r},${g},${b}, ${0.7 + Math.random() * 0.3})`, 
              size: Math.random() * 1.5 + 0.5,
              baseSize: Math.random() * 1.5 + 0.5,
              vx: 0,
              vy: 0,
              // Increased depth range for more diffusion
              depth: (Math.random() - 0.5) * 150 
            });
          }
        }
      }

      particlesRef.current = particles;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

  }, [imageSrc]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.targetY = (e.clientY / window.innerHeight) * 2 - 1;
      mouseRef.current.isHovering = true;
      
      // Add trail point
      trailRef.current.push({ x: e.clientX, y: e.clientY, life: 1.0 });
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

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Smooth Mouse
    mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
    mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- DRAW TRAIL ---
    // Update and draw trail
    for (let i = trailRef.current.length - 1; i >= 0; i--) {
        const point = trailRef.current[i];
        point.life -= 0.02; // Fade speed
        if (point.life <= 0) {
            trailRef.current.splice(i, 1);
        } else {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2 * point.life, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${point.life * 0.3})`;
            ctx.fill();
        }
    }

    // --- AUDIO ---
    let bass = 0;
    let mid = 0;
    if (audioData.length > 0) {
      for (let i = 0; i < 4; i++) bass += audioData[i];
      bass /= 4;
      for (let i = 4; i < 12; i++) mid += audioData[i];
      mid /= 8;
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const time = Date.now() * 0.001;
    
    // Mouse world coordinates
    const mx = (mouseRef.current.x + 1) / 2 * canvas.width;
    const my = (mouseRef.current.y + 1) / 2 * canvas.height;
    
    // --- PARTICLES ---
    particlesRef.current.forEach(p => {
      const dx = p.originX - centerX;
      const dy = p.originY - centerY;
      const distFromCenter = Math.sqrt(dx*dx + dy*dy);
      
      const edgeFactor = Math.max(0, (distFromCenter - 100) / 100);
      const audioDisplacement = (bass / 255) * edgeFactor * 15 * Math.sin(time * 2 + distFromCenter * 0.1);

      // Increased rotation amplitude for more immersive 3D feel
      const angleY = mouseRef.current.x * 0.8; 
      const angleX = -mouseRef.current.y * 0.8;
      
      const mouseInfluenceDist = 300;
      const distToMouse = Math.sqrt(Math.pow(p.originX - mx, 2) + Math.pow(p.originY - my, 2));
      
      let hoverEffectX = 0;
      let hoverEffectY = 0;
      
      if (distToMouse < mouseInfluenceDist) {
         let force = 0;
         
         if (interactionMode === 'hover') {
             // Gentle push
             force = (1 - distToMouse / mouseInfluenceDist) * 30;
         } else if (interactionMode === 'gather') {
             // Pull towards mouse
             force = -(1 - distToMouse / mouseInfluenceDist) * 50;
         } else if (interactionMode === 'scatter') {
             // Strong push
             force = (1 - distToMouse / mouseInfluenceDist) * 150;
         }

         hoverEffectX = (p.originX - mx) / distToMouse * force;
         hoverEffectY = (p.originY - my) / distToMouse * force;
      }

      let z = p.depth;
      // Increased z-beat for diffusion
      z += (mid/255) * 80 * Math.cos(time + distFromCenter * 0.01);

      let rotX = (dx + audioDisplacement) * Math.cos(angleY) - z * Math.sin(angleY);
      let rotZ = z * Math.cos(angleY) + (dx + audioDisplacement) * Math.sin(angleY);
      let rotY = (dy + audioDisplacement) * Math.cos(angleX) - rotZ * Math.sin(angleX);

      const perspective = 800;
      const scale = (perspective / (perspective + rotZ)) * zoomRef.current;

      const finalX = centerX + rotX * scale + hoverEffectX;
      const finalY = centerY + rotY * scale + hoverEffectY;

      if (finalX > 0 && finalX < canvas.width && finalY > 0 && finalY < canvas.height) {
         ctx.fillStyle = p.color;
         const pSize = p.baseSize * scale * (1 + (bass/400));
         ctx.fillRect(finalX, finalY, pSize, pSize);
      }
    });

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [audioData, interactionMode]); // Re-bind when mode changes

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed top-0 left-0 w-full h-full pointer-events-auto z-0"
      style={{ touchAction: 'none' }}
    />
  );
};

export default ParticleCanvas;