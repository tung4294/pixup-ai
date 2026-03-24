"use client";

import { GoogleGenAI, Type } from "@google/genai";
import { SourceImage, GeneratedPrompts, FinishBuildAnalysis, LandscapeAnalysis, PlanningAnalysis } from '../types';

export type InteriorMode = 'creative' | 'style_clone' | 'virtual_staging' | 'partial_redesign';
export type ExteriorMode = 'creative' | 'partial_redesign';
export type FloorplanMode = 'realistic' | '3d_view' | 'colored_plan';
export type TourMoveType = 'pan-up' | 'pan-down' | 'pan-left' | 'pan-right' | 'orbit-left' | 'orbit-right' | 'zoom-in' | 'zoom-out';

export const COST_LABELS = {
  IMAGE_FLASH: '$0.0004',
  IMAGE_PRO: '$0.004',
  ANALYSIS: '$0.0002',
  UPSCALE: '$0.004',
  TOUR_STEP: '$0.004'
};

export const PRICING_RATES = {
  IMAGE_FLASH: 0.0004,
  IMAGE_PRO: 0.004,
  INPUT_TOKEN: 0.0000001,
  OUTPUT_TOKEN: 0.0000004
};

const STORAGE_KEY = 'gemini_api_key';

const MODELS = {
    HIGH: 'gemini-3.1-flash-image-preview',
    FAST: 'gemini-2.5-flash-image', // Fallback model
    TEXT: 'gemini-3-flash-preview'
};

async function executeBackendGeneration(
    params: {
        modelId: string,
        parts: any[],
        config: any
    }
): Promise<any> {
    const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
    });
    
    const data = await res.json();
    
    if (!res.ok) {
        throw new Error(data.error || 'Server Error');
    }
    return data;
}

export function calculateCost(prompt: string, numImages: number, hasImageInput: boolean, imageSize?: string) {
    let baseCost = 0.04; // Base cost for Pro model
    if (imageSize === '2K') baseCost *= 1.5;
    if (imageSize === '4K') baseCost *= 2;
    
    const inputTokens = prompt.length / 4 + (hasImageInput ? 258 : 0);
    const totalCost = baseCost * numImages;
    
    return {
        cost: totalCost,
        tokens: Math.ceil(inputTokens)
    };
}

const cleanJson = (text: string | undefined): string => {
    if (!text) return '{}';
    let cleaned = text.replace(/```json\n?|```/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return cleaned;
};

const getImageDimensions = (source: SourceImage): Promise<{ width: number, height: number }> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
        resolve({ width: 1024, height: 1024 });
        return;
    }
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => {
        resolve({ width: 1024, height: 1024 });
    };
    img.src = `data:${source.mimeType};base64,${source.base64}`;
  });
};

const getClosestAspectRatio = (width: number, height: number): string => {
  const ratio = width / height;
  // Gemini strictly supports these ratios. Using unsupported ones often results in 500 errors.
  const targets = { 
      "1:1": 1.0, 
      "4:3": 1.333, 
      "3:4": 0.75, 
      "16:9": 1.777, 
      "9:16": 0.5625
  };
  
  let best = "1:1";
  let minDiff = Infinity;
  
  for (const [key, val] of Object.entries(targets)) {
    const diff = Math.abs(ratio - val);
    if (diff < minDiff) { 
        minDiff = diff; 
        best = key; 
    }
  }
  return best;
};

async function executeImageGeneration(
    params: {
        modelId: string,
        parts: any[],
        config: any
    }
): Promise<string[]> {
    try {
        const response: any = await executeBackendGeneration(params);
        const images: string[] = [];
        if (response.candidates) {
            for (const candidate of response.candidates) {
                if (candidate.content?.parts) {
                    for (const part of candidate.content.parts) {
                        if (part.inlineData?.data) {
                            images.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
                        }
                    }
                }
            }
        }
        
        if (images.length === 0) throw new Error("No images returned.");
        return images;
    } catch (error: any) {
        throw error; 
    }
}

