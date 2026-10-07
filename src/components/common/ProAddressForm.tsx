import React, { useState, useRef } from 'react';
import {
  MapPin,
  ClipboardCheck,
  Clipboard,
  Home,
  Building2,
  Users,
  Compass,
  CheckCircle2,
  X,
  Phone,
  User,
  ShieldCheck,
  Check,
  Navigation,
  Loader2,
  Sparkles,
  Zap,
  Info
} from 'lucide-react';
import { AddressAutocompleteInput, AddressSelectData } from './AddressAutocompleteInput';
import { CountryCodePicker } from './CountryCodePicker';
import { acquireLiveLocation } from '../../utils/liveLocation';

export interface ProAddressFormData {
  label: string;
  recipientName: string;
  phoneCountryCode: string;
  phoneNumber: string;
  address: string;
  buildingEstate?: string;
  apartment?: string;
  city: string;
  deliveryNotes?: string;
  dropoffPreference: 'hand' | 'gatehouse' | 'lobby';
  isDefault: boolean;
  latitude?: number;
  longitude?: number;
}

interface ProAddressFormProps {
  initialData?: Partial<ProAddressFormData>;
  onSave: (data: ProAddressFormData) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

/**
 * Robust text parsing function for smart clipboard auto-fill.
 * Extracts recipient name, phone (with country dial code), street address,
 * apartment/suite, building/estate, city, and delivery notes.
 */
export function parseAddressText(raw: string) {
  if (!raw || !raw.trim()) return null;
  let text = raw.trim();

  let recipientName = '';
  let phoneCountryCode = '+234';
  let phoneNumber = '';
  let address = '';
  let buildingEstate = '';
  let apartment = '';
  let city = 'Lagos';
  let deliveryNotes = '';

  // 1. Explicit Key-Value Matches (Name:, Phone:, Address:, Flat:, etc.)
  const nameKeyMatch = text.match(/(?:name|recipient|to|customer|contact|receiver)\s*[:=-]\s*([^\n,]+)/i);
  if (nameKeyMatch) {
    recipientName = nameKeyMatch[1].trim();
    text = text.replace(nameKeyMatch[0], ' ');
  }

  const aptKeyMatch = text.match(/(?:apt|apartment|flat|suite|unit|room|house\s*no\.?)\s*[:=-]\s*([^\n,]+)/i);
  if (aptKeyMatch) {
    apartment = aptKeyMatch[1].trim();
    text = text.replace(aptKeyMatch[0], ' ');
  }

  const estateKeyMatch = text.match(/(?:estate|building|landmark|compound|complex)\s*[:=-]\s*([^\n,]+)/i);
  if (estateKeyMatch) {
    buildingEstate = estateKeyMatch[1].trim();
    text = text.replace(estateKeyMatch[0], ' ');
  }

  const notesKeyMatch = text.match(/(?:note|notes|instruction|instructions|courier|dropoff)\s*[:=-]\s*([^\n]+)/i);
  if (notesKeyMatch) {
    deliveryNotes = notesKeyMatch[1].trim();
    text = text.replace(notesKeyMatch[0], ' ');
  }

  const cityKeyMatch = text.match(/(?:city|state|town|region)\s*[:=-]\s*([^\n,]+)/i);
  if (cityKeyMatch) {
    city = cityKeyMatch[1].trim();
    text = text.replace(cityKeyMatch[0], ' ');
  }

  const addressKeyMatch = text.match(/(?:address|street|location|dest|destination)\s*[:=-]\s*([^\n]+)/i);
  if (addressKeyMatch) {
    address = addressKeyMatch[1].trim();
    text = text.replace(addressKeyMatch[0], ' ');
  }

  // 2. Phone Number Extraction & International Code Detection
  const phoneRegex = /(\+?\d{1,4}[\s-]?)?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,5}/;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch && !phoneNumber) {
    const rawNum = phoneMatch[0].trim();
    const digits = rawNum.replace(/[^\d+]/g, '');
    if (digits.startsWith('+234')) {
      phoneCountryCode = '+234';
      phoneNumber = '0' + digits.slice(4);
    } else if (digits.startsWith('+1')) {
      phoneCountryCode = '+1';
      phoneNumber = digits.slice(2);
    } else if (digits.startsWith('+44')) {
      phoneCountryCode = '+44';
      phoneNumber = digits.slice(3);
    } else if (digits.startsWith('+')) {
      phoneCountryCode = digits.slice(0, 4);
      phoneNumber = digits.slice(4);
    } else if (digits.startsWith('234') && digits.length >= 12) {
      phoneCountryCode = '+234';
      phoneNumber = '0' + digits.slice(3);
    } else {
      phoneNumber = digits;
    }
    text = text.replace(phoneMatch[0], ' ');
  }

  // 3. Apartment / Flat inline pattern
  if (!apartment) {
    const inlineApt = text.match(/\b(?:apt|flat|suite|unit|block\s*[a-z0-9]+|room|floor)\s*[a-z0-9#/-]+/i);
    if (inlineApt) {
      apartment = inlineApt[0].trim();
      text = text.replace(inlineApt[0], ' ');
    }
  }

  // 4. Notes inline pattern
  if (!deliveryNotes) {
    const inlineNotes = text.match(/\b(?:call\s*(?:on|at|when|upon)\s*(?:arrival|gate|delivery|reach)|leave\s*(?:with|at)\s*(?:security|gate|door|lobby|reception|guard)|ring\s*(?:the\s*)?bell[^\n,]*|don'?t\s*knock|gate\s*code\s*[:#]?\s*\d+)/i);
    if (inlineNotes) {
      deliveryNotes = inlineNotes[0].trim();
      text = text.replace(inlineNotes[0], ' ');
    }
  }

  // 5. Estate inline pattern
  if (!buildingEstate) {
    const inlineEstate = text.match(/\b[A-Za-z0-9\s'-]+(?:\s+Estate|\s+Gardens|\s+Court|\s+Heights|\s+Residence|\s+Towers|\s+Plaza|\s+Gate\s*\d+)\b/i);
    if (inlineEstate) {
      buildingEstate = inlineEstate[0].trim();
      text = text.replace(inlineEstate[0], ' ');
    }
  }

  // 6. City inline pattern
  const cityRegex = /\b(Lagos|Abuja|Ibadan|Port Harcourt|Enugu|Kano|Kaduna|Benin City|Calabar|Asaba|Warri|Uyo|Owerri|Akure|Abeokuta|Ilorin|Jos|London|Dubai|Toronto|New York)\b/i;
  const inlineCity = text.match(cityRegex);
  if (inlineCity && city === 'Lagos') {
    city = inlineCity[1].trim();
    text = text.replace(inlineCity[0], ' ');
  }

  // 7. Clean remaining text chunks
  const rawParts = text.split(/[\n,]+/).map(s => s.trim().replace(/^[\s,;:-]+|[\s,;:-]+$/g, '')).filter(Boolean);

  for (const part of rawParts) {
    const isStreetLike = /street|road|way|crescent|close|ave|avenue|lane|drive|boulevard|expressway|highway|junction|roundabout|str|rd|cl/i.test(part);
    const hasNumbers = /\d+/.test(part);

    if (!recipientName && !isStreetLike && !hasNumbers && part.split(/\s+/).length <= 4 && part.length <= 40) {
      recipientName = part;
    } else if (!address) {
      address = part;
    } else if (!buildingEstate && /estate|gardens|court|heights|towers/i.test(part)) {
      buildingEstate = part;
    } else if (!deliveryNotes && part.length > 5) {
      deliveryNotes = deliveryNotes ? deliveryNotes + ', ' + part : part;
    }
  }

  // Fallback: if space-separated without commas (e.g. John Doe 18 Isaac John Street GRA Ikeja)
  if (!recipientName && address) {
    const words = address.split(/\s+/);
    if (words.length >= 4 && !/^\d+/.test(words[0])) {
      const possibleName = words.slice(0, 2).join(' ');
      const rest = words.slice(2).join(' ');
      if (/street|road|way|crescent|close|ave|lane|drive|\d+/i.test(rest)) {
        recipientName = possibleName;
        address = rest;
      }
    }
  }

  return {
    recipientName: recipientName.trim(),
    phoneCountryCode,
    phoneNumber: phoneNumber.trim(),
    address: address.trim(),
    buildingEstate: buildingEstate.trim(),
    apartment: apartment.trim(),
    city: city.trim(),
    deliveryNotes: deliveryNotes.trim()
  };
}

export const ProAddressForm: React.FC<ProAddressFormProps> = ({
  initialData,
  onSave,
  onCancel,
  isSubmitting = false
}) => {
  // Clipboard Smart Paste Box State
  const [clipboardText, setClipboardText] = useState('');
  const [autoFillSummary, setAutoFillSummary] = useState<string | null>(null);
  const [isReadingClipboard, setIsReadingClipboard] = useState(false);
  const clipboardInputRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [label, setLabel] = useState<string>(initialData?.label || 'Home');
  const [recipientName, setRecipientName] = useState<string>(initialData?.recipientName || '');
  const [phoneCountryCode, setPhoneCountryCode] = useState<string>(initialData?.phoneCountryCode || '+234');
  const [phoneNumber, setPhoneNumber] = useState<string>(initialData?.phoneNumber || '');
  const [address, setAddress] = useState<string>(initialData?.address || '');
  const [buildingEstate, setBuildingEstate] = useState<string>(initialData?.buildingEstate || '');
  const [apartment, setApartment] = useState<string>(initialData?.apartment || '');
  const [city, setCity] = useState<string>(initialData?.city || 'Lagos');
  const [deliveryNotes, setDeliveryNotes] = useState<string>(initialData?.deliveryNotes || '');
  const [dropoffPreference, setDropoffPreference] = useState<'hand' | 'gatehouse' | 'lobby'>(
    initialData?.dropoffPreference || 'hand'
  );
  const [isDefault, setIsDefault] = useState<boolean>(initialData?.isDefault ?? true);
  const [latitude, setLatitude] = useState<number | undefined>(initialData?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(initialData?.longitude);

  const [formError, setFormError] = useState<string | null>(null);
  const [isLocatingLive, setIsLocatingLive] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);

  /**
   * Applies parsed fields to form state immediately and triggers visual feedback
   */
  const applyAutoFillData = (parsed: ReturnType<typeof parseAddressText>) => {
    if (!parsed) return;

    let filledCount = 0;
    const filledFields: string[] = [];

    if (parsed.recipientName) {
      setRecipientName(parsed.recipientName);
      filledCount++;
      filledFields.push('Name');
    }
    if (parsed.phoneNumber) {
      setPhoneNumber(parsed.phoneNumber);
      if (parsed.phoneCountryCode) setPhoneCountryCode(parsed.phoneCountryCode);
      filledCount++;
      filledFields.push('Phone');
    }
    if (parsed.address) {
      setAddress(parsed.address);
      filledCount++;
      filledFields.push('Street');
    }
    if (parsed.buildingEstate) {
      setBuildingEstate(parsed.buildingEstate);
      filledCount++;
      filledFields.push('Estate');
    }
    if (parsed.apartment) {
      setApartment(parsed.apartment);
      filledCount++;
      filledFields.push('Apt');
    }
    if (parsed.city) {
      setCity(parsed.city);
      filledCount++;
      filledFields.push('City');
    }
    if (parsed.deliveryNotes) {
      setDeliveryNotes(parsed.deliveryNotes);
      filledCount++;
      filledFields.push('Notes');
    }

    if (filledCount > 0) {
      setAutoFillSummary(`✓ Auto-filled ${filledCount} field${filledCount > 1 ? 's' : ''} (${filledFields.join(', ')})`);
      setFormError(null);
    } else {
      setAutoFillSummary('No address fields recognized. Please check text or enter manually.');
    }

    setTimeout(() => {
      setAutoFillSummary(null);
    }, 4500);
  };

  /**
   * 1. Smart Text Auto-Fill (from the input field text)
   */
  const handleAutoFillFromText = () => {
    if (!clipboardText.trim()) {
      setAutoFillSummary('Please paste address text into the box first.');
      clipboardInputRef.current?.focus();
      return;
    }
    const parsed = parseAddressText(clipboardText);
    applyAutoFillData(parsed);
  };

  /**
   * 2. 1-Tap Paste from System Clipboard
   */
  const handlePasteFromClipboard = async () => {
    setIsReadingClipboard(true);
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setClipboardText(text);
          const parsed = parseAddressText(text);
          applyAutoFillData(parsed);
          setIsReadingClipboard(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Clipboard read access notice:', err);
    }

    // Fallback: If clipboard read is blocked by browser permissions, trigger from input or focus
    setIsReadingClipboard(false);
    if (clipboardText.trim()) {
      const parsed = parseAddressText(clipboardText);
      applyAutoFillData(parsed);
    } else {
      setAutoFillSummary('Please paste text in the box (Ctrl+V) and tap Auto Fill.');
      clipboardInputRef.current?.focus();
    }
  };

  /**
   * 3. Dedicated Live GPS & IP Location Detection via acquireLiveLocation Engine
   */
  const handleDetectLiveGPS = async () => {
    setIsLocatingLive(true);
    setFormError(null);

    try {
      const loc = await acquireLiveLocation(10000);
      setLatitude(loc.latitude);
      setLongitude(loc.longitude);
      setAddress(loc.address || loc.formattedAddress || `Live Location (${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)})`);
      if (loc.city) setCity(loc.city);
      setGpsSuccess(true);
      const accText = loc.accuracy ? ` (±${Math.round(loc.accuracy)}m)` : '';
      setAutoFillSummary(`✓ Live location detected via ${loc.source}${accText}`);
      setTimeout(() => {
        setGpsSuccess(false);
        setAutoFillSummary(null);
      }, 5000);
    } catch (err: any) {
      console.warn('Live location error:', err);
      setFormError(err.message || 'Could not detect live location. Please allow browser location access or enter address manually.');
    } finally {
      setIsLocatingLive(false);
    }
  };

  const handleAddressSelect = (data: AddressSelectData) => {
    setAddress(data.formattedAddress || data.address);
    if (data.city) setCity(data.city);
    if (data.apartment) setApartment(data.apartment);
    if (data.latitude) setLatitude(data.latitude);
    if (data.longitude) setLongitude(data.longitude);
  };

  const handleQuickNote = (noteText: string) => {
    if (deliveryNotes.includes(noteText)) return;
    setDeliveryNotes((prev) => (prev ? `${prev}, ${noteText}` : noteText));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!address.trim()) {
      setFormError('Please enter or select a valid street address.');
      return;
    }

    const fullAddressString = [
      address.trim(),
      buildingEstate.trim(),
      apartment.trim(),
      city.trim()
    ]
      .filter(Boolean)
      .join(', ');

    try {
      await onSave({
        label,
        recipientName: recipientName.trim() || 'Valued Customer',
        phoneCountryCode,
        phoneNumber: phoneNumber.trim(),
        address: fullAddressString,
        buildingEstate: buildingEstate.trim(),
        apartment: apartment.trim(),
        city: city.trim() || 'Lagos',
        deliveryNotes: deliveryNotes.trim(),
        dropoffPreference,
        isDefault,
        latitude,
        longitude
      });
    } catch (err: any) {
      setFormError(err.message || 'Failed to save address.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-slate-900">
      {formError && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <X className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
          {(formError.toLowerCase().includes('permission') || formError.toLowerCase().includes('device gps')) && (
            <button
              type="button"
              onClick={() => window.open(window.location.href, '_blank')}
              className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold shrink-0 self-start sm:self-auto cursor-pointer shadow-xs transition-colors"
            >
              Open in Direct Tab for Device GPS
            </button>
          )}
        </div>
      )}

      {/* 1. Smart Clipboard Auto-Fill Hub */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-orange-50/90 via-amber-50/50 to-slate-50 border border-orange-200/90 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#FF5500] text-white">
              <Clipboard className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-extrabold text-slate-900">Smart Address Auto-Fill</span>
              <p className="text-[10px] text-slate-500">Paste any address/contact message to fill all fields instantly</p>
            </div>
          </div>
          {autoFillSummary && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in">
              <Check className="w-3 h-3" /> {autoFillSummary}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <input
            ref={clipboardInputRef}
            type="text"
            value={clipboardText}
            onChange={(e) => setClipboardText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAutoFillFromText();
              }
            }}
            placeholder='e.g. "Amina Bello, 08012345678, 14 Admiralty Way, Lekki, Flat 4B"'
            className="flex-1 bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
          />
          <button
            type="button"
            onClick={handlePasteFromClipboard}
            disabled={isReadingClipboard}
            className="px-2.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs shrink-0 flex items-center gap-1 cursor-pointer transition-all hover:border-orange-300"
            title="Paste from system clipboard and parse"
          >
            <Clipboard className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline text-[11px]">Paste</span>
          </button>
          <button
            type="button"
            onClick={handleAutoFillFromText}
            className="px-3.5 py-2 rounded-xl bg-[#FF5500] hover:bg-[#EA4C00] text-white font-extrabold text-xs shrink-0 flex items-center gap-1.5 cursor-pointer shadow-md shadow-orange-500/20 transition-all"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Auto Fill</span>
          </button>
        </div>

        {/* Quick Tip */}
        <div className="mt-2 text-[10px] text-slate-400">
          <span>Tip: Paste full text with name, phone, flat, and street to auto-populate all fields.</span>
        </div>
      </div>

      {/* 2. Street Address with Google Places Autocomplete & Dedicated GPS Pin Detection */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#FF5500]" />
            <span>Street Address & Area *</span>
          </label>
          <button
            type="button"
            onClick={handleDetectLiveGPS}
            disabled={isLocatingLive}
            className="text-[11px] font-bold text-[#FF5500] hover:text-[#EA4C00] flex items-center gap-1 hover:underline cursor-pointer disabled:opacity-50"
          >
            {isLocatingLive ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Locating GPS...</span>
              </>
            ) : gpsSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Location Detected!</span>
              </>
            ) : (
              <>
                <Navigation className="w-3 h-3" />
                <span>Use Live GPS</span>
              </>
            )}
          </button>
        </div>

        <AddressAutocompleteInput
          value={address}
          onChange={setAddress}
          onAddressSelect={handleAddressSelect}
          placeholder="Search street name, estate, or landmark..."
          showCurrentLocationButton={true}
        />
      </div>

      {/* 3. Building / Estate & Apartment Grid (2-Column) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Apt / Flat / Suite Number</label>
          <input
            type="text"
            value={apartment}
            onChange={(e) => setApartment(e.target.value)}
            placeholder="e.g. Apt 4B, 2nd Floor"
            className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Building / Estate Name</label>
          <input
            type="text"
            value={buildingEstate}
            onChange={(e) => setBuildingEstate(e.target.value)}
            placeholder="e.g. Admiralty Heights or Gate 2"
            className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
          />
        </div>
      </div>

      {/* 4. Recipient Name & Multi-Country Phone Number */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>Recipient Name</span>
          </label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Recipient's full name"
            className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>Recipient Phone Number</span>
          </label>
          <div className="flex gap-1.5">
            <CountryCodePicker
              value={phoneCountryCode}
              onChange={setPhoneCountryCode}
            />
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="0801 234 5678"
              className="flex-1 bg-white border border-slate-200 text-xs rounded-xl px-3 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
            />
          </div>
        </div>
      </div>

      {/* 5. Visual Category Tag Chips */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-800">Address Category Tag</label>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'Home', icon: Home },
            { id: 'Work', icon: Building2 },
            { id: 'Family', icon: Users },
            { id: 'Other', icon: Navigation }
          ].map((cat) => {
            const IconComp = cat.icon;
            const isSelected = label === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setLabel(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#FF5500] text-white shadow-xs ring-2 ring-[#FF5500]/30'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <IconComp className="w-3.5 h-3.5" />
                <span>{cat.id}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Courier Drop-Off Method & Quick Instruction Chips */}
      <div className="space-y-2 p-3 rounded-2xl bg-slate-50 border border-slate-200">
        <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#FF5500]" />
          <span>Courier Handover Preference</span>
        </label>

        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'hand', label: 'Hand it to me' },
            { id: 'gatehouse', label: 'Leave at Gate' },
            { id: 'lobby', label: 'Meet in Lobby' }
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setDropoffPreference(mode.id as any)}
              className={`p-2 rounded-xl border text-[11px] font-bold text-center transition-all cursor-pointer ${
                dropoffPreference === mode.id
                  ? 'bg-orange-100/70 border-[#FF5500] text-[#FF5500] ring-1 ring-[#FF5500]/30'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Courier Instruction Note & Prompt Chips */}
        <div className="space-y-1.5 pt-1">
          <textarea
            rows={2}
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            placeholder="Special delivery instructions for courier (e.g. Call at gate 2, ring bell twice)..."
            className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FF5500] resize-none"
          />

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Add:</span>
            {['Call on arrival', 'Leave with gate security', 'Ring bell twice', 'Ask for gate pass'].map(
              (chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleQuickNote(chip)}
                  className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 hover:border-orange-300 hover:bg-orange-50 text-[10px] font-bold text-slate-600 hover:text-[#FF5500] transition-colors cursor-pointer"
                >
                  + {chip}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* 7. Default Switch & Action Buttons */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="w-4 h-4 rounded text-[#FF5500] focus:ring-[#FF5500] accent-[#FF5500]"
          />
          <span className="text-xs font-bold text-slate-800">Set as primary default address</span>
        </label>
      </div>

      <div className="flex items-center gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 py-3 px-4 rounded-2xl bg-[#FF5500] hover:bg-[#EA4C00] text-white font-extrabold text-xs shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Address...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Save & Deliver Here</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
