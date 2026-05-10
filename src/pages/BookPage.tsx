import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, Navigation, Send, Loader2, Bookmark, LocateFixed, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RideState, Location } from '@/hooks/useRider';
import { VehicleSelector } from '@/components/VehicleSelector';
import { FareCard } from '@/components/FareCard';
import { searchAddress, getRoute } from '@/lib/maps';
import { cn } from '@/lib/utils';
import { savedPlaces, vehicleTypes } from '@/data/transportData';
import { supabase } from '@/lib/supabase';

// Fix for default marker icons in React Leaflet
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  ride: RideState;
  setPickup: (loc: Location | null) => void;
  setDestination: (loc: Location | null) => void;
  setVehicle: (id: string) => void;
  setRouteDetails: (dist: number, dur: number) => void;
  setStatus: (status: RideState['status']) => void;
  resetRide: () => void;
}

// Helper component to center map on markers
function MapUpdater({ pickup, destination, lastUpdate }: { pickup: Location | null, destination: Location | null, lastUpdate: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (pickup && destination) {
      const bounds = L.latLngBounds([pickup.lat, pickup.lng], [destination.lat, destination.lng]);
      map.fitBounds(bounds, { padding: [80, 80] });
    } else if (pickup) {
      map.setView([pickup.lat, pickup.lng], 15);
    }
  }, [pickup, destination, map, lastUpdate]);

  return null;
}