export async function generateImages(
    prompt: string,
    sourceImage: SourceImage | null,
    options: { 
        aspectRatio?: string, 
        numImages?: number, 
        imageSize?: '1K' | '2K' | '4K'
    }
): Promise<string[]> {
    let targetAspectRatio = options.aspectRatio || '1:1';
    if (targetAspectRatio === 'Auto') {
        if (sourceImage) {
            const dims = await getImageDimensions(sourceImage);
            targetAspectRatio = getClosestAspectRatio(dims.width, dims.height);
        } else {
            targetAspectRatio = '1:1';
        }
    }

    const parts: any[] = [];
    if (sourceImage) {
        parts.push({ inlineData: { mimeType: sourceImage.mimeType, data: sourceImage.base64 } });
    }

    let finalPrompt = `
Bạn là một chuyên gia Render 3D và Kiến trúc sư Diễn họa (Architectural Visualizer) cấp độ thế giới. 
NHIỆM VỤ: Biến bức ảnh này thành một tác phẩm render kiến trúc tuyệt đẹp và chân thực.

YÊU CẦU BẮT BUỘC (Auto-Enhancement):
1. VẬT LIỆU (MATERIALS): TUYỆT ĐỐI GIỮ NGUYÊN loại vật liệu, màu sắc và cảm quan của công trình gốc. CHỈ làm đẹp, tăng độ sắc nét, chân thực và chất cảm của vật liệu hiện tại (ví dụ: làm tường nét hơn, kính có phản chiếu ánh sáng tự nhiên tốt hơn). KHÔNG thay đổi sang loại vật liệu khác làm mất đi cảm xúc của công trình.
2. ÁNH SÁNG (LIGHTING): Tự động đánh sáng chuẩn Cinematic. Thêm bóng đổ mềm (soft shadows), Ambient Occlusion, và Global Illumination để khung cảnh có chiều sâu, tôn lên vẻ đẹp của công trình chính.
3. CẢNH QUAN (LANDSCAPING): Tự động bổ sung hoặc làm đẹp cảnh quan xung quanh (cây xanh, thảm cỏ, hoa lề đường, mây trời) một cách hài hòa để làm bối cảnh sống động hơn.
4. CHẤT LƯỢNG (QUALITY): Chụp bằng ống kính nhiếp ảnh chuyên nghiệp, độ phân giải sắc nét chi tiết. Đẹp như ảnh tạp chí kiến trúc.

${sourceImage ? "5. CẤU TRÚC GỐC (GEOMETRY): GIỮ NGUYÊN 100% hình khối kiến trúc, tỷ lệ khung hình, đường nét và góc tụ phối cảnh của ảnh gốc. KHÔNG làm sai lệch mặt đứng và phối cảnh nhà ban đầu." : ""}

YÊU CẦU CỤ THỂ CỦA NGƯỜI DÙNG: ${prompt || 'Hãy làm đẹp bức ảnh kiến trúc này, bổ sung ánh sáng và cảnh quan nhưng TUYỆT ĐỐI GIỮ NGUYÊN VẬT LIỆU GỐC.'}
`;

    parts.push({ text: finalPrompt });
    
    const count = options.numImages || 1;
    const promises = [];

    for (let i = 0; i < count; i++) {
        promises.push((async () => {
            try {
                return await executeImageGeneration({
                    modelId: MODELS.HIGH,
                    parts: [...parts],
                    config: { imageConfig: { aspectRatio: targetAspectRatio, imageSize: options.imageSize || '1K' } }
                });
            } catch (e) {
                try {
                    return await executeImageGeneration({
                        modelId: MODELS.FAST,
                        parts: [...parts],
                        config: { imageConfig: { aspectRatio: targetAspectRatio } }
                    });
                } catch (flashError: any) {
                    throw new Error(`Failed: ${flashError.message}`);
                }
            }
        })());
    }
    
    const results = await Promise.allSettled(promises);
    const images: string[] = [];
    for (const res of results) { if (res.status === 'fulfilled') images.push(...res.value); }
    if (images.length === 0) throw new Error("No images generated.");
    return images;
}

