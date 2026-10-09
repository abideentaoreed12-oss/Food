import React from 'react';
import { Shield, Lock, Eye, Database, UserRound, Clock, CircleHelp } from 'lucide-react';
import { useDelivery } from '../../context/DeliveryContext';

const sections = [
  { icon: UserRound, title: 'Information you provide', body: 'Depending on how you use the service, information may include your name, email address, phone number, delivery details, order information, support messages and information you choose to provide when contacting us.' },
  { icon: Database, title: 'How information is used', body: 'Information is used to operate the service, process and coordinate orders, communicate order updates, respond to support requests, help prevent misuse, maintain records and improve service reliability. Only collect or use information for purposes that apply to the features you actually provide.' },
  { icon: Eye, title: 'Sharing and service providers', body: 'Information may need to be shared with the restaurant fulfilling an order, delivery personnel involved in fulfilment, payment providers handling a transaction, hosting or technical providers, and support staff who need it to perform their duties. The information shared should be limited to what is necessary for the relevant purpose.' },
  { icon: Lock, title: 'Payments and account security', body: 'Payment details are handled according to the payment provider and payment flow used for your transaction. Do not assume that a particular certification, encryption standard, masking feature or storage practice applies unless the operator has verified it. Protect your password and never disclose one-time codes or banking PINs to support.' },
  { icon: Clock, title: 'Retention and your choices', body: 'Information should be retained only for as long as needed for the purposes described, including legitimate operational, dispute-resolution, accounting or legal needs. Depending on applicable law and the data involved, you may be able to request access, correction, deletion or other action regarding your personal information.' },
  { icon: Shield, title: 'Privacy questions and updates', body: 'If you have a privacy question or request, contact support and clearly state that it concerns personal information. The operator should verify your identity where appropriate before acting on a request. This policy may be updated as the service changes; review the published version for the current description of practices.' }
];

export const PrivacyPage: React.FC = () => {
  const { platformSettings, setActivePage } = useDelivery();
  return (
    <main className="min-h-[70vh] bg-slate-50 pb-16">
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-orange-200"><Shield className="h-4 w-4" /> YOUR PRIVACY</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">{platformSettings['cms_privacy_title'] || 'Privacy Policy'}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{platformSettings['cms_privacy_subtitle'] || 'Understand what information may be used when you browse, order food or contact Veyrang.'}</p>
        </div>
      </section>
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_240px] lg:py-10">
        <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-7 rounded-xl border border-blue-100 bg-blue-50 p-4"><p className="text-sm leading-6 text-blue-950">This policy explains common data uses for a food-ordering service. The operator must verify the final text against the live application, backend, vendors, retention settings and applicable data-protection obligations before publishing it as a formal legal policy.</p></div>
          <div className="space-y-8">{sections.map((section, i) => { const Icon = section.icon; const titleKey = 'cms_privacy_s' + (i + 1) + '_title'; const contentKey = 'cms_privacy_s' + (i + 1) + '_content'; return <section key={section.title} className="flex gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><Icon className="h-5 w-5" /></div><div className="min-w-0"><h2 className="text-base font-bold text-slate-950">{platformSettings[titleKey] || (i + 1) + '. ' + section.title}</h2><p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">{platformSettings[contentKey] || section.body}</p></div></section>; })}</div>
          <div className="mt-8 border-t border-slate-100 pt-5"><h2 className="text-base font-bold text-slate-950">Contact about your information</h2><p className="mt-2 text-sm leading-6 text-slate-600">Use the support page to submit a privacy question or request. Do not include passwords, banking PINs or one-time codes.</p><button onClick={() => setActivePage('contact')} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"><CircleHelp className="h-4 w-4" /> Contact support</button></div>
        </article>
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-orange-700">On this site</p><button onClick={() => setActivePage('terms')} className="mt-4 block w-full text-left text-sm font-semibold text-slate-800 hover:text-orange-700">Terms of Service <span aria-hidden="true">→</span></button><div className="my-3 border-t border-slate-100" /><button onClick={() => setActivePage('help')} className="block w-full text-left text-sm font-semibold text-slate-800 hover:text-orange-700">Help Centre & FAQs <span aria-hidden="true">→</span></button></aside>
      </div>
    </main>
  );
};