export default function BookPage({ ride, setPickup, setDestination, setVehicle, setRouteDetails, setStatus, resetRide }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeInput, setActiveInput] = useState<'pickup' | 'destination' | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [mapUpdateKey, setMapUpdateKey] = useState(0);
  const searchTimeout = useRef<any>(null);

  // Handle address search with debounce
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchAddress(searchQuery);
        setSuggestions(results);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

  // Update route when pickup/destination changes
  useEffect(() => {
    if (ride.pickup && ride.destination) {
      const fetchRoute = async () => {
        setIsRouting(true);
        const data = await getRoute(
          [ride.pickup!.lat, ride.pickup!.lng],
          [ride.destination!.lat, ride.destination!.lng]
        );
        
        if (data && data.routes && data.routes[0]) {
          const route = data.routes[0];
          setRouteCoords(route.geometry.coordinates.map((c: any) => [c[1], c[0]]));
          setRouteDetails(route.distance / 1000, route.duration / 60);
        } else if (ride.pickup && ride.destination) {
          alert("Could not calculate route. Please try again.");
        }
        setIsRouting(false);
      };
      fetchRoute();
    } else {
      setRouteCoords([]);
    }
  }, [ride.pickup, ride.destination]);

  const selectLocation = (item: any) => {
    const loc: Location = {
      lat: parseFloat(item.lat || item.latitude),
      lng: parseFloat(item.lon || item.longitude || item.lng),
      address: item.display_name ? item.display_name.split(',')[0] + ', ' + (item.address?.city || item.address?.town || '') : item.address
    };

    if (activeInput === 'pickup') {
      setPickup(loc);
    } else {
      setDestination(loc);
    }

    setSuggestions([]);
    setSearchQuery('');
    setActiveInput(null);
  };

  const useCurrentLocation = () => {
    // Simulated current location (Kathmandu Durbar Square)
    const currentLoc: Location = {
      lat: 27.7042,
      lng: 85.3065,
      address: "Kathmandu Durbar Square, Basantapur"
    };
    
    if (activeInput === 'pickup') setPickup(currentLoc);
    else setDestination(currentLoc);
    
    setActiveInput(null);
  };

  const selectSavedPlace = (place: any) => {
    const loc: Location = {
      lat: place.lat,
      lng: place.lng,
      address: place.address
    };
    
    if (activeInput === 'pickup') setPickup(loc);
    else setDestination(loc);
    
    setActiveInput(null);
  };

  const currentStep = !ride.pickup ? 'pickup' : !ride.destination ? 'destination' : 'vehicle';

  const confirmRide = async () => {
    if (!ride.pickup || !ride.destination) return;
    
    setStatus('searching');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const vehicle = vehicleTypes.find(v => v.id === ride.vehicleId);
      const totalFare = Math.round((vehicle?.baseFare || 0) + ((ride.distance || 0) * (vehicle?.perKm || 0)));

      const { error } = await supabase.from('rides').insert({
        user_id: user.id,
        pickup_address: ride.pickup.address,
        pickup_lat: ride.pickup.lat,
        pickup_lng: ride.pickup.lng,
        destination_address: ride.destination.address,
        destination_lat: ride.destination.lat,
        destination_lng: ride.destination.lng,
        vehicle_id: ride.vehicleId,
        distance: ride.distance,
        duration: ride.duration,
        fare: totalFare,
        status: 'completed'
      });

      if (error) throw error;
      
      setStatus('assigned'); // Use this to show success briefly

      // Reset flow after showing success
      setTimeout(() => {
        setStatus('idle');
        resetRide();
      }, 3000);
      
    } catch (error) {
      console.error("Ride insertion error:", error);
      setStatus('idle');
      alert("Failed to save ride. Please check connection.");
    }
  };

  const isSearchingRide = ride.status === 'searching';
  const isAssignedRide = ride.status === 'assigned';

  return (
    <div id="book-page" className="relative h-full w-full overflow-hidden flex flex-col">
      {/* Map Background */}
      <div className="absolute inset-0 z-0">
        <MapContainer 
          center={[27.7172, 85.3240]} 
          zoom={13} 
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {ride.pickup && <Marker position={[ride.pickup.lat, ride.pickup.lng]} />}
          {ride.destination && <Marker position={[ride.destination.lat, ride.destination.lng]} />}
          {routeCoords.length > 0 && <Polyline positions={routeCoords} color="#176b4d" weight={5} opacity={0.7} />}
          <MapUpdater pickup={ride.pickup} destination={ride.destination} lastUpdate={mapUpdateKey} />
        </MapContainer>

        {(ride.pickup || ride.destination) && (
          <button 
            onClick={() => setMapUpdateKey(prev => prev + 1)}
            className="absolute right-4 bottom-1/2 translate-y-24 z-10 w-12 h-12 bg-white rounded-2xl shadow-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:text-primary transition-all active:scale-95"
          >
            <LocateFixed size={20} />
          </button>
        )}
        
        {isRouting && (
          <div className="absolute inset-x-0 bottom-1/2 flex justify-center pointer-events-none">
            <div className="bg-white/80 backdrop-blur-sm p-3 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3">
              <Loader2 className="animate-spin text-primary" size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">Calculating...</span>
            </div>
          </div>
        )}
      </div>

      {/* Top HUD */}
      <div className="relative z-10 p-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />
              <div className="w-0.5 h-8 bg-slate-100" />
              <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-sm" />
            </div>
            
            <div className="flex-1 space-y-2">
              <div className={cn("w-full relative group")}>
                <button 
                  onClick={() => setActiveInput('pickup')}
                  className={cn(
                    "w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all border-2",
                    activeInput === 'pickup' ? "bg-slate-50 border-primary" : "bg-slate-50 border-transparent shadow-inner-sm"
                  )}
                >
                  <div className="flex justify-between items-center pr-6">
                    <span className={cn("block truncate max-w-[200px]", !ride.pickup ? "text-slate-400" : "text-slate-700 font-bold")}>
                      {ride.pickup?.address || "Pickup Point"}
                    </span>
                    {!ride.pickup && <MapPin size={14} className="text-slate-300" />}
                  </div>
                </button>
                {ride.pickup && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setPickup(null); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className={cn("w-full relative group")}>
                <button 
                  onClick={() => setActiveInput('destination')}
                  className={cn(
                    "w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all border-2",
                    activeInput === 'destination' ? "bg-slate-50 border-primary" : "bg-slate-50 border-transparent shadow-inner-sm"
                  )}
                >
                  <div className="flex justify-between items-center pr-6">
                    <span className={cn("block truncate max-w-[200px]", !ride.destination ? "text-slate-400" : "text-slate-700 font-bold")}>
                      {ride.destination?.address || "Where to?"}
                    </span>
                    {!ride.destination && <Navigation size={14} className="text-slate-300" />}
                  </div>
                </button>
                {ride.destination && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setDestination(null); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search Overlay */}
        <AnimatePresence>
          {activeInput && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute inset-x-4 top-4 z-40 bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
                <Search size={18} className="text-slate-400" />
                <input
                  autoFocus
                  placeholder={activeInput === 'pickup' ? "Search pickup location..." : "Search destination..."}
                  className="flex-1 bg-transparent outline-none text-sm font-bold text-slate-700 placeholder:text-slate-300"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button 
                  onClick={() => { setActiveInput(null); setSearchQuery(''); }}
                  className="px-2 py-1 text-xs font-black text-primary uppercase tracking-widest"
                >
                  Cancel
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto bg-white">
                {searchQuery.length < 3 && suggestions.length === 0 && (
                  <div className="p-2">
                    <button
                      onClick={useCurrentLocation}
                      className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-xl transition-colors text-primary font-bold text-sm"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <LocateFixed size={16} />
                      </div>
                      Use Current Location
                    </button>
                    
                    <div className="px-4 py-2 mt-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saved Places</label>
                    </div>
                    {savedPlaces.map((place) => (
                      <button
                        key={place.id}
                        onClick={() => selectSavedPlace(place)}
                        className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-xl transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <Bookmark size={16} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{place.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{place.address}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {isSearching && (
                  <div className="p-12 flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-primary opacity-50" size={24} />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Searching in Nepal...</p>
                  </div>
                )}

                {searchQuery.length >= 3 && suggestions.length === 0 && !isSearching && (
                  <div className="p-12 text-center">
                    <p className="text-sm font-bold text-slate-400">No places found in Nepal</p>
                    <p className="text-[10px] text-slate-300 font-medium uppercase tracking-widest mt-1 text-center">Try a different address or landmark</p>
                  </div>
                )}

                {suggestions.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => selectLocation(item)}
                    className="w-full text-left p-4 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-start gap-4 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin size={14} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm leading-tight mb-0.5">
                        {item.display_name.split(',')[0]}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">
                        {item.display_name.split(',').slice(1, 3).join(',')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Interface */}
      <div className="mt-auto relative z-10 p-4 pb-20">
        <AnimatePresence mode="wait">
          {ride.pickup && ride.destination ? (
            <motion.div
              key="booking-flow"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="space-y-4"
            >
              <FareCard 
                vehicleId={ride.vehicleId} 
                distance={ride.distance} 
                duration={ride.duration} 
              />
              
              <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl border border-slate-200">
                <div className="flex justify-between items-center mb-4 px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Select Ride</label>
                  <span className="text-[9px] text-slate-400 font-bold uppercase py-0.5 px-2 bg-slate-50 rounded-full border border-slate-100">Rural Ready</span>
                </div>
                <VehicleSelector 
                  selectedId={ride.vehicleId} 
                  onSelect={setVehicle} 
                />
                
                <button
                  onClick={confirmRide}
                  className="w-full bg-primary hover:bg-primary/95 text-white py-4 mt-4 rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all uppercase tracking-widest text-sm"
                >
                  CONFIRM BOOKING <Send size={18} />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="setup-info"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-2xl text-center border border-slate-200"
            >
              <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary shadow-sm">
                {currentStep === 'pickup' ? <MapPin size={24} /> : <Navigation size={24} />}
              </div>
              <h3 className="text-lg font-bold mb-1 text-slate-800 tracking-tight">
                {currentStep === 'pickup' ? "Namaste, Rohit!" : "Setting Destination"}
              </h3>
              <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest">
                {currentStep === 'pickup' ? "Where are you currently?" : "Where do you want to go?"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status Overlay */}
      <AnimatePresence>
        {(isSearchingRide || isAssignedRide) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6"
          >
            <div className="bg-white rounded-3xl p-8 text-center shadow-2xl max-w-xs w-full border border-white/20">
              <AnimatePresence mode="wait">
                {isSearchingRide ? (
                  <motion.div
                    key="searching"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                  >
                    <div className="relative mb-8">
                      <div className="w-24 h-24 border-4 border-primary/10 border-t-primary rounded-full animate-spin mx-auto" />
                      <div className="absolute inset-0 flex items-center justify-center">
                         <div className="w-12 h-12 bg-primary rounded-2xl rotate-45 flex items-center justify-center shadow-lg animate-pulse">
                            <Navigation size={24} className="text-white -rotate-45" />
                         </div>
                      </div>
                    </div>
                    <h2 className="text-2xl font-black mb-2 text-slate-800">Finding Ride</h2>
                    <p className="text-slate-400 text-xs font-medium mb-8">Matching you with the nearest driver in your area...</p>
                    <button 
                      onClick={() => setStatus('idle')}
                      className="w-full text-slate-400 text-xs font-black uppercase tracking-widest py-3 border-2 border-slate-100 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Cancel Request
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-4"
                  >
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 size={40} className="text-green-500" />
                    </div>
                    <h2 className="text-2xl font-black mb-2 text-slate-800">Ride Booked!</h2>
                    <p className="text-slate-400 text-xs font-medium mb-2">Driver is on the way.</p>
                    <div className="bg-slate-50 rounded-2xl p-4 mt-6">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Driver Assigned</p>
                       <p className="text-sm font-bold text-slate-700">Purna Bahadur (BA 4 PA 1234)</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
