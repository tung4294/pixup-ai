"use client";
import React from 'react';
import { Icon } from './icons';

export const UpscaleModal: React.FC<{ imageUrl: string; onClose: () => void; }> = ({ imageUrl, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[120] p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl max-w-4xl max-h-[90vh] flex flex-col relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-4 -right-4 bg-orange-500 text-black rounded-full p-2 hover:bg-orange-400 transition-transform duration-200 hover:scale-110 z-10 shadow-lg shadow-orange-500/20">
            <Icon name="x-mark" className="w-6 h-6" />
        </button>
        <div className="p-4 overflow-auto flex items-center justify-center">
            <img src={imageUrl} alt="Upscaled result" className="max-w-full h-auto object-contain rounded-2xl" />
        </div>
        <div className="p-6 border-t border-white/5 flex justify-center bg-black/20">
          <a 
            href={imageUrl} 
            download={`Pixup-ai-upscaled-${Date.now()}.png`} 
            className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white font-black py-4 px-8 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-orange-500/20"
          >
            <Icon name="download" className="w-6 h-6" />
            Tải Về Ảnh Nâng Cấp (Chất Lượng Cao)
          </a>
        </div>
      </div>
    </div>
  );
};
