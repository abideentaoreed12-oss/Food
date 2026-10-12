import React, { useState } from 'react';
import { Map, AdvancedMarker, InfoWindow, useApiIsLoaded } from '@vis.gl/react-google-maps';
import { useDelivery } from '../../context/DeliveryContext';
import { Store, Star, Clock, MapPin, Navigation, Bike, Compass, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

interface DeliveryMapViewProps {
  height?: string;
  selectedRestaurantId?: string | null;
  onSelectRestaurant?: (id: string) => void;
  showCourierRoute?: boolean;
}

export const DeliveryMapView: React.FC<DeliveryMapViewProps> = ({
  height = '420px',
  selectedRestaurantId,
  onSelectRestaurant,
  showCourierRoute = false
}) => {
  const { restaurants, currency, setSelectedRestaurantId } = useDelivery();
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(selectedRestaurantId || null);
  const apiIsLoaded = useApiIsLoaded();

  const restaurantsWithCoordinates = (restaurants || []).filter((r) =>
    r && typeof r.lat === 'number' && typeof r.lng === 'number' &&
    Number.isFinite(r.lat) && Number.isFinite(r.lng) && r.lat >= -90 && r.lat <= 90 && r.lng >= -180 && r.lng <= 180
  );
  const defaultCenter = restaurantsWithCoordinates.length
    ? { lat: restaurantsWithCoordinates[0].lat, lng: restaurantsWithCoordinates[0].lng }
    : null;

  const handleMarkerClick = (id: string) => {
    setActiveMarkerId(id);
    if (onSelectRestaurant) {
      onSelectRestaurant(id);
    }
  };

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border border-slate-200/90 shadow-md bg-slate-100">
      {/* Map Control Header Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-slate-200 shadow-md text-xs font-bold text-slate-800 flex items-center gap-2 pointer-events-auto">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-display font-extrabold text-slate-900">Restaurant Locations</span>
          <span className="text-slate-300">·</span>
          <span className="text-[#0D4F3C] font-mono">Verified Partner Locations</span>
        </div>

        <div className="bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-2xl text-[11px] font-semibold border border-slate-700 shadow-md pointer-events-auto hidden sm:flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-[#E8C547]" />
          <span>Restaurant Map</span>
        </div>
      </div>

      <div style={{ height, width: '100%' }}>
        {apiIsLoaded && defaultCenter ? (
          <Map
            mapId="DEMO_MAP_ID"
            defaultCenter={defaultCenter}
            defaultZoom={13}
            gestureHandling="greedy"
            disableDefaultUI={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            className="w-full h-full rounded-3xl"
          >
            {(restaurants || [])
              .filter(
                (r) =>
                  r &&
                  typeof r.lat === 'number' &&
                  typeof r.lng === 'number' &&
                  !isNaN(r.lat) &&
                  !isNaN(r.lng)
              )
              .map((rest) => {
                const isActive = activeMarkerId === rest.id;
                const safeRating = (rest.rating != null ? Number(rest.rating) : 4.5).toFixed(1);
                return (
                  <React.Fragment key={rest.id}>
                    <AdvancedMarker
                      position={{ lat: rest.lat, lng: rest.lng }}
                      onClick={() => handleMarkerClick(rest.id)}
                      title={rest.name}
                    >
                      <div
                        className={`relative group cursor-pointer transition-transform duration-200 ${
                          isActive ? 'scale-110 z-30' : 'hover:scale-105 z-10'
                        }`}
                      >
                        <div
                          className={`px-3 py-1.5 rounded-2xl shadow-lg border flex items-center gap-2 font-bold text-xs transition-all ${
                            isActive
                              ? 'bg-[#0D4F3C] text-white border-white ring-4 ring-[#0D4F3C]/20'
                              : 'bg-white text-slate-900 border-slate-200 hover:border-[#0D4F3C]/40'
                          }`}
                        >
                          <Store className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[#0D4F3C]'}`} />
                          <span className="truncate max-w-[120px]">{rest.name}</span>
                          <div className="flex items-center gap-0.5 text-[10px] font-mono">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            <span>{safeRating}</span>
                          </div>
                        </div>

                        {/* Pin tail */}
                        <div
                          className={`w-2.5 h-2.5 mx-auto -mt-1 rotate-45 border-r border-b ${
                            isActive
                              ? 'bg-[#0D4F3C] border-white'
                              : 'bg-white border-slate-200'
                          }`}
                        />
                      </div>
                    </AdvancedMarker>

                    {/* Selected Restaurant InfoWindow */}
                    {isActive && (
                      <InfoWindow
                        position={{ lat: rest.lat, lng: rest.lng }}
                        onCloseClick={() => setActiveMarkerId(null)}
                        headerDisabled={true}
                      >
                        <div className="p-1 max-w-[220px] text-slate-900 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-extrabold text-xs text-slate-900 font-display">
                              {rest.name}
                            </h4>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Open
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 leading-tight">
                            {rest.address}
                          </p>

                          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-mono">
                            <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                              <Star className="w-3 h-3 fill-amber-400" />
                              {safeRating}
                            </span>
                          <span>·</span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {rest.deliveryTimeMin != null && rest.deliveryTimeMax != null ? `${rest.deliveryTimeMin}-${rest.deliveryTimeMax}m prep` : 'Time unavailable'}
                          </span>
                        </div>

                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-semibold">
                            Fee: {rest.calculatedDeliveryFee != null ? formatCurrency(rest.calculatedDeliveryFee, currency) : 'After address'}
                          </span>

                          <button
                            onClick={() => {
                              setSelectedRestaurantId(rest.id);
                            }}
                            className="px-2.5 py-1 bg-[#0D4F3C] hover:bg-[#0A3F30] text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
                          >
                            View Menu →
                          </button>
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </React.Fragment>
              );
            })}
          </Map>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white p-6 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#0D4F3C_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="relative z-10 text-center max-w-sm space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0D4F3C]/20 text-[#0D4F3C] flex items-center justify-center mx-auto ring-8 ring-[#0D4F3C]/10">
                <Navigation className="w-6 h-6 rotate-45" />
              </div>
              <h3 className="text-sm font-bold text-white font-display">
                Interactive map unavailable
              </h3>
              <p className="text-xs text-slate-400">
                Configure the optional map display provider to enable the interactive map. Address search and delivery routing remain available through OpenStreetMap services.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                  {(restaurants || []).length} restaurant records
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
