import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import crypto from 'crypto';

// Admin-only endpoint to generate top-up codes
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { adminSecret, credits, quantity = 1 } = body;

        // Verify admin secret
        const expectedSecret = process.env.ADMIN_SECRET;
        if (!expectedSecret || adminSecret !== expectedSecret) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        if (!credits || credits < 1 || credits > 10000) {
            return NextResponse.json({ error: "Credits must be between 1 and 10000." }, { status: 400 });
        }

        const count = Math.min(Math.max(1, quantity), 100); // Max 100 codes at once

        const codes: string[] = [];
        for (let i = 0; i < count; i++) {
            // Generate a readable code like "PIX-XXXX-XXXX"
            const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
            const code = `PIX-${randomPart.slice(0, 4)}-${randomPart.slice(4, 8)}`;
            
            await prisma.topUpCode.create({
                data: { code, credits }
            });
            
            codes.push(code);
        }

        return NextResponse.json({ 
            success: true, 
            codes,
            credits,
            message: `Generated ${count} code(s) with ${credits} credits each.`
        });

    } catch (error: any) {
        console.error("Generate code error:", error);
        return NextResponse.json({ error: error.message || "Failed to generate codes" }, { status: 500 });
    }
}
