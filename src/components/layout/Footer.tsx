import React, { useState } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import {
  Utensils,
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  CreditCard,
  Building2,
  Bike,
  ShieldAlert,
  HelpCircle,
  FileText,
  Shield,
  Instagram,
  Facebook,
  Twitter,
  Linkedin
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
    setTimeout(() => setIsSubscribed(false), 5000);
  };

  const handleNavClick = (page: any, role: 'customer' | 'restaurant' | 'courier' | 'admin' = 'customer') => {
    setActiveRole(role);
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-36 sm:pb-40 border-t border-slate-800 font-sans relative overflow-hidden">
      {/* Top Ambient Glow Accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[1px] bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Newsletter & Brand Hero Bar */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 sm:p-8 mb-14 shadow-2xl backdrop-blur-md">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Tagline */}
            <div className="lg:col-span-7">
              <div className="mb-3">
                <VeyrangLogo iconSize="md" textSize="md" lightMode={true} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">
                {platformSettings['cms_footer_newsletter_title'] || 'Get ₦1,500 off your first food order'}
              </h3>
              <p className="text-sm text-slate-400 max-w-xl">
                {platformSettings['cms_footer_newsletter_desc'] || 'Subscribe to our weekly foodie newsletter for exclusive promo codes, new restaurant launches in Lagos & Abuja, and flash discounts!'}
              </p>
            </div>

            {/* Right Input Form */}
            <div className="lg:col-span-5">
              {isSubscribed ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3 text-emerald-400 font-semibold text-sm animate-fade-in">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                  <span>You’re subscribed! Check your inbox for your ₦1,500 voucher code.</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    className="flex-1 bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm rounded-2xl px-4 py-3.5 focus:outline-none focus:border-[#FF5500] focus:ring-1 focus:ring-[#FF5500] transition-colors"
                  />
                  <button
                    type="submit"
                    className="bg-[#FF5500] hover:bg-[#EA4C00] text-white font-bold text-sm px-6 py-3.5 rounded-2xl transition-all shadow-lg hover:shadow-orange-500/20 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                  >
                    <span>Subscribe</span>
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>

          </div>
        </div>

        {/* 4 Main Footer Navigation Columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12 pb-12 border-b border-slate-800 text-xs sm:text-sm">
          
          {/* Column 1: Popular Cuisines */}
          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <h4 className="text-white font-extrabold uppercase tracking-wider text-xs mb-4 flex items-center gap-2">
              <Utensils className="w-4 h-4 text-[#FF5500]" />
              <span>Popular Cuisines</span>
            </h4>
            <ul className="space-y-2.5 text-slate-400">
              <li>
                <button onClick={() => handleNavClick('restaurants')} className="hover:text-white transition-colors cursor-pointer">
                  Jollof Rice & Nigerian Buka
                </button>
              </li>
              <li>
                <button onClick={() => handleNavClick('restaurants')} className="hover:text-white transition-colors cursor-pointer">
                  Suya, Asun & Pepper Soup
                </button>
              </li>
              <li>
                <button onClick={() => handleNavClick('restaurants')} className="hover:text-white transition-colors cursor-pointer">
                  Amala, Ewedu & Abula
                </button>
              </li>
              <li>
                <button onClick={() => handleNavClick('restaurants')} className="hover:text-white transition-colors cursor-pointer">
                  Wood-fired Pizzas & Pasta
                </button>
              </li>
              <li>
                <button onClick={() => handleNavClick('restaurants')} className="hover:text-white transition-colors cursor-pointer">
                  Burgers, Fries & Shawarma
                </button>
              </li>
              <li>
                <button onClick={() => handleNavClick('restaurants')} className="hover:text-white transition-colors cursor-pointer">
                  Seafood & Grill Platter
                </button>
              </li>
              <li>
                <button onClick={() => handleNavClick('restaurants')} className="hover:text-white transition-colors cursor-pointer">
                  Fresh Juices & Smoothies
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Top Locations */}
          <div>
            <h4 className="text-white font-extrabold uppercase tracking-wider text-xs mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#FF5500]" />
              <span>Delivery Zones</span>
            </h4>
            <ul className="space-y-2.5 text-slate-400">
              {deliveryZones && deliveryZones.length > 0 ? (
                deliveryZones.map((zone: any) => (
                  <li key={zone.id}>
                    <button onClick={() => handleNavClick('search')} className="hover:text-white transition-colors cursor-pointer">
                      {zone.name || zone.code}
                    </button>
                  </li>
                ))
              ) : (
                <li>No active delivery zones</li>
              )}
            </ul>
          </div>

          {/* Column 3: Partner & Business */}
          <div>
            <h4 className="text-white font-extrabold uppercase tracking-wider text-xs mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#FF5500]" />
              <span>Partner With Us</span>
            </h4>
            <ul className="space-y-2.5 text-slate-400">
              <li>
                <button onClick={() => handleNavClick('partner')} className="hover:text-white transition-colors cursor-pointer font-medium text-white flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  List Your Restaurant
                </button>
              </li>
              <li>
                <button onClick={() => handleNavClick('partner')} className="hover:text-white transition-colors cursor-pointer">
                  Become a Courier Rider
                </button>
              </li>
              <li>
                <button onClick={() => handleNavClick('partner')} className="hover:text-white transition-colors cursor-pointer">
                  Veyrang Corporate Catering
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Help & Support */}
          <div>
            <h4 className="text-white font-extrabold uppercase tracking-wider text-xs mb-4 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#FF5500]" />
              <span>Company & Support</span>
            </h4>
            <ul className="space-y-2.5 text-slate-400">
              <li>
                <button onClick={() => handleNavClick('help')} className="hover:text-white transition-colors cursor-pointer">
                  Help Center & FAQs
                </button>
              </li>
              <li>
                <button onClick={() => handleNavClick('contact')} className="hover:text-white transition-colors cursor-pointer">
                  Contact Support
                </button>
              </li>
              <li>
                <button onClick={() => handleNavClick('terms')} className="hover:text-white transition-colors cursor-pointer">
                  Terms of Service
                </button>
              </li>
              <li>
                <button onClick={() => handleNavClick('privacy')} className="hover:text-white transition-colors cursor-pointer">
                  Privacy Policy
                </button>
              </li>
            </ul>
          </div>

          {/* Column 5: Contact & Mobile App Download */}
          <div className="col-span-2 lg:col-span-1">
            <h4 className="text-white font-extrabold uppercase tracking-wider text-xs mb-4 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#FF5500]" />
              <span>24/7 Support Hotline</span>
            </h4>
            
            <div className="space-y-3 text-slate-400 text-xs mb-6">
              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-[#FF5500] shrink-0 mt-0.5" />
                <div>
                  <div className="text-white font-bold">{platformSettings['cms_support_phone'] || ''}</div>
                  {platformSettings['cms_support_phone'] && <div className="text-[11px] text-slate-500">Support phone</div>}
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-[#FF5500] shrink-0 mt-0.5" />
                <div>
                  <div className="text-white font-bold">{platformSettings['cms_support_email'] || ''}</div>
                  <div className="text-[11px] text-slate-500">10-min average response time</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-[#FF5500] shrink-0 mt-0.5" />
                <div>
                  <div className="text-white font-bold">{platformSettings['cms_support_hours'] || 'Mon – Sun: 24 Hours'}</div>
                  <div className="text-[11px] text-slate-500">Live GPS Doorstep Tracking</div>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-3 text-slate-400">
              <a
                href={platformSettings['cms_social_instagram'] || 'https://instagram.com/veyrang'}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-[#FF5500] hover:text-white hover:border-[#FF5500] transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href={platformSettings['cms_social_twitter'] || 'https://twitter.com/veyrang'}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter X"
                className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-[#FF5500] hover:text-white hover:border-[#FF5500] transition-colors"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href={platformSettings['cms_social_facebook'] || 'https://facebook.com/veyrang'}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-[#FF5500] hover:text-white hover:border-[#FF5500] transition-colors"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href={platformSettings['cms_social_linkedin'] || 'https://linkedin.com/company/veyrang'}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-[#FF5500] hover:text-white hover:border-[#FF5500] transition-colors"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>

          </div>

        </div>

        {/* Bottom Trust & Copyright Row */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-500">
          
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
            <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>PCI-DSS Bank Grade Security</span>
            </div>
            <span>·</span>
            <span>Bank Transfer, Cards & Veyrang Wallet</span>
            <span>·</span>
            <span>Lagos & Abuja Dispatch Hubs</span>
          </div>

          <div className="text-center md:text-right">
            <div suppressHydrationWarning>
              © {new Date().getFullYear()} <span className="text-white font-bold">{platformSettings['cms_copyright_text'] || 'Veyrang Technologies Limited'}</span>. All rights reserved.
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {platformSettings['cms_footer_tagline'] || 'Designed for ultra-fast food delivery in Nigeria.'}
            </div>
          </div>

        </div>

      </div>
    </footer>
  );
};
