"use client";

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Icon } from './icons';
import { ImageCompareSlider, ImageViewerModal } from './ImageEditor';
import type { SourceImage, GeneratedPrompts, RenderHistoryItem, FinishBuildAnalysis, LandscapeAnalysis, PlanningAnalysis, GeneratedPromptItem } from '../types';
import { generatePromptsFromImage, analyzeUnfinishedBuild, generateInteriorCompletionPrompts, upscaleImage, analyzeLandscapeImage, analyzePlanningImage, generateImages, calculateCost, COST_LABELS, PRICING_RATES, blendPersonIntoScene } from '../services/geminiService';

export interface MaskCanvasHandle {
    getCanvas: () => HTMLCanvasElement | null;
    clear: () => void;
    getImageData: () => ImageData | null;
    putImageData: (data: ImageData) => void;
    undoPoint: () => void;
    finishPath: () => void;
}

export interface DrawableCanvasProps {
    image: SourceImage;
    onMaskChange?: () => void;
    brushSize: number;
    color: string;
    tool?: 'brush' | 'pen';
}

// --- Shared Components ---

const UtilityCard: React.FC<{ 
    id: string; 
    label: string; 
    icon: string; 
    desc: string; 
    onClick: () => void; 
}> = ({ id, label, icon, desc, onClick }) => (
    <button 
        onClick={onClick}
        className="group relative flex flex-col items-start p-6 bg-[var(--bg-surface-2)] border border-[var(--border-2)] rounded-2xl hover:bg-[var(--bg-surface-3)] hover:border-amber-400/50 transition-all duration-300 text-left overflow-hidden h-full shadow-lg hover:shadow-amber-500/10 hover:-translate-y-1"
    >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Icon name={icon} className="w-24 h-24 text-white transform rotate-12 group-hover:rotate-0 transition-transform duration-500" />
        </div>
        <div className="p-3 bg-[var(--bg-surface-4)] rounded-xl mb-4 border border-[var(--border-1)] group-hover:border-amber-400/30 transition-colors shadow-inner">
            <Icon name={icon} className="w-8 h-8 text-amber-400" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">{label}</h3>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{desc}</p>
        <div className="mt-auto pt-4 flex items-center gap-2 text-xs font-bold text-[var(--text-tertiary)] group-hover:text-white transition-colors">
            <span>Sử dụng ngay</span>
            <Icon name="arrow-right-circle" className="w-4 h-4" />
        </div>
    </button>
);

