'use client';

import React, { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDelivery } from '../../src/context/DeliveryContext';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';

function PaystackReturnHandlerInner() {
  const searchParams = useSearchParams();
  const { refreshData } = useDelivery();
  const { refreshUser } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ref = searchParams?.get('reference') || searchParams?.get('trxref');
    if (!ref) return;

    let cancelled = false;
    (async () => {
      try {
        const result: any = await api.payment.verify(ref);
        const verified =
          result?.isPaid === true ||
          result?.status === 'success' ||
          result?.data?.status === 'success' ||
          result?.data?.isPaid === true;
        if (!verified) {
          console.warn('Paystack payment is not yet confirmed:', result?.error || result?.status || 'verification pending');
          return;
        }
        if (cancelled) return;
        if (refreshUser) await refreshUser();
        if (typeof refreshData === 'function') await refreshData();

        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('reference');
        cleanUrl.searchParams.delete('trxref');
        cleanUrl.searchParams.delete('order_id');
        window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
      } catch (err) {
        console.warn('Paystack callback reconciliation warning:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, refreshUser, refreshData]);

  return null;
}

export function PaystackReturnHandler() {
  return (
    <Suspense fallback={null}>
      <PaystackReturnHandlerInner />
    </Suspense>
  );
}
