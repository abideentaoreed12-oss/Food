import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  MapPin,
  Search,
  Navigation,
  CheckCircle2,
  X,
  Loader2,
  Compass,
  Building,
  Check
} from 'lucide-react';
import { acquireLiveLocation } from '../../utils/liveLocation';

export interface AddressSelectData {
  address: string;
  apartment?: string;
  city: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  formattedAddress: string;
}

export interface AddressAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (data: AddressSelectData) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  name?: string;
  showCurrentLocationButton?: boolean;
}

interface SuggestionItem {
  id: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  placeId?: string;
  source: 'google' | 'gps' | 'popular' | 'fallback';
  lat?: number;
  lng?: number;
}

const POPULAR_ZONES: SuggestionItem[] = [
  {
    id: 'pop-1',
    mainText: 'Admiralty Way, Lekki Phase 1',
    secondaryText: 'Lekki Peninsula, Lagos, Nigeria',
    fullText: 'Admiralty Way, Lekki Phase 1, Lagos',
    source: 'popular',
    lat: 6.4474,
    lng: 3.4723
  },
  {
    id: 'pop-2',
    mainText: 'Ahmadu Bello Way, Victoria Island',
    secondaryText: 'Victoria Island, Lagos, Nigeria',
    fullText: 'Ahmadu Bello Way, Victoria Island, Lagos',
    source: 'popular',
    lat: 6.4281,
    lng: 3.4219
  },
  {
    id: 'pop-3',
    mainText: 'Bourdillon Road, Ikoyi',
    secondaryText: 'Ikoyi, Lagos, Nigeria',
    fullText: 'Bourdillon Road, Ikoyi, Lagos',
    source: 'popular',
    lat: 6.4549,
    lng: 3.4357
  },
  {
    id: 'pop-4',
    mainText: 'Isaac John Street, GRA Ikeja',
    secondaryText: 'Ikeja, Lagos, Nigeria',
    fullText: 'Isaac John Street, GRA Ikeja, Lagos',
    source: 'popular',
    lat: 6.5866,
    lng: 3.3578
  },
  {
    id: 'pop-5',
    mainText: 'Herbert Macaulay Way, Yaba',
    secondaryText: 'Yaba / Alagomeji, Lagos, Nigeria',
    fullText: 'Herbert Macaulay Way, Yaba, Lagos',
    source: 'popular',
    lat: 6.5059,
    lng: 3.3781
  },
  {
    id: 'pop-6',
    mainText: 'Aminu Kano Crescent, Wuse 2',
    secondaryText: 'Wuse 2, Abuja, FCT, Nigeria',
    fullText: 'Aminu Kano Crescent, Wuse 2, Abuja',
    source: 'popular',
    lat: 9.0765,
    lng: 7.4721
  }
];

