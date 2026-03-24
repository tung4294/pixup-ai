"use client";

import React, { useState, useCallback } from 'react';
import { Icon } from './icons';
import { generateVirtualTourImage, TourMoveType, COST_LABELS, PRICING_RATES } from '../services/geminiService';
import type { SourceImage } from '../types';

// Reusable components for this tab to keep it self-contained
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-[var(--bg-surface-1)] backdrop-blur-md border border-[var(--border-1)] shadow-2xl shadow-[var(--shadow-color)] p-6 rounded-xl">
    <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{title}</h2>
    {children}
  </div>
);

const ImageUpload: React.FC<{
  sourceImage: SourceImage | null;
  onImageUpload: (image: SourceImage) => void;
  onRemove: () => void;
}> = ({ sourceImage, onImageUpload, onRemove }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const processFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = (e.target?.result as string).split(',')[1];
            if (base64) {
              onImageUpload({ base64, mimeType: file.type });
            }
        };
        reader.readAsDataURL(file);
    } else {
        alert("Vui lòng tải lên một tệp ảnh hợp lệ (PNG, JPG, WEBP).");
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
      e.stopPropagation(); 
      onRemove();
  }

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative group border-2 border-dashed rounded-lg p-4 flex items-center justify-center h-48 mb-4 hover:border-[var(--border-interactive)] transition-colors cursor-pointer ${isDraggingOver ? 'border-[var(--border-interactive)] bg-[var(--bg-surface-2)]' : 'border-[var(--border-2)]'}`}
        onClick={() => fileInputRef.current?.click()}
      >
        {sourceImage ? (
          <>
            <img src={`data:${sourceImage.mimeType};base64,${sourceImage.base64}`} alt="Source" className="max-h-full max-w-full object-contain rounded" />
            <button
                onClick={handleRemove}
                className="absolute top-1 right-1 bg-black/50 rounded-full text-white hover:bg-black/80 p-0.5 transition-colors opacity-0 group-hover:opacity-100 z-10"
                aria-label="Remove source image"
            >
                <Icon name="x-circle" className="w-5 h-5" />
            </button>
          </>
        ) : (
          <div className="text-center text-[var(--text-secondary)] pointer-events-none">
            <p>Nhấp hoặc kéo tệp vào đây</p>
            <p className="text-xs">PNG, JPG, WEBP</p>
          </div>
        )}
      </div>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-2 px-4 rounded transition-colors"
      >
        {sourceImage ? 'Đổi Ảnh Khác' : 'Tải Lên Ảnh'}
      </button>
    </div>
  );
};

const ControlButton: React.FC<{ icon: string; label: string; onClick: () => void; disabled: boolean; title: string; }> = ({ icon, label, onClick, disabled, title }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="flex flex-col items-center justify-center gap-1.5 p-3 bg-[var(--bg-surface-2)] rounded-lg hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full h-full aspect-square relative group"
        title={title}
    >
        <Icon name={icon} className="w-8 h-8"/>
        <span className="text-xs font-semibold">{label}</span>
        <div className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse group-hover:opacity-100 opacity-0 transition-opacity"></div>
    </button>
);

const FullscreenModal: React.FC<{ imageUrl: string; onClose: () => void; }> = ({ imageUrl, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-surface-4)]/80 backdrop-blur-lg border border-[var(--border-1)] rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-[var(--bg-interactive)] text-white rounded-full p-2 hover:bg-[var(--bg-interactive-hover)] transition-transform duration-200 hover:scale-110 z-10"
          aria-label="Close"
        >
          <Icon name="x-mark" className="w-6 h-6" />
        </button>
        <div className="p-2 flex-grow overflow-auto flex items-center justify-center">
            <img src={imageUrl} alt="Fullscreen view" className="max-w-full max-h-full object-contain rounded-md" />
        </div>
      </div>
    </div>
  );
};

type AppTab = 'exterior' | 'interior' | 'floorplan' | 'virtual_tour' | 'edit' | 'utilities' | 'library';

interface VirtualTourTabProps {
  setActiveTab: (tab: AppTab) => void;
  setImageForEditing: (image: SourceImage | null) => void;
  onCreateVideoRequest: (imageUrl: string) => void;
  onAddCost: (cost: number, tokens: number) => void;
  onAddToLibrary: (url: string, prompt: string, type: string) => void;
  session: any;
  onShowTopUp: () => void;
}

export const VirtualTourTab: React.FC<VirtualTourTabProps> = ({ setActiveTab, setImageForEditing, onCreateVideoRequest, onAddCost, onAddToLibrary, session, onShowTopUp }) => {
    const [currentImage, setCurrentImage] = useState<SourceImage | null>(null);
    const [undoStack, setUndoStack] = useState<SourceImage[]>([]);
    const [redoStack, setRedoStack] = useState<SourceImage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [magnitude, setMagnitude] = useState<15 | 30 | 45>(30);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleImageUpload = (image: SourceImage) => {
        setCurrentImage(image);
        setUndoStack([]);
        setRedoStack([]);
    };

    const handleRemoveImage = () => {
        setCurrentImage(null);
        setUndoStack([]);
        setRedoStack([]);
    };

    const handleNavigate = useCallback(async (moveType: TourMoveType) => {
        if (!currentImage) {
            alert("Vui lòng tải lên ảnh để bắt đầu chuyến tham quan.");
            return;
        }
        if (!session) {
            alert("Vui lòng đăng nhập để sử dụng tính năng này.");
            return;
        }
        if (((session?.user as any)?.credits ?? 0) < 200) {
            onShowTopUp();
            return;
        }

        setIsLoading(true);
        const messages: Record<TourMoveType, string> = {
            'pan-up': 'Đang nghiêng camera lên...',
            'pan-down': 'Đang nghiêng camera xuống...',
            'pan-left': 'Đang xoay camera sang trái...',
            'pan-right': 'Đang xoay camera sang phải...',
            'orbit-left': 'Đang di chuyển quanh đối tượng...',
            'orbit-right': 'Đang di chuyển quanh đối tượng...',
            'zoom-in': 'Đang phóng to...',
            'zoom-out': 'Đang thu nhỏ...'
        };
        setLoadingMessage(messages[moveType]);

        try {
            onAddCost(PRICING_RATES.IMAGE_PRO, 300); // Cost + 300 Token estimate for image input/prompt
            const newImageSrc = await generateVirtualTourImage(currentImage, moveType, magnitude);
            if (newImageSrc) {
                const newImage: SourceImage = {
                    base64: newImageSrc.split(',')[1],
                    mimeType: newImageSrc.match(/data:(image\/[a-z]+);/)?.[1] || 'image/png'
                };
                setUndoStack(prev => [...prev, currentImage]);
                setCurrentImage(newImage);
                setRedoStack([]); // New action clears the redo stack
                
                // Add to Library
                onAddToLibrary(newImageSrc, `Virtual Tour: ${moveType}`, "Virtual Tour");
            } else {
                throw new Error("AI không thể tạo ảnh cho hướng di chuyển này.");
            }
        } catch (error) {
            console.error("Virtual tour navigation failed:", error);
            alert(`Đã xảy ra lỗi: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsLoading(false);
        }
    }, [currentImage, magnitude, onAddCost, onAddToLibrary]);
    
    const handleUndo = () => {
        if (undoStack.length > 0) {
            const newUndoStack = [...undoStack];
            const previousImage = newUndoStack.pop();
            setRedoStack(prev => [currentImage!, ...prev]);
            setCurrentImage(previousImage!);
            setUndoStack(newUndoStack);
        }
    };

    const handleRedo = () => {
        if (redoStack.length > 0) {
            const newRedoStack = [...redoStack];
            const nextImage = newRedoStack.shift();
            setUndoStack(prev => [...prev, currentImage!]);
            setCurrentImage(nextImage!);
            setRedoStack(newRedoStack);
        }
    };
    
    const handleEdit = () => {
        if (currentImage) {
            setImageForEditing(currentImage);
            setActiveTab('edit');
        }
    };

    const handleCreateVideo = () => {
        if (currentImage) {
            const imageUrl = `data:${currentImage.mimeType};base64,${currentImage.base64}`;
            onCreateVideoRequest(imageUrl);
        }
    };

    return (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-1 flex flex-col gap-8 h-full">
                <Section title="1. Điểm Bắt Đầu">
                    <ImageUpload
                        sourceImage={currentImage}
                        onImageUpload={handleImageUpload}
                        onRemove={handleRemoveImage}
                    />
                </Section>
                {currentImage && (
                    <Section title="2. Bảng Điều Khiển Camera">
                        <div className="space-y-6">
                             <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Mức độ di chuyển</label>
                                <div className="flex items-center gap-2 bg-[var(--bg-surface-3)] rounded-md p-1">
                                    {(['15', '30', '45'] as const).map(angle => (
                                        <button 
                                            key={angle}
                                            onClick={() => setMagnitude(Number(angle) as 15 | 30 | 45)}
                                            className={`w-full text-sm font-semibold py-1.5 rounded-md transition-colors ${magnitude === Number(angle) ? 'bg-[var(--bg-interactive)] text-[var(--text-interactive)] shadow' : 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]'}`}
                                        >
                                            {angle}°
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs p-2 bg-orange-900/30 border border-orange-500/20 rounded text-orange-200">
                                    <div className="flex gap-1 items-center">
                                       <span className="font-bold">⚠️ Lưu ý:</span>
                                       <span className="opacity-80">Mỗi bước di chuyển (Tạo 1 ảnh)</span>
                                    </div>
                                    <span className="font-mono font-bold text-amber-400">-200 💎</span>
                                </div>
                            </div>

                             {/* Pan Controls */}
                            <div className="space-y-2">
                                <h3 className="font-semibold text-center text-[var(--text-secondary)]">Xoay Camera (Pan)</h3>
                                <div className="grid grid-cols-3 gap-2 p-2 bg-[var(--bg-surface-4)]/50 rounded-lg">
                                    <div />
                                    <ControlButton icon="arrow-up-circle" label="Lên" onClick={() => handleNavigate('pan-up')} disabled={isLoading} title="Nghiêng lên" />
                                    <div />
                                    <ControlButton icon="arrow-left-circle" label="Trái" onClick={() => handleNavigate('pan-left')} disabled={isLoading} title="Xoay trái" />
                                    <div className="flex items-center justify-center">
                                      <Icon name="cursor-arrow-rays" className="w-8 h-8 text-[var(--text-tertiary)]" />
                                    </div>
                                    <ControlButton icon="arrow-right-circle" label="Phải" onClick={() => handleNavigate('pan-right')} disabled={isLoading} title="Xoay phải" />
                                    <div />
                                    <ControlButton icon="arrow-down-circle" label="Xuống" onClick={() => handleNavigate('pan-down')} disabled={isLoading} title="Nghiêng xuống" />
                                    <div />
                                </div>
                            </div>
                            
                            {/* Orbit & Zoom Controls */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-center text-[var(--text-secondary)]">Quỹ Đạo (Orbit)</h3>
                                    <div className="grid grid-cols-2 gap-2 p-2 bg-[var(--bg-surface-4)]/50 rounded-lg">
                                        <ControlButton icon="arrow-uturn-left" label="Quay Trái" onClick={() => handleNavigate('orbit-left')} disabled={isLoading} title="Đi vòng sang trái" />
                                        <ControlButton icon="arrow-uturn-right" label="Quay Phải" onClick={() => handleNavigate('orbit-right')} disabled={isLoading} title="Đi vòng sang phải" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-center text-[var(--text-secondary)]">Thu Phóng (Zoom)</h3>
                                    <div className="grid grid-cols-2 gap-2 p-2 bg-[var(--bg-surface-4)]/50 rounded-lg">
                                        <ControlButton icon="magnifying-glass-plus" label="Gần Lại" onClick={() => handleNavigate('zoom-in')} disabled={isLoading} title="Phóng to" />
                                        <ControlButton icon="magnifying-glass-minus" label="Ra Xa" onClick={() => handleNavigate('zoom-out')} disabled={isLoading} title="Thu nhỏ" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={handleUndo}
                                    disabled={isLoading || undoStack.length === 0}
                                    className="w-full bg-[var(--bg-surface-3)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] font-bold py-2.5 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed"
                                >
                                    <Icon name="arrow-uturn-left" className="w-5 h-5" />
                                    Hoàn Tác ({undoStack.length})
                                </button>
                                <button
                                    onClick={handleRedo}
                                    disabled={isLoading || redoStack.length === 0}
                                    className="w-full bg-[var(--bg-surface-3)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] font-bold py-2.5 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed"
                                >
                                    <Icon name="arrow-uturn-right" className="w-5 h-5" />
                                    Làm Lại ({redoStack.length})
                                </button>
                            </div>
                        </div>
                    </Section>
                )}
                <div className="mt-auto">
                    {/* Support button removed for commercialization */}
                </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-2">
                <Section title="Khung Cảnh Hiện Tại">
                    <div className="w-full aspect-video bg-black/20 rounded-lg flex items-center justify-center min-h-[400px] lg:min-h-[550px] relative overflow-hidden group">
                       {isLoading && (
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-100"></div>
                                <p className="mt-4 font-semibold text-sm text-slate-200">{loadingMessage}</p>
                            </div>
                        )}
                        {currentImage ? (
                            <>
                                <img 
                                    src={`data:${currentImage.mimeType};base64,${currentImage.base64}`} 
                                    alt="Current view" 
                                    className="max-w-full max-h-full object-contain rounded-md"
                                />
                                <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                                     <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                                        title="Xem Toàn Màn Hình"
                                    >
                                        <Icon name="arrows-expand" className="w-4 h-4" />
                                        <span>Phóng To</span>
                                    </button>
                                     <button
                                        onClick={handleEdit}
                                        className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                                        title="Chỉnh Sửa Ảnh Này"
                                    >
                                        <Icon name="pencil" className="w-4 h-4" />
                                        <span>Sửa</span>
                                    </button>
                                    <button
                                        onClick={handleCreateVideo}
                                        className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                                        title="Tạo Video từ ảnh này"
                                    >
                                        <Icon name="film" className="w-4 h-4" />
                                        <span>Tạo Video</span>
                                    </button>
                                     <a
                                        href={`data:${currentImage.mimeType};base64,${currentImage.base64}`}
                                        download={`WGD-ai-tour-${Date.now()}.png`}
                                        className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                                        aria-label="Tải ảnh"
                                        title="Tải ảnh về"
                                    >
                                        <Icon name="download" className="w-4 h-4" />
                                        <span>Tải Về</span>
                                    </a>
                                </div>
                            </>
                        ) : (
                             <div className="text-center text-[var(--text-tertiary)]">
                                <Icon name="cursor-arrow-rays" className="w-16 h-16 mx-auto mb-4" />
                                <p>Khung cảnh tham quan sẽ xuất hiện ở đây.</p>
                                <p className="text-sm">Vui lòng tải ảnh để bắt đầu.</p>
                            </div>
                        )}
                    </div>
                </Section>
            </div>
        </div>
        {isModalOpen && currentImage && (
            <FullscreenModal
                imageUrl={`data:${currentImage.mimeType};base64,${currentImage.base64}`}
                onClose={() => setIsModalOpen(false)}
            />
        )}
      </>
    );
};
