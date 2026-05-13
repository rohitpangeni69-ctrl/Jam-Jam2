import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Navigation, Banknote, X, Loader2 } from 'lucide-react';
import type { DispatchPayload } from '@/hooks/usePushNotifications';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useNavigate } from 'react-router-dom';

interface Props {
  ride: DispatchPayload | null;
  onClose: () => void;
}

export function IncomingRideModal({ ride, onClose }: Props) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [isAccepting, setIsAccepting] = useState(false);
  const navigate = useNavigate();
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (ride) {
      const createdTime = new Date(ride.created_at).getTime();
      const timeoutMs = parseInt(ride.timeout_ms || '30000', 10);
      const elapsed = Date.now() - createdTime;
      const initialLeft = Math.max(0, Math.floor((timeoutMs - elapsed) / 1000));
      
      setTimeLeft(initialLeft);

      if (initialLeft > 0) {
        timerRef.current = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              onClose(); // Automatically close when time runs out
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        onClose(); // Stale notification
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ride, onClose]);

  const handleAccept = async () => {
    if (!ride || !auth.currentUser) return;
    setIsAccepting(true);
    
    const rideRef = doc(db, 'active_rides', ride.rideId);
    
    try {
      // Use transaction to ensure we are the first driver to accept
      await runTransaction(db, async (t) => {
        const rideSnap = await t.get(rideRef);
        if (!rideSnap.exists()) {
          throw new Error("Ride no longer exists");
        }
        const rideData = rideSnap.data();
        if (rideData.status !== 'requested' || rideData.driver_id !== null) {
           throw new Error("Ride already taken or cancelled");
        }
        
        t.update(rideRef, {
           driver_id: auth.currentUser!.uid,
           status: 'accepted',
           updated_at: new Date().toISOString()
        });
      });

      onClose();
      navigate(`/ride/${ride.rideId}`);
    } catch (error: any) {
      console.error("Failed to accept ride", error);
      alert(error.message || "Failed to accept ride. It may have been taken by another driver.");
      onClose();
    } finally {
      setIsAccepting(false);
    }
  };

  if (!ride) return null;

  const progress = (timeLeft / (parseInt(ride.timeout_ms) / 1000)) * 100;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 pointer-events-auto backdrop-blur-sm" onClick={onClose} />
        
        <div className="bg-white rounded-t-[32px] overflow-hidden pointer-events-auto relative shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.5)]">
          {/* Progress Bar Header */}
          <div className="h-1.5 w-full bg-slate-100 absolute top-0 left-0">
             <motion.div 
               initial={{ width: '100%' }}
               animate={{ width: `${progress}%` }}
               transition={{ ease: 'linear', duration: 1 }}
               className="h-full bg-orange-500"
             />
          </div>

          <div className="p-6 pt-8 pb-safe">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Incoming Dispatch</h2>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">New Ride Request</h1>
              </div>
              <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center border-2 border-orange-100 flex-shrink-0 animate-pulse">
                <span className="text-xl font-black text-orange-600">{timeLeft}s</span>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              {/* Fare & Distance */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="flex-1 flex items-center gap-3 border-r border-slate-200">
                   <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center shrink-0">
                     <Banknote size={20} />
                   </div>
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Est. Fare</p>
                     <p className="text-lg font-black text-green-700">Rs. {ride.estimated_fare}</p>
                   </div>
                 </div>
                 <div className="flex-1 flex items-center gap-3 pl-2">
                   <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                     <Navigation size={20} />
                   </div>
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Distance</p>
                     <p className="text-lg font-black text-blue-700">{ride.distance_km} km</p>
                   </div>
                 </div>
              </div>

              {/* Route Info */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm relative">
                 <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-slate-200"></div>
                 
                 <div className="flex gap-4 relative z-10 mb-6">
                    <div className="w-5 h-5 bg-[#176C4B] rounded-full border-4 border-white shadow-sm shrink-0 flex items-center justify-center mt-0.5">
                       <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Pickup</p>
                      <p className="text-sm font-bold text-slate-800 leading-tight">{ride.pickup_address}</p>
                    </div>
                 </div>

                 <div className="flex gap-4 relative z-10">
                    <div className="w-5 h-5 bg-red-500 rounded-full border-4 border-white shadow-sm shrink-0 flex items-center justify-center mt-0.5">
                       <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Dropoff</p>
                      <p className="text-sm font-bold text-slate-800 leading-tight">{ride.dropoff_address}</p>
                    </div>
                 </div>
              </div>
            </div>

            <div className="flex gap-3">
               <button 
                 onClick={onClose}
                 disabled={isAccepting}
                 className="w-16 shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl flex items-center justify-center transition-colors disabled:opacity-50"
               >
                 <X size={24} />
               </button>
               <button 
                 onClick={handleAccept}
                 disabled={isAccepting}
                 className="flex-1 bg-[#176C4B] hover:bg-[#155e41] text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-[#176C4B]/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
               >
                 {isAccepting ? <Loader2 className="animate-spin" size={24} /> : 'ACCEPT RIDE'}
               </button>
            </div>
            
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
