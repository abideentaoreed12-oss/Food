import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { ALL_COUNTRY_CODES, CountryCodeItem } from '../../data/countryCodes';

interface CountryCodePickerProps {
  value: string; // Dial code e.g. "+234"
  onChange: (code: string) => void;
  className?: string;
}

export const CountryCodePicker: React.FC<CountryCodePickerProps> = ({
  value,
  onChange,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Find currently selected country or default to Nigeria (+234)
  const selectedCountry =
    ALL_COUNTRY_CODES.find((c) => c.code === value) || ALL_COUNTRY_CODES[0];

  const filteredCountries = ALL_COUNTRY_CODES.filter((c) => {
    const query = search.toLowerCase().trim();
    if (!query) return true;
    return (
      c.name.toLowerCase().includes(query) ||
      c.code.includes(query) ||
      c.iso.toLowerCase().includes(query)
    );
  });

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
      >
        <span className="text-base leading-none">{selectedCountry.flag}</span>
        <span className="font-mono text-slate-900">{selectedCountry.code}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {/* Full World Country Search Modal / Popover */}
      {isOpen && (
        <div className="absolute z-50 left-0 top-11 w-72 sm:w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 text-slate-900">
          {/* Header & Search Bar */}
          <div className="p-2.5 bg-slate-50/80 border-b border-slate-100 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                Select Country Code ({ALL_COUNTRY_CODES.length})
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country or code (e.g. Nigeria, +234)..."
                autoFocus
                className="w-full bg-white border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-1.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#FF5500]"
              />
            </div>
          </div>

          {/* Scrollable Country List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100/60 p-1">
            {filteredCountries.length > 0 ? (
              filteredCountries.map((country, idx) => {
                const isSelected = country.code === value && country.iso === selectedCountry.iso;
                return (
                  <button
                    key={`${country.iso}-${country.code}-${idx}`}
                    type="button"
                    onClick={() => {
                      onChange(country.code);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'bg-orange-50 text-[#FF5500] font-extrabold'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="text-base shrink-0">{country.flag}</span>
                      <span className="truncate font-medium">{country.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono font-bold text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">
                        {country.code}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#FF5500]" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">
                No matching country found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
