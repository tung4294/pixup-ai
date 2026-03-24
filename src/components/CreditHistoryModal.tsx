"use client";
import React, { useState, useEffect } from 'react';
import { Icon } from './icons';

interface Transaction {
    id: string;
    amount: number;
    type: string;
    note: string | null;
    createdAt: string;
}

export const CreditHistoryModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch('/api/user/transactions');
                const data = await res.json();
                if (res.ok) {
                    setTransactions(data.transactions || []);
                } else {
                    setError(data.error || "Không thể tải lịch sử.");
                }
            } catch {
                setError("Lỗi kết nối.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, []);

    return (
        <div 
            className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[110] p-4" 
            onClick={onClose}
        >
            <div 
                className="bg-slate-900 border border-white/10 rounded-3xl shadow-[0_32px_128px_-16px_rgba(30,41,59,0.5)] max-w-lg w-full relative overflow-hidden flex flex-col max-h-[85vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                            <Icon name="clock" className="w-5 h-5 text-amber-500"/>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white font-montserrat tracking-tight uppercase">Lịch sử Credit</h2>
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Giao dịch của bạn</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-slate-500 hover:text-white transition-colors p-2"
                    >
                        <Icon name="x-mark" className="w-6 h-6"/>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2">
                    {isLoading ? (
                        <div className="py-20 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mb-4"></div>
                            <p className="text-slate-400 text-sm">Đang tải lịch sử...</p>
                        </div>
                    ) : error ? (
                        <div className="py-20 text-center">
                            <Icon name="x-circle" className="w-12 h-12 text-red-500/50 mx-auto mb-4"/>
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="py-20 text-center">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Icon name="credit-card" className="w-10 h-10 text-slate-700"/>
                            </div>
                            <h3 className="text-white font-bold mb-2">Chưa có giao dịch</h3>
                            <p className="text-slate-500 text-sm max-w-[240px] mx-auto">Các giao dịch nạp và sử dụng credit của bạn sẽ xuất hiện tại đây.</p>
                        </div>
                    ) : (
                        transactions.map((tx) => {
                            const isUsage = tx.type === 'usage';
                            const date = new Date(tx.createdAt);
                            const displayDate = date.toLocaleDateString('vi-VN', { 
                                day: '2-digit', 
                                month: '2-digit',
                                year: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                            });

                            return (
                                <div 
                                    key={tx.id} 
                                    className="bg-white/5 border border-white/5 hover:border-white/10 p-4 rounded-2xl flex items-center justify-between transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isUsage ? 'bg-orange-500/10' : 'bg-green-500/10'}`}>
                                            <Icon 
                                                name={isUsage ? 'bolt' : 'arrow-down-tray'} 
                                                className={`w-5 h-5 ${isUsage ? 'text-orange-500' : 'text-green-500'}`}
                                            />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                                                {tx.note || (isUsage ? "Sử dụng dịch vụ" : "Nạp Credit")}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-medium">{displayDate}</div>
                                        </div>
                                    </div>
                                    <div className="text-right leading-tight">
                                        <div className={`text-sm font-black font-mono ${isUsage ? 'text-slate-300' : 'text-green-400'}`}>
                                            {isUsage ? '-' : '+'}{Math.abs(tx.amount).toLocaleString()} 💎
                                        </div>
                                        <div className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">
                                            {tx.type}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-black/20 text-center">
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">Pixup Premium Ledger System</p>
                </div>
            </div>
        </div>
    );
};