// --- DEDICATED FLOORPLAN GENERATION ---
export async function generateFloorplanImages(
    prompt: string,
    sourceImage: SourceImage,
    mode: FloorplanMode,
    options: { numImages?: number, imageSize?: '1K' | '2K' | '4K' }
): Promise<string[]> {
    // Detect the EXACT aspect ratio of the source image to preserve CAD dimensions
    const dims = await getImageDimensions(sourceImage);
    const targetAspectRatio = getClosestAspectRatio(dims.width, dims.height);

    const modePrompts: Record<FloorplanMode, string> = {
        'realistic': `
Bạn là chuyên gia Diễn Họa Kiến Trúc (Architectural Visualization Expert).
NHIỆM VỤ: Biến bản vẽ mặt bằng kỹ thuật (CAD/floorplan) này thành ảnh RENDER THỰC TẾ nhìn từ trên xuống (top-down realistic render).

YÊU CẦU BẮT BUỘC:
1. GIỮ NGUYÊN 100% bố cục, tỷ lệ, kích thước, vị trí các phòng, tường, cửa, cầu thang từ bản vẽ gốc. KHÔNG thêm/ bớt/ dịch chuyển bất kỳ phòng hoặc tường nào.
2. Thay thế các nét vẽ kỹ thuật bằng VẬT LIỆU THỰC TẾ: sàn gỗ, gạch, thảm, bê tông, đá marble — phù hợp với chức năng từng phòng.
3. SẮP XẾP NỘI THẤT: Đặt đồ nội thất phù hợp vào từng phòng (giường ngủ, bàn ăn, sofa, bếp, toilet...) đúng tỷ lệ.
4. ÁNH SÁNG: Ánh sáng tự nhiên chiếu qua các cửa sổ/cửa đi.  Bóng đổ mềm, chân thực.
5. GÓNG MÁY: Nhìn thẳng từ trên xuống (Bird's-eye / Top-down view), vuông góc hoàn hảo.
6. CHẤT LƯỢNG: Render 8K photorealistic.
${prompt ? `\nYÊU CẦU BỔ SUNG: ${prompt}` : ''}
`,
        '3d_view': `
Bạn là chuyên gia Diễn Họa Kiến Trúc 3D (3D Architectural Visualization Expert).
NHIỆM VỤ: Biến bản vẽ mặt bằng kỹ thuật (CAD/floorplan) này thành ảnh PHỐI CẢNH 3D ISOMETRIC nhìn từ trên chéo xuống (3D isometric view / axonometric view).

YÊU CẦU BẮT BUỘC:
1. GIỮ NGUYÊN 100% bố cục, tỷ lệ, kích thước các phòng từ bản vẽ gốc. 
2. Dựng TẤT CẢ TƯỜNG 3D lên với chiều cao thực tế (~3m), cắt mái để thấy nội thất bên trong (Dollhouse / Cutaway view).
3. SẮP XẾP NỘI THẤT 3D: Đồ nội thất 3D phù hợp từng phòng, đúng tỷ lệ.
4. VẬT LIỆU 3D: Sàn, tường, trần có vật liệu chân thực (gỗ, gạch, bê tông, kính...).
5. ÁNH SÁNG: Global Illumination, soft shadows, ambient occlusion.
6. GÓC MÁY: Isometric 3D (nhìn từ góc 45° chéo từ trên xuống), toàn cảnh toàn bộ mặt bằng.
7. CHẤT LƯỢNG: Render 3D 8K, sắc nét, chuyên nghiệp.
${prompt ? `\nYÊU CẦU BỔ SUNG: ${prompt}` : ''}
`,
        'colored_plan': `
Bạn là chuyên gia Thiết Kế Bản Vẽ Kiến Trúc (Architectural Plan Designer).
NHIỆM VỤ: Biến bản vẽ mặt bằng kỹ thuật (CAD/floorplan) này thành BẢN VẼ MẶT BẰNG TÔ MÀU CHUYÊN NGHIỆP (Colored Floor Plan).

YÊU CẦU BẮT BUỘC:
1. GIỮ NGUYÊN 100% bố cục, tỷ lệ, kích thước, vị trí, đường nét kỹ thuật từ bản vẽ gốc. KHÔNG thay đổi hình dạng mặt bằng.
2. TÔ MÀU TỪNG PHÒNG theo chức năng (mã màu pastel): 
   - Phòng ngủ: xanh dương nhạt
   - Phòng khách: vàng nhạt
   - Bếp: xanh lá nhạt
   - WC: tím nhạt
   - Hành lang: xám nhạt
   - Sân/Ban công: xanh lá đậm nhạt
3. GIỮ NGUYÊN tất cả text/chú thích/kích thước/ký hiệu kỹ thuật trên bản vẽ.
4. Thêm PATTERN sàn nhẹ nhàng cho từng phòng (gạch, gỗ, thảm) dạng 2D.
5. ĐƯỜNG NÉT: Tường dày đen, cửa đi/cửa sổ rõ ràng, đường nét sạch sẽ.
6. PHONG CÁCH: Bản vẽ kỹ thuật tô màu chuyên nghiệp, không phải render 3D.
${prompt ? `\nYÊU CẦU BỔ SUNG: ${prompt}` : ''}
`
    };

    const parts: any[] = [
        { inlineData: { mimeType: sourceImage.mimeType, data: sourceImage.base64 } },
        { text: modePrompts[mode] }
    ];

    const count = options.numImages || 1;
    const promises = [];

    for (let i = 0; i < count; i++) {
        promises.push((async () => {
            try {
                return await executeImageGeneration({
                    modelId: MODELS.HIGH,
                    parts: [...parts],
                    config: { imageConfig: { aspectRatio: targetAspectRatio, imageSize: options.imageSize || '1K' } }
                });
            } catch (e) {
                try {
                    return await executeImageGeneration({
                        modelId: MODELS.FAST,
                        parts: [...parts],
                        config: { imageConfig: { aspectRatio: targetAspectRatio } }
                    });
                } catch (flashError: any) {
                    throw new Error(`Failed: ${flashError.message}`);
                }
            }
        })());
    }

    const results = await Promise.allSettled(promises);
    const images: string[] = [];
    for (const res of results) { if (res.status === 'fulfilled') images.push(...res.value); }
    if (images.length === 0) throw new Error("Không tạo được ảnh. Vui lòng thử lại.");
    return images;
}

