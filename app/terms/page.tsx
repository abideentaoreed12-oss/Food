import React from 'react';

export const metadata = {
  title: 'Terms of Service | VeyraNG',
  description: 'Terms governing use of VeyraNG food ordering and delivery services.'
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 text-slate-800">
      <h1 className="mb-3 text-3xl font-bold">Terms of Service</h1>
      <p className="mb-8 text-sm text-slate-500">Effective date: 8 October 2026</p>
      <p className="mb-5">These terms govern your use of VeyraNG. By using the service, you agree to these terms. If you do not agree, do not use the service.</p>
      <h2 className="mb-2 mt-7 text-xl font-semibold">Orders and availability</h2>
      <p className="mb-4">Menus, prices, item availability, delivery areas, fees and estimated arrival times may change. An order is subject to acceptance by the relevant restaurant. Review your order total and delivery details before paying.</p>
      <h2 className="mb-2 mt-7 text-xl font-semibold">Payments, refunds and wallet</h2>
      <p className="mb-4">Payments are processed through the payment methods displayed at checkout. Do not share passwords, one-time codes or payment credentials with support staff. Refunds, cancellations, wallet balances and disputed transactions are handled under the applicable order status and payment-provider rules. Contact support promptly if a charge or balance appears incorrect.</p>
      <h2 className="mb-2 mt-7 text-xl font-semibold">Delivery</h2>
      <p className="mb-4">You are responsible for supplying a complete, accurate delivery address and reachable contact details. Delivery estimates are estimates, not guarantees. The service may contact you to clarify access or delivery instructions.</p>
      <h2 className="mb-2 mt-7 text-xl font-semibold">Acceptable use</h2>
      <p className="mb-4">Do not misuse the service, interfere with its security, submit fraudulent orders or attempt to access another person’s account or information.</p>
      <h2 className="mb-2 mt-7 text-xl font-semibold">Support and changes</h2>
      <p className="mb-4">For order, payment or account questions, use the Contact Us section in the app. We may update these terms when necessary and will publish the updated version here.</p>
      <p className="mt-8 text-sm text-slate-600">These general terms are a starting point and should be reviewed by a qualified Nigerian legal professional before production use, particularly the consumer, privacy, refunds and wallet provisions.</p>
    </main>
  );
}
