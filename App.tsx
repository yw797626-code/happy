import React, { useState, useRef, useEffect } from 'react';
import { AppState, Message, Memory, PostcardData } from './types';
import ParticleCanvas from './components/ParticleCanvas';
import AudioController from './components/AudioController';
import { startChatWithImage, sendMessage, generatePostcardSummary } from './services/geminiService';
import { Upload, Mic, Send, X, Save, ArrowRight, Grid, Wind, Move, MessageSquare, User, Calendar, Tag } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.LANDING);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(0));
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  
  // Transition States
  const [isLandingTransitioning, setIsLandingTransitioning] = useState(false);

  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false); 
  
  const [postcardData, setPostcardData] = useState<PostcardData | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Postcard Tilt State
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Dragging State for Corridor
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Auto scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isTyping, isChatVisible]);

  // Spacebar Listener for Chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (appState === AppState.CHAT) {
        if (e.code === 'Space' && document.activeElement !== chatInputRef.current) {
          e.preventDefault();
          setIsChatVisible(prev => !prev);
          if (!isChatVisible) {
            setTimeout(() => chatInputRef.current?.focus(), 100);
          }
        }
        if (e.key === 'Escape') {
          setIsChatVisible(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appState, isChatVisible]);

  const handleStart = () => {
    setIsLandingTransitioning(true);
    setIsAudioPlaying(true);
    
    // Wait for the smoke animation to finish before switching state
    setTimeout(() => {
      setAppState(AppState.UPLOAD);
      setIsLandingTransitioning(false);
    }, 1400); 
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setUploadedImage(base64);
        setAppState(AppState.PROCESSING);
        
        const initialResponse = await startChatWithImage(base64);
        setChatHistory([{ role: 'model', text: initialResponse }]);
        setAppState(AppState.CHAT);
        setIsChatVisible(false); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !uploadedImage) return;

    const newHistory = [...chatHistory, { role: 'user', text: inputText } as Message];
    setChatHistory(newHistory);
    setInputText("");
    setIsTyping(true);

    const response = await sendMessage(newHistory, inputText, uploadedImage);
    setChatHistory([...newHistory, { role: 'model', text: response }]);
    setIsTyping(false);
  };

  const handleEndChat = async () => {
    setAppState(AppState.POSTCARD_GENERATION);
    setIsChatVisible(false);
    // Generate complex data
    const data = await generatePostcardSummary(chatHistory, uploadedImage!);
    setPostcardData(data);
  };

  const handleSaveMemory = () => {
    // Random position avoiding edges
    const startX = window.innerWidth * 0.1 + Math.random() * (window.innerWidth * 0.6);
    const startY = window.innerHeight * 0.1 + Math.random() * (window.innerHeight * 0.6);
    
    const newMemory: Memory = {
      id: Date.now().toString(),
      imageUrl: uploadedImage!,
      summary: postcardData?.summary || "",
      mood: postcardData?.mood || "宁静",
      keywords: postcardData?.keywords || [],
      date: new Date().toLocaleDateString('zh-CN'),
      timestamp: Date.now(),
      x: startX,
      y: startY,
      rotation: 0 
    };
    setMemories([...memories, newMemory]);
    setAppState(AppState.MEMORY_CORRIDOR);
  };

  const handleBackToStart = () => {
    setUploadedImage(null);
    setChatHistory([]);
    setPostcardData(null);
    setAppState(AppState.LANDING);
  };

  // Dragging Logic for Corridor
  const startDrag = (e: React.MouseEvent, id: string, currentX: number, currentY: number) => {
    e.stopPropagation();
    setDraggedId(id);
    dragOffset.current = {
      x: e.clientX - currentX,
      y: e.clientY - currentY
    };
  };

  const onDragMove = (e: React.MouseEvent) => {
    if (draggedId) {
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      
      setMemories(prev => prev.map(m => 
        m.id === draggedId ? { ...m, x: newX, y: newY } : m
      ));
    }
  };

  const endDrag = () => {
    setDraggedId(null);
  };

  // 3D Card Tilt Calculation
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate rotation (-15 to 15 degrees)
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateY = ((x - centerX) / centerX) * 10;
    const rotateX = -((y - centerY) / centerY) * 10;

    setTilt({ x: rotateY, y: rotateX });
  };

  const handleCardMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div className="relative w-full h-screen bg-[#050505] overflow-hidden text-[#e5e5e5] select-none font-serif">
      
      {/* Background Particles (Always Active except Corridor) */}
      {appState !== AppState.MEMORY_CORRIDOR && (
        <ParticleCanvas 
          imageSrc={uploadedImage} 
          audioData={audioData}
          isAudioPlaying={isAudioPlaying}
        />
      )}

      {/* Audio Control */}
      <AudioController 
        onAudioData={setAudioData} 
        isPlaying={isAudioPlaying} 
        onToggle={() => setIsAudioPlaying(!isAudioPlaying)}
      />

      {/* --- LANDING VIEW --- */}
      {appState === AppState.LANDING && (
        <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/40 backdrop-blur-[1px] transition-all duration-1000 ${isLandingTransitioning ? 'pointer-events-none' : ''}`}>
          <div className={`${isLandingTransitioning ? 'animate-smoke-exit' : ''} flex flex-col items-center`}>
            <div className="mb-4 text-white/20 tracking-[0.5em] text-xs font-sans uppercase">Welcome to</div>
            <h1 className="text-6xl md:text-8xl font-thin tracking-[0.1em] mb-10 text-white/90 font-display italic mix-blend-screen text-shadow-glow">
              记忆回廊
            </h1>
            <p className="max-w-md text-center text-white/50 mb-20 leading-loose px-6 font-light tracking-wide text-sm opacity-80">
              这里没有时间的刻度。<br/>
              只有光，和被光照亮的瞬间。
            </p>
            <button 
              onClick={handleStart}
              className="group relative px-12 py-5 overflow-hidden transition-all duration-700"
            >
              <div className="absolute inset-0 border border-white/20 scale-100 group-hover:scale-95 transition-transform duration-700 ease-out rounded-sm"></div>
              <div className="absolute inset-0 bg-white/5 scale-0 group-hover:scale-100 transition-transform duration-500 rounded-sm"></div>
              
              <span className="relative z-10 flex items-center gap-4 tracking-[0.3em] text-xs font-bold uppercase text-white/80 group-hover:text-white transition-colors">
                Enter Garden <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">→</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {/* --- UPLOAD VIEW --- */}
      {appState === AppState.UPLOAD && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 animate-fade-in">
           {/* High-end Upload Trigger */}
           <div 
             className="relative w-96 h-96 group cursor-pointer flex items-center justify-center"
             onClick={() => fileInputRef.current?.click()}
           >
             {/* Rotating Decoration Rings */}
             <div className="absolute inset-0 border border-white/5 rounded-full scale-75 group-hover:scale-90 transition-transform duration-[2s] ease-in-out"></div>
             <div className="absolute inset-0 border border-white/5 rounded-full scale-50 group-hover:scale-75 transition-transform duration-[2s] delay-100 ease-in-out border-dashed animate-spin-slow"></div>
             
             {/* Center visual */}
             <div className="relative z-10 flex flex-col items-center gap-4">
                <div className="w-1 h-20 bg-gradient-to-b from-transparent via-white/50 to-transparent mb-4 group-hover:h-32 transition-all duration-700"></div>
                <span className="text-4xl font-display italic text-white/60 group-hover:text-white transition-colors">Upload</span>
                <span className="text-[10px] tracking-[0.4em] text-white/30 uppercase mt-2">Create Memory</span>
             </div>
           </div>
           
           <input 
             type="file" 
             ref={fileInputRef} 
             onChange={handleFileUpload} 
             className="hidden" 
             accept="image/*"
           />
        </div>
      )}

      {/* --- PROCESSING VIEW --- */}
      {appState === AppState.PROCESSING && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/60 backdrop-blur-sm">
          <div className="relative">
             <div className="w-20 h-20 border-[1px] border-white/10 rounded-full animate-ping opacity-20 absolute top-0 left-0"></div>
             <div className="w-20 h-20 border-[1px] border-t-white/80 border-r-transparent border-b-white/10 border-l-transparent rounded-full animate-spin"></div>
          </div>
          <p className="mt-8 text-xs tracking-[0.3em] text-white/60 font-light font-sans">DISSOLVING REALITY...</p>
        </div>
      )}

      {/* --- CHAT VIEW --- */}
      {appState === AppState.CHAT && (
        <>
          {!isChatVisible && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-pulse text-white/40 text-[10px] tracking-[0.2em] uppercase font-sans">
              Press [ Space ] to converse
            </div>
          )}

          <div 
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl transition-all duration-700 cubic-bezier(0.2, 1, 0.2, 1) z-20 ${
              isChatVisible ? 'translate-y-0 opacity-100' : 'translate-y-[110%] opacity-0'
            }`}
          >
            <div className="bg-[#0a0a0a]/90 backdrop-blur-2xl border-t border-l border-r border-white/10 rounded-t-[2rem] shadow-[0_-20px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[70vh]">
              
              <div className="flex justify-between items-center px-8 py-6 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500/50 animate-pulse"></div>
                  <span className="text-xs tracking-widest text-white/40 uppercase font-sans">Connected</span>
                </div>
                <div className="flex gap-6">
                  <button onClick={handleEndChat} className="text-xs text-white/40 hover:text-amber-200 transition-colors flex items-center gap-2 group">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-2 group-hover:translate-x-0">Archive Memory</span>
                    <Save size={14}/> 
                  </button>
                  <button onClick={() => setIsChatVisible(false)} className="text-white/40 hover:text-white transition-colors">
                    <X size={16}/>
                  </button>
                </div>
              </div>

              <div 
                className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin min-h-[300px]" 
                ref={chatContainerRef}
              >
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] text-sm leading-8 px-6 py-4 relative group ${
                      msg.role === 'model' 
                        ? 'text-white/80' 
                        : 'text-white/60 text-right'
                    }`}>
                      {msg.role === 'model' && <div className="absolute left-0 top-4 w-[2px] h-4 bg-white/20 group-hover:bg-white/50 transition-colors"></div>}
                      {msg.role === 'user' && <div className="absolute right-0 top-4 w-[2px] h-4 bg-white/10 group-hover:bg-white/30 transition-colors"></div>}
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="pl-8 opacity-30 text-xs tracking-widest">
                    Thinking...
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-white/5 bg-black/20">
                <div className="relative">
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type to speak..."
                    className="w-full bg-transparent border-b border-white/10 px-4 py-4 text-base text-white focus:outline-none focus:border-white/40 transition-colors placeholder:text-white/10 font-light"
                  />
                  <button 
                    onClick={handleSendMessage}
                    className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-white/20 hover:text-white transition-colors"
                  >
                    <ArrowRight size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- POSTCARD GENERATION (3D TILT) --- */}
      {appState === AppState.POSTCARD_GENERATION && (
        <div className="absolute inset-0 z-20 bg-black/95 flex flex-col items-center justify-center animate-fade-in">
            {!postcardData ? (
              <div className="text-center space-y-4 animate-pulse">
                <div className="h-[1px] w-20 bg-white/20 mx-auto mb-8"></div>
                <p className="text-xs tracking-[0.4em] text-white/50 uppercase">Extracting Essence...</p>
              </div>
            ) : (
              <div className="perspective-1000">
                <div 
                  ref={cardRef}
                  onMouseMove={handleCardMouseMove}
                  onMouseLeave={handleCardMouseLeave}
                  className="relative w-[340px] h-[500px] preserve-3d transition-transform duration-100 ease-out cursor-pointer group"
                  style={{
                    transform: `rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`
                  }}
                >
                  {/* Card Front */}
                  <div className="absolute inset-0 bg-[#151515] border border-white/10 rounded-xl overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]">
                    
                    {/* Image Layer */}
                    <div className="h-[55%] w-full overflow-hidden relative">
                       <img src={uploadedImage!} className="w-full h-full object-cover opacity-80 mix-blend-overlay filter contrast-125 sepia-[0.3]" />
                       <div className="absolute inset-0 bg-gradient-to-t from-[#151515] to-transparent"></div>
                    </div>

                    {/* Content Layer */}
                    <div className="p-8 relative h-[45%] flex flex-col justify-between">
                       {/* Running Person Icon (SVG Metaphor) */}
                       <div className="absolute -top-6 right-6 w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-lg transform group-hover:translate-y-[-5px] transition-transform duration-500">
                          <Wind size={20} className="animate-pulse" />
                       </div>

                       <div>
                         <div className="flex items-center gap-2 mb-4 opacity-50">
                           <Tag size={12}/>
                           <div className="flex gap-2 text-[10px] tracking-widest uppercase">
                              {postcardData.keywords.map((k, i) => (
                                <span key={i} className="border border-white/20 px-2 py-[2px] rounded-full">{k}</span>
                              ))}
                           </div>
                         </div>
                         <p className="text-lg font-display italic leading-relaxed text-white/90">
                           "{postcardData.summary}"
                         </p>
                       </div>

                       <div className="flex justify-between items-end border-t border-white/10 pt-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-white/30 uppercase tracking-widest">Mood</span>
                            <span className="text-sm font-serif text-white/70">{postcardData.mood}</span>
                          </div>
                          <div className="flex flex-col gap-1 text-right">
                             <span className="text-[10px] text-white/30 uppercase tracking-widest">Time</span>
                             <span className="text-xs font-mono text-white/50">{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="mt-16 text-center">
                   <button 
                    onClick={handleSaveMemory}
                    className="text-xs tracking-[0.3em] text-white/40 hover:text-white border-b border-transparent hover:border-white/50 pb-1 transition-all duration-500 uppercase"
                  >
                    Store in Memory Corridor
                  </button>
                </div>
              </div>
            )}
        </div>
      )}

      {/* --- MEMORY CORRIDOR (PUZZLE DESIGN) --- */}
      {appState === AppState.MEMORY_CORRIDOR && (
        <div 
          className="absolute inset-0 z-30 bg-[#080808] overflow-hidden bg-noise animate-fade-in"
          onMouseMove={onDragMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
        >
          {/* Header */}
          <div className="absolute top-10 left-10 z-50 pointer-events-none mix-blend-difference">
            <h2 className="text-4xl font-thin tracking-[0.2em] text-white font-display italic">Memory Corridor</h2>
            <div className="h-[1px] w-20 bg-white/30 mt-4 mb-2"></div>
            <p className="text-[10px] text-white/50 tracking-widest uppercase">Archive • {new Date().getFullYear()}</p>
          </div>

          <button 
            onClick={handleBackToStart}
            className="absolute top-10 right-10 z-50 w-12 h-12 flex items-center justify-center border border-white/10 rounded-full text-white/30 hover:text-white hover:bg-white/5 hover:border-white/30 transition-all duration-500 group"
          >
            <Grid size={16} className="group-hover:rotate-90 transition-transform duration-500"/>
          </button>

          {/* Puzzle Pieces */}
          {memories.map((mem) => (
            <div 
              key={mem.id} 
              className="absolute group cursor-grab active:cursor-grabbing w-72 h-72 transition-all duration-300"
              style={{ 
                left: mem.x, 
                top: mem.y,
                zIndex: draggedId === mem.id ? 100 : 10,
                transform: `rotate(${mem.rotation}deg)`
              }}
              onMouseDown={(e) => startDrag(e, mem.id, mem.x, mem.y)}
            >
              <div className="relative w-full h-full transition-transform duration-500 group-hover:scale-105 group-hover:-translate-y-2">
                
                {/* Image Content with Mask */}
                <div className="absolute inset-0 puzzle-mask-1 bg-[#1a1a1a]">
                  <div className="absolute inset-0 opacity-40 bg-noise mix-blend-overlay z-10 pointer-events-none"></div>
                  <img 
                    src={mem.imageUrl} 
                    alt="memory" 
                    className="w-full h-full object-cover filter contrast-125 sepia-[0.3] brightness-90 group-hover:brightness-110 transition-all duration-700"
                  />
                  <div className="absolute inset-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.9)] pointer-events-none"></div>
                </div>

                {/* Floating Info */}
                <div className="absolute -bottom-12 left-4 w-60 opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none transform translate-y-4 group-hover:translate-y-0">
                  <div className="flex justify-between items-end border-b border-white/10 pb-2 mb-2">
                     <span className="text-[10px] tracking-widest text-white/60 font-sans uppercase">{mem.mood}</span>
                     <span className="text-[10px] tracking-widest text-white/40 font-mono">{mem.date}</span>
                  </div>
                  <p className="text-sm text-white/90 font-display italic leading-relaxed text-shadow-glow">
                    "{mem.summary}"
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          {memories.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
               <span className="text-white/5 text-8xl font-display italic tracking-widest">VOID</span>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default App;