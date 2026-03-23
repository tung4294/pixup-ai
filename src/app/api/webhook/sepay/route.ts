import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

// SePay Webhook Endpoint
// SePay sends POST here when a bank transfer is detected
// Docs: https://my.sepay.vn/userguide/webhooks
export async function POST(req: Request) {
    try {
        const body = await req.json();

        // SePay webhook payload fields:
        // id, gateway, transactionDate, accountNumber, code, content,
        // transferType, transferAmount, accumulated, subAccount, 
        // referenceCode, description
        
        const {
            id: sepayId,
            transferType,
            transferAmount,
            content,
            referenceCode,
        } = body;

        console.log('[SePay Webhook] Received:', JSON.stringify(body));

        // Only process incoming money
        if (transferType !== 'in') {
            return NextResponse.json({ success: true, message: 'Ignored: not money-in' });
        }

        if (!content || !transferAmount) {
            return NextResponse.json({ success: true, message: 'Ignored: missing content or amount' });
        }

        // Extract order code from transfer content
        // The content might contain extra text, so we search for PIX followed by digits
        const match = content.toUpperCase().match(/PIX\d{6}/);
        if (!match) {
            console.log('[SePay Webhook] No order code found in content:', content);
            return NextResponse.json({ success: true, message: 'Ignored: no order code in content' });
        }

        const orderCode = match[0];

        // Find the pending order
        const order = await prisma.pendingOrder.findUnique({
            where: { orderCode }
        });

        if (!order) {
            console.log('[SePay Webhook] Order not found:', orderCode);
            return NextResponse.json({ success: true, message: 'Order not found' });
        }

        if (order.status === 'paid') {
            console.log('[SePay Webhook] Order already paid:', orderCode);
            return NextResponse.json({ success: true, message: 'Already processed' });
        }

        // Verify amount matches (allow small difference for bank fees)
        if (transferAmount < order.amountVND) {
            console.log(`[SePay Webhook] Amount mismatch: expected ${order.amountVND}, got ${transferAmount}`);
            return NextResponse.json({ success: true, message: 'Amount too low' });
        }

        // Process the payment atomically
        await prisma.$transaction(async (tx) => {
            // Mark order as paid
            await tx.pendingOrder.update({
                where: { id: order.id },
                data: {
                    status: 'paid',
                    sepayId: sepayId,
                    referenceCode: referenceCode || null,
                    paidAt: new Date(),
                }
            });

            // Add credits to user
            await tx.user.update({
                where: { id: order.userId },
                data: { credits: { increment: order.credits } }
            });

            // Create transaction record
            await tx.transaction.create({
                data: {
                    userId: order.userId,
                    amount: order.credits,
                    type: 'topup',
                    note: `Nạp ${order.credits} credits - Mã: ${orderCode} - ${transferAmount.toLocaleString()}đ`
                }
            });
        });

        console.log(`[SePay Webhook] ✅ Order ${orderCode} fulfilled: +${order.credits} credits for user ${order.userId}`);

        return NextResponse.json({ success: true, message: 'Payment processed' });

    } catch (error: any) {
        console.error('[SePay Webhook] Error:', error);
        // Always return 200 to prevent SePay from retrying on server errors
        return NextResponse.json({ success: false, message: error.message }, { status: 200 });
    }
}