export async function blendPersonIntoScene(
    background: SourceImage,
    person: SourceImage,
    mask: SourceImage | null,
    userPrompt: string = ""
): Promise<string | null> {
    const modelId = MODELS.HIGH;

    const dims = await getImageDimensions(background);
    const targetAspectRatio = getClosestAspectRatio(dims.width, dims.height);

    const instructions = `
        ROLE: Master Architectural Photographer and Visual Effects Specialist.
        TASK: Seamlessly integrate the person from the SECOND image into the architectural scene of the FIRST image.
        IDENTITY: The person's face, features, and hair must remain 100% identical to the reference image.
        INTEGRATION REQUIREMENTS (SEAMLESS BLENDING):
        1. GLOBAL ILLUMINATION (GI): Analyze the scene's primary and bounce light sources. Apply matching highlights and color tones to the person's skin and clothing.
        2. AMBIENT OCCLUSION & CONTACT SHADOWS: Create realistic, soft contact shadows where the person's feet touch the floor or where they sit. There must be a clear sense of weight and physical contact with the environment.
        3. COLOR GRADING: Perform a perfect match of exposure, contrast, and color temperature between the person and the background.
        4. DEPTH OF FIELD: If the background is slightly out of focus at the placement point, apply the same level of blur to the person.
        PLACEMENT LOGIC:
        - ONLY place on FLOOR or SEATING. 
        - Ensure human scale is correct relative to the door frames and furniture.
        ${mask ? "PLACEMENT: Exactly within the provided mask." : "PLACEMENT: Find a natural, architecturally sound standing or sitting position."}
        STYLE: ${userPrompt || "Natural lifestyle integration in a professional architectural photo."}
    `;

    const parts: any[] = [
        { inlineData: { mimeType: background.mimeType, data: background.base64 } }
    ];
    if (mask) parts.push({ inlineData: { mimeType: mask.mimeType, data: mask.base64 } });
    parts.push({ text: instructions });
    parts.push({ inlineData: { mimeType: person.mimeType, data: person.base64 } });

    try {
        const response: any = await executeBackendGeneration({
            modelId: modelId,
            parts: parts,
            config: { imageConfig: { aspectRatio: targetAspectRatio, imageSize: '1K' } }
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData?.data) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    } catch (e: any) {
        console.error("Person blend failed:", e);
    }
    return null;
}

export async function editImage(
    sourceImage: SourceImage, 
    maskImage: SourceImage | null, 
    prompt: string
): Promise<string | null> {
    const instructions = `
Bạn là chuyên gia Render 3D và Kiến trúc sư Diễn họa.
Nhiệm vụ: Chỉnh sửa lại bức ảnh kiến trúc này dựa theo vùng Mask (nếu có) và yêu cầu sau.
YÊU CẦU BẮT BUỘC:
1. Giữ nguyên 100% tỷ lệ, hình khối, góc chụp và các chi tiết không nằm trong vùng cần chỉnh sửa.
2. Tự động làm đẹp vật liệu, ánh sáng và cảnh quan cho phần được tạo mới sao cho khớp hoàn hảo và chân thực nhất.

YÊU CẦU NGƯỜI DÙNG: ${prompt}
`;
    const parts: any[] = [
         { inlineData: { mimeType: sourceImage.mimeType, data: sourceImage.base64 } },
         { text: instructions }
    ];
    if (maskImage) parts.splice(1, 0, { inlineData: { mimeType: maskImage.mimeType, data: maskImage.base64 } });
    try {
        const imgs = await executeImageGeneration({
            modelId: MODELS.HIGH,
            parts,
            config: { imageConfig: { aspectRatio: '1:1', imageSize: '1K' } }
        });
        return imgs[0] || null;
    } catch (e) {
        try {
            const imgs = await executeImageGeneration({
                modelId: MODELS.FAST,
                parts,
                config: { imageConfig: { aspectRatio: '1:1' } }
            });
            return imgs[0] || null;
        } catch (e2) { return null; }
    }
}

export async function upscaleImage(image: SourceImage, target: '2k' | '4k'): Promise<string | null> {
     // Detect input image dimensions to maintain aspect ratio
     const dims = await getImageDimensions(image);
     const targetAspectRatio = getClosestAspectRatio(dims.width, dims.height);

     const parts = [
        { inlineData: { mimeType: image.mimeType, data: image.base64 } },
        { text: "Generate a high-fidelity, high-resolution version of this image. Maintain the exact framing, composition, and aspect ratio of the original." }
     ];
     try {
        const imgs = await executeImageGeneration({
            modelId: MODELS.HIGH,
            parts,
            config: { 
                imageConfig: { 
                    aspectRatio: targetAspectRatio, 
                    imageSize: target === '2k' ? '2K' : '4K' 
                } 
            }
        });
        return imgs[0] || null;
     } catch (e) {
         try {
            const imgs = await executeImageGeneration({
                modelId: MODELS.FAST,
                parts,
                config: { imageConfig: { aspectRatio: targetAspectRatio } }
            });
            return imgs[0] || null;
         } catch(e2) { return null; }
     }
}

export async function generateVirtualTourImage(image: SourceImage, moveType: TourMoveType, magnitude: number): Promise<string | null> {
    const moveDescriptions: Record<TourMoveType, string> = {
        'pan-up': `TILT THE CAMERA UPWARD by ${magnitude} degrees. Show MORE of the ceiling, sky, and upper portions of the architecture. The lower part of the original image should be cropped out. The viewpoint stays in the same position but the camera lens TILTS UP.`,
        'pan-down': `TILT THE CAMERA DOWNWARD by ${magnitude} degrees. Show MORE of the floor, ground, foundation, and lower portions of the architecture. The upper part of the original image should be cropped out. The camera lens TILTS DOWN.`,
        'pan-left': `ROTATE THE CAMERA TO THE LEFT by ${magnitude} degrees. Reveal the area that was previously OUTSIDE the left edge of the frame. The right portion of the original scene should disappear. The camera SWIVELS LEFT on its axis.`,
        'pan-right': `ROTATE THE CAMERA TO THE RIGHT by ${magnitude} degrees. Reveal the area that was previously OUTSIDE the right edge of the frame. The left portion of the original scene should disappear. The camera SWIVELS RIGHT on its axis.`,
        'orbit-left': `PHYSICALLY MOVE THE CAMERA to the LEFT while keeping it pointed at the building/subject. This changes the perspective — you will see more of the RIGHT SIDE of the building that was previously hidden. The parallax and perspective must shift accordingly.`,
        'orbit-right': `PHYSICALLY MOVE THE CAMERA to the RIGHT while keeping it pointed at the building/subject. This changes the perspective — you will see more of the LEFT SIDE of the building that was previously hidden. The parallax and perspective must shift accordingly.`,
        'zoom-in': `ZOOM INTO the center of the image by ${magnitude}%. Show a CROPPED, CLOSER view of the central subject. Reveal MORE DETAIL in materials, textures, and architectural elements. The edges of the original frame should be removed.`,
        'zoom-out': `ZOOM OUT from the image by ${magnitude}%. Show a WIDER view that includes MORE of the surrounding environment, landscape, sky, and context around the building. The original scene should appear SMALLER within a larger frame.`,
    };

    const promptStr = `
You are an expert architectural 3D renderer and virtual camera operator.
TASK: Generate a NEW VIEW of the same architectural scene by performing this EXACT camera movement:

${moveDescriptions[moveType]}

CRITICAL REQUIREMENTS:
1. The OUTPUT IMAGE MUST BE VISIBLY DIFFERENT from the input. If the output looks identical to the input, you have FAILED.
2. MAINTAIN the exact same architectural style, materials, color palette, lighting conditions, and design language.
3. MAINTAIN consistent perspective geometry — vanishing points must shift correctly based on the camera movement.
4. All newly revealed areas must be architecturally plausible and consistent with the original design.
5. Quality: 8K photorealistic architectural visualization.
`;
    const parts = [
        { inlineData: { mimeType: image.mimeType, data: image.base64 } },
        { text: promptStr }
    ];
    try {
        const imgs = await executeImageGeneration({
            modelId: MODELS.HIGH,
            parts,
            config: { imageConfig: { aspectRatio: '16:9', imageSize: '2K' } }
        });
        return imgs[0] || null;
    } catch (e) {
        try {
             const imgs = await executeImageGeneration({
                modelId: MODELS.FAST,
                parts,
                config: { imageConfig: { aspectRatio: '16:9' } }
            });
            return imgs[0] || null;
        } catch (e2) { return null; }
    }
}

export async function generatePromptsFromImage(
    image: SourceImage, 
    personImage: SourceImage | null = null, 
    personDesc: string = ""
): Promise<GeneratedPrompts | null> {
    const parts: any[] = [
        { inlineData: { mimeType: image.mimeType, data: image.base64 } }
    ];
    
    if (personImage) {
        parts.push({ inlineData: { mimeType: personImage.mimeType, data: personImage.base64 } });
    }

    const instructions = `
        BẠN LÀ CHUYÊN GIA NHIẾP ẢNH KIẾN TRÚC VÀ PROMPT ENGINEER.
        HÃY PHÂN TÍCH ẢNH KIẾN TRÚC NÀY VÀ TẠO RA 20 PROMPT NHIẾP ẢNH CHUYÊN NGHIỆP TRONG TIẾNG VIỆT.
        
        PHÂN LOẠI THÀNH 4 NHÓM (MỖI NHÓM 5 PROMPT):
        1. wide_shots: 5 Góc toàn cảnh (Wide Shots) - Lấy trọn vẹn không gian, phối cảnh hùng vĩ.
        2. medium_shots: 5 Góc trung cảnh (Medium Shots) - Tập trung vào sự tương tác giữa con người và kiến trúc.
        3. closeup_shots: 5 Góc cận cảnh chi tiết (Detailed Close-up Shots) - Đặc tả vật liệu, hoa văn, ánh sáng.
        4. artistic_shots: 5 Góc máy nghệ thuật (Artistic Shots) - Sử dụng DOF, bokeh, góc máy thấp hoặc cao lạ mắt.

        YÊU CẦU:
        - MỖI PROMPT PHẢI CÓ 'title' (Tiêu đề ngắn gọn) VÀ 'description' (Mô tả chi tiết kỹ thuật nhiếp ảnh, ống kính, ánh sáng, tâm trạng).
        - ${personImage || personDesc ? `LỒNG GHÉP NHÂN VẬT ${personDesc || ""} VÀO CÁC GÓC CHỤP MỘT CÁCH TỰ NHIÊN.` : "TẬP TRUNG VÀO VẺ ĐẸP CỦA KIẾN TRÚC."}
        - NGÔN NGỮ: TIẾNG VIỆT 100%.
        - CHỈ TRẢ VỀ JSON THEO ĐỊNH DẠNG:
        {
          "wide_shots": [{"title": "...", "description": "..."}, ...],
          "medium_shots": [...],
          "closeup_shots": [...],
          "artistic_shots": [...]
        }
    `;

    parts.push({ text: instructions });

    const response: any = await executeBackendGeneration({
        modelId: MODELS.TEXT,
        parts: parts,
        config: { 
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    wide_shots: { 
                        type: Type.ARRAY, 
                        items: { 
                            type: Type.OBJECT, 
                            properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
                            required: ["title", "description"]
                        } 
                    },
                    medium_shots: { 
                        type: Type.ARRAY, 
                        items: { 
                            type: Type.OBJECT, 
                            properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
                            required: ["title", "description"]
                        } 
                    },
                    closeup_shots: { 
                        type: Type.ARRAY, 
                        items: { 
                            type: Type.OBJECT, 
                            properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
                            required: ["title", "description"]
                        } 
                    },
                    artistic_shots: { 
                        type: Type.ARRAY, 
                        items: { 
                            type: Type.OBJECT, 
                            properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
                            required: ["title", "description"]
                        } 
                    }
                },
                required: ["wide_shots", "medium_shots", "closeup_shots", "artistic_shots"]
            }
        }
    });

    try { 
        const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
        return JSON.parse(cleanJson(responseText)); 
    } catch (e) { return null; }
}

