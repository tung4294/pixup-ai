"use client";

import { useState, useCallback } from "react";

export default function ImageUpload() {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileObject, setFileObject] = useState<File | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = function(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setFileObject(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
    setResult(null);
    setErrorMsg(null);
    setSliderPosition(50); // Reset slider
  };

  const clearImage = () => {
    setPreview(null);
    setFileObject(null);
    setResult(null);
    setErrorMsg(null);
  };

  const analyzeImage = async () => {
    if (!fileObject) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setResult(null);
    setSliderPosition(50);
    
    try {
      const formData = new FormData();
      formData.append('image', fileObject);
      
      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process image');
      }
      
      setResult(data.result);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderPosition(Number(e.target.value));
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-10">
      <div 
        className={`glass-panel glass-panel-hover rounded-3xl p-8 text-center transition-all border-2 border-dashed ${
          dragActive ? "border-indigo-400 bg-white/10" : "border-white/20"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          id="imageUpload" 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleChange} 
        />
        
        {preview ? (
          <div>
            {!result ? (
              // Trạng thái chỉ có ảnh Preview
              <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={preview} 
                  alt="Preview" 
                  className="w-full h-auto object-contain max-h-[500px]" 
                />
                <button 
                  onClick={(e) => { e.stopPropagation(); clearImage(); }}
                  className="absolute top-4 right-4 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 backdrop-blur-md transition-colors"
                  title="Remove image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            ) : (
              // Trạng thái kết quả: Image Comparison Slider
              <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black/20 group select-none flex justify-center items-center" style={{ minHeight: '300px' }}>
                <img 
                  src={result} 
                  alt="After" 
                  className="w-full h-auto object-contain max-h-[600px] pointer-events-none" 
                  draggable={false}
                />
                
                {/* Lớp hiển thị ảnh gốc (được cắt đi một phần bởi clipPath) */}
                <div 
                  className="absolute top-0 left-0 w-full h-full pointer-events-none flex justify-center items-center"
                  style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                >
                  <img 
                    src={preview} 
                    alt="Before" 
                    className="w-full h-auto object-contain max-h-[600px]" 
                    draggable={false}
                  />
                </div>

                {/* Đường gạch ngang ở giữa chia cách */}
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize pointer-events-none shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10 flex items-center justify-center transition-opacity"
                  style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
                >
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m15 18-6-6 6-6"/>
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </div>

                {/* Input trượt ẩn */}
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={sliderPosition} 
                  onChange={handleSliderChange}
                  className="absolute top-0 left-0 w-full h-full opacity-0 cursor-ew-resize z-20 m-0"
                />
                
                {/* Nhãn Before / After */}
                <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md pointer-events-none uppercase tracking-wider">Original</div>
                <div className="absolute top-4 right-4 bg-indigo-600/80 text-white px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md pointer-events-none uppercase tracking-wider">Upscaled</div>

                <button 
                  onClick={(e) => { e.stopPropagation(); clearImage(); }}
                  className="absolute bottom-4 right-4 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 backdrop-blur-md transition-colors z-30"
                  title="Upload New Image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            )}
            
            <div className="mt-6 flex flex-col gap-4">
              {!result && (
                <button 
                  onClick={(e) => { e.stopPropagation(); analyzeImage(); }}
                  disabled={isProcessing}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Upscaling...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h4l3-9 5 18 3-9h5"/></svg>
                      Upscale Image
                    </>
                  )}
                </button>
              )}

              {errorMsg && (
                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-100 text-left">
                  <p className="font-semibold flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                    Error
                  </p>
                  <p className="mt-1 text-sm">{errorMsg}</p>
                </div>
              )}

              {result && (
                <div className="w-full flex justify-center">
                  <a 
                    href={result} 
                    download="upscaled_image.png" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-8 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold transition-all shadow-xl hover:shadow-indigo-500/20 flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    Download Full Resolution
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div 
            className="py-12 flex flex-col items-center justify-center gap-4 cursor-pointer"
            onClick={() => document.getElementById('imageUpload')?.click()}
          >
            <div className="bg-white/10 p-4 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            </div>
            <div>
              <p className="text-xl font-semibold text-white mb-2">Click or drag image to upload</p>
              <p className="text-sm text-white/60">SVG, PNG, JPG or GIF (max. 10MB)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