const ImageUploadArea: React.FC<{
  sourceImage: SourceImage | null;
  onImageUpload: (image: SourceImage) => void;
  onRemove: () => void;
  label?: string;
  compact?: boolean;
}> = ({ sourceImage, onImageUpload, onRemove, label = "Tải ảnh lên", compact = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (file: File) => {
      const reader = new FileReader(); 
      reader.onload = (ev) => onImageUpload({base64: (ev.target?.result as string).split(',')[1], mimeType: file.type}); 
      reader.readAsDataURL(file);
  };

  return (
    <div 
        className={`relative w-full ${compact ? 'aspect-square' : 'aspect-video md:aspect-[4/3]'} rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden group
            ${isDragging ? 'border-amber-400 bg-amber-400/10' : 'border-[var(--border-2)] bg-[var(--bg-surface-1)] hover:border-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]'}
        `}
        onClick={() => !sourceImage && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]); }}
    >
      {sourceImage ? (
          <>
             <img src={`data:${sourceImage.mimeType};base64,${sourceImage.base64}`} className="w-full h-full object-contain p-2"/>
             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                 <button onClick={(e) => {e.stopPropagation(); fileInputRef.current?.click()}} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full backdrop-blur-sm text-xs font-bold border border-white/20">Đổi Ảnh</button>
                 <button onClick={(e) => {e.stopPropagation(); onRemove()}} className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-sm"><Icon name="trash" className="w-5 h-5"/></button>
             </div>
          </>
      ) : (
          <div className="flex flex-col items-center justify-center text-[var(--text-secondary)] p-4 text-center">
             <div className={`${compact ? 'w-10 h-10' : 'w-16 h-16'} rounded-full bg-[var(--bg-surface-3)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon name="photo" className={`${compact ? 'w-5 h-5' : 'w-8 h-8'} opacity-70`}/>
             </div>
             <span className="font-bold text-xs mb-1 text-white">{label}</span>
          </div>
      )}
      <input type="file" className="hidden" ref={fileInputRef} accept="image/*" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
    </div>
  ); 
};

// --- Mask Editor Components ---
export const MaskEditorModal: React.FC<{
    image: SourceImage;
    initialMaskData: ImageData | null;
    onClose: () => void;
    onSave: (finalMaskData: ImageData) => void;
    brushSize: number;
    setBrushSize: (size: number) => void;
    tool: 'brush' | 'pen';
    setTool: (tool: 'brush' | 'pen') => void;
    color: string;
}> = ({ image, initialMaskData, onClose, onSave, brushSize, setBrushSize, tool, setTool, color }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageCanvasRef = useRef<HTMLCanvasElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [currentMode, setCurrentMode] = useState<'edit' | 'pan'>('edit'); 
    const [isDrawing, setIsDrawing] = useState(false);
    const [points, setPoints] = useState<{x: number, y: number}[]>([]); 
    const [history, setHistory] = useState<ImageData[]>([]);

    useEffect(() => {
        const img = new Image();
        img.src = `data:${image.mimeType};base64,${image.base64}`;
        img.onload = () => {
            [imageCanvasRef, canvasRef].forEach(ref => {
                if(ref.current) { ref.current.width = img.width; ref.current.height = img.height; }
            });
            imageCanvasRef.current?.getContext('2d')?.drawImage(img, 0, 0);
            if (initialMaskData && canvasRef.current) {
                canvasRef.current.getContext('2d')?.putImageData(initialMaskData, 0, 0);
                setHistory([initialMaskData]);
            }
        };
    }, [image, initialMaskData]);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY * -0.001;
        const newScale = Math.min(Math.max(.1, scale + delta), 5);
        setScale(newScale);
    };

    const getMousePos = (e: React.MouseEvent) => {
        if (!canvasRef.current || !containerRef.current) return { x: 0, y: 0 };
        const containerRect = containerRef.current.getBoundingClientRect();
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;
        return { x: (e.clientX - containerRect.left - centerX - offset.x) / scale + (canvasRef.current.width / 2), y: (e.clientY - containerRect.top - centerY - offset.y) / scale + (canvasRef.current.height / 2) };
    };

    const startPan = (e: React.MouseEvent) => { setIsDragging(true); setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y }); };
    const doPan = (e: React.MouseEvent) => { if (isDragging) setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); };
    const endPan = () => setIsDragging(false);

    const startDraw = (e: React.MouseEvent) => {
        const pos = getMousePos(e);
        if (tool === 'brush') { setIsDrawing(true); canvasRef.current?.getContext('2d')?.beginPath(); canvasRef.current?.getContext('2d')?.moveTo(pos.x, pos.y); } 
        else setPoints(prev => [...prev, pos]);
    };

    const doDraw = (e: React.MouseEvent) => {
        if (cursorRef.current) { cursorRef.current.style.left = e.clientX + 'px'; cursorRef.current.style.top = e.clientY + 'px'; }
        if (tool === 'brush' && isDrawing) {
            const pos = getMousePos(e);
            const ctx = canvasRef.current?.getContext('2d');
            if(ctx) { ctx.lineTo(pos.x, pos.y); ctx.strokeStyle = color; ctx.lineWidth = brushSize; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
        }
    };

    const endDraw = () => { if (tool === 'brush' && isDrawing) { setIsDrawing(false); canvasRef.current?.getContext('2d')?.closePath(); saveHistory(); } };
    
    const finishPath = () => {
        if (points.length < 3) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y); ctx.closePath(); ctx.fill(); saveHistory(); }
        setPoints([]);
    };

    const saveHistory = () => { const ctx = canvasRef.current?.getContext('2d'); if (ctx && canvasRef.current) setHistory(prev => [...prev, ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height)]); };
    const handleUndo = () => { if (tool === 'pen' && points.length > 0) setPoints(prev => prev.slice(0, -1)); else if (history.length > 0) { const newHistory = history.slice(0, -1); setHistory(newHistory); const ctx = canvasRef.current?.getContext('2d'); if (ctx && canvasRef.current) { ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); if (newHistory.length > 0) ctx.putImageData(newHistory[newHistory.length - 1], 0, 0); else if (initialMaskData) ctx.putImageData(initialMaskData, 0, 0); } } };
    const handleSave = () => { const ctx = canvasRef.current?.getContext('2d'); if (ctx && canvasRef.current) onSave(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)); onClose(); };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
            <div className="flex items-center justify-between p-3 bg-[var(--bg-surface-4)] border-b border-[var(--border-1)]">
                <div className="flex items-center gap-4">
                     <div className="flex bg-[var(--bg-surface-3)] rounded-lg p-1">
                        <button onClick={() => setCurrentMode('edit')} className={`p-2 rounded ${currentMode === 'edit' ? 'bg-[var(--bg-interactive)] text-white' : 'text-gray-400'}`}><Icon name="pencil" className="w-5 h-5"/></button>
                        <button onClick={() => setCurrentMode('pan')} className={`p-2 rounded ${currentMode === 'pan' ? 'bg-[var(--bg-interactive)] text-white' : 'text-gray-400'}`}><Icon name="hand-raised" className="w-5 h-5"/></button>
                     </div>
                     <div className="flex bg-[var(--bg-surface-3)] rounded-lg p-1">
                        <button onClick={() => setTool('brush')} className={`p-2 rounded ${tool === 'brush' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}><Icon name="brush" className="w-5 h-5"/></button>
                        <button onClick={() => setTool('pen')} className={`p-2 rounded ${tool === 'pen' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}><Icon name="pen-nib" className="w-5 h-5"/></button>
                     </div>
                     {tool === 'brush' && <input type="range" min="5" max="200" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-24"/>}
                     <button onClick={handleUndo} className="flex items-center gap-1 bg-[var(--bg-surface-3)] px-3 py-1.5 rounded text-sm hover:bg-[var(--bg-surface-2)]"><Icon name="arrow-uturn-left" className="w-4 h-4"/> Undo</button>
                     {tool === 'pen' && points.length > 2 && <button onClick={finishPath} className="flex items-center gap-1 bg-green-600 px-3 py-1.5 rounded text-sm font-bold text-white hover:bg-green-500"><Icon name="check-circle" className="w-4 h-4"/> Đóng</button>}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-300 hover:text-white">Hủy</button>
                    <button onClick={handleSave} className="bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-white px-6 py-2 rounded-lg font-bold">Lưu</button>
                </div>
            </div>
            <div ref={containerRef} className={`flex-grow overflow-hidden relative ${currentMode === 'pan' ? 'cursor-grab active:cursor-grabbing' : tool === 'pen' ? 'cursor-crosshair' : 'cursor-none'}`}
                onWheel={handleWheel}
                onMouseDown={currentMode === 'pan' ? startPan : startDraw}
                onMouseMove={currentMode === 'pan' ? doPan : doDraw}
                onMouseUp={currentMode === 'pan' ? endPan : endDraw}
                onMouseLeave={currentMode === 'pan' ? endPan : endDraw}
                onDoubleClick={() => { if(tool === 'pen' && currentMode === 'edit') finishPath(); }}>   
                <div className="absolute top-1/2 left-1/2 origin-center" style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})` }}>
                    <canvas ref={imageCanvasRef} className="block pointer-events-none" />
                    <canvas ref={canvasRef} className="absolute inset-0 block" />
                    {tool === 'pen' && <svg className="absolute inset-0 w-full h-full pointer-events-none"><polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color.replace(/[\d.]+\)$/, '1)')} strokeWidth="2" />{points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="white" stroke="black" />)}</svg>}
                </div>
                {currentMode === 'edit' && tool === 'brush' && <div ref={cursorRef} className="pointer-events-none absolute border-2 border-white rounded-full shadow-sm z-50 mix-blend-difference" style={{ width: brushSize * scale, height: brushSize * scale, left: 0, top: 0, transform: 'translate(-50%, -50%)', position: 'fixed' }}></div>}
            </div>
        </div>
    );
};

