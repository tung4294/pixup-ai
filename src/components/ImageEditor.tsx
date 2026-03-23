import React, { useState, useRef } from 'react';
import { Icon } from './icons';
import type { SourceImage } from '../types';

export const ImageCompareSlider: React.FC<{ beforeImage: string | null; afterImage: string }> = ({ beforeImage, afterImage }) => {
    const [sliderPos, setSliderPos] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        setSliderPos((x / rect.width) * 100);
    };

    return (
        <div 
            ref={containerRef}
            className="relative w-full h-full overflow-hidden select-none cursor-ew-resize min-h-[300px]"
            onMouseMove={(e) => { if (e.buttons === 1) handleMove(e); }}
            onTouchMove={handleMove}
            onMouseDown={handleMove}
            onTouchStart={handleMove}
        >
            <img src={afterImage} alt="After" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
            
            {beforeImage && (
                <>
                    <img 
                        src={beforeImage} 
                        alt="Before" 
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none" 
                        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }} 
                    />
                    <div 
                        className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10"
                        style={{ left: `calc(${sliderPos}% - 0.125rem)` }}
                    >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg pointer-events-none">
                            <Icon name="arrows-right-left" className="w-5 h-5 text-gray-800" />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export const ImageViewerModal: React.FC<{ imageUrl: string; onClose: () => void }> = ({ imageUrl, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div className="relative max-w-full max-h-full">
                <button onClick={onClose} className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2"><Icon name="x-mark" className="w-8 h-8" /></button>
                <img src={imageUrl} alt="Fullscreen" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
            </div>
        </div>
    );
};

export const ImageEditor: React.FC<any> = ({ initialImage, onClearInitialImage, onEditComplete, historyItemToRestore, onHistoryRestored, onCreateVideoRequest }) => {
    return (
        <div className="flex flex-col items-center justify-center p-20 bg-[var(--bg-surface-2)] rounded-xl border border-[var(--border-2)] h-full">
            <Icon name="pencil-square" className="w-16 h-16 text-[var(--text-tertiary)] mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Trình Chỉnh Sửa Ảnh</h2>
            <p className="text-[var(--text-secondary)]">Khu vực này đang được hoàn thiện. Vui lòng tải file ImageEditor.tsx nếu bạn có code cập nhật.</p>
            {initialImage && (
                <div className="mt-6">
                    <img src={`data:${initialImage.mimeType};base64,${initialImage.base64}`} alt="Target" className="max-h-64 rounded-lg shadow" />
                </div>
            )}
        </div>
    );
};
