import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// Check the status of a pending order (for frontend polling)
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const orderCode = searchParams.get('orderCode');

        if (!orderCode) {
            return NextResponse.json({ error: "Missing orderCode" }, { status: 400 });
        }

        const order = await prisma.pendingOrder.findUnique({
            where: { orderCode }
        });

        if (!order || order.userId !== session.user.id) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        // Also get updated user credits
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { credits: true }
        });

        return NextResponse.json({
            status: order.status,
            credits: order.credits,
            paidAt: order.paidAt,
            userCredits: user?.credits ?? 0,
        });

    } catch (error: any) {
        console.error("Check order error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