export const MaskLayeredCanvas = forwardRef<MaskCanvasHandle, DrawableCanvasProps>(({ image, onMaskChange, brushSize, color, tool = 'brush' }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [points, setPoints] = useState<{x: number, y: number}[]>([]);

    useEffect(() => {
        const img = new Image();
        img.src = `data:${image.mimeType};base64,${image.base64}`;
        img.onload = () => {
            if (containerRef.current) containerRef.current.style.aspectRatio = `${img.width} / ${img.height}`;
            if(canvasRef.current) { canvasRef.current.width = img.width; canvasRef.current.height = img.height; }
        };
    }, [image]);

    useImperativeHandle(ref, () => ({
        getCanvas: () => canvasRef.current,
        clear: () => { const ctx = canvasRef.current?.getContext('2d'); if(ctx) { ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); setPoints([]); }},
        getImageData: () => canvasRef.current?.getContext('2d')?.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height) || null,
        putImageData: (data) => canvasRef.current?.getContext('2d')?.putImageData(data, 0, 0),
        undoPoint: () => setPoints(p => p.slice(0, -1)),
        finishPath: () => { if (points.length > 2) { const ctx = canvasRef.current?.getContext('2d'); if (ctx) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y); ctx.closePath(); ctx.fill(); onMaskChange?.(); } setPoints([]); } }
    }));

    const getMousePos = (e: React.MouseEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        return { x: (e.clientX - rect.left) * (canvasRef.current.width / rect.width), y: (e.clientY - rect.top) * (canvasRef.current.height / rect.height) };
    };

    return (
        <div ref={containerRef} className="relative w-full h-full bg-black/20">
            <img src={`data:${image.mimeType};base64,${image.base64}`} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
            <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full object-contain ${tool === 'pen' ? 'cursor-crosshair' : 'cursor-crosshair'}`}
                onMouseDown={(e) => { if(tool === 'brush') { setIsDrawing(true); canvasRef.current?.getContext('2d')?.beginPath(); canvasRef.current?.getContext('2d')?.moveTo(getMousePos(e).x, getMousePos(e).y); } else setPoints(p => [...p, getMousePos(e)]); }}
                onMouseMove={(e) => { if(tool === 'brush' && isDrawing) { const ctx = canvasRef.current?.getContext('2d'); if(ctx) { ctx.lineTo(getMousePos(e).x, getMousePos(e).y); ctx.strokeStyle = color; ctx.lineWidth = brushSize; ctx.lineCap = 'round'; ctx.stroke(); } } }}
                onMouseUp={() => { if(isDrawing) { setIsDrawing(false); canvasRef.current?.getContext('2d')?.closePath(); onMaskChange?.(); } }}
                onMouseLeave={() => { if(isDrawing) { setIsDrawing(false); canvasRef.current?.getContext('2d')?.closePath(); onMaskChange?.(); } }}
                onDoubleClick={() => { if(tool === 'pen' && points.length > 2) { const ctx = canvasRef.current?.getContext('2d'); if (ctx) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y); ctx.closePath(); ctx.fill(); onMaskChange?.(); } setPoints([]); } }}
            />
        </div>
    );
});

// --- Main Utilities Tab ---

interface UtilitiesTabProps {
    onEditRequest: (image: string) => void;
    onStartNewRenderFlow: (prompt: string, sourceImage: SourceImage | null) => void;
    onTrackUsage: (cost: number, tokens: number) => void;
    
    // States passed from parent to keep data alive
    promptFinderImage: SourceImage | null; setPromptFinderImage: (img: SourceImage | null) => void;
    promptFinderPrompts: GeneratedPrompts | null; setPromptFinderPrompts: (data: GeneratedPrompts | null) => void;
    finishMyBuildImage: SourceImage | null; setFinishMyBuildImage: (img: SourceImage | null) => void;
    finishMyBuildPrompts: FinishBuildAnalysis | null; setFinishMyBuildPrompts: (data: FinishBuildAnalysis | null) => void;
    finishInteriorImage: SourceImage | null; setFinishInteriorImage: (img: SourceImage | null) => void;
    finishInteriorPrompts: string[] | null; setFinishInteriorPrompts: (data: string[] | null) => void;
    upscaleUtilityImage: SourceImage | null; setUpscaleUtilityImage: (img: SourceImage | null) => void;
    landscapeUtilityImage: SourceImage | null; setLandscapeUtilityImage: (img: SourceImage | null) => void;
    landscapeUtilityPrompts: LandscapeAnalysis | null; setLandscapeUtilityPrompts: (data: LandscapeAnalysis | null) => void;
    planningUtilityImage: SourceImage | null; setPlanningUtilityImage: (img: SourceImage | null) => void;
    planningUtilityPrompts: PlanningAnalysis | null; setPlanningUtilityPrompts: (data: PlanningAnalysis | null) => void;
    history: RenderHistoryItem[]; onClearHistory: () => void; onGenerationComplete: (item: RenderHistoryItem) => void;
    initialUtility: string | null; setInitialUtility: (u: string | null) => void;
    onAddToLibrary: (url: string, prompt: string, type: string) => void;
    session: any;
    onShowTopUp: () => void;
}

export const UtilitiesTab: React.FC<UtilitiesTabProps> = (props) => {
    const [activeUtility, setActiveUtility] = useState<string | null>(props.initialUtility);
    const [isLoading, setIsLoading] = useState(false);
    const [resultImages, setResultImages] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'analysis' | 'results'>('analysis');
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

    // Person Blend Utility State
    const [blendBg, setBlendBg] = useState<SourceImage | null>(null);
    const [blendPerson, setBlendPerson] = useState<SourceImage | null>(null);
    const blendMaskRef = useRef<MaskCanvasHandle>(null);
    const [blendPrompt, setBlendPrompt] = useState('');
    const [isMaskEditorOpen, setIsMaskEditorOpen] = useState(false);

    // Redesigned Prompt Finder State
    const [promptFinderPersonImage, setPromptFinderPersonImage] = useState<SourceImage | null>(null);
    const [promptFinderPersonDesc, setPromptFinderPersonDesc] = useState('');
    
    useEffect(() => { 
        if (props.initialUtility) {
            setActiveUtility(props.initialUtility);
            setViewMode('analysis');
            setResultImages([]);
        }
    }, [props.initialUtility]);

    const UTILITIES = [
        { id: 'person_blend', label: 'Ghép Người AI', icon: 'cursor-arrow-rays', desc: 'Ghép một người cụ thể vào không gian kiến trúc. Giữ nguyên 100% khuôn mặt và tự động khớp ánh sáng.' },
        { id: 'prompt_finder', label: 'Dò Prompt (Style)', icon: 'magnifying-glass-plus', desc: 'AI phân tích ảnh và trích xuất 20 prompt nhiếp ảnh chuyên nghiệp (Góc toàn, trung, cận, nghệ thuật).' },
        { id: 'finish_build', label: 'Hoàn Thiện Nhà Thô', icon: 'home', desc: 'Tải ảnh công trình đang xây dở, AI sẽ đề xuất 4 phương án hoàn thiện ngoại thất.' },
        { id: 'finish_interior', label: 'Gợi Ý Nội Thất', icon: 'sparkles', desc: 'Tải ảnh phòng trống, AI gợi ý 3 concept nội thất phù hợp với không gian.' },
        { id: 'landscape_design', label: 'Thiết Kế Cảnh Quan', icon: 'sun', desc: 'Gợi ý sân vườn, tiểu cảnh cho không gian ngoài trời.' },
        { id: 'upscale', label: 'Nâng Cấp Ảnh (Upscale)', icon: 'arrow-up-circle', desc: 'Làm nét ảnh cũ, ảnh mờ hoặc ảnh render độ phân giải thấp.' },
    ];

    const currentUtility = UTILITIES.find(u => u.id === activeUtility);

    const handleBack = () => {
        setActiveUtility(null);
        props.setInitialUtility(null);
        setViewMode('analysis');
        setResultImages([]);
    };

    const handleBackToConcepts = () => {
        setViewMode('analysis');
    };

    // --- Core Action Handlers ---

    const checkCredits = (reqCredits: number) => {
        if (!props.session) {
            alert("Vui lòng đăng nhập để sử dụng tính năng này.");
            return false;
        }
        if (((props.session?.user as any)?.credits ?? 0) < reqCredits) {
            props.onShowTopUp();
            return false;
        }
        return true;
    };

    const handlePersonBlendRun = async () => {
        if (!blendBg || !blendPerson) {
            alert("Vui lòng tải đủ ảnh bối cảnh và ảnh người.");
            return;
        }
        if (!checkCredits(2)) return; // 2 credits for person blend

        setIsLoading(true);
        setViewMode('results');
        try {
            const maskCanvas = blendMaskRef.current?.getCanvas();
            let maskImage: SourceImage | null = null;
            if (maskCanvas) {
                const ctx = maskCanvas.getContext('2d')!;
                const data = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
                let hasMask = false;
                for (let i = 3; i < data.length; i += 4) { if (data[i] > 0) { hasMask = true; break; } }
                if (hasMask) {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = maskCanvas.width;
                    tempCanvas.height = maskCanvas.height;
                    const tCtx = tempCanvas.getContext('2d')!;
                    tCtx.fillStyle = 'black';
                    tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                    tCtx.drawImage(maskCanvas, 0, 0);
                    const imgData = tCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    for (let i = 0; i < imgData.data.length; i += 4) { if (imgData.data[i + 3] > 0) { imgData.data[i] = 255; imgData.data[i+1] = 255; imgData.data[i+2] = 255; imgData.data[i+3] = 255; } }
                    tCtx.putImageData(imgData, 0, 0);
                    maskImage = { base64: tempCanvas.toDataURL('image/png').split(',')[1], mimeType: 'image/png' };
                }
            }
            props.onTrackUsage(PRICING_RATES.IMAGE_PRO, 600);
            const result = await blendPersonIntoScene(blendBg, blendPerson, maskImage, blendPrompt);
            if (result) {
                setResultImages([result]);
                props.onAddToLibrary(result, blendPrompt || "Ghép người AI", "Utility: Ghép người");
            } else { alert("Không thể ghép ảnh. Vui lòng thử lại."); }
        } catch (e) { alert("Lỗi: " + e); } finally { setIsLoading(false); }
    };

    const handlePromptFinder = async () => {
        if (!props.promptFinderImage) return;
        if (!checkCredits(1)) return; // 1 credit
        setIsLoading(true);
        try {
            props.onTrackUsage(PRICING_RATES.IMAGE_FLASH, 300);
            const results = await generatePromptsFromImage(props.promptFinderImage, promptFinderPersonImage, promptFinderPersonDesc);
            props.setPromptFinderPrompts(results);
        } catch (e) { alert("Lỗi: " + e); } finally { setIsLoading(false); }
    };

    const handleFinishBuild = async () => {
        if (!props.finishMyBuildImage) return;
        if (!checkCredits(1)) return;
        setIsLoading(true);
        try {
            props.onTrackUsage(PRICING_RATES.IMAGE_FLASH, 500);
            const analysis = await analyzeUnfinishedBuild(props.finishMyBuildImage);
            props.setFinishMyBuildPrompts(analysis);
        } catch (e) { alert("Lỗi: " + e); } finally { setIsLoading(false); }
    };

    const handleInteriorSuggest = async () => {
        if (!props.finishInteriorImage) return;
        if (!checkCredits(1)) return;
        setIsLoading(true);
        try {
            props.onTrackUsage(PRICING_RATES.IMAGE_FLASH, 300);
            const concepts = await generateInteriorCompletionPrompts(props.finishInteriorImage);
            props.setFinishInteriorPrompts(concepts);
        } catch (e) { alert("Lỗi: " + e); } finally { setIsLoading(false); }
    };

    const handleLandscape = async () => {
        if (!props.landscapeUtilityImage) return;
        if (!checkCredits(1)) return;
        setIsLoading(true);
        try {
             props.onTrackUsage(PRICING_RATES.IMAGE_FLASH, 400);
             const analysis = await analyzeLandscapeImage(props.landscapeUtilityImage);
             props.setLandscapeUtilityPrompts(analysis);
        } catch (e) { alert("Lỗi: " + e); } finally { setIsLoading(false); }
    };

    const handleUpscaleRun = async (target: '2k' | '4k') => {
        if (!props.upscaleUtilityImage) return;
        const reqCredits = target === '4k' ? 4 : 2;
        if (!checkCredits(reqCredits)) return;

        setIsLoading(true);
        setViewMode('results');
        try {
            props.onTrackUsage(PRICING_RATES.IMAGE_PRO, 300);
            const res = await upscaleImage(props.upscaleUtilityImage, target);
            if (res) {
                setResultImages([res]);
                props.onAddToLibrary(res, `Upscale ${target}`, "Utility: Upscale");
            }
        } catch (e) { alert("Lỗi: " + e); } finally { setIsLoading(false); }
    };
    
    // --- Render Helpers ---

    const renderPromptItem = (item: GeneratedPromptItem, index: number) => (
        <div key={index} className="bg-[var(--bg-surface-3)] p-4 rounded-xl border border-[var(--border-2)] hover:border-blue-400/50 transition-all flex flex-col gap-2 group shadow-lg mb-3">
             <div className="flex justify-between items-start">
                <h4 className="text-sm font-bold text-blue-300">{item.title}</h4>
                <div className="flex gap-1">
                    <button 
                        onClick={() => { navigator.clipboard.writeText(item.description); alert("Đã sao chép prompt!"); }}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
                        title="Sao chép"
                    >
                        <Icon name="bookmark" className="w-4 h-4"/>
                    </button>
                    <button 
                        onClick={() => props.onStartNewRenderFlow(item.description, props.promptFinderImage)}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
                        title="Tạo ảnh ngay"
                    >
                        <Icon name="photo" className="w-4 h-4"/>
                    </button>
                </div>
             </div>
             <p className="text-xs text-slate-300 leading-relaxed italic">{item.description}</p>
        </div>
    );

    const renderPromptSection = (title: string, icon: string, items: GeneratedPromptItem[] | undefined) => {
        if (!items || items.length === 0) return null;
        return (
            <div className="mb-8">
                <h3 className="text-sm font-black text-white flex items-center gap-2 mb-4 uppercase tracking-widest border-l-4 border-blue-500 pl-3">
                    <Icon name={icon} className="w-5 h-5 text-blue-400"/> {title}
                </h3>
                <div className="space-y-3">
                    {items.map((item, idx) => renderPromptItem(item, idx))}
                </div>
            </div>
        );
    };

    const renderConceptCard = (title: string, content: string | string[], onUse: (txt: string) => void) => (
        <div className="bg-[var(--bg-surface-3)] p-4 rounded-xl border border-[var(--border-2)] hover:border-amber-400/50 transition-all flex flex-col gap-3 group shadow-lg">
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">{title}</span>
                <Icon name="sparkles" className="w-4 h-4 text-amber-400 opacity-50 group-hover:opacity-100 animate-pulse" />
            </div>
            <div className="flex-grow">
                {Array.isArray(content) ? (
                     <ul className="text-xs text-slate-300 list-disc pl-4 space-y-1">
                        {content.map((c, i) => <li key={i}>{c}</li>)}
                     </ul>
                ) : (
                    <p className="text-xs text-slate-300 leading-relaxed">{content}</p>
                )}
            </div>
            <div className="flex gap-2 mt-2">
                <button 
                    onClick={() => onUse(Array.isArray(content) ? content[0] : content)} 
                    className="flex-1 bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-white py-2 rounded-lg text-xs font-bold transition-colors shadow-md"
                >
                    Tạo Ngay
                </button>
            </div>
        </div>
    );

    const renderEmptyState = (message: string) => (
        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
            <Icon name="photo" className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">{message}</p>
        </div>
    );

    const renderResultDisplay = () => {
        const resultImage = resultImages[0];
        let sourceImage: SourceImage | null = null;
        if (activeUtility === 'upscale') sourceImage = props.upscaleUtilityImage;
        else if (activeUtility === 'person_blend') sourceImage = blendBg;
        const sourceImageUrl = sourceImage ? `data:${sourceImage.mimeType};base64,${sourceImage.base64}` : null;

        return (
            <div className="flex flex-col h-full animate-in fade-in zoom-in duration-300">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={handleBackToConcepts} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors group">
                        <Icon name="arrow-uturn-left" className="w-4 h-4 group-hover:-translate-x-1 transition-transform"/> Quay lại Thiết lập
                    </button>
                </div>
                <div className="flex-grow bg-black/40 rounded-xl overflow-hidden relative group border border-[var(--border-2)] shadow-2xl flex items-center justify-center">
                    {resultImage ? (
                        <div className="w-full h-full">
                            <ImageCompareSlider beforeImage={sourceImageUrl} afterImage={resultImage} />
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[var(--bg-surface-4)]/90 backdrop-blur-md p-2 rounded-xl border border-[var(--border-2)] shadow-xl opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => setFullscreenImage(resultImage)} className="p-2 hover:bg-[var(--bg-surface-3)] rounded-lg text-white"><Icon name="arrows-expand" className="w-5 h-5"/></button>
                                <a href={resultImage} download={`WGD-utility-${Date.now()}.png`} className="p-2 hover:bg-[var(--bg-surface-3)] rounded-lg text-white"><Icon name="download" className="w-5 h-5"/></a>
                                <button onClick={() => props.onEditRequest(resultImage)} className="p-2 hover:bg-[var(--bg-surface-3)] rounded-lg text-white"><Icon name="pencil" className="w-5 h-5"/></button>
                            </div>
                        </div>
                    ) : ( <div className="text-white">Đang tải kết quả...</div> )}
                </div>
            </div>
        );
    };

    if (!activeUtility) {
        return (
            <div className="max-w-7xl mx-auto pb-20">
                <div className="text-center mb-10 mt-6">
                    <h1 className="text-3xl font-black text-white mb-2 tracking-tight">KHO TIỆN ÍCH AI</h1>
                    <p className="text-[var(--text-secondary)]">Bộ công cụ chuyên sâu hỗ trợ mọi giai đoạn thiết kế</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
                    {UTILITIES.map(u => <UtilityCard key={u.id} {...u} onClick={() => setActiveUtility(u.id)} />)}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col pb-20 max-w-[1920px] mx-auto px-4">
            <div className="flex items-center gap-4 py-6 border-b border-[var(--border-1)] mb-6">
                <button onClick={handleBack} className="p-2 rounded-full hover:bg-[var(--bg-surface-3)] transition-colors group">
                    <Icon name="arrow-uturn-left" className="w-6 h-6 text-[var(--text-secondary)] group-hover:text-white" />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Icon name={currentUtility?.icon || 'sparkles'} className="w-6 h-6 text-amber-400" />
                        {currentUtility?.label}
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)]">{currentUtility?.desc}</p>
                </div>
            </div>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0">
                <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
                    <div className="bg-[var(--bg-surface-1)] p-6 rounded-2xl border border-[var(--border-1)] shadow-xl">
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase mb-4 tracking-wider">THIẾT LẬP</h3>
                        
                        {activeUtility === 'prompt_finder' ? (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">1. Tải ảnh lên để phân tích</label>
                                    <p className="text-[9px] text-slate-500 mb-2">AI sẽ phân tích ảnh và tạo ra 20 prompt nhiếp ảnh chuyên nghiệp.</p>
                                    <ImageUploadArea sourceImage={props.promptFinderImage} onImageUpload={props.setPromptFinderImage} onRemove={() => props.setPromptFinderImage(null)} />
                                </div>

                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">2. Tải ảnh nhân vật (Tùy chọn)</label>
                                        <p className="text-[9px] text-slate-500 mb-2">AI sẽ phân tích và đưa nhân vật này vào các góc chụp có người.</p>
                                        <ImageUploadArea sourceImage={promptFinderPersonImage} onImageUpload={setPromptFinderPersonImage} onRemove={() => setPromptFinderPersonImage(null)} label="Kéo thả, dán, hoặc click" compact />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Mô tả nhân vật</label>
                                        <textarea 
                                            value={promptFinderPersonDesc} 
                                            onChange={(e) => setPromptFinderPersonDesc(e.target.value)} 
                                            placeholder="Nhập mô tả nhân vật thủ công hoặc tải ảnh để AI tự động phân tích..." 
                                            className="w-full bg-[var(--bg-surface-3)] border border-slate-700 p-3 rounded-xl text-xs outline-none focus:border-blue-400 h-24" 
                                        />
                                        <p className="text-[9px] text-slate-500 italic">* Bạn có thể tải ảnh lên để AI phân tích mô tả tự động, sau đó chỉnh sửa lại nếu cần.</p>
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center justify-between text-xs p-2 rounded bg-orange-900/40 text-orange-200 border border-orange-500/30">
                                    <span className="font-semibold">Phí Phân Tích</span>
                                    <span className="font-mono font-bold text-amber-400">-1 💎</span>
                                </div>
                                <button onClick={handlePromptFinder} disabled={!props.promptFinderImage || isLoading} className="w-full py-4 mt-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                                    {isLoading ? <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></div> : 'Bắt Đầu Phân Tích'}
                                </button>
                            </div>
                        ) : activeUtility === 'person_blend' ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">1. Bối Cảnh (Architecture)</label>
                                        <ImageUploadArea sourceImage={blendBg} onImageUpload={setBlendBg} onRemove={() => setBlendBg(null)} label="Bối cảnh" compact />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">2. Người Mẫu (Person)</label>
                                        <ImageUploadArea sourceImage={blendPerson} onImageUpload={setBlendPerson} onRemove={() => setBlendPerson(null)} label="Chân dung" compact />
                                    </div>
                                </div>
                                {blendBg && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase flex justify-between items-center"> 3. Vị trí ghép (Tô Mask) <button onClick={() => setIsMaskEditorOpen(true)} className="text-amber-400 hover:underline">Phóng to Sửa</button> </label>
                                        <div className="aspect-video border border-slate-700 rounded-xl overflow-hidden bg-black/40"> <MaskLayeredCanvas ref={blendMaskRef} image={blendBg} brushSize={40} color="rgba(251, 191, 36, 0.5)" tool="brush" /> </div>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">4. Tư thế/Yêu cầu khác</label>
                                    <textarea value={blendPrompt} onChange={(e) => setBlendPrompt(e.target.value)} placeholder="VD: Đang đứng tựa vào tường, đang cười nhìn vào camera..." className="w-full bg-[var(--bg-surface-3)] border border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-amber-400 h-20" />
                                </div>
                                <div className="mt-4 flex items-center justify-between text-xs p-2 rounded bg-orange-900/40 text-orange-200 border border-orange-500/30">
                                    <span className="font-semibold">Phí Tách Ghép Chân Dung AI</span>
                                    <span className="font-mono font-bold text-amber-400">-2 💎</span>
                                </div>
                                <button onClick={handlePersonBlendRun} disabled={!blendBg || !blendPerson || isLoading} className="w-full py-4 mt-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"> {isLoading ? <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></div> : 'Bắt Đầu Ghép Người'} </button>
                            </div>
                        ) : (
                            <>
                                {activeUtility === 'finish_build' && <ImageUploadArea sourceImage={props.finishMyBuildImage} onImageUpload={props.setFinishMyBuildImage} onRemove={() => props.setFinishMyBuildImage(null)} />}
                                {activeUtility === 'finish_interior' && <ImageUploadArea sourceImage={props.finishInteriorImage} onImageUpload={props.setFinishInteriorImage} onRemove={() => props.setFinishInteriorImage(null)} />}
                                {activeUtility === 'landscape_design' && <ImageUploadArea sourceImage={props.landscapeUtilityImage} onImageUpload={props.setLandscapeUtilityImage} onRemove={() => props.setLandscapeUtilityImage(null)} />}
                                {activeUtility === 'upscale' && <ImageUploadArea sourceImage={props.upscaleUtilityImage} onImageUpload={props.setUpscaleUtilityImage} onRemove={() => props.setUpscaleUtilityImage(null)} />}

                                {activeUtility !== 'upscale' && (
                                    <>
                                        <div className="mt-4 flex items-center justify-between text-xs p-2 rounded bg-orange-900/40 text-orange-200 border border-orange-500/30">
                                            <span className="font-semibold">Phí Tạo Mẫu / Gợi Ý</span>
                                            <span className="font-mono font-bold text-amber-400">-1 💎</span>
                                        </div>
                                        <button onClick={activeUtility === 'finish_build' ? handleFinishBuild : activeUtility === 'finish_interior' ? handleInteriorSuggest : handleLandscape} disabled={isLoading} className="w-full py-4 mt-2 bg-[var(--bg-interactive)] text-white font-bold rounded-xl">{isLoading ? 'Đang phân tích...' : 'Bắt Đầu Phân Tích'}</button>
                                    </>
                                )}

                                {activeUtility === 'upscale' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-3 mt-6">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between items-center text-xs p-1.5 rounded bg-orange-900/40 text-orange-200 border border-orange-500/30 px-2 mt-auto">
                                                    <span>Phí: </span><span className="font-mono font-bold text-amber-400">-2 💎</span>
                                                </div>
                                                <button onClick={() => handleUpscaleRun('2k')} disabled={isLoading} className="py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition-colors shadow-lg">2K Resolution</button>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between items-center text-xs p-1.5 rounded bg-purple-900/40 text-purple-200 border border-purple-500/30 px-2 mt-auto">
                                                    <span>Phí: </span><span className="font-mono font-bold text-amber-400">-4 💎</span>
                                                </div>
                                                <button onClick={() => handleUpscaleRun('4k')} disabled={isLoading} className="py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors shadow-lg">4K Resolution</button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-8 h-full overflow-y-auto custom-scrollbar bg-[var(--bg-surface-1)]/50 rounded-2xl border border-[var(--border-1)] p-6 relative">
                    {viewMode === 'results' ? renderResultDisplay() : (
                        <div className="h-full">
                            {activeUtility === 'prompt_finder' && props.promptFinderPrompts ? (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5">
                                        <div className="bg-orange-500/20 p-2 rounded-lg"><Icon name="magnifying-glass-plus" className="w-6 h-6 text-orange-400"/></div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white uppercase tracking-tight">Kết quả phân tích nhiếp ảnh</h3>
                                            <p className="text-xs text-slate-400">20 góc máy chuyên nghiệp đã được trích xuất cho không gian của bạn.</p>
                                        </div>
                                    </div>

                                    {renderPromptSection("5 GÓC TOÀN CẢNH (WIDE SHOTS)", "arrows-expand", props.promptFinderPrompts.wide_shots)}
                                    {renderPromptSection("5 GÓC TRUNG CẢNH (MEDIUM SHOTS)", "photo", props.promptFinderPrompts.medium_shots)}
                                    {renderPromptSection("5 GÓC CẬN CẢNH CHI TIẾT (DETAILED CLOSE-UP SHOTS)", "viewfinder", props.promptFinderPrompts.closeup_shots)}
                                    {renderPromptSection("5 GÓC MÁY NGHỆ THUẬT (ARTISTIC SHOTS)", "sparkles", props.promptFinderPrompts.artistic_shots)}
                                </div>
                            ) : activeUtility === 'prompt_finder' && !isLoading ? (
                                renderEmptyState("Kết quả phân tích 20 prompt chuyên nghiệp sẽ xuất hiện ở đây.")
                            ) : null}

                            {activeUtility === 'finish_build' && props.finishMyBuildPrompts && Object.entries(props.finishMyBuildPrompts).map(([key, val]) => renderConceptCard(key, val as string, () => {}))}
                            {activeUtility === 'finish_interior' && props.finishInteriorPrompts && props.finishInteriorPrompts.map((c, i) => renderConceptCard(`Concept ${i+1}`, c, () => {}))}
                            {activeUtility === 'landscape_design' && props.landscapeUtilityPrompts && Object.entries(props.landscapeUtilityPrompts).map(([key, val]) => renderConceptCard(key, val as string, () => {}))}
                            
                            {isLoading && (
                                <div className="flex flex-col items-center justify-center py-20 text-orange-400">
                                    <div className="animate-spin h-10 w-10 border-4 border-orange-500 rounded-full border-t-transparent mb-4"></div>
                                    <p className="text-sm font-bold animate-pulse">AI đang phân tích từng điểm ảnh...</p>
                                </div>
                            )}
                            
                            {!isLoading && !props.promptFinderPrompts && !props.finishMyBuildPrompts && !props.finishInteriorPrompts && !props.landscapeUtilityPrompts && activeUtility !== 'prompt_finder' && renderEmptyState("Kết quả phân tích sẽ xuất hiện ở đây.")}
                        </div>
                    )}
                </div>
            </div>

            {isMaskEditorOpen && blendBg && (
                <MaskEditorModal image={blendBg} initialMaskData={blendMaskRef.current?.getImageData() || null} onClose={() => setIsMaskEditorOpen(false)} onSave={(data) => blendMaskRef.current?.putImageData(data)} brushSize={40} setBrushSize={() => {}} tool="brush" setTool={() => {}} color="rgba(251, 191, 36, 0.5)" />
            )}
            {fullscreenImage && <ImageViewerModal imageUrl={fullscreenImage} onClose={() => setFullscreenImage(null)} />}
        </div>
    );
};
