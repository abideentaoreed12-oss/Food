import React, { useState, useMemo } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { SavedAddress } from '../../types';
import {
  MapPin,
  Home,
  Building2,
  Briefcase,
  Plus,
  Trash2,
  Check,
  X,
  Navigation,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { acquireLiveLocation } from '../../utils/liveLocation';

export const DeliveryAddressModal: React.FC = () => {
  const {
    isAddressModalOpen,
    setIsAddressModalOpen,
    savedAddresses,
    selectedAddress,
    setSelectedAddress,
    addSavedAddress,
    deleteSavedAddress
  } = useDelivery();

  const { user } = useAuth();

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [label, setLabel] = useState('Home');
  const [address, setAddress] = useState('');
  const [apartment, setApartment] = useState('');
  const [city, setCity] = useState('Akure');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Deduplicate all addresses so no duplicate items ever appear
  const uniqueAddresses = useMemo(() => {
    const seen = new Set<string>();
    const list: SavedAddress[] = [];

    // 1. Saved addresses
    (savedAddresses || []).forEach((a) => {
      const key = String(a?.address || '').trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push({
          id: a.id || `addr-${list.length}`,
          label: a.label || 'Home',
          address: a.address.trim(),
          apartment: a.apartment || '',
          city: a.city || 'Akure',
          isDefault: Boolean(a.isDefault)
        });
      }
    });

    // 2. Currently selected address if not already present
    if (selectedAddress?.address && String(selectedAddress.address).trim()) {
      const key = String(selectedAddress.address).trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.unshift({
          id: selectedAddress.id || 'selected-addr',
          label: selectedAddress.label || 'Home',
          address: selectedAddress.address.trim(),
          apartment: selectedAddress.apartment || '',
          city: selectedAddress.city || 'Akure',
          isDefault: true
        });
      }
    }

    // 3. User profile address if set and not in list
    if (user?.address && String(user.address).trim()) {
      const key = String(user.address).trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          id: 'profile-address',
          label: 'Default Address',
          address: user.address.trim(),
          apartment: '',
          city: 'Akure',
          isDefault: list.length === 0
        });
      }
    }

    return list;
  }, [savedAddresses, selectedAddress, user?.address]);

  if (!isAddressModalOpen) return null;

  const handleClose = () => {
    setIsAddressModalOpen(false);
    setIsAddingNew(false);
    setErrorMsg('');
  };

  const handleSelectAddress = (addr: SavedAddress) => {
    setSelectedAddress(addr);
    handleClose();
  };

  const handleDeleteAddress = async (e: React.MouseEvent, addr: SavedAddress) => {
    e.stopPropagation();
    try {
      setDeletingId(addr.id);
      await deleteSavedAddress(addr.id);
    } catch (err: any) {
      console.warn('Failed to delete address:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    setErrorMsg('');
    try {
      const coords = await acquireLiveLocation(12000);

      if (coords) {
        if (coords.address || coords.formattedAddress) {
          setAddress(coords.address || coords.formattedAddress || '');
          if (coords.city) setCity(coords.city);
          return;
        }

        // Reverse geocode fallback
        try {
          const res = await fetch(`/api/geocode/reverse?lat=${coords.latitude}&lng=${coords.longitude}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.address) {
              setAddress(data.address);
              if (data.city) setCity(data.city);
              return;
            }
          }
        } catch (e) {}

        setAddress(`GPS Location (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`);
      } else {
        setErrorMsg('Unable to retrieve current GPS location. Please enter your address manually.');
      }
    } catch (err: any) {
      setErrorMsg('Location permission denied or unavailable. Please type your street address.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      setErrorMsg('Please enter a street address or landmark');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const created = await addSavedAddress({
        label: label || 'Home',
        address: address.trim(),
        apartment: apartment.trim(),
        city: city.trim() || 'Akure',
        isDefault: true
      });
      setSelectedAddress(created);
      setIsAddingNew(false);
      setAddress('');
      setApartment('');
      handleClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save address');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLabelIcon = (lbl: string) => {
    const lower = (lbl || '').toLowerCase();
    if (lower.includes('work') || lower.includes('office')) return <Briefcase className="w-4 h-4 text-[#0D4F3C]" />;
    if (lower.includes('building') || lower.includes('apt')) return <Building2 className="w-4 h-4 text-[#0D4F3C]" />;
    return <Home className="w-4 h-4 text-[#0D4F3C]" />;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden text-slate-900 border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#E8F5EF] text-[#0D4F3C] flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Delivery Location</h2>
              <p className="text-[11px] text-slate-500">Choose or add where your food should be delivered</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Current Selection Pill */}
          {selectedAddress?.address && (
            <div className="p-3 rounded-2xl bg-[#E8F5EF]/60 border border-emerald-200/60 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0D4F3C]">Active Delivery Address</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0D4F3C]" />
                </div>
                <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
                  {selectedAddress.label || 'Home'}: {selectedAddress.address}
                </p>
                {(selectedAddress.apartment || selectedAddress.city) && (
                  <p className="text-[11px] text-slate-500">
                    {[selectedAddress.apartment, selectedAddress.city].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Add New Address Toggle / Form */}
          {!isAddingNew ? (
            <button
              type="button"
              onClick={() => setIsAddingNew(true)}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-[#0D4F3C]/40 hover:border-[#0D4F3C] bg-[#E8F5EF]/30 hover:bg-[#E8F5EF]/70 text-[#0D4F3C] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add New Address
            </button>
          ) : (
            <form onSubmit={handleSaveNewAddress} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Add New Delivery Location</span>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {/* Label Selector Pills */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Location Type
                </label>
                <div className="flex gap-2">
                  {['Home', 'Work', 'Office', 'Other'].map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setLabel(lbl)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        label === lbl
                          ? 'bg-[#0D4F3C] text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Street Address Input with GPS button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Street Address / Area *
                  </label>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                    className="text-[11px] font-semibold text-[#0D4F3C] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isLocating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Navigation className="w-3 h-3" />
                    )}
                    Use GPS
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 15 Admiralty Way, Lekki or Akure South"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#0D4F3C]/20 focus:border-[#0D4F3C] outline-none"
                />
              </div>

              {/* Apartment / Suite */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Apartment, Suite or Landmark (Optional)
                </label>
                <input
                  type="text"
                  value={apartment}
                  onChange={(e) => setApartment(e.target.value)}
                  placeholder="e.g. Flat 3B, Opposite Grand Mall"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#0D4F3C]/20 focus:border-[#0D4F3C] outline-none"
                />
              </div>

              {/* City */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Akure, Lagos, Abuja"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#0D4F3C]/20 focus:border-[#0D4F3C] outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !address.trim()}
                className="w-full py-2.5 bg-[#0D4F3C] hover:bg-[#0A3F30] text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save & Deliver to this Address'
                )}
              </button>
            </form>
          )}

          {/* Saved Addresses List */}
          <div className="space-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block px-1">
              Your Saved Addresses ({uniqueAddresses.length})
            </span>

            {uniqueAddresses.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-slate-50 border border-slate-100 text-slate-500 text-xs">
                <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No saved addresses yet</p>
                <p className="text-[11px] text-slate-400 mt-1">Add an address above to choose your delivery spot.</p>
              </div>
            ) : (
              uniqueAddresses.map((addr) => {
                const isSelected =
                  selectedAddress?.id === addr.id ||
                  (selectedAddress?.address &&
                    String(selectedAddress.address).trim().toLowerCase() === String(addr.address).trim().toLowerCase());

                const isDeleting = deletingId === addr.id;

                return (
                  <div
                    key={addr.id}
                    onClick={() => handleSelectAddress(addr)}
                    className={`w-full p-3 rounded-2xl border transition-all flex items-start justify-between gap-3 text-left cursor-pointer group ${
                      isSelected
                        ? 'bg-[#E8F5EF] border-[#0D4F3C] shadow-xs'
                        : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'bg-[#0D4F3C] text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {getLabelIcon(addr.label || 'Home')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${isSelected ? 'text-[#0D4F3C]' : 'text-slate-900'}`}>
                            {addr.label || 'Home'}
                          </span>
                          {isSelected && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-[#0D4F3C] text-white">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 font-normal mt-0.5 break-words line-clamp-2">
                          {addr.address}
                        </p>
                        {(addr.apartment || addr.city) && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {[addr.apartment, addr.city].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-center">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-[#0D4F3C] text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectAddress(addr)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#0D4F3C] text-slate-700 hover:text-white text-[11px] font-bold transition cursor-pointer"
                        >
                          Select
                        </button>
                      )}

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteAddress(e, addr)}
                        disabled={isDeleting}
                        aria-label={`Delete ${addr.label || 'address'}`}
                        title="Delete this address"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer disabled:opacity-40"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
