import React, { useState } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import {
  Utensils, Phone, Mail, MapPin, Clock, Send, CheckCircle2, ShieldCheck,
  Smartphone, Building2, HelpCircle, Instagram, Facebook, Twitter, Linkedin
} from 'lucide-react';
import { VeyrangLogo } from '../common/VeyrangLogo.tsx';

export const Footer: React.FC = () => {
  const { setActiveRole, setActivePage, platformSettings, deliveryZones } = useDelivery();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail || !newsletterEmail.includes('@')) return;
    setIsSubscribed(true);
    setNewsletterEmail('');
  };

  const handleNavClick = (page: any, role: 'customer' | 'restaurant' | 'courier' | 'admin' = 'customer') => {
    setActiveRole(role);
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const supportPhone = platformSettings['cms_support_phone'] || '';
  const supportEmail = platformSettings['cms_support_email'] || '';
  const supportHours = platformSettings['cms_support_hours'] || '';

  return (
    <footer className="relative overflow-hidden border-t border-slate-800 bg-slate-950 pb-28 pt-12 font-sans text-slate-300 sm:pb-32 sm:pt-14">
      <div className="absolute left-1/2 top-0 h-px w-full max-w-7xl -translate-x-1/2 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 rounded-3xl border border-slate-700/80 bg-slate-900 p-6 sm:p-8">
          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7"><div className="mb-3"><VeyrangLogo iconSize="md" textSize="md" lightMode={true} /></div><h3 className="text-lg font-bold tracking-tight text-white sm:text-xl">{platformSettings['cms_footer_newsletter_title'] || 'Good food news, occasionally.'}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{platformSettings['cms_footer_newsletter_desc'] || 'Get updates about food, participating restaurants and offers from Veyrang.'}</p></div>
            <div className="lg:col-span-5">{isSubscribed ? <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-300"><CheckCircle2 className="h-5 w-5 shrink-0" /><span>Thanks for your interest. Newsletter sign-up is not connected yet, so no subscription has been saved.</span></div> : <form onSubmit={handleSubscribe} className="flex flex-col gap-2.5 sm:flex-row"><label className="sr-only" htmlFor="footer-newsletter-email">Email address</label><input id="footer-newsletter-email" type="email" value={newsletterEmail} onChange={e => setNewsletterEmail(e.target.value)} placeholder="Enter your email address" required className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" /><button type="submit" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-orange-700"><span>Stay in touch</span><Send className="h-4 w-4" /></button></form>}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 border-b border-slate-800 pb-10 text-sm md:grid-cols-4 lg:grid-cols-5 lg:gap-10">
          <div className="col-span-2 sm:col-span-1"><h4 className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-white"><Utensils className="h-4 w-4 text-orange-500" /> Popular cuisines</h4><ul className="space-y-3 text-slate-400"><li><button onClick={() => handleNavClick('restaurants')} className="transition hover:text-white">Nigerian favourites</button></li><li><button onClick={() => handleNavClick('restaurants')} className="transition hover:text-white">Grills and suya</button></li><li><button onClick={() => handleNavClick('restaurants')} className="transition hover:text-white">Rice and local dishes</button></li><li><button onClick={() => handleNavClick('restaurants')} className="transition hover:text-white">Pizza, pasta and more</button></li><li><button onClick={() => handleNavClick('restaurants')} className="transition hover:text-white">Drinks and desserts</button></li></ul></div>
          <div><h4 className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-white"><MapPin className="h-4 w-4 text-orange-500" /> Delivery zones</h4><ul className="space-y-3 text-slate-400">{deliveryZones && deliveryZones.length > 0 ? deliveryZones.map((zone: any) => <li key={zone.id}><button onClick={() => handleNavClick('search')} className="transition hover:text-white">{zone.name || zone.code}</button></li>) : <li className="text-slate-500">Zones will appear here when available.</li>}</ul></div>
          <div><h4 className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-white"><Building2 className="h-4 w-4 text-orange-500" /> Partner with us</h4><ul className="space-y-3 text-slate-400"><li><button onClick={() => handleNavClick('partner')} className="transition hover:text-white">List your restaurant</button></li><li><button onClick={() => handleNavClick('partner')} className="transition hover:text-white">Become a courier</button></li><li><button onClick={() => handleNavClick('partner')} className="transition hover:text-white">Business enquiries</button></li><li><button onClick={() => handleNavClick('home', 'restaurant')} className="transition hover:text-white">Restaurant portal</button></li><li><button onClick={() => handleNavClick('home', 'courier')} className="transition hover:text-white">Courier portal</button></li></ul></div>
          <div><h4 className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-white"><HelpCircle className="h-4 w-4 text-orange-500" /> Company & support</h4><ul className="space-y-3 text-slate-400"><li><button onClick={() => handleNavClick('help')} className="transition hover:text-white">Help Centre & FAQs</button></li><li><button onClick={() => handleNavClick('contact')} className="transition hover:text-white">Contact Support</button></li><li><button onClick={() => handleNavClick('terms')} className="transition hover:text-white">Terms of Service</button></li><li><button onClick={() => handleNavClick('privacy')} className="transition hover:text-white">Privacy Policy</button></li></ul></div>
          <div className="col-span-2 lg:col-span-1"><h4 className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-white"><Smartphone className="h-4 w-4 text-orange-500" /> Contact details</h4><div className="mb-5 space-y-4 text-xs text-slate-400">{supportPhone && <div className="flex items-start gap-2.5"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" /><div><div className="font-semibold text-white">{supportPhone}</div><div className="mt-1 text-slate-500">Support phone</div></div></div>}{supportEmail && <div className="flex items-start gap-2.5"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" /><div><div className="break-all font-semibold text-white">{supportEmail}</div><div className="mt-1 text-slate-500">Support email</div></div></div>}{supportHours && <div className="flex items-start gap-2.5"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" /><div><div className="font-semibold text-white">{supportHours}</div><div className="mt-1 text-slate-500">Published support hours</div></div></div>}{!supportPhone && !supportEmail && !supportHours && <p className="leading-6 text-slate-500">For assistance, visit the Help Centre or submit a support ticket.</p>}</div><div className="flex items-center gap-3 text-slate-400">{platformSettings['cms_social_instagram'] && <a href={platformSettings['cms_social_instagram']} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 transition hover:border-orange-500 hover:text-white"><Instagram className="h-4 w-4" /></a>}{platformSettings['cms_social_twitter'] && <a href={platformSettings['cms_social_twitter']} target="_blank" rel="noopener noreferrer" aria-label="Twitter or X" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 transition hover:border-orange-500 hover:text-white"><Twitter className="h-4 w-4" /></a>}{platformSettings['cms_social_facebook'] && <a href={platformSettings['cms_social_facebook']} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 transition hover:border-orange-500 hover:text-white"><Facebook className="h-4 w-4" /></a>}{platformSettings['cms_social_linkedin'] && <a href={platformSettings['cms_social_linkedin']} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 transition hover:border-orange-500 hover:text-white"><Linkedin className="h-4 w-4" /></a>}</div></div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 pt-7 text-center text-xs text-slate-500 md:flex-row md:text-left"><div className="flex flex-wrap items-center justify-center gap-3 md:justify-start"><span className="inline-flex items-center gap-1.5 text-slate-400"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Customer-first support</span><span className="hidden text-slate-700 sm:inline">·</span><span>Payment options are shown at checkout.</span></div><div><div>© {new Date().getFullYear()} <span className="font-bold text-white">{platformSettings['cms_copyright_text'] || 'Veyrang'}</span>. All rights reserved.</div><div className="mt-1 text-[11px] text-slate-500">{platformSettings['cms_footer_tagline'] || 'Food discovery and ordering, made simpler.'}</div></div></div>
      </div>
    </footer>
  );
};
