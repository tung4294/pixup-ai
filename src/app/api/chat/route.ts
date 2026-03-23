import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

// In-memory rate limiting map
const rateLimitMap = new Map<string, { count: number, lastReset: number }>();

function isRateLimited(ip: string): boolean {
    const windowMs = 60000; // 1 phút
    const maxRequests = 5; // Tối đa 5 tin nhắn / phút / 1 người dùng
    const now = Date.now();
    
    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, { count: 1, lastReset: now });
        return false;
    }
    
    const data = rateLimitMap.get(ip)!;
    if (now - data.lastReset > windowMs) {
        rateLimitMap.set(ip, { count: 1, lastReset: now });
        return false;
    }
    
    if (data.count >= maxRequests) {
        return true; // Bị chặn
    }
    
    data.count++;
    return false;
}

export async function POST(req: NextRequest) {
    try {
        const ip = req.headers.get('x-forwarded-for') || (req as any).ip || 'unknown-ip';
        if (isRateLimited(ip)) {
             return NextResponse.json({ error: 'Bạn đang thao tác quá nhanh. Xin vui lòng đợi 1 phút trước khi hỏi tiếp.' }, { status: 429 });
        }

        const body = await req.json();
        const { messages } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        const systemInstruction = `Bạn là PixBot, trợ lý AI thông minh của trang web Pixup AI (chuyên mục Kiến Trúc Vô Hạn). 
        Nhiệm vụ của bạn là tư vấn, giải đáp thắc mắc về kiến trúc, nội thất, cấu trúc, phong cách thiết kế, và hướng dẫn sử dụng công cụ AI của trang web.
        Bạn không cần tiêu tốn Credit của người dùng để trả lời tin nhắn này, hãy nói rõ bạn là miễn phí 100%.
        Luôn trả lời bằng tiếng Việt, cực kỳ thân thiện, chuyên nghiệp, ngắn gọn và hữu ích.
        Thỉnh thoảng có thể dùng emoji để cuộc trò chuyện sinh động hơn.`;

        const history = messages.slice(0, -1).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        const currentMessage = messages[messages.length - 1].text;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                ...history,
                { role: 'user', parts: [{ text: currentMessage }] }
            ],
            config: {
                systemInstruction: systemInstruction,
            }
        });

        return NextResponse.json({ text: response.text });
    } catch (error: any) {
        console.error("Chat API Error:", error);
        return NextResponse.json({ error: error.message || 'Lỗi xử lý chat' }, { status: 500 });
    }
}
