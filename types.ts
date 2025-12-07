export enum AppState {
  LANDING = 'LANDING',
  UPLOAD = 'UPLOAD',
  PROCESSING = 'PROCESSING',
  CHAT = 'CHAT',
  POSTCARD_GENERATION = 'POSTCARD_GENERATION',
  MEMORY_CORRIDOR = 'MEMORY_CORRIDOR'
}

export interface Message {
  role: 'user' | 'model';
  text: string;
}

export interface PostcardData {
  summary: string;
  mood: string;
  keywords: string[];
}

export interface Memory {
  id: string;
  imageUrl: string; // Base64
  summary: string;
  date: string;
  timestamp: number;
  mood: string;
  keywords: string[];
  viewCount: number;
  // Position for the puzzle/canvas view
  x: number;
  y: number;
  rotation: number;
}

export interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  color: string;
  size: number;
  baseSize: number;
  vx: number;
  vy: number;
  depth: number; // For 3D parallax
}