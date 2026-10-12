'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, ShieldCheck, Clock3, AlertTriangle, LoaderCircle, Star, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api';

type HandoverDetails = { orderReference: string; restaurantName?: string; status: string; expiresAt: string };
export default function HandoverPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = typeof params?.token === 'string' ? params.token : '';
  const [details, setDetails] = useState<HandoverDetails | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) return;
    api.orders.getHandoverDetails(token).then((result: any) => {
      if (!active) return;
      const data = result?.data || result;
      setDetails(data);
    }).catch((e: any) => {
      if (active) setError(e?.message || 'This handover link is invalid, expired, or already used.');
    });
    return () => { active = false; };
  }, [token]);

  const confirm = async () => {
    setBusy(true); setError('');
    try {
      const result: any = await api.orders.confirmQrHandover(token);
      const data = result?.data || result;
      // Only show success after the server explicitly confirms the state transition.
      if (data?.status !== 'delivered') throw new Error('The server did not confirm delivery.');
      setConfirmed(true);
      setDetails((previous) => previous ? { ...previous, status: 'delivered' } : previous);
    } catch (e: any) {
      setError(e?.message || 'Delivery could not be confirmed. Please retry or contact support.');
    } finally { setBusy(false); }
  };

  const expired = details ? new Date(details.expiresAt).getTime() <= Date.now() : false;
  return (
    <main className="min-h-[70vh] w-full max-w-xl mx-auto px-4 py-8 sm:py-14">
      <button onClick={() => router.push('/')} className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#0D4F3C]"><ArrowLeft className="h-4 w-4" /> Back to VeyraNG</button>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="bg-gradient-to-r from-[#0D4F3C] to-[#147A5A] p-6 text-white sm:p-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><ShieldCheck className="h-6 w-6" /></div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E8C547]">VeyraNG · Secure Handover</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">{confirmed ? 'Delivery confirmed' : 'Confirm your delivery'}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-200">Confirm receipt only when the food is physically with you. Your confirmation is checked by VeyraNG's server.</p>
        </div>
        <div className="space-y-5 p-6 sm:p-8">
          {error && <div role="alert" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="h-5 w-5 shrink-0" />{error}</div>}
          {!details && !error && <div className="flex items-center gap-3 py-8 text-slate-600"><LoaderCircle className="h-5 w-5 animate-spin" /> Validating your secure handover link…</div>}
          {details && <>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Order reference</p>
              <p className="mt-0.5 font-mono text-lg font-black text-slate-900">{details.orderReference}</p>
              {details.restaurantName && <p className="mt-0.5 text-xs text-slate-600">From {details.restaurantName}</p>}
              <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500"><Clock3 className="h-3.5 w-3.5" /> Link expires {new Date(details.expiresAt).toLocaleString()}</p>
            </div>
            {confirmed ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900"><CheckCircle2 className="mb-1 h-5 w-5" /><p className="text-xs font-bold">Receipt recorded securely.</p><p className="mt-0.5 text-[10px]">You can now open Order History to leave feedback.</p><button onClick={() => router.push('/?page=orders')} className="mt-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Go to order history</button></div>
            : <><p className="text-xs leading-5 text-slate-600">For privacy, this page does not display your delivery address or phone number.</p><button disabled={busy || expired || details.status === 'delivered'} onClick={() => void confirm()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0D4F3C] px-4 py-3 text-xs font-extrabold text-white shadow-md shadow-[#0D4F3C]/20 transition hover:bg-[#0A3F30] disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{busy ? 'Confirming securely…' : expired ? 'Link expired' : details.status === 'delivered' ? 'Already delivered' : 'I have received my order'}</button></>}
          </>}
          <div className="flex gap-2 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" /> QR links are temporary. Never confirm receipt before the order arrives.</div>
        </div>
      </section>
    </main>
  );
}
