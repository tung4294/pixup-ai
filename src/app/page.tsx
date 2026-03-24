"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { RenderHistoryItem, SourceImage, EditHistoryItem, GeneratedPrompts, FinishBuildAnalysis, LandscapeAnalysis, PlanningAnalysis } from '../types';
import { generateImages, generateFloorplanImages, upscaleImage, FloorplanMode, InteriorMode, ExteriorMode, calculateCost, editImage, COST_LABELS, PRICING_RATES } from '../services/geminiService';
import { useSession, signIn, signOut } from "next-auth/react";
import { Icon } from '../components/icons';
import { TopUpModal } from '../components/TopUpModal';
import { ImageEditor, ImageCompareSlider, ImageViewerModal } from '../components/ImageEditor';
import { UtilitiesTab, MaskLayeredCanvas, MaskCanvasHandle, MaskEditorModal } from '../components/UtilitiesTab';
import { VirtualTourTab } from '../components/VirtualTourTab';

type RenderTab = 'exterior' | 'interior' | 'floorplan';
type AppTab = RenderTab | 'virtual_tour' | 'edit' | 'utilities' | 'library';
type MaskMode = 'keep' | 'edit';
type MaskTool = 'brush' | 'pen';
type MobileView = 'setup' | 'result';

interface RenderTabState {
  sourceImage: SourceImage | null;
  referenceImage: SourceImage | null;
  generatedImages: string[];
  selectedImageIndex: number;
}

interface LibraryItem {
    id: number;
    url: string;
    prompt: string;
    timestamp: string;
    type: string;
}

const initialTabState: RenderTabState = {
  sourceImage: null,
  referenceImage: null,
  generatedImages: [],
  selectedImageIndex: 0,
};

const TAB_LABELS: Record<string, string> = {
  exterior: 'NGOẠI THẤT',
  interior: 'NỘI THẤT',
  floorplan: 'MẶT BẰNG',
  virtual_tour: 'THAM QUAN ẢO',
  utilities: 'TIỆN ÍCH',
  library: 'THƯ VIỆN'
};

const STYLES_DATA = {
    interior: [
        { id: 'modern', label: 'Hiện Đại (Modern)', prompt: 'Modern style, clean lines, neutral colors, sleek furniture, natural light' },
        { id: 'neoclassic', label: 'Tân Cổ Điển', prompt: 'Neoclassical style, elegant wall moldings, sophisticated furniture, balanced symmetry, white and gold tones' },
        { id: 'indochine', label: 'Đông Dương', prompt: 'Indochine style, tropical timber, patterned cement tiles, rattan furniture, yellow and green accents, nostalgic vibe' },
        { id: 'luxury', label: 'Sang Trọng (Luxury)', prompt: 'High-end Luxury style, marble flooring, crystal chandeliers, premium leather, glossy surfaces, rich textures' },
        { id: 'japandi', label: 'Japandi (Zen)', prompt: 'Japandi style, blend of Japanese rustic and Scandinavian functionality, low profile furniture, natural materials, peaceful' },
        { id: 'scandinavian', label: 'Bắc Âu', prompt: 'Scandinavian style, light wood floors, white walls, cozy textiles, hygge atmosphere, functional' },
        { id: 'industrial', label: 'Công Nghiệp', prompt: 'Industrial style, exposed brick walls, concrete floors, black metal fixtures, raw wood, open ceiling' },
        { id: 'classic', label: 'Cổ Điển', prompt: 'Classical European style, ornate details, rich dark wood, heavy drapery, grand chandelier, timeless elegance' },
        { id: 'tropical', label: 'Nhiệt Đới', prompt: 'Tropical style, indoor plants, large leaves, wood and bamboo materials, airy and fresh atmosphere' },
        { id: 'art_deco', label: 'Art Deco', prompt: 'Art Deco style, geometric patterns, gold/brass accents, velvet textures, bold colors, luxurious and glamorous' },
        { id: 'wabi_sabi', label: 'Wabi Sabi', prompt: 'Wabi Sabi style, raw concrete, organic shapes, imperfection, earth tones, natural stone, rustic simplicity' },
    ],
    exterior: [
        { id: 'modern', label: 'Hiện Đại', prompt: 'Modern architecture, clean lines, glass facade, concrete textures, flat roof, minimalist landscape' },
        { id: 'neoclassic', label: 'Tân Cổ Điển', prompt: 'Neoclassical architecture, symmetric columns, intricate moldings, white paint, grand entrance, wrought iron details' },
        { id: 'mediterranean', label: 'Địa Trung Hải', prompt: 'Mediterranean style, terracotta roof tiles, white stucco walls, arched windows, warm tones, lush garden' },
        { id: 'indochine', label: 'Đông Dương', prompt: 'Indochine style, yellow walls, green shutters, tropical plants, tiled roof, colonial architecture blend' },
        { id: 'tropical', label: 'Nhiệt Đới', prompt: 'Modern Tropical architecture, abundant greenery, wood louvers, open spaces, integration with nature, large overhangs' },
        { id: 'thai_roof', label: 'Mái Thái', prompt: 'Thai roof style, pitched roof with multiple gables, decorative eaves, modern asian fusion' },
        { id: 'japandi', label: 'Nhật Bản', prompt: 'Japanese modern style, wood cladding, simple forms, zen garden, connection with nature, neutral palette' },
        { id: 'scandinavian', label: 'Bắc Âu', prompt: 'Scandinavian exterior, dark wood siding or black metal, gable roof, simple windows, cozy and functional' },
    ]
};

const ATTRIBUTES_DATA = {
    people: [
        { id: 'none', label: 'Không người', prompt: 'no people, architectural photography' },
        { id: 'minimal', label: 'Ít người (Xa)', prompt: 'minimal people in background, distant silhouette, architectural scale' },
        { id: 'couple', label: 'Cặp đôi', prompt: 'a romantic couple walking, lifestyle' },
        { id: 'family', label: 'Gia đình', prompt: 'happy family playing, children running, lively atmosphere' },
        { id: 'business', label: 'Doanh nhân', prompt: 'business people walking, professional atmosphere, suits' },
        { id: 'crowd', label: 'Đám đông', prompt: 'busy street, crowd of people, vibrant urban life' },
    ],
    vehicles: [
        { id: 'none', label: 'Không xe', prompt: 'no cars, clean street' },
        { id: 'luxury', label: 'Xe sang (Luxury)', prompt: 'luxury cars parked, Mercedes, Porsche, high-end lifestyle' },
        { id: 'street', label: 'Giao thông', prompt: 'moving traffic, motion blur cars, city life' },
        { id: 'bicycle', label: 'Xe đạp', prompt: 'bicycles parked, cycling path, eco-friendly vibe' },
        { id: 'scooter', label: 'Xe máy', prompt: 'scooters parked, vietnamese street vibe' },
    ],
    lighting: [
        { id: 'day', label: 'Tự nhiên (Ngày)', prompt: 'natural daylight, clear sunny, bright' },
        { id: 'golden', label: 'Giờ Vàng (Golden)', prompt: 'golden hour lighting, warm sun, long shadows, romantic sunset' },
        { id: 'blue', label: 'Giờ Xanh (Blue)', prompt: 'blue hour, twilight, interior lights on, cold ambient vs warm artificial' },
        { id: 'night', label: 'Ban đêm', prompt: 'night scene, dramatic artificial lighting, street lights, dark sky' },
        { id: 'overcast', label: 'Mây (Diffused)', prompt: 'overcast sky, soft diffused light, no harsh shadows, balanced exposure' },
        { id: 'cinematic', label: 'Cinematic', prompt: 'cinematic lighting, dramatic contrast, volumetric fog, moody' },
    ],
    weather: [
        { id: 'clear', label: 'Nắng đẹp', prompt: 'clear blue sky, sunny weather' },
        { id: 'cloudy', label: 'Nhiều mây', prompt: 'cloudy sky, dramatic clouds' },
        { id: 'rain', label: 'Mưa bay', prompt: 'light rain, wet ground reflections, rainy atmosphere' },
        { id: 'fog', label: 'Sương mù', prompt: 'foggy atmosphere, misty, dreamy' },
        { id: 'snow', label: 'Tuyết rơi', prompt: 'snowy weather, winter scene, white snow covering' },
    ]
};

const AccordionItem: React.FC<{
    title: string;
    icon: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    selectedCount?: number;
}> = ({ title, icon, isOpen, onToggle, children, selectedCount }) => {
    return (
        <div className="border border-[var(--border-2)] rounded-lg bg-[var(--bg-surface-3)] overflow-hidden transition-all duration-300">
            <button 
                onClick={onToggle}
                className={`w-full flex items-center justify-between p-3 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors ${isOpen ? 'bg-[var(--bg-surface-4)]' : ''}`}
            >
                <div className="flex items-center gap-2">
                    <Icon name={icon} className="w-4 h-4 text-[var(--text-secondary)]"/>
                    <span>{title}</span>
                    {selectedCount && selectedCount > 0 ? (
                        <span className="bg-[var(--bg-interactive)] text-white text-[10px] px-1.5 py-0.5 rounded-full">{selectedCount}</span>
                    ) : null}
                </div>
                <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} className="w-4 h-4 text-[var(--text-tertiary)]"/>
            </button>
            <div 
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
                <div className="p-3 bg-[var(--bg-surface-1)] border-t border-[var(--border-2)]">
                    {children}
                </div>
            </div>
        </div>
    );
};

