import React from 'react';
import { Shield, Lock, Eye, Database } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
          Privacy Policy
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          How Veyrang protects your personal data under the Nigeria Data Protection Act (NDPA)
        </p>
      </div>

      <div className="rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5 text-xs text-slate-600 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-orange-600" />
            <span>1. Information We Collect</span>
          </h2>
          <p>
            Veyrang collects your name, Nigerian mobile phone number, email address, and delivery coordinates strictly to fulfill orders, communicate delivery status updates, and verify doorstep handovers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-orange-600" />
            <span>2. Courier Access & Privacy Masking</span>
          </h2>
          <p>
            Assigned courier riders only receive your destination delivery address and phone number for the active duration of the trip. Contact numbers are masked after the delivery is marked as completed.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-orange-600" />
            <span>3. Payment Security & PCI-DSS Compliance</span>
          </h2>
          <p>
            Veyrang never stores raw debit card numbers or bank account PINs on our servers. All financial transactions are tokenized and processed through PCI-DSS Level 1 certified gateways.
          </p>
        </section>
      </div>
    </div>
  );
};
