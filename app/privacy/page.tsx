import React from 'react';

export const metadata = {
  title: 'Privacy Policy | VeyraNG',
  description: 'How VeyraNG handles account, delivery, order and payment-related information.'
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 text-slate-800">
      <h1 className="mb-3 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-sm text-slate-500">Effective date: 8 October 2026</p>
      <p className="mb-5">This policy explains how VeyraNG may handle information when you use the food ordering and delivery service.</p>
      <h2 className="mb-2 mt-7 text-xl font-semibold">Information used</h2>
      <p className="mb-4">Depending on the features you use, information may include account and contact details, saved delivery addresses, order history, support messages, wallet and transaction records, and technical logs needed to secure and operate the service. Location information should be used only when you enable a location-dependent feature or provide an address.</p>
      <h2 className="mb-2 mt-7 text-xl font-semibold">Why information is used</h2>
      <p className="mb-4">Information may be used to authenticate accounts, process orders and payments, deliver orders, provide support, prevent fraud, maintain records, and improve service reliability.</p>
      <h2 className="mb-2 mt-7 text-xl font-semibold">Service providers and sharing</h2>
      <p className="mb-4">Information may be shared with the restaurant fulfilling your order, delivery partners, payment providers, and hosting or storage providers when necessary to provide the service or meet legal obligations. Payment card credentials should be handled by the payment provider rather than stored by VeyraNG.</p>
      <h2 className="mb-2 mt-7 text-xl font-semibold">Security and retention</h2>
      <p className="mb-4">We use technical and organisational measures intended to protect information, but no internet service can guarantee absolute security. Information is retained only as needed for service operations, legal obligations, dispute resolution and legitimate recordkeeping.</p>
      <h2 className="mb-2 mt-7 text-xl font-semibold">Your choices and requests</h2>
      <p className="mb-4">You may contact VeyraNG through the Contact Us section to request access to, correction of, or deletion of personal information where applicable. Some records may need to be retained to meet legal or transaction requirements.</p>
      <h2 className="mb-2 mt-7 text-xl font-semibold">Policy updates and contact</h2>
      <p className="mb-4">This policy may be updated as the service changes. Use the Contact Us section in the app for privacy questions or requests.</p>
      <p className="mt-8 text-sm text-slate-600">This draft must be reviewed against actual data flows, processors, retention periods, contact details and Nigerian data protection obligations before production use. It is not a substitute for legal advice.</p>
    </main>
  );
}
