import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Vui lòng đăng nhập để nạp credit." }, { status: 401 });
        }

        const body = await req.json();
        const { code } = body;

        if (!code || typeof code !== 'string' || code.trim().length === 0) {
            return NextResponse.json({ error: "Mã nạp không hợp lệ." }, { status: 400 });
        }

        const trimmedCode = code.trim().toUpperCase();

        // Find the code
        const topUpCode = await prisma.topUpCode.findUnique({
            where: { code: trimmedCode }
        });

        if (!topUpCode) {
            return NextResponse.json({ error: "Mã nạp không tồn tại. Vui lòng kiểm tra lại." }, { status: 404 });
        }

        if (topUpCode.used) {
            return NextResponse.json({ error: "Mã nạp đã được sử dụng trước đó." }, { status: 409 });
        }

        // Use a transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
            // Mark code as used
            await tx.topUpCode.update({
                where: { id: topUpCode.id },
                data: { 
                    used: true, 
                    usedById: session.user.id, 
                    usedAt: new Date() 
                }
            });

            // Add credits to user
            const updatedUser = await tx.user.update({
                where: { id: session.user.id },
                data: { credits: { increment: topUpCode.credits } }
            });

            // Create transaction record
            await tx.transaction.create({
                data: {
                    userId: session.user.id,
                    amount: topUpCode.credits,
                    type: 'topup',
                    note: `Nạp ${topUpCode.credits} credits bằng mã ${trimmedCode}`
                }
            });

            return updatedUser;
        });

        return NextResponse.json({ 
            success: true, 
            message: `Nạp thành công ${topUpCode.credits} credits!`,
            credits: result.credits,
            added: topUpCode.credits
        });

    } catch (error: any) {
        console.error("Top-up error:", error);
        return NextResponse.json({ error: "Đã xảy ra lỗi khi nạp credit. Vui lòng thử lại." }, { status: 500 });
    }
}
