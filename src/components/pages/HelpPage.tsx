import React, { useState } from 'react';
import { HelpCircle, ChevronDown, Phone, MessageSquare, ShieldCheck, Clock } from 'lucide-react';

export const HelpPage: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How long does doorstep delivery take in Lagos?',
      a: 'Average delivery takes between 25 to 35 minutes depending on traffic and your delivery zone (Lekki Phase 1, Victoria Island, Ikoyi, Ikeja). You can monitor your order progress in real-time in the My Orders tab.'
    },
    {
      q: 'What payment methods do you accept?',
      a: 'Veyrang accepts all debit cards, instant Bank Transfer / Virtual Accounts, and Veyrang in-app Wallet balances.'
    },
    {
      q: 'How does the Handover PIN work?',
      a: 'Every delivery is assigned a unique 4-digit Handover PIN (visible in your order details). When your rider arrives at your gate or door, share this code with them to verify that the meal was delivered to the right person.'
    },
    {
      q: 'Can I cancel or modify my food order after placing it?',
      a: 'You can cancel an order within 60 seconds of placing it before the kitchen accepts the ticket. Once the kitchen starts food preparation, orders cannot be cancelled to prevent food waste.'
    },
    {
      q: 'How do refunds work if an item is missing or sold out?',
      a: 'If a kitchen 86s (sells out) an item or an issue arises, refunds are instantly credited to your Veyrang Wallet balance with zero deduction, ready for your next meal or bank payout.'
    },
    {
      q: 'What is the delivery fee and minimum order?',
      a: 'Delivery fees start at ₦500 within your local neighborhood zone. Minimum order values vary by restaurant (typically ₦1,500 to ₦2,000).'
    }
  ];

  return (
    <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
          Help & Support
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Frequently asked questions, delivery policies, and customer support
        </p>
      </div>

      {/* Direct Support Channels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          href="https://wa.me/2348007842524"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 rounded-3xl bg-emerald-50 border border-emerald-200 hover:border-emerald-300 transition-all flex items-center gap-3.5 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">WhatsApp Support</div>
            <div className="text-sm font-bold text-emerald-950">Chat with Customer Care</div>
            <div className="text-[11px] text-emerald-600">Available 8am – 11pm WAT</div>
          </div>
        </a>

        <a
          href="tel:+23418002483"
          className="p-4 rounded-3xl bg-orange-50 border border-orange-200 hover:border-orange-300 transition-all flex items-center gap-3.5 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center shrink-0">
            <Phone className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-orange-700">Toll-Free Hotline</div>
            <div className="text-sm font-bold text-orange-950">0800-VEYRANG</div>
            <div className="text-[11px] text-orange-600">Direct telephone support</div>
          </div>
        </a>
      </div>

      {/* FAQ Accordion */}
      <div className="rounded-3xl bg-white border border-slate-200/90 p-5 shadow-2xs space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
          Frequently Asked Questions
        </h2>

        <div className="space-y-2">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;

            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-100 bg-slate-50/50 overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full text-left p-3.5 flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-slate-900 cursor-pointer hover:text-orange-600"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                      isOpen ? 'rotate-180 text-orange-600' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-3.5 pb-3.5 text-xs text-slate-600 leading-relaxed border-t border-slate-100/80 pt-2 animate-in fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
