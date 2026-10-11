import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface CountryCodeItem {
  name: string;
  code: string;
  flag: string;
  iso: string;
}

export const NIGERIA_COUNTRY_CODE: CountryCodeItem = {
  name: 'Nigeria',
  code: '+234',
  flag: '🇳🇬',
  iso: 'NG',
};

// Veyrang primary dial codes — default is Nigeria (+234)
export const SUPPORTED_COUNTRY_CODES: CountryCodeItem[] = [
  NIGERIA_COUNTRY_CODE,
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧', iso: 'GB' },
  { name: 'United States', code: '+1', flag: '🇺🇸', iso: 'US' },
];

export const ALL_COUNTRY_CODES = SUPPORTED_COUNTRY_CODES;

interface CountryCodePickerProps {
  value: string; // Dial code e.g. "+234"
  onChange: (code: string) => void;
  className?: string;
}

export const CountryCodePicker: React.FC<CountryCodePickerProps> = ({
  value = '+234',
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Default to Nigeria (+234)
  const selectedCountry =
    SUPPORTED_COUNTRY_CODES.find((c) => c.code === value) || NIGERIA_COUNTRY_CODE;

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={`relative inline-block ${className}`} ref={modalRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 bg-white border border-slate-200 hover:border-slate-300 text-xs rounded-xl px-2.5 py-2 font-extrabold text-slate-800 flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-[#FF5500] cursor-pointer shadow-2xs transition-colors shrink-0"
        title="Select phone country code"
      >
        <span className="text-base leading-none">{selectedCountry.flag}</span>
        <span className="font-mono text-slate-900">{selectedCountry.code}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {/* Country Selection Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 top-11 w-48 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100 text-slate-900 p-1">
          {SUPPORTED_COUNTRY_CODES.map((country) => {
            const isSelected = country.code === value;
            return (
              <button
                key={country.iso}
                type="button"
                onClick={() => {
                  onChange(country.code);
                  setIsOpen(false);
                }}
                className={`w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer text-left ${
                  isSelected
                    ? 'bg-orange-50 text-[#FF5500] font-extrabold'
                    : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{country.flag}</span>
                  <span className="font-medium">{country.name}</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[11px] text-slate-600">
                  <span>{country.code}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#FF5500]" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
