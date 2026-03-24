"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from './icons';
import { useSession } from 'next-auth/react';

type PaymentStep = 'select' | 'paying' | 'success';

interface OrderInfo {
    orderCode: string;
    amountVND: number;
    credits: number;
}

// ===== CONFIG: Thay bằng thông tin ngân hàng thật của bạn =====
const BANK_ID = 'MB';  // Ngân hàng Quân Đội (MB Bank)
const ACCOUNT_NUMBER = '0975113248';  // Số tài khoản nhận tiền (đã link SePay)
const ACCOUNT_NAME = 'DO PHUONG TUNG';  // Tên chủ tài khoản
// ===============================================================

export const TopUpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { update: updateSession } = useSession();
    const [step, setStep] = useState<PaymentStep>('select');
    const [order, setOrder] = useState<OrderInfo | null>(null);
    const [isCreatingOrder, setIsCreatingOrder] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    // Manual code redeem
    const [code, setCode] = useState('');
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [redeemResult, setRedeemResult] = useState<{ type: 'success' | 'error'; message: string; added?: number } | null>(null);

    const packs = [
        { id: 'starter', name: 'Gói Khởi Đầu', credits: 40, price: '20.000đ', amountVND: 20000, badge: null, highlight: false, pricePerImage: '500đ' },
        { id: 'basic', name: 'Gói Cơ Bản', credits: 120, price: '50.000đ', amountVND: 50000, badge: 'Phổ Biến', highlight: false, bonus: '+20%', pricePerImage: '416đ' },
        { id: 'value', name: 'Gói Tiết Kiệm', credits: 300, price: '100.000đ', amountVND: 100000, badge: 'Giá Tốt', highlight: true, bonus: '+50%', pricePerImage: '333đ' },
        { id: 'pro', name: 'Gói Chuyên Nghiệp', credits: 700, price: '200.000đ', amountVND: 200000, badge: 'Bán Chạy', highlight: false, bonus: '+75%', pricePerImage: '285đ' },
        { id: 'super', name: 'Gói Siêu Cấp', credits: 2000, price: '500.000đ', amountVND: 500000, badge: '💎 VIP', highlight: false, bonus: '+100%', pricePerImage: '250đ' },
    ];

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    // Poll for payment status
    const startPolling = useCallback((orderCode: string) => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/topup/status?orderCode=${orderCode}`);
                const data = await res.json();
                if (data.status === 'paid') {
                    if (pollRef.current) clearInterval(pollRef.current);
                    setStep('success');
                    await updateSession();
                }
            } catch {
                // Ignore polling errors
            }
        }, 5000); // Poll every 5 seconds
    }, [updateSession]);

    const handleSelectPack = async (packId: string) => {
        setIsCreatingOrder(true);
        setError(null);
        try {
            const res = await fetch('/api/topup/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packId })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setOrder({
                    orderCode: data.orderCode,
                    amountVND: data.amountVND,
                    credits: data.credits,
                });
                setStep('paying');
                startPolling(data.orderCode);
            } else {
                setError(data.error || 'Không thể tạo đơn hàng.');
            }
        } catch {
            setError('Lỗi kết nối. Vui lòng thử lại.');
        } finally {
            setIsCreatingOrder(false);
        }
    };

    const handleRedeem = async () => {
        if (!code.trim()) return;
        setIsRedeeming(true);
        setRedeemResult(null);
        try {
            const res = await fetch('/api/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code.trim() })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setRedeemResult({ type: 'success', message: data.message, added: data.added });
                setCode('');
                await updateSession();
            } else {
                setRedeemResult({ type: 'error', message: data.error || 'Đã xảy ra lỗi.' });
            }
        } catch {
            setRedeemResult({ type: 'error', message: 'Không thể kết nối.' });
        } finally {
            setIsRedeeming(false);
        }
    };

    const qrUrl = order ? `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NUMBER}-compact2.jpg?amount=${order.amountVND}&addInfo=${order.orderCode}&accountName=${encodeURIComponent(ACCOUNT_NAME)}` : '';

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-white/10 rounded-3xl shadow-[0_32px_128px_-16px_rgba(249,115,22,0.25)] max-w-lg w-full relative overflow-hidden" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors z-20 p-1">
                    <Icon name="x-mark" className="w-5 h-5"/>
                </button>

                {/* ===== STEP 1: Select Pack ===== */}
                {step === 'select' && (
                    <div className="p-6 md:p-8">
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                                <span className="text-xl">💎</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white font-montserrat tracking-tight">Nạp Pixup Credits</h2>
                                <p className="text-xs text-slate-400">Chuyển khoản tự động - nhận credit ngay</p>
                            </div>
                        </div>

                        {/* Credit Packs */}
                        <div className="space-y-3 mb-6">
                            {packs.map(pack => (
                                <button
                                    key={pack.id}
                                    onClick={() => handleSelectPack(pack.id)}
                                    disabled={isCreatingOrder}
                                    className={`w-full p-4 rounded-2xl text-left transition-all border-2 flex items-center justify-between group ${
                                        pack.highlight
                                            ? 'bg-gradient-to-r from-orange-600/20 to-amber-950/30 border-orange-500 hover:border-orange-400'
                                            : 'bg-slate-800/40 border-white/5 hover:border-orange-500/50'
                                    } ${isCreatingOrder ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`text-2xl font-black ${pack.id === 'super' ? 'bg-gradient-to-br from-yellow-300 via-orange-400 to-amber-600 bg-clip-text text-transparent' : pack.highlight ? 'text-orange-400' : 'text-white'}`}>
                                            {pack.credits.toLocaleString()}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">{pack.name}</div>
                                            <div className="flex gap-2 items-center">
                                                {pack.bonus && <div className="text-[10px] text-green-400 font-bold px-1.5 py-0.5 bg-green-400/10 rounded-md">Bonus {pack.bonus}</div>}
                                                <div className="text-[10px] text-slate-400 font-medium">Chỉ {pack.pricePerImage}/ảnh</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {pack.badge && (
                                            <span className="bg-orange-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase">{pack.badge}</span>
                                        )}
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-white">{pack.price}</div>
                                        </div>
                                        <Icon name="chevron-right" className="w-5 h-5 text-slate-500 group-hover:text-orange-400 transition-colors"/>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-900/40 border border-red-500/30 rounded-xl text-sm text-red-300 flex items-center gap-2">
                                <Icon name="x-circle" className="w-5 h-5 flex-shrink-0"/> {error}
                            </div>
                        )}

                        {/* Manual Code Redeem */}
                        <div className="border-t border-white/5 pt-5">
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-3">Hoặc nhập mã nạp</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={code}
                                    onChange={e => setCode(e.target.value.toUpperCase())}
                                    onKeyDown={e => e.key === 'Enter' && handleRedeem()}
                                    placeholder="PIX-XXXX-XXXX"
                                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono text-sm tracking-wider placeholder:text-slate-600 outline-none focus:border-orange-500 transition-colors"
                                    disabled={isRedeeming}
                                />
                                <button
                                    onClick={handleRedeem}
                                    disabled={isRedeeming || !code.trim()}
                                    className="px-4 bg-orange-500 hover:bg-orange-400 disabled:bg-slate-700 disabled:text-slate-500 text-black font-black rounded-xl transition-all text-sm"
                                >
                                    {isRedeeming ? '...' : 'Nạp'}
                                </button>
                            </div>
                            {redeemResult && (
                                <div className={`mt-3 p-3 rounded-xl text-sm font-semibold flex items-center gap-2 ${redeemResult.type === 'success' ? 'bg-green-900/40 border border-green-500/30 text-green-300' : 'bg-red-900/40 border border-red-500/30 text-red-300'}`}>
                                    <Icon name={redeemResult.type === 'success' ? 'check-circle' : 'x-circle'} className="w-4 h-4 flex-shrink-0"/>
                                    {redeemResult.message}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ===== STEP 2: Paying (Show QR + Polling) ===== */}
                {step === 'paying' && order && (
                    <div className="p-6 md:p-8">
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-300 px-4 py-2 rounded-full text-sm font-bold mb-4">
                                <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                                Đang chờ thanh toán...
                            </div>
                            <h2 className="text-xl font-black text-white mb-1">Quét QR để hoàn tất</h2>
                            <p className="text-sm text-slate-400">Mở app ngân hàng và quét mã bên dưới</p>
                        </div>

                        {/* QR Code */}
                        <div className="bg-white rounded-2xl p-3 mx-auto max-w-[260px] mb-6 shadow-2xl">
                            <img src={qrUrl} alt="QR Thanh Toán" className="w-full h-auto rounded-xl"/>
                        </div>

                        {/* Transfer Details */}
                        <div className="space-y-2 mb-6">
                            <div className="flex justify-between items-center bg-slate-800/60 px-4 py-3 rounded-xl">
                                <span className="text-xs text-slate-400 uppercase font-bold">Số tiền</span>
                                <span className="text-white font-black text-lg">{order.amountVND.toLocaleString()}đ</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-800/60 px-4 py-3 rounded-xl">
                                <span className="text-xs text-slate-400 uppercase font-bold">Nội dung CK</span>
                                <span className="text-orange-400 font-mono font-black text-lg select-all">{order.orderCode}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-800/60 px-4 py-3 rounded-xl">
                                <span className="text-xs text-slate-400 uppercase font-bold">Nhận</span>
                                <span className="text-green-400 font-bold">+{order.credits} Credits 💎</span>
                            </div>
                        </div>

                        <div className="bg-amber-900/20 border border-amber-500/20 p-3 rounded-xl text-center">
                            <p className="text-xs text-amber-200"><strong>⚡ Tự động xác nhận</strong> — Credit sẽ được cộng ngay sau khi hệ thống nhận được chuyển khoản. Không cần liên hệ admin.</p>
                        </div>

                        <button onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setStep('select'); setOrder(null); }} className="w-full mt-4 py-3 text-slate-400 hover:text-white text-sm transition-colors">
                            ← Quay lại chọn gói khác
                        </button>
                    </div>
                )}

                {/* ===== STEP 3: Success ===== */}
                {step === 'success' && order && (
                    <div className="p-6 md:p-8 text-center">
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-green-500/30">
                            <Icon name="check-circle" className="w-12 h-12 text-green-400"/>
                        </div>
                        <h2 className="text-2xl font-black text-white mb-2">Nạp Thành Công! 🎉</h2>
                        <p className="text-slate-400 mb-6">Bạn đã nhận được <span className="text-orange-400 font-bold">{order.credits} Credits</span></p>
                        
                        <div className="bg-green-900/20 border border-green-500/20 p-4 rounded-2xl mb-6">
                            <div className="text-3xl font-black text-green-400 mb-1">+{order.credits} 💎</div>
                            <div className="text-xs text-green-300/60 font-mono">{order.orderCode}</div>
                        </div>

                        <button onClick={onClose} className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-black font-black rounded-xl transition-all text-sm">
                            Bắt Đầu Sáng Tạo
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
