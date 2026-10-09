import React from 'react';
import { Shield, Database, Users, Clock, Mail } from 'lucide-react';
import { useDelivery } from '../../context/DeliveryContext';

export const PrivacyPage: React.FC = () => {
  const { platformSettings } = useDelivery();
  const supportEmail = platformSettings['cms_support_email'] || '';

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 rounded-3xl bg-slate-950 px-6 py-8 text-white sm:px-10 sm:py-10">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300">
          <Shield className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-orange-300">Your information</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {platformSettings['cms_privacy_title'] || 'Privacy Policy'}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
          {platformSettings['cms_privacy_subtitle'] || 'How Veyrang may use information when you browse, order food, arrange delivery, or contact support.'}
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <Database className="mb-3 h-5 w-5 text-orange-600" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-900">Information you provide</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Depending on the features you use, information may include your name, contact details, delivery address, order details, account information, and messages sent to support. Please do not send passwords, one-time codes, card PINs, or full payment-card details in support messages.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <Users className="mb-3 h-5 w-5 text-orange-600" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-900">How information is used and shared</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Information may be used to manage accounts and orders, coordinate delivery, process payments, respond to enquiries, prevent abuse, and operate the service. Relevant order and delivery details may be shared with the restaurant, assigned courier, and payment provider where needed to complete a transaction or resolve an issue.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <Clock className="mb-3 h-5 w-5 text-orange-600" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-900">Retention and security</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Information is handled using the controls implemented in the service and may be retained for operational, dispute-resolution, legal, and accounting needs. Specific retention periods, deletion procedures, and technical safeguards should be confirmed by Veyrang before publication; this page does not promise a particular deletion timeline or certification.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <Mail className="mb-3 h-5 w-5 text-orange-600" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-900">Your choices and privacy requests</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            You may contact Veyrang to ask about personal information associated with your account or to request a correction. Requests may need identity verification and may be subject to applicable legal requirements. Use the configured support contact below or the Contact Support page.
          </p>
          {supportEmail ? (
            <a className="mt-3 inline-flex break-all font-semibold text-orange-700 underline underline-offset-4 hover:text-orange-800" href={`mailto:${supportEmail}`}>{supportEmail}</a>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No privacy email is configured. Please use the Contact Support page.</p>
          )}
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">Cookies, analytics and policy updates</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The website may use browser storage or similar technologies needed for functionality. The specific analytics and cookie technologies in use should be confirmed against the current deployment configuration. This policy may be updated when the service or its data practices change; please review this page periodically.
        </p>
      </section>

      <p className="mt-6 text-xs leading-5 text-slate-500">
        Owner review required before production: confirm the legal entity/controller name and address, lawful bases for processing, actual cookie and analytics tools, retention periods, security measures, privacy contact details, and the applicable data-subject request process. This summary is not legal advice.
      </p>
    </main>
  );
};
