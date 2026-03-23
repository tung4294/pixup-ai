"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './icons';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
      { role: 'model', text: 'Chào bạn! Mình là PixBot, trợ lý AI của Pixup. Mình có thể tư vấn miễn phí 100% về kiến trúc, nội thất hoặc hướng dẫn bạn dùng web. Mình giúp gì được cho bạn?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
      if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
      if (!input.trim() || isLoading) return;
      
      const newMessages = [...messages, { role: 'user' as const, text: input }];
      setMessages(newMessages);
      setInput('');
      setIsLoading(true);

      try {
          const res = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ messages: newMessages })
          });
          
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Server error');
          
          setMessages(prev => [...prev, { role: 'model', text: data.text }]);
      } catch (error: any) {
          setMessages(prev => [...prev, { role: 'model', text: "Xin lỗi, hiện tại mình đang xử lý quá nhiều yêu cầu hoặc máy chủ gặp sự cố. Bạn thử lại sau vài giây nhé! 😓" }]);
      } finally {
          setIsLoading(false);
      }
  };

  return (
      <div className="fixed bottom-6 right-6 z-50">
          {isOpen && (
              <div className="bg-[var(--bg-surface-1)] border border-[var(--border-1)] shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded-2xl w-80 sm:w-96 h-[500px] flex flex-col mb-4 overflow-hidden transform transition-all duration-300 scale-100 origin-bottom-right drop-shadow-2xl">
                  <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-4 flex justify-between items-center text-white shadow-md z-10">
                      <div className="flex items-center gap-2">
                          <Icon name="sparkles" className="w-5 h-5 animate-pulse text-amber-300" />
                          <div className="flex flex-col leading-tight">
                              <span className="font-bold text-sm">PixBot AI Assistant</span>
                              <span className="text-[10px] text-orange-100 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-300 animate-pulse"></span> Sẵn sàng 24/7 (Miễn phí)</span>
                          </div>
                      </div>
                      <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 rounded-full p-1.5 transition-colors">
                          <Icon name="x-mark" className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[var(--bg-surface-2)]/30 relative">
                     <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, white 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                      {messages.map((msg, idx) => (
                          <div key={idx} className={`relative z-10 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm ${msg.role === 'user' ? 'bg-orange-600 text-white rounded-br-none' : 'bg-[var(--bg-surface-3)] text-[var(--text-primary)] rounded-bl-none border border-[var(--border-2)]'}`}>
                                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                              </div>
                          </div>
                      ))}
                      {isLoading && (
                          <div className="relative z-10 flex justify-start">
                              <div className="bg-[var(--bg-surface-3)] rounded-2xl rounded-bl-none px-4 py-3 shadow-sm border border-[var(--border-2)] flex gap-1.5">
                                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
                                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                              </div>
                          </div>
                      )}
                      <div ref={messagesEndRef} />
                  </div>
                  
                  <div className="p-3 bg-[var(--bg-surface-1)] border-t border-[var(--border-2)] z-10">
                      <div className="flex gap-2 relative">
                          <input 
                              type="text" 
                              value={input}
                              onChange={e => setInput(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleSend()}
                               placeholder="Hỏi PixBot tư vấn..."
                              className="w-full bg-[var(--bg-surface-4)] text-[var(--text-primary)] text-sm rounded-full pl-4 pr-11 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all placeholder:text-[var(--text-secondary)] shadow-inner"
                          />
                          <button 
                              onClick={handleSend}
                              disabled={!input.trim() || isLoading}
                              className="absolute right-1 top-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-full p-1.5 transition-all shadow disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                          >
                              <Icon name="paper-airplane" className="w-5 h-5 transform -rotate-45 ml-0.5 mt-0.5" />
                          </button>
                      </div>
                      <div className="text-center mt-2 flex items-center justify-center gap-1">
                        <Icon name="sparkles" className="w-3 h-3 text-amber-400" />
                        <span className="text-[10px] text-[var(--text-tertiary)] font-medium">Powered by Gemini 2.5 Flash Hỗ Trợ Pixup</span>
                      </div>
                  </div>
              </div>
          )}
          
          {!isOpen && (
              <button 
                  onClick={() => setIsOpen(true)}
                  className="bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-full p-4 shadow-[0_0_20px_rgba(249,115,22,0.5)] hover:shadow-[0_0_30px_rgba(249,115,22,0.8)] hover:scale-110 transition-all duration-300 animate-bounce flex items-center justify-center relative group"
              >
                  <Icon name="chat-bubble" className="w-8 h-8" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-[var(--bg-surface-1)]"></span>
                  </span>
                  <div className="absolute whitespace-nowrap right-full mr-4 bg-[var(--bg-surface-1)] text-[var(--text-primary)] text-xs font-bold py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity border border-[var(--border-2)] shadow-xl pointer-events-none">
                      Chat Miễn Phí với AI
                      <div className="absolute top-1/2 -right-1 w-2 h-2 transform -translate-y-1/2 rotate-45 bg-[var(--bg-surface-1)] border-t border-r border-[var(--border-2)]"></div>
                  </div>
              </button>
          )}
      </div>
  );
}
