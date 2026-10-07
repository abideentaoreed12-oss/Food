import React from 'react';
import { FileText, ShieldAlert, Clock, RefreshCw } from 'lucide-react';
import { useDelivery } from '../../context/DeliveryContext';

export const TermsPage: React.FC = () => {
  const { platformSettings } = useDelivery();

  return (
    <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
          {platformSettings['cms_terms_title'] || 'Terms of Service'}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {platformSettings['cms_terms_effective_date'] || 'Effective date: October 2026 · Governing food delivery operations across Nigeria'}
        </p>
      </div>

      <div className="rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5 text-xs text-slate-600 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-orange-600" />
            <span>{platformSettings['cms_terms_s1_title'] || '1. Platform Overview & Ordering Rules'}</span>
          </h2>
          <p>
            {platformSettings['cms_terms_s1_content'] || 'Veyrang operates a multi-restaurant culinary marketplace connecting consumers with vetted Nigerian restaurants, cloud kitchens, and independent couriers. By placing an order via Veyrang, you agree to enter into a direct purchase contract with the designated food merchant.'}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-orange-600" />
            <span>{platformSettings['cms_terms_s2_title'] || '2. Delivery Times & Handover PIN Verification'}</span>
          </h2>
          <p>
            {platformSettings['cms_terms_s2_content'] || 'Estimated arrival times (ETAs) are calculated algorithmically based on kitchen prep velocity and real-time traffic conditions in Lagos and Abuja. To safeguard your meal, every delivery requires verification of the 4-digit Handover PIN generated at checkout before the courier releases the sealed parcel.'}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4 text-orange-600" />
            <span>{platformSettings['cms_terms_s3_title'] || '3. Cancellation & Refund Policy'}</span>
          </h2>
          <p>
            {platformSettings['cms_terms_s3_content'] || 'Orders can be cancelled free of charge within 60 seconds of checkout before the merchant accepts the ticket. Once cooking commences, cancellations cannot be accepted. In the event of confirmed missing items, damaged food, or restaurant unavailability, full refunds are issued directly to your Veyrang in-app Wallet.'}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-orange-600" />
            <span>{platformSettings['cms_terms_s4_title'] || '4. Dietary Allergic Requirements'}</span>
          </h2>
          <p>
            {platformSettings['cms_terms_s4_content'] || 'While restaurant partners list ingredients and dietary indicators (Halal, Vegan, Gluten-Free), cross-contamination in shared commercial kitchens may occur. Customers with severe allergies must note instructions in the dish modifier comments before placing an order.'}
          </p>
        </section>
      </div>
    </div>
  );
};
