import React, { useState } from 'react';
import { Store, CheckCircle2, TrendingUp, Users, DollarSign } from 'lucide-react';
import { useDelivery } from '../../context/DeliveryContext';

export const PartnerPage: React.FC = () => {
  const { platformSettings } = useDelivery();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    cuisineType: 'Nigerian Delicacies',
    address: '',
    city: 'Lagos (Lekki / Island)',
    contactName: '',
    phone: '',
    email: '',
    averagePrepTime: '15-20 min'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const commissionRate = platformSettings['platform_commission_percent'] || '15';

  return (
    <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
          {platformSettings['cms_partner_page_title'] || 'Partner with Veyrang'}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {platformSettings['cms_partner_page_subtitle'] || 'Grow your culinary business with thousands of food lovers across Nigeria'}
        </p>
      </div>

      {/* Value Proposition Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-2.5">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            {platformSettings['cms_partner_benefit1_title'] || 'Increase Sales'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {platformSettings['cms_partner_benefit1_desc'] || 'Boost daily order volume by up to 40% with doorstep dispatch.'}
          </p>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2.5">
            <Users className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            {platformSettings['cms_partner_benefit2_title'] || 'New Customers'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {platformSettings['cms_partner_benefit2_desc'] || 'Reach corporate workers and residents across Lekki, VI & Ikeja.'}
          </p>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-2.5">
            <DollarSign className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            {platformSettings['cms_partner_benefit3_title'] || 'Fast Settlements'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {platformSettings['cms_partner_benefit3_desc'] || `Automated direct bank payouts with transparent ${commissionRate}% commission.`}
          </p>
        </div>
      </div>

      {/* Partner Application Form */}
      <div className="rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
        {submitted ? (
          <div className="text-center py-10 space-y-3 animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Application Received!</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Thank you for applying to partner with Veyrang. Our merchant onboarding team will review your kitchen details and contact you on{' '}
              <strong className="text-slate-800">{formData.phone || '+234 802 ...'}</strong> within 24 hours.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Submit Another Application
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-orange-600" />
              <span>Restaurant Registration Form</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Restaurant / Kitchen Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lagos Suya Grill"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Cuisine *
                </label>
                <select
                  value={formData.cuisineType}
                  onChange={(e) => setFormData({ ...formData, cuisineType: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-orange-500 bg-white"
                >
                  <option value="Nigerian Delicacies">Nigerian Delicacies / Jollof</option>
                  <option value="Burgers & Fast Food">Burgers & Fast Food</option>
                  <option value="Pizza & Italian">Pizza & Italian</option>
                  <option value="Suya & Grills">Suya, Shawarma & BBQ</option>
                  <option value="Asian & Chinese">Asian & Chinese</option>
                  <option value="Healthy & Salads">Healthy & Salads</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Operating City & Zone *
                </label>
                <select
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-orange-500 bg-white"
                >
                  <option value="Lagos (Lekki / Island)">Lagos — Lekki Phase 1 / Victoria Island</option>
                  <option value="Lagos (Ikeja / Mainland)">Lagos — Ikeja GRA / Yaba</option>
                  <option value="Abuja (Maitama / Wuse 2)">Abuja — Maitama / Wuse 2</option>
                  <option value="Port Harcourt (GRA)">Port Harcourt — GRA</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kitchen Street Address *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 25 Admiralty Way, Lekki"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Manager / Owner Contact Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Babatunde Alabi"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nigerian Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+234 800 000 0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-orange-600 text-white font-bold text-xs sm:text-sm hover:bg-orange-700 transition-colors shadow-xs cursor-pointer"
            >
              Submit Partner Application
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
