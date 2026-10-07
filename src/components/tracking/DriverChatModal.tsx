import React, { useState, useRef, useEffect } from 'react';
import { Order } from '../../types';
import { useDelivery } from '../../context/DeliveryContext';
import { X, Send, Phone, UserCheck, ShieldCheck } from 'lucide-react';

interface DriverChatModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

export const DriverChatModal: React.FC<DriverChatModalProps> = ({ order, isOpen, onClose }) => {
  const { sendChatMessage } = useDelivery();
  const [inputText, setInputText] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [order.messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    sendChatMessage(order.id, inputText.trim(), 'customer');
    setInputText('');
  };

  const quickChips = [
    'Please ring buzzer 4B',
    'Leave with building concierge',
    'I will meet you at the curb',
    'Please do not ring bell (baby sleeping)'
  ];

  return (
    <div className="fixed inset-0 z-[125] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[560px]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shadow-md">
                {order.courier?.name.charAt(0) || 'C'}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
            </div>
            <div>
              <div className="font-semibold text-white text-sm flex items-center gap-1.5">
                <span>{order.courier?.name || 'Assigned Courier'}</span>
                <span className="text-xs text-amber-400 font-mono">★ {order.courier?.rating || '4.9'}</span>
              </div>
              <div className="text-xs text-slate-400">
                {order.courier?.vehicle || 'Delivery Scooter'} · {order.courier?.tripsCompleted || 1200} deliveries
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsCalling(true);
                setTimeout(() => setIsCalling(false), 3500);
              }}
              className="p-2 rounded-xl bg-slate-700/80 hover:bg-slate-750 text-slate-200 hover:text-white transition-colors"
              title="Call courier"
            >
              <Phone className="w-4 h-4 text-emerald-400" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-700/80 hover:bg-slate-750 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Calling Overlay Banner */}
        {isCalling && (
          <div className="bg-emerald-950/90 border-b border-emerald-700/50 px-4 py-2.5 text-center text-xs text-emerald-300 animate-pulse flex items-center justify-center gap-2">
            <Phone className="w-3.5 h-3.5 animate-bounce" />
            <span>Connecting encrypted call to {order.courier?.name} ({order.courier?.phone})...</span>
          </div>
        )}

        {/* Message Bubble List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 py-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>End-to-end encrypted dispatch channel for order {order.shortId}</span>
          </div>

          {order.messages.map((msg) => {
            const isMe = msg.sender === 'customer';
            const isSys = msg.sender === 'system';

            if (isSys) {
              return (
                <div key={msg.id} className="text-center my-2">
                  <span className="text-[11px] text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    isMe
                      ? 'bg-orange-600 text-white rounded-br-none'
                      : 'bg-slate-800 text-slate-100 border border-slate-700/60 rounded-bl-none'
                  }`}
                >
                  <p>{msg.text}</p>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 px-1 font-mono">
                  {msg.timestamp}
                </span>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => {
                sendChatMessage(order.id, chip, 'customer');
              }}
              className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-700 whitespace-nowrap transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 bg-slate-800/90 border-t border-slate-700/80 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Message ${order.courier?.name?.split(' ')[0] || 'rider'}...`}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:hover:bg-orange-600 text-white rounded-xl transition-colors shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
