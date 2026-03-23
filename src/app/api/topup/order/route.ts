import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// Create a pending order when user selects a credit pack
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
        }

        const body = await req.json();
        const { packId } = body;

        // Define credit packs (must match frontend TopUpModal.tsx)
        const packs: Record<string, { credits: number; amountVND: number }> = {
            starter: { credits: 10,  amountVND: 20000 },
            basic:   { credits: 30,  amountVND: 50000 },
            value:   { credits: 65,  amountVND: 100000 },
            pro:     { credits: 140, amountVND: 200000 },
            super:   { credits: 400, amountVND: 500000 },
        };

        const pack = packs[packId];
        if (!pack) {
            return NextResponse.json({ error: "Gói không hợp lệ." }, { status: 400 });
        }

        // Generate unique order code: PIX + 6 random digits
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        const orderCode = `PIX${randomNum}`;

        // Create pending order
        const order = await prisma.pendingOrder.create({
            data: {
                orderCode,
                userId: session.user.id,
                credits: pack.credits,
                amountVND: pack.amountVND,
                status: 'pending',
            }
        });

        return NextResponse.json({
            success: true,
            orderCode: order.orderCode,
            amountVND: order.amountVND,
            credits: order.credits,
            orderId: order.id,
        });

    } catch (error: any) {
        console.error("Create order error:", error);
        return NextResponse.json({ error: "Không thể tạo đơn hàng." }, { status: 500 });
    }
}
