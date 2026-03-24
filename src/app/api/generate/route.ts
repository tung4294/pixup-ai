import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60; // Allow longer execution time for image gen

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 401 });
        }

        const body = await req.json();
        const { modelId, parts, config } = body;

        // TÍNH TOÁN CREDIT DỰA TRÊN PAYLOAD (x100 inflation system)
        const imageConfig = config?.imageConfig || {};
        const count = imageConfig.numberOfImages || 1;
        const size = imageConfig.imageSize || '1K';
        
        let baseCredits = 100; // 1K = 100 credits
        if (size === '2K') baseCredits = 200;
        if (size === '4K') baseCredits = 400;
        
        const requiredCredits = count * baseCredits;

        const user = await prisma.user.findUnique({ where: { id: session.user.id } });
        if (!user || user.credits < requiredCredits) {
            return NextResponse.json({ error: "Thanh toán thất bại: Không đủ Pixup Credits." }, { status: 403 });
        }

        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_API_KEY;
        if (!apiKey) {
            console.error("Missing GEMINI_API_KEY in environment");
             return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: modelId,
            contents: { parts },
            config
        });

        // Deduct calculated credits logic
        await prisma.user.update({
            where: { id: session.user.id },
            data: { credits: { decrement: requiredCredits } }
        });

        return NextResponse.json(response);

    } catch (error: any) {
        console.error("API Generation error:", error);
        return NextResponse.json({ error: error.message || "Generation failed" }, { status: error.status || 500 });
    }
}
