import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { LiveDriverMap } from '@/components/LiveDriverMap';
import { publishDriverLocation } from '@/lib/tracking';
import { RideState, canTransitionRideState, getRideStatusText } from '@/lib/rideStateMachine';
import { Loader2, Navigation, CheckCircle, ShieldCheck, MapPin, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { nativeLocation } from '@/lib/native/location';
import { useForegroundService } from '@/hooks/useForegroundService';
import { Capacitor } from '@capacitor/core';

export default function ActiveRidePage() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const { startService, stopService, updateServiceStatus } = useForegroundService();

  useEffect(() => {
    if (!rideId || !auth.currentUser) return;

    // Listen to Firestore active ride document
    const unsub = onSnapshot(doc(db, 'active_rides', rideId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRide(data);
        setErrorMsg(null);
        
        // Update Native Foreground status
        if (data.status === 'in_progress') {
           updateServiceStatus('Ride in progress...');
        } else if (data.status === 'arriving') {
           updateServiceStatus('Arriving at pickup...');
        }

        // If it was cancelled or completed, maybe navigate or show summary page,
        // but for MVP we render it right here or navigate to history
        if (data.status === 'completed' || data.status === 'cancelled') {
           if (auth.currentUser?.uid === data.driver_id) {
             stopService();
             nativeLocation.stopTracking();
           }
           setTimeout(() => navigate('/history'), 3000);
        }
      } else {
        // Ride gone (maybe moved to history)
        if (ride?.driver_id === auth.currentUser?.uid) {
           stopService();
           nativeLocation.stopTracking();
        }
        navigate('/history');
      }
      setLoading(false);
    }, (error) => {
      console.error("Ride listener error", error);
      setErrorMsg(error.message);
      setLoading(false);
    });

    return () => unsub();
  }, [rideId, navigate]);

  // Handle Driver GPS publishing
  useEffect(() => {
    if (!ride || !auth.currentUser || !rideId) return;
    const isDriver = auth.currentUser.uid === ride.driver_id;
    
    // Only publish location if driver and ride is active
    if (isDriver && ['accepted', 'arriving', 'in_progress'].includes(ride.status)) {
      if (Capacitor.isNativePlatform()) {
        // Native background tracking
        nativeLocation.initialize().then((granted) => {
          if (granted) {
            startService('JamJam Driving', `Status: ${getRideStatusText(ride.status)}`);
            nativeLocation.startTracking((pos) => {
              publishDriverLocation(rideId, {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                heading: pos.coords.heading || 0,
                speed: pos.coords.speed || 0,
              });
            });
          }
        });
      } else {
        // Web fallback
        if (navigator.geolocation && !watchIdRef.current) {
          watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              // Throttling logic can be added here or inside the publisher
              publishDriverLocation(rideId, {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                heading: pos.coords.heading || 0,
                speed: pos.coords.speed || 0,
              });
            },
            (err) => console.error("GPS error:", err),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
          );
        }
      }
    } else {
      // Clear watch if not appropriate
      if (Capacitor.isNativePlatform()) {
        nativeLocation.stopTracking();
        stopService();
      } else if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (Capacitor.isNativePlatform()) {
        nativeLocation.stopTracking();
        stopService();
      } else if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [ride?.status, rideId]);

  const isDriver = auth.currentUser?.uid === ride?.driver_id;
  const isRider = auth.currentUser?.uid === ride?.rider_id;
  
  // Mock driver assignment for testing (simulate driver taking the ride)
  useEffect(() => {
    if (!ride || !isRider) return;

    if (ride.status === 'requested') {
      const mockDriverId = 'mock-driver-' + Math.floor(Math.random() * 1000);
      const timer = setTimeout(() => {
        updateDoc(doc(db, 'active_rides', rideId!), {
          status: 'accepted',
          driver_id: mockDriverId,
          updated_at: new Date().toISOString()
        }).catch(err => console.error("Simulated driver accept failed:", err));
      }, 5000);
      return () => clearTimeout(timer);
    }
    
    // Auto advance other states for testing if we are assigned a mock driver
    if (ride.driver_id?.startsWith('mock-')) {
      const transitions: Record<string, string> = {
        'accepted': 'arriving',
        'arriving': 'started',
        'started': 'completed'
      };
      
      const nextStatus = transitions[ride.status];
      if (nextStatus) {
        const timer = setTimeout(() => {
          updateDoc(doc(db, 'active_rides', rideId!), {
            status: nextStatus,
            updated_at: new Date().toISOString()
          }).catch(err => console.error("Simulated state advance failed:", err));
        }, 8000);
        return () => clearTimeout(timer);
      }
    }
  }, [ride?.status, isRider, ride?.driver_id, rideId, ride]);

  if (loading) {
     return (
       <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#0F172A]">
         <Loader2 className="animate-spin text-[#22C55E] mb-4" size={40} />
         <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading trip details...</p>
       </div>
     );
  }

  if (errorMsg) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0F172A] p-6 text-center">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <p className="text-[#F8FAFC] font-bold text-lg mb-2">Error loading ride</p>
        <p className="text-slate-400 text-sm">{errorMsg}</p>
        <button onClick={() => navigate('/')} className="mt-6 px-6 py-2 bg-slate-800 rounded-full text-white font-medium">Go Home</button>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0F172A] p-6 text-center">
        <MapPin className="text-slate-500 mb-4" size={48} />
        <p className="text-[#F8FAFC] font-bold text-lg mb-2">Ride not found</p>
        <p className="text-slate-400 text-sm">This ride may have been cancelled or completed.</p>
        <button onClick={() => navigate('/')} className="mt-6 px-6 py-2 bg-slate-800 rounded-full text-[#F8FAFC] font-medium">Go Home</button>
      </div>
    );
  }

  const handleTransition = async (nextState: RideState) => {
    if (!canTransitionRideState(ride.status as RideState, nextState)) {
      alert("Invalid state transition");
      return;
    }
    
    try {
      await updateDoc(doc(db, 'active_rides', rideId!), {
        status: nextState,
        updated_at: new Date().toISOString()
      });

      if (nextState === 'completed') {
         // In production this would be handled by cloud function via ride updates
         // Here we call the mock wallet transaction logic directly
         const { runTransaction } = await import('firebase/firestore');
         
         const fare = ride.estimated_fare;
         const commission = Math.round(fare * 0.1); 

         const driverWalletRef = doc(db, 'wallets', ride.driver_id);
         const txId = 'mock_comm_' + Date.now();
         const txRef = doc(db, `wallets/${ride.driver_id}/transactions`, txId);
         
         await runTransaction(db, async (transaction) => {
            const walletDoc = await transaction.get(driverWalletRef);
            const balance = walletDoc.exists() ? walletDoc.data()?.balance || 0 : 0;
            
            if (!walletDoc.exists()) {
              transaction.set(driverWalletRef, {
                 balance: -commission,
                 currency: 'NPR',
                 updated_at: new Date().toISOString()
              });
            } else {
              transaction.update(driverWalletRef, {
                 balance: balance - commission,
                 updated_at: new Date().toISOString()
              });
            }

            transaction.set(txRef, {
               type: 'driver_commission',
               amount: -commission,
               status: 'completed',
               reference: rideId,
               created_at: new Date().toISOString(),
               metadata: { rideId, fare, paymentMethod: 'cash' }
            });
         });
      }
    } catch (err) {
      console.error("Transition failed", err);
      alert("Network error. Please try again.");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 relative">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-40 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-[#176C4B]" size={24} />
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-800">
               {getRideStatusText(ride.status as RideState, isDriver ? 'driver' : 'rider')}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 bg-green-50 border border-green-100 rounded-full">
           <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
           <span className="text-[9px] font-black text-green-700 uppercase tracking-widest">LIVE</span>
        </div>
      </header>

      {/* Map Area */}
      <div className="flex-1 relative bg-slate-200 z-10">
        <LiveDriverMap 
          rideId={rideId!} 
          riderLocation={ride.pickup}
          isDriver={isDriver}
        />
        
        {/* Overlay for ending states */}
        <AnimatePresence>
          {(ride.status === 'completed' || ride.status === 'cancelled') && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center"
            >
              {ride.status === 'completed' ? (
                <>
                  <CheckCircle className="text-green-500 mb-4" size={64} />
                  <h2 className="text-3xl font-black text-slate-800 mb-2">Trip Completed</h2>
                  <p className="text-slate-500 font-bold mb-8">Rs. {ride.estimated_fare} will be deducted from wallet.</p>
                </>
              ) : (
                <>
                  <AlertCircle className="text-red-500 mb-4" size={64} />
                  <h2 className="text-3xl font-black text-slate-800 mb-2">Trip Cancelled</h2>
                  <p className="text-slate-500 font-bold mb-8">This trip was cancelled.</p>
                </>
              )}
              <Loader2 className="animate-spin text-slate-400" size={24} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Control Sheet */}
      <div className="bg-white rounded-t-[32px] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] relative z-40 border-t border-slate-100 pb-safe">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center flex-shrink-0">
             <MapPin className="text-red-500" size={24} />
          </div>
          <div className="flex-1 overflow-hidden">
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Destination</p>
             <p className="text-sm font-bold text-slate-800 truncate">{ride.dropoff.address}</p>
          </div>
          <div className="text-right">
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Fare</p>
             <p className="text-lg font-black text-[#176C4B]">Rs. {ride.estimated_fare}</p>
          </div>
        </div>

        {/* Driver Controls */}
        {isDriver && (
          <div className="space-y-3">
             {ride.status === 'accepted' && (
               <button 
                 onClick={() => handleTransition('arriving')}
                 className="w-full bg-[#176C4B] hover:bg-[#155e41] text-white py-5 rounded-2xl font-black shadow-xl shadow-[#176C4B]/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
               >
                 I HAVE ARRIVED <Navigation size={20} />
               </button>
             )}
             {ride.status === 'arriving' && (
               <button 
                 onClick={() => handleTransition('started')}
                 className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
               >
                 START TRIP <Navigation size={20} />
               </button>
             )}
             {ride.status === 'started' && (
               <button 
                 onClick={() => handleTransition('completed')}
                 className="w-full bg-green-600 hover:bg-green-700 text-white py-5 rounded-2xl font-black shadow-xl shadow-green-600/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
               >
                 COMPLETE TRIP <CheckCircle size={20} />
               </button>
             )}
          </div>
        )}

        {/* Rider View */}
        {isRider && (
          <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-4 text-center">
             <p className="text-sm font-bold text-[#F8FAFC]">
               {ride.status === 'requested' && (
                 <span className="flex items-center justify-center gap-2">
                   <Loader2 className="animate-spin text-[#22C55E]" size={16} />
                   Finding a nearby driver...
                 </span>
               )}
               {ride.status === 'accepted' && 'Driver is navigating to you.'}
               {ride.status === 'arriving' && 'Driver has arrived! Look around.'}
               {ride.status === 'started' && 'Trip in progress. Safe travels!'}
             </p>
          </div>
        )}

      </div>
    </div>
  );
}