const ResultDisplay: React.FC<{
  sourceImage: SourceImage | null;
  images: string[];
  isLoading: boolean;
  onUpscale: (index: number, target: '2k' | '4k') => void;
  upscalingIndex: number | null;
  onEditRequest: (image: string) => void;
  selectedImageIndex: number;
  onSelectImageIndex: (index: number) => void;
  onChangeAngle: (index: number) => void;
  onFullscreen: (index: number) => void;
  onCreateVideoRequest: (image: string) => void;
  showChangeAngleButton: boolean;
}> = ({ sourceImage, images, isLoading, onUpscale, upscalingIndex, onEditRequest, selectedImageIndex, onSelectImageIndex, onChangeAngle, onFullscreen, onCreateVideoRequest, showChangeAngleButton }) => {
  const selectedImage = images[selectedImageIndex];
  const sourceImageUrl = sourceImage ? `data:${sourceImage.mimeType};base64,${sourceImage.base64}` : null;

  return (
    <div className="bg-[var(--bg-surface-1)] backdrop-blur-lg border border-[var(--border-1)] shadow-2xl p-6 rounded-xl h-auto flex flex-col">
      <div className="relative z-10 flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            Kết Quả Render
            <span className="text-[10px] bg-gradient-to-r from-amber-500 to-orange-600 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">MODEL MỚI NHẤT</span>
        </h2>
        {images.length > 0 && <span className="text-sm text-[var(--text-secondary)]">{images.length} ảnh</span>}
      </div>

      <div className="relative z-10 flex-grow flex items-center justify-center bg-black/20 rounded-lg mb-4 min-h-[300px] md:min-h-[400px]">
        {isLoading ? (
          <div className="w-full h-full bg-[var(--bg-surface-2)] rounded-lg flex flex-col items-center justify-center relative overflow-hidden p-8">
             <div className="flex flex-col items-center justify-center space-y-6">
                <div className="relative w-24 h-24 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-t-4 border-r-4 border-amber-400 animate-spin" style={{ animationDuration: '1s' }}></div>
                    <div className="absolute inset-3 rounded-full border-b-4 border-l-4 border-teal-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                    <Icon name="sparkles" className="w-8 h-8 text-amber-400 animate-pulse" />
                </div>
                
                <div className="flex flex-col items-center gap-3">
                    <div className="text-[var(--text-accent)] font-bold text-lg tracking-wide uppercase animate-pulse">Đang Xử Lý Kết Xuất 3D...</div>
                    <div className="text-[var(--text-secondary)] text-sm flex flex-col items-center gap-1.5 opacity-80">
                        <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-ping"></div> Áp dụng vật liệu PBR & Chiếu sáng toàn cục...</span>
                        <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping delay-75"></div> Xây dựng lại cấu trúc hình học khối...</span>
                    </div>
                </div>
             </div>
          </div>
        ) : selectedImage ? (
          <div className="relative group w-full h-full flex items-center justify-center">
            <div className="absolute inset-0 flex items-center justify-center">
                {sourceImageUrl ? (
                    <ImageCompareSlider beforeImage={sourceImageUrl} afterImage={selectedImage} />
                ) : (
                    <img src={selectedImage} alt="Result" className="max-w-full max-h-full object-contain rounded-md" />
                )}
            </div>
            
            {upscalingIndex === selectedImageIndex && (
              <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center rounded-lg z-20 backdrop-blur-sm">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-400"></div>
                <p className="mt-3 font-semibold text-sm text-amber-400">Đang Nâng Cấp (Upscale)...</p>
              </div>
            )}
            
            {images.length > 1 && (
              <>
                <button
                  onClick={() => onSelectImageIndex(selectedImageIndex - 1)}
                  disabled={selectedImageIndex === 0}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-black/40 text-white rounded-full p-2 hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:cursor-not-allowed"
                >
                  <Icon name="chevron-left" className="w-6 h-6" />
                </button>
                <button
                  onClick={() => onSelectImageIndex(selectedImageIndex + 1)}
                  disabled={selectedImageIndex === images.length - 1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-black/40 text-white rounded-full p-2 hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:cursor-not-allowed"
                >
                  <Icon name="chevron-right" className="w-6 h-6" />
                </button>
              </>
            )}

            {upscalingIndex === null && (
              <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                <button onClick={() => onFullscreen(selectedImageIndex)} className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"><Icon name="arrows-expand" className="w-4 h-4" /><span>Phóng To</span></button>
                <button onClick={() => onEditRequest(selectedImage)} className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"><Icon name="pencil" className="w-4 h-4" /><span>Sửa</span></button>
                <button onClick={() => onCreateVideoRequest(selectedImage)} className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"><Icon name="film" className="w-4 h-4" /><span>Tạo Video</span></button>
                {showChangeAngleButton && (<button onClick={() => onChangeAngle(selectedImageIndex)} className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"><Icon name="viewfinder" className="w-4 h-4" /><span>Đổi Góc Chụp</span></button>)}
                <a href={selectedImage} download={`WGD-ai-render-${Date.now()}.png`} className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"><Icon name="download" className="w-4 h-4" /><span>Tải</span></a>
              </div>
            )}

            {upscalingIndex === null && (
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                <span className="text-[10px] text-white bg-black/50 px-2 py-1 rounded mr-1">{COST_LABELS.UPSCALE}</span>
                <button
                  onClick={() => onUpscale(selectedImageIndex, '2k')}
                  className="bg-indigo-600/90 backdrop-blur-sm border border-indigo-400 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1.5 rounded-md transition-colors shadow-lg"
                >
                  Nâng Cấp 2x
                </button>
                <button
                  onClick={() => onUpscale(selectedImageIndex, '4k')}
                  className="bg-purple-600/90 backdrop-blur-sm border border-purple-400 hover:bg-purple-500 text-white font-bold text-xs px-3 py-1.5 rounded-md transition-colors shadow-lg"
                >
                  Nâng Cấp 4x
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-[var(--text-tertiary)]">
            <p>Hình ảnh được tạo sẽ xuất hiện ở đây.</p>
          </div>
        )}
      </div>

      <div className="relative z-10 font-bold grid gap-3 grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="aspect-square bg-[var(--bg-surface-2)] rounded-lg animate-pulse flex items-center justify-center">
                <Icon name="photo" className="w-6 h-6 text-[var(--text-tertiary)] opacity-20" />
            </div>
          ))
        ) : (
          images.map((image, index) => (
            <div
              key={index}
              className={`relative group aspect-square bg-[var(--bg-surface-2)] rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${selectedImageIndex === index ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-surface-1)] ring-[var(--ring-active)]' : 'opacity-70 hover:opacity-100'}`}
              onClick={() => onSelectImageIndex(index)}
            >
              <img src={image} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const UpscaleModal: React.FC<{ imageUrl: string; onClose: () => void; }> = ({ imageUrl, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-surface-4)]/80 backdrop-blur-lg border border-[var(--border-1)] rounded-xl shadow-2xl max-w-4xl max-h-[90vh] flex flex-col relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-4 -right-4 bg-[var(--bg-interactive)] text-white rounded-full p-2 hover:bg-[var(--bg-interactive-hover)] transition-transform duration-200 hover:scale-110 z-10"><Icon name="x-mark" className="w-6 h-6" /></button>
        <div className="p-4 overflow-auto"><img src={imageUrl} alt="Upscaled result" className="w-full h-auto object-contain rounded-md" /></div>
        <div className="p-4 border-t border-[var(--border-2)] flex justify-center">
          <a href={imageUrl} download={`WGD-ai-upscaled-${Date.now()}.png`} className="bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-6 rounded transition-colors flex items-center justify-center gap-2"><Icon name="download" className="w-5 h-5" />Tải Về Ảnh Nâng Cấp (Chất Lượng Cao)</a>
        </div>
      </div>
    </div>
  );
};

const TabButton: React.FC<{ label: string; icon: string; isActive: boolean; onClick: () => void; }> = ({ label, icon, isActive, onClick }) => {
  return (
    <button 
        onClick={onClick} 
        className={`
            relative px-5 py-2.5 mx-1 text-sm font-bold tracking-wide uppercase transition-all duration-300 rounded-full
            flex items-center gap-2 overflow-hidden flex-shrink-0
            ${isActive 
                ? 'bg-[var(--bg-interactive)] text-white shadow-[0_0_15px_rgba(251,191,36,0.3)] active-tab-glow transform scale-105' 
                : 'bg-transparent text-[var(--text-secondary)] hover:text-white hover:bg-white/5'
            }
        `}
    >
        {isActive && <div className="absolute inset-0 shimmer-btn opacity-30 pointer-events-none"></div>}
        <Icon name={icon} className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-slate-500'}`} />
        <span className={`${isActive ? 'text-glow' : ''} whitespace-nowrap hidden md:inline-block`}>{label}</span>
    </button>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (<div className="bg-[var(--bg-surface-1)] backdrop-blur-lg border border-[var(--border-1)] shadow-2xl shadow-[var(--shadow-color)] p-6 rounded-xl"><h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{title}</h2>{children}</div>);

const ImageUpload: React.FC<{
  sourceImage: SourceImage | null;
  onImageUpload: (image: SourceImage) => void;
  onRemove: () => void;
  resetKey?: number; // Added to force reset
}> = ({ sourceImage, onImageUpload, onRemove, resetKey }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // When resetKey changes, clear the input value
  useEffect(() => {
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  }, [resetKey]);

  return (
    <div 
        className="p-4 border-2 border-dashed border-[var(--border-2)] rounded-lg text-center cursor-pointer hover:border-[var(--border-interactive)] hover:bg-[var(--bg-surface-2)] transition-colors"
        onClick={() => fileInputRef.current?.click()}
    >
      {sourceImage ? (
          <div className="relative inline-block">
             <img src={`data:${sourceImage.mimeType};base64,${sourceImage.base64}`} className="max-h-48 mx-auto rounded-md shadow-sm"/>
             <button 
                onClick={(e) => {e.stopPropagation(); onRemove()}} 
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                title="Xóa ảnh"
             >
                <Icon name="x-mark" className="w-4 h-4"/>
             </button>
          </div>
      ) : (
          <div className="flex flex-col items-center justify-center py-8 text-[var(--text-secondary)]">
             <Icon name="photo" className="w-12 h-12 mb-2 opacity-50"/>
             <span className="font-medium">Nhấn để tải ảnh lên</span>
             <span className="text-xs text-[var(--text-tertiary)] mt-1">Hỗ trợ JPG, PNG, WEBP</span>
          </div>
      )}
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef}
        accept="image/*"
        onChange={(e) => { 
            if(e.target.files?.[0]) { 
                const file = e.target.files[0];
                const reader = new FileReader(); 
                reader.onload = (ev) => onImageUpload({base64: (ev.target?.result as string).split(',')[1], mimeType: file.type}); 
                reader.readAsDataURL(file); 
            } 
        }} 
      />
    </div>
  ); 
};

const ReferenceImageUpload: React.FC<{
  image: SourceImage | null;
  onUpload: (image: SourceImage) => void;
  onRemove: () => void;
  resetKey?: number;
}> = ({ image, onUpload, onRemove, resetKey }) => {
   const fileInputRef = useRef<HTMLInputElement>(null);
   useEffect(() => { if(fileInputRef.current) fileInputRef.current.value = ''; }, [resetKey]);

   return (
    <div 
        className="p-3 border-2 border-dashed border-[var(--border-2)] rounded-lg text-center cursor-pointer hover:border-[var(--border-interactive)] hover:bg-[var(--bg-surface-2)] transition-colors mb-4"
        onClick={() => fileInputRef.current?.click()}
    >
      {image ? (
        <div className="relative inline-block">
            <img src={`data:${image.mimeType};base64,${image.base64}`} className="max-h-32 mx-auto rounded-md"/>
             <button onClick={(e) => {e.stopPropagation(); onRemove()}} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"><Icon name="x-mark" className="w-3 h-3"/></button>
        </div>
      ) : (
          <div className="flex flex-col items-center justify-center py-4 text-[var(--text-secondary)]"><Icon name="photo" className="w-8 h-8 mb-1 opacity-50"/><span className="text-sm font-medium">Thêm ảnh mẫu (Style Ref)</span></div>
      )}
      <input type="file" className="hidden" ref={fileInputRef} accept="image/*" onChange={(e) => { if(e.target.files?.[0]) { const file = e.target.files[0]; const reader = new FileReader(); reader.onload = (ev) => onUpload({base64: (ev.target?.result as string).split(',')[1], mimeType: file.type}); reader.readAsDataURL(file); } }} />
    </div>
   );
};

const PixupLogo: React.FC<{ sizeClassName?: string, showText?: boolean, textClassName?: string, noRotate?: boolean }> = ({ sizeClassName = "w-10 h-10", showText = true, textClassName = "text-xl", noRotate = false }) => (
    <div className={`flex items-center ${showText ? 'gap-3' : ''}`}>
        <div className={`relative flex-shrink-0 ${sizeClassName}`} style={{ containerType: 'size' } as any}>
             <div className={`absolute inset-0 bg-gradient-to-br from-orange-500 to-amber-600 rounded-[22%] ${noRotate ? '' : 'transform rotate-3'} transition-transform shadow-xl shadow-orange-500/20 border border-white/10`}></div>
             <div className="absolute inset-0 bg-slate-950 m-[2px] rounded-[20%] flex items-center justify-center overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/5 to-transparent"></div>
                 <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400 leading-none select-none tracking-tighter" style={{fontFamily: "'Montserrat', sans-serif", fontSize: '40cqw'}}>PIX</span>
             </div>
        </div>
        {showText && (
            <div className="flex flex-col">
                <h1 className={`${textClassName} font-bold tracking-tight text-white leading-none font-montserrat`}>Pixup <span className="text-orange-400 font-light">AI</span></h1>
                <p className="text-[10px] text-slate-400 tracking-widest uppercase">Kiến Trúc Vô Hạn</p>
            </div>
        )}
    </div>
);

// ApiKeyModal removed in favor of Server-side API key management

const LibraryTab: React.FC<{
    library: LibraryItem[];
    onSelect: (item: LibraryItem) => void;
}> = ({ library, onSelect }) => {
    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-4 pb-20">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Icon name="bookmark" className="w-6 h-6 text-amber-400"/> Thư Viện Của Bạn
                <span className="text-sm font-normal text-slate-400 ml-2">({library.length} ảnh)</span>
            </h2>
            
            {library.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
                    <Icon name="photo" className="w-12 h-12 mb-2 opacity-50"/>
                    <p>Chưa có ảnh nào được tạo.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {library.map((item) => (
                        <div key={item.id} className="group relative bg-[var(--bg-surface-2)] rounded-lg overflow-hidden border border-[var(--border-2)] hover:border-amber-400 transition-all">
                             <img 
                                src={item.url} 
                                alt={item.prompt} 
                                className="w-full aspect-square object-cover cursor-pointer"
                                onClick={() => onSelect(item)}
                             />
                             <div className="absolute inset-x-0 bottom-0 bg-black/80 p-2 transform translate-y-full group-hover:translate-y-0 transition-transform">
                                <p className="text-[10px] text-slate-300 line-clamp-2">{item.prompt || "Không có mô tả"}</p>
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-[9px] text-amber-400 uppercase">{item.type}</span>
                                    <a href={item.url} download={`library-${item.id}.png`} onClick={(e) => e.stopPropagation()} className="text-white hover:text-amber-400"><Icon name="download" className="w-3 h-3"/></a>
                                </div>
                             </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function App() {
  const { data: session, status } = useSession();
  const [showApp, setShowApp] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('exterior');
  
  // TRACKING STATE
  const [sessionCost, setSessionCost] = useState(0);
  const [sessionTokens, setSessionTokens] = useState(0);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  
  const [showTopUp, setShowTopUp] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('setup');

  const [imageForEditing, setImageForEditing] = useState<SourceImage | null>(null);
  const [editHistoryItemToRestore, setEditHistoryItemToRestore] = useState<EditHistoryItem | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const [tabStates, setTabStates] = useState<Record<RenderTab, RenderTabState>>({
    exterior: { ...initialTabState },
    interior: { ...initialTabState },
    floorplan: { ...initialTabState },
  });

  // Automatically show app on load
  useEffect(() => {
    setShowApp(true);
  }, []);

  const isRenderTab = (tab: string): tab is RenderTab => ['exterior', 'interior', 'floorplan'].includes(tab as RenderTab);
  
  const updateActiveTabState = (update: Partial<RenderTabState>) => {
    if (isRenderTab(activeTab)) {
      setTabStates(prev => ({ ...prev, [activeTab]: { ...prev[activeTab], ...update } }));
    }
  };

  const activeTabState = isRenderTab(activeTab) ? tabStates[activeTab] : initialTabState;
  const { sourceImage, referenceImage, generatedImages, selectedImageIndex } = activeTabState;
  const setSourceImage = (img: SourceImage | null) => updateActiveTabState({ sourceImage: img });
  const setReferenceImage = (img: SourceImage | null) => updateActiveTabState({ referenceImage: img });
  const setGeneratedImages = (imgs: string[]) => updateActiveTabState({ generatedImages: imgs });
  const setSelectedImageIndex = (idx: number) => updateActiveTabState({ selectedImageIndex: idx });
  
  const [numImages, setNumImages] = useState(2);
  const [aspectRatio, setAspectRatio] = useState('Auto');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');

  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedPeople, setSelectedPeople] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedLighting, setSelectedLighting] = useState<string | null>(null);
  const [selectedWeather, setSelectedWeather] = useState<string | null>(null);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const [exteriorCustomPrompt, setExteriorCustomPrompt] = useState('');
  const [interiorPrompt, setInteriorPrompt] = useState('');
  const [floorplanPrompt, setFloorplanPrompt] = useState('');

  const [exteriorMode, setExteriorMode] = useState<ExteriorMode>('creative');
  const [exteriorBrushSize, setExteriorBrushSize] = useState(40);
  const [exteriorMaskMode, setExteriorMaskMode] = useState<MaskMode>('keep');
  const [exteriorTool, setExteriorTool] = useState<MaskTool>('brush');
  const exteriorMaskRef = useRef<MaskCanvasHandle>(null);

  const [interiorMode, setInteriorMode] = useState<InteriorMode>('creative');
  const [interiorBrushSize, setInteriorBrushSize] = useState(40);
  const [interiorMaskMode, setInteriorMaskMode] = useState<MaskMode>('keep');
  const [interiorTool, setInteriorTool] = useState<MaskTool>('brush');
  const interiorMaskRef = useRef<MaskCanvasHandle>(null);
  
  const [isMaskEditorOpen, setIsMaskEditorOpen] = useState(false);
  const [floorplanMode, setFloorplanMode] = useState<FloorplanMode>('realistic');

  const [exteriorHistory, setExteriorHistory] = useState<RenderHistoryItem[]>([]);
  const [interiorHistory, setInteriorHistory] = useState<RenderHistoryItem[]>([]);
  const [floorplanHistory, setFloorplanHistory] = useState<RenderHistoryItem[]>([]);
  const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([]);
  const [utilitiesHistory, setUtilitiesHistory] = useState<RenderHistoryItem[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [upscalingIndex, setUpscalingIndex] = useState<number | null>(null);
  const [upscaledImageForModal, setUpscaledImageForModal] = useState<string | null>(null);
  const [fullscreenState, setFullscreenState] = useState<{ images: string[]; startIndex: number } | null>(null);
  
  const [initialUtility, setInitialUtility] = useState<string | null>(null);
  
  const [promptFinderImage, setPromptFinderImage] = useState<SourceImage | null>(null);
  const [promptFinderPrompts, setPromptFinderPrompts] = useState<GeneratedPrompts | null>(null);
  const [finishMyBuildImage, setFinishMyBuildImage] = useState<SourceImage | null>(null);
  const [finishMyBuildPrompts, setFinishMyBuildPrompts] = useState<FinishBuildAnalysis | null>(null);
  const [finishInteriorImage, setFinishInteriorImage] = useState<SourceImage | null>(null);
  const [finishInteriorPrompts, setFinishInteriorPrompts] = useState<string[] | null>(null);
  const [upscaleUtilityImage, setUpscaleUtilityImage] = useState<SourceImage | null>(null);
  const [landscapeUtilityImage, setLandscapeUtilityImage] = useState<SourceImage | null>(null);
  const [landscapeUtilityPrompts, setLandscapeUtilityPrompts] = useState<LandscapeAnalysis | null>(null);
  const [planningUtilityImage, setPlanningUtilityImage] = useState<SourceImage | null>(null);
  const [planningUtilityPrompts, setPlanningUtilityPrompts] = useState<PlanningAnalysis | null>(null);

  const [estimatedCost, setEstimatedCost] = useState({ tokens: 0, cost: 0 });

  useEffect(() => {
      setSelectedStyle(null);
      setSelectedPeople(null);
      setSelectedVehicle(null);
      setSelectedLighting(null);
      setSelectedWeather(null);
      setOpenAccordion(null);
      setMobileView('setup');
  }, [activeTab]);

  const getCombinedPrompt = () => {
      let basePrompt = '';
      if (activeTab === 'exterior') basePrompt = exteriorCustomPrompt;
      else if (activeTab === 'interior') basePrompt = interiorPrompt;
      else if (activeTab === 'floorplan') basePrompt = floorplanPrompt;

      const attributes = [
          selectedStyle ? `Style: ${selectedStyle}` : '',
          selectedPeople ? `People: ${selectedPeople}` : '',
          selectedVehicle ? `Vehicles: ${selectedVehicle}` : '',
          selectedLighting ? `Lighting: ${selectedLighting}` : '',
          selectedWeather ? `Weather: ${selectedWeather}` : '',
      ].filter(Boolean).join(', ');

      return basePrompt + (basePrompt && attributes ? ', ' : '') + attributes;
  };

  useEffect(() => {
     let prompt = getCombinedPrompt();
     let hasInput = false;
     
     if(activeTab === 'exterior') {
         hasInput = !!tabStates.exterior.sourceImage;
     } else if(activeTab === 'interior') {
         hasInput = !!tabStates.interior.sourceImage;
     } else if(activeTab === 'floorplan') {
         hasInput = !!tabStates.floorplan.sourceImage;
     }

     const calculation = calculateCost(
        prompt,
        numImages,
        hasInput,
        imageSize
     );
     setEstimatedCost(calculation);
  }, [activeTab, exteriorCustomPrompt, interiorPrompt, floorplanPrompt, numImages, tabStates, selectedStyle, selectedPeople, selectedVehicle, selectedLighting, selectedWeather, imageSize]);

  const handleTrackUsage = useCallback((cost: number, tokens: number) => {
      setSessionCost(prev => prev + cost);
      setSessionTokens(prev => prev + tokens);
  }, []);
  
  const addToLibrary = useCallback((url: string, prompt: string, type: string) => {
      setLibrary(prev => [{
          id: Date.now() + Math.random(),
          url,
          prompt,
          timestamp: new Date().toLocaleString(),
          type
      }, ...prev]);
  }, []);

  const handleLoginClick = async () => {
      if (session) signOut();
      else signIn('google');
  };

  const handleReset = () => {
      if (window.confirm("🗑️ BẠN MUỐN TẠO DỰ ÁN MỚI?\n\nHành động này sẽ xóa toàn bộ ảnh, mô tả và kết quả hiện tại để bắt đầu lại từ đầu.")) {
          try {
             exteriorMaskRef.current?.clear();
             interiorMaskRef.current?.clear();
          } catch(e) {}

          setTabStates({
            exterior: { ...initialTabState },
            interior: { ...initialTabState },
            floorplan: { ...initialTabState },
          });
          
          setExteriorCustomPrompt('');
          setInteriorPrompt('');
          setFloorplanPrompt('');
          
          setSelectedStyle(null);
          setSelectedPeople(null);
          setSelectedVehicle(null);
          setSelectedLighting(null);
          setSelectedWeather(null);
          setOpenAccordion(null);
          
          setNumImages(2);
          setImageSize('1K');
          
          setExteriorMode('creative');
          setInteriorMode('creative');
          setFloorplanMode('realistic');
          
          setExteriorHistory([]);
          setInteriorHistory([]);
          setFloorplanHistory([]);
          setEditHistory([]);
          setUtilitiesHistory([]);
          
          setPromptFinderImage(null);
          setPromptFinderPrompts(null);
          setFinishMyBuildImage(null);
          setFinishMyBuildPrompts(null);
          setFinishInteriorImage(null);
          setFinishInteriorPrompts(null);
          setUpscaleUtilityImage(null);
          setLandscapeUtilityImage(null);
          setLandscapeUtilityPrompts(null);
          setPlanningUtilityImage(null);
          setPlanningUtilityPrompts(null);
          
          setInitialUtility(null);
          setImageForEditing(null);
          
          setSessionCost(0);
          setSessionTokens(0);
          
          setMobileView('setup');
          setResetKey(prev => prev + 1); 
          
          setActiveTab('exterior');
      }
  };

  const handleGeneration = useCallback(async (promptInput: string, renderType: 'exterior' | 'interior' | 'floorplan', isAnglePrompt: boolean, overrideSourceImage?: SourceImage | null) => {
    const fullPrompt = promptInput || getCombinedPrompt();
    // Prioritize passed image over state image for immediate rendering from utilities
    const currentSourceImage = overrideSourceImage !== undefined ? overrideSourceImage : tabStates[renderType].sourceImage;

    if (!currentSourceImage && !fullPrompt) { alert("Vui lòng nhập mô tả hoặc tải ảnh."); return; }
    
    setMobileView('result');

    if ((renderType === 'interior' && interiorMode === 'partial_redesign') || (renderType === 'exterior' && exteriorMode === 'partial_redesign')) {
        const maskRef = renderType === 'interior' ? interiorMaskRef.current : exteriorMaskRef.current;
        const canvas = maskRef?.getCanvas();
        if (!canvas) { alert("Vui lòng tải ảnh và tô vùng bạn muốn GIỮ LẠI (Khóa)."); return; }
        if (!currentSourceImage) { alert("Chế độ này yêu cầu ảnh đầu vào."); return; }
        
        setIsLoading(true);
        // We set tab-specific state via setter aliases if it matches activeTab, but here we update tabStates manually to be safer
        setTabStates(prev => ({ ...prev, [renderType]: { ...prev[renderType], generatedImages: [], selectedImageIndex: 0 } }));

        try {
            const currentMaskMode = renderType === 'interior' ? interiorMaskMode : exteriorMaskMode;

            const finalMaskCanvas = document.createElement('canvas');
            finalMaskCanvas.width = canvas.width;
            finalMaskCanvas.height = canvas.height;
            const ctx = finalMaskCanvas.getContext('2d')!;
            
            ctx.drawImage(canvas, 0, 0);
            ctx.globalCompositeOperation = 'source-in';
            if (currentMaskMode === 'edit') {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, finalMaskCanvas.width, finalMaskCanvas.height);
                ctx.globalCompositeOperation = 'destination-over';
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, finalMaskCanvas.width, finalMaskCanvas.height);
            } else {
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, finalMaskCanvas.width, finalMaskCanvas.height);
                ctx.globalCompositeOperation = 'destination-over';
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, finalMaskCanvas.width, finalMaskCanvas.height);
            }
            
            const maskBase64 = finalMaskCanvas.toDataURL('image/png').split(',')[1];
            const maskImage = { base64: maskBase64, mimeType: 'image/png' };

            const editPromises = Array(numImages).fill(0).map(() => editImage(currentSourceImage, maskImage, fullPrompt));
            const results = await Promise.allSettled(editPromises);
            const successfulImages = results
                .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
                .map(r => r.value);

            if (successfulImages.length === 0 && results.length > 0) {
                 throw new Error("Generation failed.");
            }
            
            setTabStates(prev => ({ ...prev, [renderType]: { ...prev[renderType], generatedImages: successfulImages } }));
            successfulImages.forEach(img => addToLibrary(img, fullPrompt, `Inpaint ${renderType}`));
            
            const calculation = calculateCost(fullPrompt, successfulImages.length, true, imageSize);
            handleTrackUsage(calculation.cost, calculation.tokens);

        } catch (error: any) {
            console.error("Partial redesign failed:", error);
            if (error.message?.includes("API_KEY_MISSING")) alert("Vui lòng đăng nhập.");
            else alert(`Lỗi: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
        return;
    }

    setIsLoading(true);
    setTabStates(prev => ({ ...prev, [renderType]: { ...prev[renderType], generatedImages: [], selectedImageIndex: 0 } }));

    try {
      let results: string[];
      
      if (renderType === 'floorplan' && currentSourceImage) {
        // Use dedicated floorplan pipeline with mode-specific prompts
        results = await generateFloorplanImages(
          fullPrompt,
          currentSourceImage,
          floorplanMode,
          {
            numImages: numImages,
            imageSize: imageSize
          }
        );
      } else {
        results = await generateImages(
          fullPrompt,
          currentSourceImage, 
          {
            aspectRatio: aspectRatio,
            numImages: numImages,
            imageSize: imageSize
          }
        );
      }
      
      if (results.length === 0) {
          throw new Error("Không tạo được ảnh nào. Vui lòng thử lại.");
      }

      setTabStates(prev => ({ ...prev, [renderType]: { ...prev[renderType], generatedImages: results } }));
      results.forEach(img => addToLibrary(img, fullPrompt, renderType));

      const newItem: RenderHistoryItem = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        images: results,
        prompt: fullPrompt,
      };

      if (renderType === 'exterior') setExteriorHistory(prev => [newItem, ...prev]);
      else if (renderType === 'interior') setInteriorHistory(prev => [newItem, ...prev]);
      else setFloorplanHistory(prev => [newItem, ...prev]);

      const calculation = calculateCost(fullPrompt, results.length, !!currentSourceImage, imageSize);
      handleTrackUsage(calculation.cost, calculation.tokens);

    } catch (error: any) {
      console.error("Generation failed:", error);
       if (error.message?.includes("API_KEY_MISSING")) alert("Vui lòng đăng nhập.");
       else alert(`Đã xảy ra lỗi: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, getCombinedPrompt, tabStates, interiorMode, exteriorMode, interiorMaskMode, exteriorMaskMode, numImages, imageSize, aspectRatio, floorplanMode, addToLibrary, handleTrackUsage]);

  const handleStartNewRenderFlowFromUtility = (prompt: string, sourceImg: SourceImage | null) => {
    setExteriorCustomPrompt(prompt);
    // Explicitly update tab state first
    setTabStates(prev => ({
        ...prev,
        exterior: {
            ...prev.exterior,
            sourceImage: sourceImg || prev.exterior.sourceImage,
            generatedImages: [],
            selectedImageIndex: 0
        }
    }));
    setActiveTab('exterior');
    // Trigger generation with the passed image directly to bypass async state delay
    handleGeneration(prompt, 'exterior', false, sourceImg);
  };

  const toggleAccordion = (id: string) => {
      setOpenAccordion(openAccordion === id ? null : id);
  }

  const renderAttributeGrid = (data: any[], selectedId: string | null, onSelect: (prompt: string | null) => void) => (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {data.map(item => (
              <button
                  key={item.id}
                  onClick={() => onSelect(selectedId === item.prompt ? null : item.prompt)}
                  className={`p-2 text-xs rounded border transition-all ${selectedId === item.prompt ? 'bg-[var(--bg-interactive)] border-transparent text-white shadow-md' : 'bg-[var(--bg-surface-2)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface-4)]'}`}
              >
                  {item.label}
              </button>
          ))}
      </div>
  );

  return (
    <>
      {!showApp ? (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center relative overflow-hidden bg-slate-950">
            {/* Decorative background elements */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80')] bg-cover bg-center opacity-10 z-0"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-500/10 blur-[120px] rounded-full z-0 animate-pulse"></div>

            <div className="relative z-10 flex flex-col items-center max-w-2xl w-full">
              {/* Animated Hero Logo */}
              <div className="mb-10 relative">
                  <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
                  <PixupLogo sizeClassName="w-32 h-32 md:w-40 md:h-40" showText={false} noRotate={true} />
              </div>

              <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight text-white font-montserrat drop-shadow-2xl">
                  Pixup <span className="text-transparent bg-clip-text bg-gradient-to-br from-orange-400 via-amber-500 to-orange-600">AI</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-slate-300 mb-12 font-light tracking-wide max-w-lg leading-relaxed">
                  Nâng tầm không gian sống với <span className="text-orange-400 font-semibold">Trí tuệ nhân tạo</span> chuyên sâu về kiến trúc
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                  <button 
                      onClick={() => setShowApp(true)} 
                      className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-black py-5 px-8 rounded-2xl shadow-[0_10px_40px_-10px_rgba(249,115,22,0.5)] hover:shadow-[0_15px_50px_-10px_rgba(249,115,22,0.6)] transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3 text-xl group"
                  >
                    <Icon name="sparkles" className="w-6 h-6 group-hover:rotate-12 transition-transform" /> 
                    Bắt đầu ngay
                  </button>
                  <button 
                      onClick={() => window.open('https://facebook.com/pixupai', '_blank')} 
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold py-5 px-8 rounded-2xl backdrop-blur-md transition-all flex items-center justify-center gap-3 text-lg hover:border-white/20"
                  >
                    <Icon name="chat-bubble" className="w-5 h-5 text-orange-400" /> Cộng đồng Community
                  </button>
              </div>
              
              {/* Trust Badges / Stats */}
              <div className="mt-16 flex items-center gap-8 text-slate-500 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
                  <div className="flex flex-col items-center">
                      <span className="text-xl font-bold text-white">1k+</span>
                      <span className="text-[10px] uppercase tracking-widest">Kiến trúc sư</span>
                  </div>
                  <div className="w-px h-8 bg-slate-800"></div>
                  <div className="flex flex-col items-center">
                      <span className="text-xl font-bold text-white">50k+</span>
                      <span className="text-[10px] uppercase tracking-widest">Ảnh đã tạo</span>
                  </div>
                  <div className="w-px h-8 bg-slate-800"></div>
                  <div className="flex flex-col items-center">
                      <span className="text-xl font-bold text-white">4.9/5</span>
                      <span className="text-[10px] uppercase tracking-widest">Đánh giá</span>
                  </div>
              </div>
              
              <p className="mt-12 text-xs text-slate-600 font-medium tracking-widest uppercase">© 2025 Pixup AI. Premium Architectural Solutions.</p>
            </div>
        </div>
      ) : (
        <div className="flex flex-col h-screen overflow-hidden">
          <header className="flex-shrink-0 bg-[var(--bg-surface-4)]/80 backdrop-blur-md border-b border-[var(--border-1)] z-30">
             <div className="max-w-[1920px] mx-auto px-3 py-2 md:px-4 md:py-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center justify-between w-full md:w-auto">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setShowApp(false)} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="Về Trang Chủ"><Icon name="home" className="w-6 h-6"/></button>
                            <PixupLogo sizeClassName="w-8 h-8" />
                        </div>
                         <div className="flex items-center gap-2 md:hidden">
                            <button onClick={() => setShowTopUp(true)} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white px-3 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-orange-500/20">
                                <Icon name="credit-card" className="w-4 h-4"/> Nạp
                            </button>
                            <div className="bg-black/40 px-3 py-1.5 rounded-full border border-white/10 flex flex-col items-end leading-none">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Credits</span>
                                <span className="text-amber-400 font-mono font-bold text-xs">💎 {(session?.user as any)?.credits ?? 0}</span>
                            </div>
                         </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">
                         <div className="hidden md:flex items-center gap-2">
                             <div onClick={() => setShowTopUp(true)} className="flex items-center bg-black/40 px-4 py-2 rounded-full border border-white/10 cursor-pointer hover:border-orange-500/50 transition-colors group">
                                 <div className="flex flex-col items-end leading-tight mr-3">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Pixup AI</span>
                                    <span className="text-amber-400 font-mono font-bold text-sm">Credits</span>
                                 </div>
                                 <div className="w-px h-6 bg-white/10 mr-3"></div>
                                 <div className="flex items-center gap-2 leading-tight">
                                    <span className="text-cyan-400 text-lg">💎</span>
                                    <span className="text-white font-mono font-bold text-lg">{(session?.user as any)?.credits ?? 0}</span>
                                 </div>
                             </div>
                             <button onClick={() => setShowTopUp(true)} className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white px-4 py-2.5 rounded-full font-black text-xs flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all hover:shadow-orange-500/40 uppercase tracking-wider">
                                 <Icon name="credit-card" className="w-4 h-4"/> Nạp Credit
                             </button>
                         </div>
                        
                        <button onClick={handleReset} className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/30" title="Tạo Dự Án Mới (Làm Mới)">
                            <Icon name="arrow-path" className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500"/>
                            <span className="font-bold text-xs uppercase tracking-wide hidden md:inline-block">Tạo Mới</span>
                        </button>

                        {session ? (
                            <button onClick={handleLoginClick} className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all border border-blue-500/30" title="Đăng xuất">
                                <span className="font-bold text-xs uppercase tracking-wide hidden md:inline-block">Đăng Xuất</span>
                                <Icon name="arrow-right-on-rectangle" className="w-4 h-4"/>
                            </button>
                        ) : (
                             <button onClick={handleLoginClick} className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg" title="Đăng nhập bằng Google">
                                <Icon name="user-circle" className="w-5 h-5"/>
                                <span className="font-bold text-xs uppercase tracking-wide hidden md:inline-block">Đăng Nhập</span>
                            </button>
                        )}
                    </div>
                </div>
             </div>
          </header>

           <nav className="flex-shrink-0 glass-nav-bar z-20">
             <div className="max-w-[1920px] mx-auto px-1 md:px-2">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2 px-2 mask-linear-fade">
                    {Object.entries(TAB_LABELS).map(([key, label]) => {
                        let iconName = 'home';
                        if (key === 'interior') iconName = 'photo';
                        if (key === 'floorplan') iconName = 'cube';
                        if (key === 'virtual_tour') iconName = 'viewfinder';
                        if (key === 'edit') iconName = 'pencil';
                        if (key === 'utilities') iconName = 'sparkles';
                        if (key === 'library') iconName = 'bookmark';
                        
                        if (key === 'edit') return null; 
                        
                        return (
                            <TabButton key={key} label={label} icon={iconName} isActive={activeTab === key} onClick={() => setActiveTab(key as AppTab)} />
                        );
                    })}
                </div>
             </div>
          </nav>

          <main className="flex-grow overflow-hidden bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-5 relative">
             <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-slate-900/50 to-purple-900/10 pointer-events-none"></div>
             
             {activeTab === 'edit' && (
                <div className="absolute inset-0 z-50 bg-[var(--bg-gradient-start)] p-4 overflow-auto">
                    <div className="max-w-[1920px] mx-auto h-full">
                         <div className="flex items-center gap-4 mb-4">
                            <button onClick={() => setActiveTab('exterior')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"><Icon name="chevron-left" className="w-5 h-5"/> Quay Lại</button>
                            <h1 className="text-xl font-bold text-white">Chỉnh Sửa Chi Tiết</h1>
                         </div>
                        <ImageEditor 
                            initialImage={imageForEditing} 
                            onClearInitialImage={() => setImageForEditing(null)} 
                            onEditComplete={(item: any) => {
                                const historyItem: EditHistoryItem = { id: Date.now(), timestamp: new Date().toLocaleString(), ...item };
                                setEditHistory(prev => [historyItem, ...prev]);
                                addToLibrary(item.resultImage, item.prompt, "Manual Edit");
                            }}
                            historyItemToRestore={editHistoryItemToRestore}
                            onHistoryRestored={() => setEditHistoryItemToRestore(null)}
                            onCreateVideoRequest={(url: string) => {
                                 alert("Chức năng tạo video đã được ẩn.");
                            }}
                        />
                    </div>
                </div>
             )}
             
             <div className={`h-full overflow-auto p-4 custom-scrollbar ${activeTab === 'edit' ? 'hidden' : ''}`}>
                 <div className="max-w-[1920px] mx-auto h-full flex flex-col">
                    
                    {activeTab === 'library' ? (
                        <LibraryTab 
                            library={library} 
                            onSelect={(item) => {
                                const src = { base64: item.url.split(',')[1], mimeType: 'image/png' };
                                setImageForEditing(src);
                                setActiveTab('edit');
                            }}
                        />
                    ) : activeTab === 'utilities' ? (
                        <UtilitiesTab 
                            key={resetKey}
                            onEditRequest={(img) => {
                                const src = { base64: img.split(',')[1], mimeType: 'image/png' };
                                setImageForEditing(src);
                                setActiveTab('edit');
                            }}
                            onStartNewRenderFlow={handleStartNewRenderFlowFromUtility}
                            onTrackUsage={handleTrackUsage}
                            promptFinderImage={promptFinderImage} setPromptFinderImage={setPromptFinderImage}
                            promptFinderPrompts={promptFinderPrompts} setPromptFinderPrompts={setPromptFinderPrompts}
                            finishMyBuildImage={finishMyBuildImage} setFinishMyBuildImage={setFinishMyBuildImage}
                            finishMyBuildPrompts={finishMyBuildPrompts} setFinishMyBuildPrompts={setFinishMyBuildPrompts}
                            finishInteriorImage={finishInteriorImage} setFinishInteriorImage={setFinishInteriorImage}
                            finishInteriorPrompts={finishInteriorPrompts} setFinishInteriorPrompts={setFinishInteriorPrompts}
                            landscapeUtilityImage={landscapeUtilityImage} setLandscapeUtilityImage={setLandscapeUtilityImage}
                            landscapeUtilityPrompts={landscapeUtilityPrompts} setLandscapeUtilityPrompts={setLandscapeUtilityPrompts}
                            planningUtilityImage={planningUtilityImage} setPlanningUtilityImage={setPlanningUtilityImage}
                            planningUtilityPrompts={planningUtilityPrompts} setPlanningUtilityPrompts={setPlanningUtilityPrompts}
                            history={utilitiesHistory} onClearHistory={() => setUtilitiesHistory([])} onGenerationComplete={() => {}}
                            initialUtility={initialUtility} setInitialUtility={setInitialUtility}
                            upscaleUtilityImage={upscaleUtilityImage} setUpscaleUtilityImage={setUpscaleUtilityImage}
                            onShowTopUp={() => setShowTopUp(true)}
                            onAddToLibrary={addToLibrary}
                            session={session}
                        />
                    ) : activeTab === 'virtual_tour' ? (
                        <VirtualTourTab 
                            key={resetKey}
                            setActiveTab={setActiveTab} 
                            setImageForEditing={setImageForEditing}
                            onCreateVideoRequest={(url) => {
                                alert("Chức năng tạo video đã được ẩn.");
                            }}
                            onShowTopUp={() => setShowTopUp(true)}
                            onAddCost={handleTrackUsage}
                            onAddToLibrary={addToLibrary}
                            session={session}
                        />
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                            <div className={`lg:col-span-3 flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar pr-2 pb-20 ${mobileView === 'result' ? 'hidden lg:flex' : 'flex'}`}>
                                <Section title={`1. Ảnh ${TAB_LABELS[activeTab]}`}>
                                    <ImageUpload key={resetKey} resetKey={resetKey} sourceImage={sourceImage} onImageUpload={setSourceImage} onRemove={() => setSourceImage(null)} />
                                    {isRenderTab(activeTab) && sourceImage && activeTab !== 'floorplan' && (
                                        <>
                                         {(activeTab === 'exterior' || activeTab === 'interior') && (
                                            <div className="mt-4 p-3 bg-[var(--bg-surface-3)] rounded-lg border border-[var(--border-2)]">
                                                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-2 uppercase tracking-wider">Chế độ xử lý</label>
                                                <div className="flex flex-col gap-2">
                                                    <button 
                                                        onClick={() => activeTab === 'exterior' ? setExteriorMode('creative') : setInteriorMode('creative')}
                                                        className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors ${(activeTab==='exterior' ? exteriorMode : interiorMode) === 'creative' ? 'bg-[var(--bg-interactive)] text-white shadow-md' : 'hover:bg-[var(--bg-surface-4)] text-[var(--text-primary)]'}`}
                                                    >
                                                        ✨ Sáng Tạo (Creative)
                                                    </button>
                                                    {activeTab === 'interior' && (
                                                        <>
                                                        <button 
                                                            onClick={() => setInteriorMode('style_clone')}
                                                            className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors ${interiorMode === 'style_clone' ? 'bg-[var(--bg-interactive)] text-white shadow-md' : 'hover:bg-[var(--bg-surface-4)] text-[var(--text-primary)]'}`}
                                                        >
                                                            🧬 Sao Chép Style (Clone)
                                                        </button>
                                                        <button 
                                                            onClick={() => setInteriorMode('virtual_staging')}
                                                            className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors ${interiorMode === 'virtual_staging' ? 'bg-[var(--bg-interactive)] text-white shadow-md' : 'hover:bg-[var(--bg-surface-4)] text-[var(--text-primary)]'}`}
                                                        >
                                                            🛋️ Sắp Đặt (Giữ Cấu Trúc)
                                                        </button>
                                                        </>
                                                    )}
                                                    <button 
                                                        onClick={() => activeTab === 'exterior' ? setExteriorMode('partial_redesign') : setInteriorMode('partial_redesign')}
                                                        className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors ${(activeTab==='exterior' ? exteriorMode : interiorMode) === 'partial_redesign' ? 'bg-[var(--bg-interactive)] text-white shadow-md' : 'hover:bg-[var(--bg-surface-4)] text-[var(--text-primary)]'}`}
                                                    >
                                                        🔒 Giữ Lại (Khóa Vùng)
                                                    </button>
                                                </div>
                                            </div>
                                         )}
                                        </>
                                    )}
                                </Section>
                                
                                {((activeTab === 'interior' && interiorMode === 'partial_redesign') || (activeTab === 'exterior' && exteriorMode === 'partial_redesign')) && sourceImage && (
                                    <Section title="2. Vùng Chọn (Mask)">
                                        <div className="flex bg-[var(--bg-surface-3)] p-1 rounded-lg mb-2">
                                             <button 
                                                onClick={() => activeTab === 'interior' ? setInteriorTool('brush') : setExteriorTool('brush')}
                                                className={`flex-1 py-1.5 text-xs font-bold rounded flex items-center justify-center gap-1 transition-all ${(activeTab === 'interior' ? interiorTool : exteriorTool) === 'brush' ? 'bg-[var(--bg-interactive)] text-white shadow' : 'text-[var(--text-secondary)] hover:text-white'}`}
                                            >
                                                <Icon name="brush" className="w-3 h-3"/> Cọ Vẽ
                                            </button>
                                            <button 
                                                onClick={() => activeTab === 'interior' ? setInteriorTool('pen') : setExteriorTool('pen')}
                                                className={`flex-1 py-1.5 text-xs font-bold rounded flex items-center justify-center gap-1 transition-all ${(activeTab === 'interior' ? interiorTool : exteriorTool) === 'pen' ? 'bg-[var(--bg-interactive)] text-white shadow' : 'text-[var(--text-secondary)] hover:text-white'}`}
                                            >
                                                <Icon name="pen-nib" className="w-3 h-3"/> Đa Giác
                                            </button>
                                        </div>

                                        <div className="h-64 border border-[var(--border-2)] rounded-lg overflow-hidden bg-black/20 relative group">
                                            <MaskLayeredCanvas 
                                                ref={activeTab === 'interior' ? interiorMaskRef : exteriorMaskRef}
                                                image={sourceImage} 
                                                brushSize={activeTab === 'interior' ? interiorBrushSize : exteriorBrushSize} 
                                                color={(activeTab === 'interior' ? interiorMaskMode : exteriorMaskMode) === 'keep' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'} 
                                                tool={activeTab === 'interior' ? interiorTool : exteriorTool}
                                            />
                                            {(activeTab === 'interior' ? interiorTool : exteriorTool) === 'pen' && (
                                                <div className="absolute top-2 left-2 bg-black/50 text-[10px] text-white px-2 py-1 rounded pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
                                                    Click để chấm điểm. Double click để đóng vùng.
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="mt-4 space-y-4">
                                            <button onClick={() => setIsMaskEditorOpen(true)} className="w-full bg-[var(--bg-surface-3)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] text-sm font-bold py-2 rounded flex items-center justify-center gap-2 border border-[var(--border-2)]">
                                                <Icon name="arrows-pointing-out" className="w-4 h-4"/> Phóng To & Sửa (Zoom/Pan)
                                            </button>

                                            {(activeTab === 'interior' ? interiorTool : exteriorTool) === 'pen' ? (
                                                <div className="flex gap-2">
                                                    <button onClick={() => activeTab === 'interior' ? interiorMaskRef.current?.undoPoint() : exteriorMaskRef.current?.undoPoint()} className="flex-1 bg-[var(--bg-surface-3)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] text-xs font-bold py-2 rounded flex items-center justify-center gap-1">
                                                        <Icon name="arrow-uturn-left" className="w-3 h-3"/> Hoàn Tác Điểm
                                                    </button>
                                                    <button onClick={() => activeTab === 'interior' ? interiorMaskRef.current?.finishPath() : exteriorMaskRef.current?.finishPath()} className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-1">
                                                        <Icon name="check-circle" className="w-3 h-3"/> Xong Hình
                                                    </button>
                                                </div>
                                            ) : (
                                                 <div>
                                                    <label className="text-xs font-bold text-[var(--text-secondary)]">Cỡ Cọ</label>
                                                    <input type="range" min="10" max="150" value={activeTab === 'interior' ? interiorBrushSize : exteriorBrushSize} onChange={e => activeTab === 'interior' ? setInteriorBrushSize(Number(e.target.value)) : setExteriorBrushSize(Number(e.target.value))} className="w-full h-2 bg-[var(--bg-surface-3)] rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-1"/>
                                                </div>
                                            )}

                                            <div className="flex bg-[var(--bg-surface-3)] p-1 rounded-lg">
                                                <button 
                                                    onClick={() => activeTab === 'interior' ? setInteriorMaskMode('keep') : setExteriorMaskMode('keep')}
                                                    className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-1 transition-all ${(activeTab === 'interior' ? interiorMaskMode : exteriorMaskMode) === 'keep' ? 'bg-green-600 text-white shadow' : 'text-[var(--text-secondary)] hover:text-white'}`}
                                                >
                                                    <div className="w-2 h-2 rounded-full bg-green-400"></div> Tô Xanh (Giữ Lại)
                                                </button>
                                                <button 
                                                     onClick={() => activeTab === 'interior' ? setInteriorMaskMode('edit') : setExteriorMaskMode('edit')}
                                                    className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-1 transition-all ${(activeTab === 'interior' ? interiorMaskMode : exteriorMaskMode) === 'edit' ? 'bg-red-600 text-white shadow' : 'text-[var(--text-secondary)] hover:text-white'}`}
                                                >
                                                    <div className="w-2 h-2 rounded-full bg-red-400"></div> Tô Đỏ (Sửa)
                                                </button>
                                            </div>
                                             <button 
                                                onClick={() => activeTab === 'interior' ? interiorMaskRef.current?.clear() : exteriorMaskRef.current?.clear()}
                                                className="w-full py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-red-400 border border-[var(--border-2)] rounded hover:border-red-500/50 transition-colors"
                                            >
                                                Xóa Tất Cả Mask
                                            </button>
                                        </div>
                                    </Section>
                                )}

                                <Section title="Thiết Lập & Mô Tả">
                                    <ReferenceImageUpload key={resetKey} resetKey={resetKey} image={referenceImage} onUpload={setReferenceImage} onRemove={() => setReferenceImage(null)} />
                                    
                                    {(activeTab === 'interior' || activeTab === 'exterior') && (
                                        <div className="space-y-2 mb-4">
                                            <AccordionItem title="Phong Cách" icon="sparkles" isOpen={openAccordion === 'style'} onToggle={() => toggleAccordion('style')} selectedCount={selectedStyle ? 1 : 0}>
                                                {renderAttributeGrid(activeTab === 'interior' ? STYLES_DATA.interior : STYLES_DATA.exterior, selectedStyle, setSelectedStyle)}
                                            </AccordionItem>
                                            
                                            <AccordionItem title="Người & Hoạt Hoạt" icon="cursor-arrow-rays" isOpen={openAccordion === 'people'} onToggle={() => toggleAccordion('people')} selectedCount={selectedPeople ? 1 : 0}>
                                                {renderAttributeGrid(ATTRIBUTES_DATA.people, selectedPeople, setSelectedPeople)}
                                            </AccordionItem>
                                            
                                            <AccordionItem title="Xe Cộ & Giao Thông" icon="arrow-path" isOpen={openAccordion === 'vehicles'} onToggle={() => toggleAccordion('vehicles')} selectedCount={selectedVehicle ? 1 : 0}>
                                                {renderAttributeGrid(ATTRIBUTES_DATA.vehicles, selectedVehicle, setSelectedVehicle)}
                                            </AccordionItem>
                                            
                                            <AccordionItem title="Ánh Sáng" icon="sun" isOpen={openAccordion === 'lighting'} onToggle={() => toggleAccordion('lighting')} selectedCount={selectedLighting ? 1 : 0}>
                                                {renderAttributeGrid(ATTRIBUTES_DATA.lighting, selectedLighting, setSelectedLighting)}
                                            </AccordionItem>
                                            
                                            <AccordionItem title="Thời Tiết" icon="snowflake" isOpen={openAccordion === 'weather'} onToggle={() => toggleAccordion('weather')} selectedCount={selectedWeather ? 1 : 0}>
                                                {renderAttributeGrid(ATTRIBUTES_DATA.weather, selectedWeather, setSelectedWeather)}
                                            </AccordionItem>
                                        </div>
                                    )}

                                    {activeTab === 'exterior' ? (
                                        <div className="space-y-3">
                                            <textarea value={exteriorCustomPrompt} onChange={e => setExteriorCustomPrompt(e.target.value)} placeholder="Mô tả chi tiết công trình (VD: Nhà phố hiện đại 3 tầng...)" className="w-full bg-[var(--bg-surface-3)] p-3 rounded-lg h-24 resize-none focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none text-sm" />
                                        </div>
                                    ) : activeTab === 'interior' ? (
                                        <textarea value={interiorPrompt} onChange={e => setInteriorPrompt(e.target.value)} placeholder="Mô tả không gian nội thất..." className="w-full bg-[var(--bg-surface-3)] p-3 rounded-lg h-32 resize-none focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none text-sm" />
                                    ) : (
                                        <div className="space-y-3">
                                            <textarea value={floorplanPrompt} onChange={e => setFloorplanPrompt(e.target.value)} placeholder="Mô tả mặt bằng..." className="w-full bg-[var(--bg-surface-3)] p-3 rounded-lg h-24 resize-none focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none text-sm" />
                                            <div className="grid grid-cols-3 gap-2">
                                                {(['realistic', '3d_view', 'colored_plan'] as const).map(m => (
                                                    <button key={m} onClick={() => setFloorplanMode(m)} className={`p-2 text-xs rounded border ${floorplanMode === m ? 'bg-[var(--bg-interactive)] border-transparent text-white' : 'bg-[var(--bg-surface-3)] border-[var(--border-2)] text-[var(--text-secondary)]'}`}>{m === 'realistic' ? 'Thực Tế' : m === '3d_view' ? 'View 3D' : 'Đổ Màu'}</button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="flex items-center gap-4 mt-4 bg-[var(--bg-surface-3)] p-2 rounded-lg">
                                        <span className="text-xs font-bold text-[var(--text-secondary)]">Số lượng ảnh:</span>
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4].map(n => (
                                                <button key={n} onClick={() => setNumImages(n)} className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs transition-colors ${numImages === n ? 'bg-[var(--bg-interactive)] text-white' : 'bg-[var(--bg-surface-4)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]'}`}>{n}</button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-4 bg-[var(--bg-surface-3)] p-3 rounded-lg">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-[var(--text-secondary)]">Tỷ lệ khung hình:</span>
                                            <span className="text-[10px] text-[var(--text-tertiary)]">{aspectRatio === 'Auto' ? 'Tự động theo ảnh gốc' : aspectRatio}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {['Auto', '1:1', '4:3', '3:4', '16:9', '9:16'].map(ratio => (
                                                <button 
                                                    key={ratio} 
                                                    onClick={() => setAspectRatio(ratio)} 
                                                    className={`py-1.5 px-2 rounded text-[10px] font-bold border transition-all flex items-center justify-center gap-1
                                                        ${aspectRatio === ratio 
                                                            ? 'bg-[var(--bg-interactive)] border-[var(--border-interactive)] text-white shadow-md' 
                                                            : 'bg-[var(--bg-surface-1)] border-[var(--border-2)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]'
                                                        }`}
                                                >
                                                    {ratio === 'Auto' && <Icon name="sparkles" className="w-3 h-3"/>}
                                                    {ratio === '1:1' && <div className="w-3 h-3 border border-current bg-current opacity-50"></div>}
                                                    {ratio === '16:9' && <div className="w-4 h-2 border border-current bg-current opacity-50"></div>}
                                                    {ratio === '9:16' && <div className="w-2 h-4 border border-current bg-current opacity-50"></div>}
                                                    {ratio === '4:3' && <div className="w-3.5 h-2.5 border border-current bg-current opacity-50"></div>}
                                                    {ratio === '3:4' && <div className="w-2.5 h-3.5 border border-current bg-current opacity-50"></div>}
                                                    {ratio}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 mt-4 bg-[var(--bg-surface-3)] p-2 rounded-lg">
                                        <span className="text-xs font-bold text-[var(--text-secondary)]">Độ Phân Giải:</span>
                                        <div className="flex gap-1 flex-grow">
                                            {['1K', '2K', '4K'].map(size => (
                                                <button 
                                                    key={size} 
                                                    onClick={() => setImageSize(size as any)} 
                                                    className={`flex-1 h-8 rounded flex items-center justify-center font-bold text-xs transition-colors ${imageSize === size ? 'bg-[var(--bg-interactive)] text-white' : 'bg-[var(--bg-surface-4)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]'}`}
                                                >
                                                    {size}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className={`mt-4 flex items-center justify-between text-xs p-2 rounded bg-orange-900/40 text-orange-200 border border-orange-500/30`}>
                                        <div className="flex gap-2">
                                            <span className="font-semibold">Phí Tổng Cộng</span>
                                            <span className="opacity-70">({numImages} ảnh x {imageSize === '4K' ? 400 : imageSize === '2K' ? 200 : 100}💎)</span>
                                        </div>
                                        <span className="font-mono font-bold text-amber-400">-{numImages * (imageSize === '4K' ? 400 : imageSize === '2K' ? 200 : 100)} 💎</span>
                                    </div>

                                    <button 
                                        onClick={() => {
                                            if (!session) {
                                                signIn('google');
                                                return;
                                            }
                                            const reqCredits = numImages * (imageSize === '4K' ? 400 : imageSize === '2K' ? 200 : 100);
                                            if (((session?.user as any)?.credits ?? 0) < reqCredits) {
                                                setShowTopUp(true);
                                                return;
                                            }
                                            handleGeneration('', activeTab as 'exterior' | 'interior' | 'floorplan', false);
                                        }} 
                                        disabled={isLoading} 
                                        className="w-full py-4 mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 text-lg"
                                    >
                                        <div className="flex items-center gap-2">
                                            {isLoading ? <div className="animate-spin h-5 w-5 border-2 border-white rounded-full"></div> : <Icon name="sparkles" className="w-5 h-5" />}
                                            {isLoading ? 'Đang Sáng Tạo...' : (!session ? 'Đăng Nhập Để Tạo' : (((session?.user as any)?.credits ?? 0) < 100 ? 'Nạp Thêm Credit' : 'Tạo Phương Án'))}
                                        </div>
                                        <span className="text-[10px] font-normal opacity-80">Sử dụng Gemini 3.0 Pro (Chất Lượng Cao Nhất)</span>
                                    </button>
                                </Section>
                            </div>

                            <div className={`lg:col-span-9 h-full pb-20 overflow-hidden ${mobileView === 'setup' ? 'hidden lg:block' : 'block'}`}>
                                <ResultDisplay 
                                    sourceImage={sourceImage}
                                    images={generatedImages} 
                                    isLoading={isLoading}
                                    onUpscale={async (index, target) => {
                                        const reqCredits = target === '4k' ? 4 : 2;
                                        if (((session?.user as any)?.credits ?? 0) < reqCredits) {
                                             setShowTopUp(true);
                                             return;
                                        }
                                        setUpscalingIndex(index);
                                        try {
                                            handleTrackUsage(PRICING_RATES.IMAGE_PRO, 300);
                                            const res = await upscaleImage({base64: generatedImages[index].split(',')[1], mimeType: 'image/png'}, target);
                                            if(res) {
                                                setUpscaledImageForModal(res);
                                                addToLibrary(res, "Upscale Image", "Upscale");
                                            }
                                        } catch(e) { alert("Upscale failed"); } finally { setUpscalingIndex(null); }
                                    }}
                                    upscalingIndex={upscalingIndex}
                                    onEditRequest={(img) => {
                                        const src = { base64: img.split(',')[1], mimeType: 'image/png' };
                                        setImageForEditing(src);
                                        setActiveTab('edit');
                                    }}
                                    selectedImageIndex={selectedImageIndex}
                                    onSelectImageIndex={setSelectedImageIndex}
                                    onChangeAngle={() => {}}
                                    onFullscreen={(idx) => setFullscreenState({ images: generatedImages, startIndex: idx })}
                                    onCreateVideoRequest={(img) => {
                                        alert("Chức năng tạo video đã được ẩn.");
                                    }}
                                    showChangeAngleButton={false}
                                />
                            </div>
                        </div>
                    )}
                 </div>
             </div>
          </main>
          
          {upscaledImageForModal && <UpscaleModal imageUrl={upscaledImageForModal} onClose={() => setUpscaledImageForModal(null)} />}
          {showTopUp && <TopUpModal onClose={() => setShowTopUp(false)} />}
          {fullscreenState && <ImageViewerModal imageUrl={fullscreenState.images[fullscreenState.startIndex]} onClose={() => setFullscreenState(null)} />}
          
          {isMaskEditorOpen && sourceImage && (
             <MaskEditorModal
                 image={sourceImage}
                 initialMaskData={activeTab === 'interior' ? interiorMaskRef.current?.getImageData() || null : exteriorMaskRef.current?.getImageData() || null}
                 onClose={() => setIsMaskEditorOpen(false)}
                 onSave={(data) => {
                     const targetRef = activeTab === 'interior' ? interiorMaskRef : exteriorMaskRef;
                     targetRef.current?.putImageData(data);
                 }}
                 brushSize={activeTab === 'interior' ? interiorBrushSize : exteriorBrushSize}
                 setBrushSize={activeTab === 'interior' ? setInteriorBrushSize : setExteriorBrushSize}
                 tool={activeTab === 'interior' ? interiorTool : exteriorTool}
                 setTool={activeTab === 'interior' ? setInteriorTool : setExteriorTool}
                 color={(activeTab === 'interior' ? interiorMaskMode : exteriorMaskMode) === 'keep' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'}
             />
          )}

        </div>
      )}
    </>
  );
}
