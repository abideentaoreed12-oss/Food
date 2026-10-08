'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

function PaymentCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const orderId = searchParams.get('order_id');

  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!reference) {
      setStatus('failed');
      setErrorMessage('No payment reference found.');
      return;
    }

    async function verifyPayment() {
      try {
        const res = await fetch(`/api/payments/verify?reference=${encodeURIComponent(reference as string)}`);
        const data = await res.json();
        if (res.ok && (data.success || data.isPaid)) {
          setStatus('success');
          setTimeout(() => {
            router.push(orderId ? `/?order_id=${orderId}` : '/');
          }, 3000);
        } else {
          setStatus('failed');
          setErrorMessage(data.error || 'Payment verification failed.');
        }
      } catch (err: any) {
        setStatus('failed');
        setErrorMessage(err.message || 'Network error during verification.');
      }
    }

    verifyPayment();
  }, [reference, orderId, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
        {status === 'verifying' && (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
            <h1 className="text-xl font-bold">Verifying Payment...</h1>
            <p className="text-slate-400 text-sm">Please wait while we confirm your transaction with Paystack.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 animate-bounce" />
            <h1 className="text-2xl font-bold text-emerald-400">Payment Successful!</h1>
            <p className="text-slate-300 text-sm">Your order has been paid and is now being prepared by the kitchen.</p>
            <p className="text-xs text-slate-500">Redirecting to your order tracking...</p>
          </div>
        )}

        {status === 'failed' && (
          <div className="flex flex-col items-center space-y-4">
            <XCircle className="w-16 h-16 text-rose-500" />
            <h1 className="text-2xl font-bold text-rose-400">Payment Failed</h1>
            <p className="text-slate-300 text-sm">{errorMessage}</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all"
            >
              Return to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
          <h1 className="text-xl font-bold">Loading Payment Callback...</h1>
        </div>
      </div>
    }>
      <PaymentCallbackContent />
    </Suspense>
  );
}
