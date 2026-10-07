import React, { useState } from 'react';
import { PhoneCall, Mail, MapPin, Clock, MessageSquare, CheckCircle2, Send } from 'lucide-react';

export const ContactPage: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: 'Order Inquiry', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
          Contact Customer Care
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          We are here to assist with your orders, payments, and delivery inquiries
        </p>
      </div>

      {/* Contact Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-2.5">
            <PhoneCall className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Telephone Line</h3>
          <p className="text-xs font-mono text-slate-700 mt-1">0800-VEYRANG</p>
          <p className="text-[11px] text-slate-400 mt-0.5">+234 1 800 2483</p>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2.5">
            <Mail className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Email Inquiries</h3>
          <p className="text-xs text-slate-700 mt-1 font-mono">support@veyrang.com</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Average reply in 15 mins</p>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-2.5">
            <MapPin className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Lagos Head Office</h3>
          <p className="text-xs text-slate-700 mt-1">14 Admiralty Way</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Lekki Phase 1, Lagos</p>
        </div>
      </div>

      {/* Support Hours Alert */}
      <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-center gap-2.5 text-xs text-orange-950 font-medium">
        <Clock className="w-4 h-4 text-orange-600 shrink-0" />
        <span>Live Dispatch & Support Hours: <strong>8:00 AM – 11:00 PM WAT</strong> (Monday to Sunday)</span>
      </div>

      {/* Message Form */}
      <div className="rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
        {submitted ? (
          <div className="text-center py-8 space-y-2 animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Message Dispatched!</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              A support specialist has received your inquiry and will follow up shortly via email or phone.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-3 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Send Another Inquiry
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-orange-600" />
              <span>Leave a Message</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Your Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amina Bello"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email or Phone *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 0802 345 8901"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message Topic</label>
              <select
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-orange-500 bg-white"
              >
                <option value="Order Inquiry">Active Food Order Inquiry</option>
                <option value="Payment Issue">Payment / Wallet Settlement</option>
                <option value="Missing Item">Missing or Damaged Item</option>
                <option value="Merchant Partnership">Restaurant Partnership</option>
                <option value="General Feedback">General App Feedback</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Your Message *</label>
              <textarea
                required
                rows={3}
                placeholder="Describe your issue or feedback in detail..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-orange-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-2xl bg-orange-600 text-white font-bold text-xs sm:text-sm hover:bg-orange-700 transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Message</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
