import React from 'react';
import { FileText, Clock, RefreshCw, ShieldAlert, ShoppingBag, CircleHelp } from 'lucide-react';
import { useDelivery } from '../../context/DeliveryContext';

const sections = [
  { icon: ShoppingBag, title: 'Using the service', body: 'Veyrang provides an online service for discovering food offerings and submitting orders through participating businesses. Product availability, menu descriptions, prices and preparation times are provided through the app and may change. Review your order details before confirming. An order is subject to acceptance and availability.' },
  { icon: Clock, title: 'Order status and delivery', body: 'Delivery times shown in the app are estimates, not guarantees. Preparation, weather, traffic, location accuracy and other conditions can affect delivery. Keep your contact and delivery details accurate and available so the restaurant or delivery team can complete your order.' },
  { icon: RefreshCw, title: 'Changes, cancellations and refunds', body: 'Whether an order can be changed or cancelled depends on its current status and preparation progress. Contact support promptly with your order reference. If an order is incorrect, incomplete, unavailable or otherwise disputed, submit a support request with the relevant details. Any refund or adjustment will be reviewed against the order, payment record and applicable policy; the method and timing may depend on the original payment provider.' },
  { icon: ShieldAlert, title: 'Food, ingredients and allergies', body: 'Menu descriptions and dietary information are supplied by the relevant food business and may not cover every ingredient or cross-contact risk. If you have an allergy or serious dietary restriction, contact the food business before ordering. Do not rely on a dietary label alone as a safety guarantee.' },
  { icon: FileText, title: 'Accounts and acceptable use', body: 'Keep your account information accurate and protect your sign-in credentials. You are responsible for activity carried out through your account, except where applicable law provides otherwise. Do not misuse the service, interfere with its operation, submit fraudulent orders, or attempt to access another person’s account or data.' },
  { icon: CircleHelp, title: 'Support, updates and questions', body: 'For help with an order or account, use the Help Centre or submit a support ticket. Keep the ticket reference for follow-up. These terms may be updated as the service changes; the version published here should be reviewed before using the service. If a provision is unenforceable, the remaining provisions continue to apply to the extent permitted by law.' }
];

export const TermsPage: React.FC = () => {
  const { platformSettings, setActivePage } = useDelivery();
  return (
    <main className="min-h-[70vh] bg-slate-50 pb-16">
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-orange-200"><FileText className="h-4 w-4" /> CUSTOMER INFORMATION</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">{platformSettings['cms_terms_title'] || 'Terms of Service'}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">The terms that apply when you browse, place an order or use Veyrang’s customer-facing services.</p>
          <p className="mt-4 text-xs text-slate-400">{platformSettings['cms_terms_effective_date'] || 'Please review this page before placing an order.'}</p>
        </div>
      </section>
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_240px] lg:py-10">
        <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-7 border-b border-slate-100 pb-5"><h2 className="text-xl font-bold text-slate-950">Please read these terms carefully</h2><p className="mt-2 text-sm leading-6 text-slate-600">This page is general service information and is not a substitute for legal advice. Before publication, the operator should confirm that these terms reflect the actual business, payment, cancellation and delivery practices.</p></div>
          <div className="space-y-8">{sections.map((section, i) => { const Icon = section.icon; const titleKey = 'cms_terms_s' + (i + 1) + '_title'; const contentKey = 'cms_terms_s' + (i + 1) + '_content'; return <section key={section.title} className="flex gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><Icon className="h-5 w-5" /></div><div className="min-w-0"><h2 className="text-base font-bold text-slate-950">{platformSettings[titleKey] || (i + 1) + '. ' + section.title}</h2><p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">{platformSettings[contentKey] || section.body}</p></div></section>; })}</div>
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600"><strong className="text-slate-900">Need clarification?</strong> Contact the support team before proceeding if you have a question about an order or these terms.</div>
        </article>
        <aside className="space-y-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-orange-700">Related information</p><button onClick={() => setActivePage('privacy')} className="mt-4 block w-full text-left text-sm font-semibold text-slate-800 hover:text-orange-700">Privacy Policy <span aria-hidden="true">→</span></button><div className="my-3 border-t border-slate-100" /><button onClick={() => setActivePage('help')} className="block w-full text-left text-sm font-semibold text-slate-800 hover:text-orange-700">Help Centre & FAQs <span aria-hidden="true">→</span></button><div className="my-3 border-t border-slate-100" /><button onClick={() => setActivePage('contact')} className="block w-full text-left text-sm font-semibold text-slate-800 hover:text-orange-700">Contact Support <span aria-hidden="true">→</span></button></div><p className="px-1 text-xs leading-5 text-slate-500">For legal publication, have the final terms reviewed for the jurisdictions in which the service operates.</p></aside>
      </div>
    </main>
  );
};
