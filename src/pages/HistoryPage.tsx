import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Clock, Navigation, Loader2 } from 'lucide-react';

export default function HistoryPage() {
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRides() {
      if (localStorage.getItem('jamjam_demo_user')) {
        setRides([
          {
            id: 'mock-1',
            created_at: new Date().toISOString(),
            fare: 150,
            pickup_address: 'Boudhanath Stupa, Kathmandu',
            destination_address: 'Thamel, Kathmandu',
            vehicle_id: 'bike'
          }
        ]);
        setLoading(false);
        return;
      }

      const user = auth.currentUser;
      if (user) {
        try {
          const q = query(collection(db, 'ride_history'), where('rider_id', '==', user.uid), orderBy('created_at', 'desc'));
          const querySnapshot = await getDocs(q);
          const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setRides(data);
        } catch (error) {
          console.error("Error fetching rides:", error);
        }
      }
      setLoading(false);
    }
    fetchRides();
  }, []);

  if (loading) return (
    <div className="flex h-full items-center justify-center p-12">
      <Loader2 className="animate-spin text-primary opacity-50" />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 pb-24"
      id="history-page"
    >
      <div className="mb-8 mt-4">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Activity</h1>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Your ride history in Nepal</p>
      </div>

      <div className="space-y-4">
        {rides.length === 0 ? (
          <div className="p-10 text-center border-2 border-dashed border-slate-100 rounded-3xl">
             <Clock className="mx-auto text-slate-200 mb-4" size={48} />
             <p className="text-sm font-bold text-slate-500 mb-1">No rides yet</p>
             <p className="text-[10px] text-slate-400 font-medium">Book your first Jam Jam ride!</p>
          </div>
        ) : rides.map((ride) => (
          <div key={ride.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md">
                {new Date(ride.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-sm font-black italic text-primary">NPR {ride.fare}</span>
            </div>
            
            <div className="flex gap-4">
               <div className="flex flex-col items-center gap-1 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <div className="w-0.5 flex-1 bg-slate-100" />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
               </div>
               <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">From</p>
                    <p className="text-xs font-bold text-slate-700 truncate">{ride.pickup_address}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">To</p>
                    <p className="text-xs font-bold text-slate-700 truncate">{ride.destination_address}</p>
                  </div>
               </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
               <div className="flex items-center gap-2">
                 <div className="w-6 h-6 bg-slate-50 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">
                    {ride.vehicle_id[0]}
                 </div>
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{ride.vehicle_id}</span>
               </div>
               <div className="flex items-center gap-1 text-[9px] font-black text-green-500 uppercase tracking-wider">
                  <div className="w-1 h-1 rounded-full bg-green-500" />
                  Completed
               </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