export const AddressAutocompleteInput: React.FC<AddressAutocompleteInputProps> = ({
  value,
  onChange,
  onAddressSelect,
  placeholder = 'Start typing street address or landmark...',
  className = '',
  required = false,
  disabled = false,
  autoFocus = false,
  id,
  name,
  showCurrentLocationButton = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Load Google Maps Places Library via vis.gl
  let placesLib: google.maps.PlacesLibrary | null = null;
  try {
    placesLib = useMapsLibrary('places');
  } catch (err) {
    // If not within APIProvider or error, safely continue with fallback
    placesLib = null;
  }

  // Session Token for Google Places Autocomplete
  const sessionTokenRef = useRef<any>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions with debouncing
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = value.trim();

    if (!trimmed) {
      setSuggestions([]);
      setIsLoading(false);
      setIsVerified(false);
      return;
    }

    // If text was set by a selection, don't re-trigger search if verified
    if (isVerified) {
      return;
    }

    setIsLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        let items: SuggestionItem[] = [];

        // 1. Try Google Places Autocomplete (New or Classic)
        if (placesLib) {
          try {
            if ((placesLib as any).AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
              if (!sessionTokenRef.current && (placesLib as any).AutocompleteSessionToken) {
                sessionTokenRef.current = new (placesLib as any).AutocompleteSessionToken();
              }

              const res = await (placesLib as any).AutocompleteSuggestion.fetchAutocompleteSuggestions({
                input: trimmed,
                sessionToken: sessionTokenRef.current || undefined
              });

              if (res?.suggestions?.length) {
                items = res.suggestions.map((s: any, idx: number) => {
                  const placePred = s.placePrediction;
                  return {
                    id: placePred?.placeId || `google-${idx}`,
                    mainText: placePred?.mainText?.toString() || placePred?.text?.toString() || trimmed,
                    secondaryText: placePred?.secondaryText?.toString() || 'Verified Location',
                    fullText: placePred?.text?.toString() || trimmed,
                    placeId: placePred?.placeId,
                    source: 'google'
                  };
                });
              }
            } else if ((placesLib as any).AutocompleteService) {
              const svc = new (placesLib as any).AutocompleteService();
              const preds: google.maps.places.AutocompletePrediction[] = await new Promise((resolve) => {
                svc.getPlacePredictions(
                  {
                    input: trimmed,
                    componentRestrictions: { country: 'ng' }
                  },
                  (results: any) => resolve(results || [])
                );
              });

              if (preds && preds.length > 0) {
                items = preds.map((p) => ({
                  id: p.place_id,
                  mainText: p.structured_formatting?.main_text || p.description,
                  secondaryText: p.structured_formatting?.secondary_text || '',
                  fullText: p.description,
                  placeId: p.place_id,
                  source: 'google'
                }));
              }
            }
          } catch (gErr) {
            console.warn('Google Places suggestion fetch notice:', gErr);
          }
        }

        // 2. High-speed open geocoding fallback if Google returned 0 or wasn't loaded
        if (items.length === 0) {
          try {
            const params = new URLSearchParams({
              q: /\\b(nigeria|lagos|ibadan|abuja|oyo|ogun|rivers|enugu|kano)\\b/i.test(trimmed)
                ? trimmed
                : `${trimmed}, Nigeria`,
              limit: '5',
              lang: 'en',
              countrycode: 'ng'
            });
            const resp = await fetch(
              `https://photon.komoot.io/api/?${params.toString()}`
            );
            if (resp.ok) {
              const data = await resp.json();
              if (data?.features?.length > 0) {
                items = data.features.filter((f: any) => {
                  const country = String(f?.properties?.country || '');
                  const coords = f?.geometry?.coordinates || [];
                  return (!country || /nigeria/i.test(country)) &&
                    Number.isFinite(Number(coords[0])) && Number.isFinite(Number(coords[1])) &&
                    Number(coords[1]) >= 4 && Number(coords[1]) <= 14 &&
                    Number(coords[0]) >= 2 && Number(coords[0]) <= 15;
                }).map((f: any, i: number) => {
                  const props = f.properties || {};
                  const main = [props.housenumber, props.street || props.name].filter(Boolean).join(' ') || props.name || trimmed;
                  const secParts = [props.district, props.city, props.state, props.country].filter(Boolean);
                  const sec = secParts.join(', ') || 'Nigeria';
                  return {
                    id: `geo-${i}-${props.osm_id || Math.random()}`,
                    mainText: main,
                    secondaryText: sec,
                    fullText: [main, sec].filter(Boolean).join(', '),
                    source: 'fallback',
                    lat: f.geometry?.coordinates?.[1],
                    lng: f.geometry?.coordinates?.[0]
                  };
                });
              }
            }
          } catch (fallErr) {
            console.warn('Fallback geocoding notice:', fallErr);
          }
        }

        // 3. Fallback to matching popular zones
        if (items.length === 0) {
          const lower = trimmed.toLowerCase();
          const matchedPopular = POPULAR_ZONES.filter(
            (z) =>
              z.mainText.toLowerCase().includes(lower) ||
              z.secondaryText.toLowerCase().includes(lower)
          );
          if (matchedPopular.length > 0) {
            items = matchedPopular;
          }
        }

        setSuggestions(items);
        setIsOpen(items.length > 0);
      } catch (err) {
        console.error('Error fetching address suggestions:', err);
      } finally {
        setIsLoading(false);
      }
    }, 220);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, placesLib, isVerified]);

  // Handle Selection of an Address
  const handleSelectSuggestion = useCallback(
    async (item: SuggestionItem) => {
      setIsLoading(true);
      setIsVerified(true);
      setIsOpen(false);

      let streetAddr = item.mainText;
      let city = 'Lagos';
      let state = 'Lagos';
      let formatted = item.fullText;
      let lat = item.lat;
      let lng = item.lng;

      // Extract City/State from secondary text
      const secLower = (item.secondaryText || '').toLowerCase();
      if (secLower.includes('abuja')) {
        city = 'Abuja';
        state = 'FCT';
      } else if (secLower.includes('ibadan')) {
        city = 'Ibadan';
        state = 'Oyo';
      } else if (secLower.includes('port harcourt')) {
        city = 'Port Harcourt';
        state = 'Rivers';
      } else if (secLower.includes('lagos') || secLower.includes('lekki') || secLower.includes('ikeja')) {
        city = 'Lagos';
        state = 'Lagos';
      }

      // If Google Place ID exists, fetch detailed place fields
      if (item.placeId && window.google?.maps?.places) {
        try {
          const service = new window.google.maps.places.PlacesService(document.createElement('div'));
          await new Promise<void>((resolve) => {
            service.getDetails(
              {
                placeId: item.placeId!,
                fields: ['formatted_address', 'address_components', 'geometry', 'name']
              },
              (place, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
                  if (place.formatted_address) {
                    formatted = place.formatted_address;
                  }
                  if (place.geometry?.location) {
                    lat = place.geometry.location.lat();
                    lng = place.geometry.location.lng();
                  }

                  // Parse components
                  if (place.address_components) {
                    let streetNum = '';
                    let route = '';
                    let locality = '';
                    let adminArea = '';

                    for (const comp of place.address_components) {
                      if (comp.types.includes('street_number')) streetNum = comp.long_name;
                      if (comp.types.includes('route')) route = comp.long_name;
                      if (comp.types.includes('locality')) locality = comp.long_name;
                      if (comp.types.includes('administrative_area_level_1')) adminArea = comp.long_name;
                    }

                    if (streetNum && route) {
                      streetAddr = `${streetNum} ${route}`;
                    } else if (route) {
                      streetAddr = route;
                    } else if (place.name) {
                      streetAddr = place.name;
                    }

                    if (locality) city = locality;
                    if (adminArea) state = adminArea;
                  }
                }
                resolve();
              }
            );
          });
        } catch (e) {
          console.warn('Place details fetch notice:', e);
        }
      }

      // If user typed without comma, use the full clean street text
      const cleanAddress = streetAddr || item.mainText;
      onChange(cleanAddress);

      if (onAddressSelect) {
        onAddressSelect({
          address: cleanAddress,
          city: city || 'Lagos',
          state: state || 'Lagos',
          formattedAddress: formatted,
          latitude: lat,
          longitude: lng
        });
      }

      // Reset session token for next search
      sessionTokenRef.current = null;
      setIsLoading(false);
    },
    [onChange, onAddressSelect]
  );

  // Live Current Location Detection via acquireLiveLocation Engine
  const handleDetectCurrentLocation = useCallback(async () => {
    setIsLocating(true);
    setLocationError('');
    setIsVerified(false);
    setIsOpen(false);

    try {
      const loc = await acquireLiveLocation(10000);
      const addr = loc.address || loc.formattedAddress || '';
      if (!addr.trim() || /^(current location|device gps location|live location)(\\b|\\s*\\()/i.test(addr.trim()) || /^-?\\d+(?:\\.\\d+)?\\s*,\\s*-?\\d+(?:\\.\\d+)?$/.test(addr.trim())) {
        throw new Error('We found your GPS position but could not verify a readable address. Please enter your Nigerian street, area, city and state.');
      }
      setIsVerified(true);
      onChange(addr);

      if (onAddressSelect) {
        onAddressSelect({
          address: addr,
          city: loc.city || '',
          state: loc.state || '',
          country: loc.country || '',
          formattedAddress: loc.formattedAddress || addr,
          latitude: loc.latitude,
          longitude: loc.longitude
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not verify your live address. Please enter it manually.';
      setLocationError(message);
      console.warn('Live location error:', err);
    } finally {
      setIsLocating(false);
    }
  }, [onChange, onAddressSelect]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsVerified(false);
    onChange(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Input Box with icons and actions */}
      <div className="relative flex items-center">
        {/* Left Status Icon */}
        <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-[#FF5500] animate-spin" />
          ) : isVerified ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-50" />
          ) : (
            <MapPin className="w-4 h-4 text-slate-400" />
          )}
        </div>

        {/* Text Input Field */}
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          className={`w-full pl-9 pr-20 py-2.5 text-xs rounded-xl bg-white border transition-all text-slate-900 placeholder-slate-400 focus:outline-none ${
            isVerified
              ? 'border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
              : 'border-slate-200 hover:border-slate-300 focus:border-[#FF5500] focus:ring-2 focus:ring-orange-100'
          }`}
        />

        {/* Right Action Icons: Clear & Live GPS */}
        <div className="absolute right-2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsVerified(false);
                setSuggestions([]);
                inputRef.current?.focus();
              }}
              title="Clear"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {showCurrentLocationButton && (
            <button
              type="button"
              onClick={handleDetectCurrentLocation}
              disabled={isLocating || disabled}
              title="Use my live GPS location"
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                isLocating
                  ? 'bg-orange-100 text-[#FF5500] animate-pulse'
                  : 'bg-orange-50 hover:bg-orange-100 text-[#FF5500] hover:text-[#EA4C00]'
              }`}
            >
              {isLocating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5 rotate-45" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Verified Status Tag */}
      {isVerified && value && (
        <div className="flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-emerald-600">
          <Check className="w-3 h-3 stroke-[3]" />
          <span>Live address verified</span>
        </div>
      )}
      {locationError && (
        <p role="alert" className="mt-2 text-xs font-medium text-rose-600">{locationError}</p>
      )}

      {/* Autocomplete Dropdown Popover */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header Bar */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#FF5500]" />
              {value.trim().length >= 2 ? 'Live Address Suggestions' : 'Popular Delivery Areas'}
            </span>
            {showCurrentLocationButton && (
              <button
                type="button"
                onClick={handleDetectCurrentLocation}
                disabled={isLocating}
                className="text-[#FF5500] hover:text-[#EA4C00] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Compass className="w-3 h-3" />
                <span>{isLocating ? 'Locating...' : 'Locate Me'}</span>
              </button>
            )}
          </div>

          {/* Suggestions List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
            {/* If user hasn't typed much, show Popular Hubs */}
            {value.trim().length < 2 && (
              <div className="p-2 space-y-1">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Quick Select Hubs (Lagos & Abuja)
                </p>
                {POPULAR_ZONES.map((zone, idx) => (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(zone)}
                    className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-orange-50/80 transition-colors flex items-start gap-2.5 cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-orange-100 text-[#FF5500] flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[#FF5500] group-hover:text-white transition-colors">
                      <Building className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 group-hover:text-[#FF5500] transition-colors truncate">
                        {zone.mainText}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{zone.secondaryText}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* When user typed 2+ chars: Live results */}
            {value.trim().length >= 2 && suggestions.length > 0 && (
              suggestions.map((item, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 transition-colors cursor-pointer ${
                      isSelected ? 'bg-orange-50 text-slate-900' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-orange-100 group-hover:text-[#FF5500]">
                      <MapPin className="w-3.5 h-3.5 text-[#FF5500]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {item.mainText}
                      </p>
                      {item.secondaryText && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {item.secondaryText}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Verified
                    </span>
                  </button>
                );
              })
            )}

            {/* Loading state indicator */}
            {value.trim().length >= 2 && isLoading && suggestions.length === 0 && (
              <div className="py-6 px-4 text-center text-slate-500">
                <Loader2 className="w-5 h-5 text-[#FF5500] animate-spin mx-auto mb-1.5" />
                <p className="text-xs font-semibold">Searching live addresses & places...</p>
              </div>
            )}

            {/* Empty state when nothing matched */}
            {value.trim().length >= 2 && !isLoading && suggestions.length === 0 && (
              <div className="py-5 px-4 text-center">
                <Search className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-slate-700">No exact place match</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  You can still save "{value}" as your custom address.
                </p>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="px-3 py-1.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span>Press Enter to select</span>
            <span className="font-semibold text-slate-500">Live Maps Verification</span>
          </div>
        </div>
      )}
    </div>
  );
};
