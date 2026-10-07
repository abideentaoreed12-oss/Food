import React, { useState } from 'react';
import { Map, AdvancedMarker, InfoWindow, useApiIsLoaded } from '@vis.gl/react-google-maps';
import { useDelivery } from '../../context/DeliveryContext';
import { Store, Star, Clock, MapPin, Navigation, Bike, Compass, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { DEFAULT_MAP_CENTER } from '../../utils/googleMapsConfig';

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

  // Default center: Victoria Island / Lekki Phase 1, Lagos
  const defaultCenter = DEFAULT_MAP_CENTER;

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
          <span className="font-display font-extrabold text-slate-900">Live Coverage</span>
          <span className="text-slate-300">·</span>
          <span className="text-[#FF5500] font-mono">Lagos & Abuja Partners</span>
        </div>

        <div className="bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-2xl text-[11px] font-semibold border border-slate-700 shadow-md pointer-events-auto hidden sm:flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-orange-400" />
          <span>Interactive Dispatch Map</span>
        </div>
      </div>

      <div style={{ height, width: '100%' }}>
        {apiIsLoaded ? (
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
                              ? 'bg-[#FF5500] text-white border-white ring-4 ring-orange-500/20'
                              : 'bg-white text-slate-900 border-slate-200 hover:border-orange-300'
                          }`}
                        >
                          <Store className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[#FF5500]'}`} />
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
                              ? 'bg-[#FF5500] border-white'
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
                            {rest.deliveryTimeMin}-{rest.deliveryTimeMax}m
                          </span>
                        </div>

                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-semibold">
                            Fee: {formatCurrency(rest.deliveryFee, currency)}
                          </span>

                          <button
                            onClick={() => {
                              setSelectedRestaurantId(rest.id);
                            }}
                            className="px-2.5 py-1 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
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
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#FF5500_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="relative z-10 text-center max-w-sm space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-[#FF5500] flex items-center justify-center mx-auto ring-8 ring-orange-500/10">
                <Navigation className="w-6 h-6 rotate-45" />
              </div>
              <h3 className="text-sm font-bold text-white font-display">
                Connecting Live Dispatch Radar
              </h3>
              <p className="text-xs text-slate-400">
                Lekki Phase 1, Victoria Island, Ikeja & Abuja coverage network is active.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                  {(restaurants || []).length} Kitchen Hubs Online
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