export async function analyzeUnfinishedBuild(image: SourceImage): Promise<FinishBuildAnalysis | null> {
     const response: any = await executeBackendGeneration({
        modelId: MODELS.TEXT,
        parts: [
            { inlineData: { mimeType: image.mimeType, data: image.base64 } },
            { text: `This is an unfinished building. Propose 4 completion concepts. JSON only.` }
        ],
        config: { responseMimeType: 'application/json' }
    });
    try { 
        const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
        return JSON.parse(cleanJson(responseText)); 
    } catch { return null; }
}

export async function generateInteriorCompletionPrompts(image: SourceImage): Promise<string[] | null> {
     const response: any = await executeBackendGeneration({
        modelId: MODELS.TEXT,
        parts: [
            { inlineData: { mimeType: image.mimeType, data: image.base64 } },
            { text: `Suggest 3 interior concepts. JSON array.` }
        ],
        config: { responseMimeType: 'application/json' }
    });
     try { 
        const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
        return JSON.parse(cleanJson(responseText)); 
    } catch { return null; }
}

export async function analyzeLandscapeImage(image: SourceImage): Promise<LandscapeAnalysis | null> {
    const response: any = await executeBackendGeneration({
        modelId: MODELS.TEXT,
        parts: [
            { inlineData: { mimeType: image.mimeType, data: image.base64 } },
            { text: `Analyze and suggest 4 landscapes. JSON.` }
        ],
        config: { responseMimeType: 'application/json' }
    });
    try { 
        const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
        return JSON.parse(cleanJson(responseText)); 
    } catch { return null; }
}

export async function analyzePlanningImage(image: SourceImage): Promise<PlanningAnalysis | null> {
    const response: any = await executeBackendGeneration({
        modelId: MODELS.TEXT,
        parts: [
            { inlineData: { mimeType: image.mimeType, data: image.base64 } },
            { text: `Analyze map and suggest 4 planning concepts. JSON.` }
        ],
        config: { responseMimeType: 'application/json' }
    });
    try { 
        const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
        return JSON.parse(cleanJson(responseText)); 
    } catch { return null; }
}
