import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, Navigation, Send, Loader2, Bookmark, LocateFixed, X, CheckCircle2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RideState, Location } from '@/hooks/useRider';
import { VehicleSelector } from '@/components/VehicleSelector';
import { FareCard } from '@/components/FareCard';
import { searchAddress, getRoute } from '@/lib/maps';
import { cn } from '@/lib/utils';
import { savedPlaces, vehicleTypes } from '@/data/transportData';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

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
function MapUpdater({ pickup, destination, lastUpdate, onCentered }: { pickup: Location | null, destination: Location | null, lastUpdate: number, onCentered: () => void }) {
  const map = useMap();
  
  useEffect(() => {
    if (pickup && destination) {
      const bounds = L.latLngBounds([pickup.lat, pickup.lng], [destination.lat, destination.lng]);
      map.fitBounds(bounds, { padding: [80, 80] });
    } else if (pickup) {
      map.setView([pickup.lat, pickup.lng], 15);
    }
    onCentered();
  }, [pickup, destination, map, lastUpdate]);

  return null;
}

function MapEventTracker({ onMove }: { onMove: () => void }) {
  useMapEvents({
    dragend: onMove,
    zoomend: onMove,
  });
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
  const [isMapPanned, setIsMapPanned] = useState(false);
  const searchTimeout = useRef<any>(null);

  const handleRecenter = () => {
    setMapUpdateKey(prev => prev + 1);
  };

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
      if (!localStorage.getItem('jamjam_demo_user')) {
        const user = auth.currentUser;
        if (!user) return;

        const vehicle = vehicleTypes.find(v => v.id === ride.vehicleId);
        const totalFare = Math.round((vehicle?.baseFare || 0) + ((ride.distance || 0) * (vehicle?.perKm || 0)));

        const { getGeohash } = await import('@/lib/geo');
        const hash = getGeohash(ride.pickup.lat, ride.pickup.lng);

        const rideRef = collection(db, 'active_rides');
        await addDoc(rideRef, {
          rider_id: user.uid,
          driver_id: null,
          pickup: {
            address: ride.pickup.address,
            lat: ride.pickup.lat,
            lng: ride.pickup.lng,
            geohash: hash,
          },
          dropoff: {
            address: ride.destination.address,
            lat: ride.destination.lat,
            lng: ride.destination.lng,
          },
          vehicle_id: ride.vehicleId,
          distance_km: ride.distance,
          estimated_fare: totalFare,
          status: 'requested',
          created_at: new Date().toISOString()
        });
      }
      
      // Keep searching until a driver bids (we'll mock success after 5 seconds for now)
      setTimeout(() => {
        setStatus('assigned');
        setTimeout(() => {
          setStatus('idle');
          resetRide();
        }, 5000);
      }, 5000);
      
    } catch (error) {
      console.error("Ride insertion error:", error);
      setStatus('idle');
      alert("Failed to request ride. Please try again.");
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
          <MapUpdater pickup={ride.pickup} destination={ride.destination} lastUpdate={mapUpdateKey} onCentered={() => setIsMapPanned(false)} />
          <MapEventTracker onMove={() => setIsMapPanned(true)} />
        </MapContainer>

        <AnimatePresence>
          {(ride.pickup || ride.destination) && isMapPanned && (
            <motion.button 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={handleRecenter}
              className="absolute right-4 bottom-1/2 translate-y-24 z-10 w-12 h-12 bg-white rounded-2xl shadow-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:text-primary transition-all active:scale-95"
            >
              <LocateFixed size={20} />
            </motion.button>
          )}
        </AnimatePresence>
        
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
        <div className="bg-[#1E293B]/90 backdrop-blur-xl rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] border border-slate-700/50 p-4 space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-1.5 ml-2">
              <div className="w-3 h-3 rounded-full bg-[#14B8A6] shadow-[0_0_10px_rgba(20,184,166,0.6)]" />
              <div className="w-0.5 h-10 bg-slate-700" />
              <div className="w-3 h-3 rounded-full bg-[#22C55E] shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
            </div>
            
            <div className="flex-1 space-y-3">
              <div className={cn("w-full relative group")}>
                <button 
                  onClick={() => setActiveInput('pickup')}
                  className={cn(
                    "w-full text-left px-5 py-3.5 rounded-2xl text-base transition-all border outline-none",
                    activeInput === 'pickup' ? "bg-slate-800 border-[#14B8A6] shadow-[0_0_15px_rgba(20,184,166,0.1)]" : "bg-slate-800 border-transparent hover:border-slate-600"
                  )}
                >
                  <div className="flex justify-between items-center pr-6">
                    <span className={cn("block truncate max-w-[200px] font-medium", !ride.pickup ? "text-slate-400" : "text-[#F8FAFC]")}>
                      {ride.pickup?.address || "Current Location"}
                    </span>
                    {!ride.pickup && <MapPin size={18} className="text-[#14B8A6]" />}
                  </div>
                </button>
                {ride.pickup && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setPickup(null); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-red-400 transition-colors bg-slate-700/50 rounded-full"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className={cn("w-full relative group")}>
                <button 
                  onClick={() => setActiveInput('destination')}
                  className={cn(
                    "w-full text-left px-5 py-3.5 rounded-2xl text-base transition-all border outline-none",
                    activeInput === 'destination' ? "bg-slate-800 border-[#22C55E] shadow-[0_0_15px_rgba(34,197,94,0.1)]" : "bg-slate-800 border-transparent hover:border-slate-600"
                  )}
                >
                  <div className="flex justify-between items-center pr-6">
                    <span className={cn("block truncate max-w-[200px] font-medium text-lg", !ride.destination ? "text-[#F8FAFC]" : "text-[#22C55E]")}>
                      {ride.destination?.address || "Where to?"}
                    </span>
                    {!ride.destination && <Search size={20} className="text-[#22C55E]" />}
                  </div>
                </button>
                {ride.destination && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setDestination(null); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-red-400 transition-colors bg-slate-700/50 rounded-full"
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
              className="absolute inset-x-4 top-4 z-40 bg-[#1E293B] rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] overflow-hidden border border-slate-700/50"
            >
              <div className="p-5 border-b border-slate-700/50 flex items-center gap-4 bg-[#1E293B]">
                <Search size={22} className="text-[#14B8A6]" />
                <input
                  autoFocus
                  placeholder={activeInput === 'pickup' ? "Search pickup location..." : "Where to?"}
                  className="flex-1 bg-transparent outline-none text-lg font-semibold text-[#F8FAFC] placeholder:text-slate-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button 
                  onClick={() => { setActiveInput(null); setSearchQuery(''); }}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto bg-[#0F172A] no-scrollbar">
                {searchQuery.length < 3 && suggestions.length === 0 && (
                  <div className="p-2">
                    <button
                      onClick={useCurrentLocation}
                      className="w-full flex items-center gap-4 p-4 hover:bg-slate-800 rounded-2xl transition-colors text-[#22C55E] font-semibold text-base"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#22C55E]/10 flex items-center justify-center">
                        <LocateFixed size={20} />
                      </div>
                      Use Current Location
                    </button>
                    
                    <div className="px-4 py-3 mt-2 flex items-center gap-2">
                       <Bookmark size={14} className="text-slate-500" />
                       <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saved Places</label>
                    </div>
                    {savedPlaces.map((place) => (
                      <button
                        key={place.id}
                        onClick={() => selectSavedPlace(place)}
                        className="w-full flex items-center gap-4 p-4 hover:bg-slate-800 rounded-2xl transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                          <Bookmark size={18} />
                        </div>
                        <div>
                          <p className="font-semibold text-[#F8FAFC] text-base">{place.name}</p>
                          <p className="text-sm text-slate-400 font-medium truncate max-w-[200px]">{place.address}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {isSearching && (
                  <div className="p-12 flex flex-col items-center gap-4 text-center">
                    <Loader2 className="animate-spin text-[#14B8A6]" size={32} />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Searching in Nepal...</p>
                  </div>
                )}

                {searchQuery.length >= 3 && suggestions.length === 0 && !isSearching && (
                  <div className="p-12 text-center flex flex-col items-center">
                     <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <MapPin size={24} className="text-slate-500" />
                     </div>
                    <p className="text-base font-bold text-[#F8FAFC]">No places found</p>
                    <p className="text-sm text-slate-400 mt-1">Try a different address or landmark.</p>
                  </div>
                )}

                {suggestions.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => selectLocation(item)}
                    className="w-full text-left p-4 hover:bg-slate-800 border-b border-slate-800/50 last:border-0 flex items-center gap-4 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                      <MapPin size={18} className="text-[#14B8A6]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#F8FAFC] text-base leading-tight mb-1">
                        {item.display_name.split(',')[0]}
                      </p>
                      <p className="text-xs text-slate-400 font-medium">
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
              
              <div className="bg-[#1E293B]/95 backdrop-blur-xl rounded-t-3xl p-6 pt-8 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-slate-700/50 relative">
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-700 rounded-full"></div>
                <div className="flex justify-between items-center mb-5 px-1">
                  <label className="text-sm font-semibold text-slate-400 tracking-wide">Select Vehicle</label>
                  <span className="text-xs text-[#22C55E] font-medium uppercase py-1 px-3 bg-[#22C55E]/10 rounded-full border border-[#22C55E]/20 flex items-center gap-1.5">
                    <Zap size={12} className="fill-[#22C55E]" /> Best Match
                  </span>
                </div>
                <VehicleSelector 
                  selectedId={ride.vehicleId} 
                  onSelect={setVehicle} 
                />
                
                <button
                  onClick={confirmRide}
                  className="w-full bg-[#22C55E] hover:bg-[#16a34a] text-slate-900 py-5 mt-6 rounded-2xl font-bold text-lg shadow-[0_10px_30px_rgba(34,197,94,0.2)] flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
                >
                  Confirm Ride <Send size={20} />
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
