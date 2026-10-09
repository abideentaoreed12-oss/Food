import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Mail, MessageCircle, Phone, Send, ShieldCheck, TicketCheck } from 'lucide-react';
import { useDelivery } from '../../context/DeliveryContext';

type Ticket = { id: string; subject: string; message: string; status: string; admin_reply?: string; created_at?: string };

const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 placeholder:text-slate-400';
const topics = [
  ['order', 'Order or delivery'], ['payment', 'Payment or wallet'], ['refund', 'Refund or missing item'],
  ['account', 'Account access'], ['restaurant', 'Restaurant partnership'], ['other', 'Something else']
];

export const ContactPage: React.FC = () => {
  const { platformSettings } = useDelivery();
  const [form, setForm] = useState({ name: '', email: '', subject: 'Order or delivery', orderReference: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [lookupId, setLookupId] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [foundTicket, setFoundTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    if (!ticket?.id) return;
    const refresh = async () => {
      try {
        const res = await fetch('/api/support/tickets/lookup?ticketId=' + encodeURIComponent(ticket.id) + '&email=' + encodeURIComponent(form.email), { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json.data) setTicket(json.data);
      } catch { /* Keep the confirmation visible while offline. */ }
    };
    const timer = window.setInterval(refresh, 20000);
    return () => window.clearInterval(timer);
  }, [ticket?.id, form.email]);

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, subject: form.subject, orderReference: form.orderReference.trim() })
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.data?.id) throw new Error(json.error || 'Your request could not be submitted. Please try again.');
      setTicket(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit your support request right now.');
    } finally { setBusy(false); }
  };

  const lookupTicket = async (e: React.FormEvent) => {
    e.preventDefault(); setLookupBusy(true); setLookupError(''); setFoundTicket(null);
    try {
      const res = await fetch('/api/support/tickets/lookup?ticketId=' + encodeURIComponent(lookupId.trim()) + '&email=' + encodeURIComponent(lookupEmail.trim()), { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json.error || 'We could not find a ticket matching those details.');
      setFoundTicket(json.data);
    } catch (err) { setLookupError(err instanceof Error ? err.message : 'Could not check ticket status.'); }
    finally { setLookupBusy(false); }
  };

  const supportPhone = platformSettings?.cms_support_phone || '';
  const supportEmail = platformSettings?.cms_support_email || 'support@veyrang.com';

  return (
    <div className="min-h-[70vh] bg-slate-50 pb-16">
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #f97316 0, transparent 34%), radial-gradient(circle at 10% 100%, #475569 0, transparent 38%)' }} />
        <div className="relative mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-orange-200"><ShieldCheck className="h-4 w-4" /> VEYRANG CUSTOMER CARE</p>
          <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">How can we help you today?</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">Tell us what happened. Every support request receives a ticket reference so you can follow up and see the team's response.</p>
          <div className="mt-7 flex flex-wrap gap-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2"><TicketCheck className="h-4 w-4 text-orange-300" /> Trackable support tickets</span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2"><Clock3 className="h-4 w-4 text-orange-300" /> Updates saved to your ticket</span>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.8fr)] lg:py-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          {ticket ? (
            <div className="py-5">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-7 w-7" /></div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Request submitted</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Your ticket is in the support queue.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Keep this reference. The support team can review your request in the admin console, and any reply will appear here when you check the ticket.</p>
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-500">TICKET REFERENCE</div>
                <div className="mt-1 break-all font-mono text-lg font-bold text-slate-950">{ticket.id}</div>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">Status</span><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-800">{ticket.status || 'open'}</span></div>
                {ticket.admin_reply && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Reply from Veyrang Support</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-950">{ticket.admin_reply}</p></div>}
              </div>
              <button onClick={() => { setTicket(null); setForm({ name: '', email: '', subject: 'Order or delivery', orderReference: '', message: '' }); }} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">Submit another request <ArrowRight className="h-4 w-4" /></button>
            </div>
          ) : (
            <>
              <div className="mb-6"><p className="text-xs font-bold uppercase tracking-widest text-orange-600">Contact support</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Submit a support ticket</h2><p className="mt-2 text-sm leading-6 text-slate-500">Share enough detail for our team to investigate. Fields marked * are required.</p></div>
              <form onSubmit={submitTicket} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">Full name *<input required maxLength={100} autoComplete="name" className={fieldClass + ' mt-2'} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></label>
                  <label className="block text-sm font-semibold text-slate-700">Email address *<input required type="email" maxLength={254} autoComplete="email" className={fieldClass + ' mt-2'} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label>
                </div>
                <label className="block text-sm font-semibold text-slate-700">What do you need help with? *<select className={fieldClass + ' mt-2'} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>{topics.map(([value,label]) => <option key={value} value={label}>{label}</option>)}</select></label>
                <label className="block text-sm font-semibold text-slate-700">Order reference (optional)<input maxLength={100} className={fieldClass + ' mt-2'} value={form.orderReference} onChange={e => setForm({ ...form, orderReference: e.target.value })} placeholder="Order number, if applicable" /></label>
                <label className="block text-sm font-semibold text-slate-700">Describe the issue *<textarea required minLength={10} maxLength={4000} rows={6} className={fieldClass + ' mt-2 resize-y'} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Tell us what happened and what outcome would help..." /><span className="mt-1 block text-right text-xs font-normal text-slate-400">{form.message.length}/4000</span></label>
                {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
                <button disabled={busy} type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">{busy ? 'Submitting request…' : 'Submit support request'} <Send className="h-4 w-4" /></button>
                <p className="text-xs leading-5 text-slate-400">Please do not include passwords, one-time codes, or full payment card details.</p>
              </form>
            </>
          )}
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-slate-950">Track an existing ticket</h2><p className="mt-1 text-sm leading-6 text-slate-500">Enter your ticket reference and the email address used to submit it.</p>
            <form onSubmit={lookupTicket} className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-600">Ticket reference<input required className={fieldClass + ' mt-1.5'} value={lookupId} onChange={e => setLookupId(e.target.value)} placeholder="e.g. VT-…" /></label>
              <label className="block text-xs font-semibold text-slate-600">Email address<input required type="email" className={fieldClass + ' mt-1.5'} value={lookupEmail} onChange={e => setLookupEmail(e.target.value)} placeholder="you@example.com" /></label>
              {lookupError && <p role="alert" className="text-xs text-rose-600">{lookupError}</p>}
              <button disabled={lookupBusy} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-60">{lookupBusy ? 'Checking…' : 'Check ticket status'}</button>
            </form>
            {foundTicket && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><span className="font-mono text-xs font-bold text-slate-700">{foundTicket.id}</span><span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold capitalize text-orange-800">{foundTicket.status}</span></div><p className="mt-3 text-sm font-semibold text-slate-900">{foundTicket.subject}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{foundTicket.message}</p>{foundTicket.admin_reply && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-800">Support reply</p><p className="mt-1 whitespace-pre-wrap text-sm text-emerald-950">{foundTicket.admin_reply}</p></div>}</div>}
          </section>
          <section className="rounded-2xl bg-slate-950 p-5 text-white sm:p-6">
            <h2 className="text-lg font-bold">Other ways to reach us</h2><p className="mt-1 text-sm leading-6 text-slate-300">Choose a contact channel for general enquiries. For issues that need follow-up, submit a ticket so the details are recorded.</p>
            <div className="mt-5 space-y-4">
              {supportEmail && <a href={'mailto:' + supportEmail} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10"><span className="rounded-lg bg-white/10 p-2"><Mail className="h-4 w-4 text-orange-300" /></span><span><span className="block text-xs text-slate-400">Email</span><span className="mt-1 block break-all text-sm font-semibold">{supportEmail}</span></span></a>}
              {supportPhone && <a href={'tel:' + supportPhone.replace(/[^+\d]/g, '')} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10"><span className="rounded-lg bg-white/10 p-2"><Phone className="h-4 w-4 text-orange-300" /></span><span><span className="block text-xs text-slate-400">Phone</span><span className="mt-1 block text-sm font-semibold">{supportPhone}</span></span></a>}
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3"><span className="rounded-lg bg-white/10 p-2"><MessageCircle className="h-4 w-4 text-orange-300" /></span><span><span className="block text-xs text-slate-400">Support hours</span><span className="mt-1 block text-sm font-semibold">{platformSettings?.cms_support_hours || 'Daily support hours are shown in the app.'}</span></span></div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
