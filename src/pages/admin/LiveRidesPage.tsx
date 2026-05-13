import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ChevronLeft, MapPin, Navigation, Clock, Search, AlertOctagon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LiveRidesPage() {
  const navigate = useNavigate();
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Listen to active rides
    const q = query(
      collection(db, 'active_rides'),
      where('status', 'in', ['pending', 'accepted', 'in_progress'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeRides = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      if (activeRides.length === 0) {
        // Mocks if DB empty
        setRides([
          {
            id: 'ride_123',
            status: 'in_progress',
            pickup: { name: 'Thamel, Kathmandu' },
            destination: { name: 'Patan Durbar Square' },
            riderId: 'rider1',
            driverId: 'driver2',
            timestamp: Date.now() - 600000,
            fare: 250
          },
          {
            id: 'ride_456',
            status: 'accepted',
            pickup: { name: 'Boudhanath Stupa' },
            destination: { name: 'Tribhuvan Airport' },
            riderId: 'rider3',
            driverId: 'driver4',
            timestamp: Date.now() - 120000,
            fare: 400
          }
        ]);
      } else {
        setRides(activeRides);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching live rides", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredRides = rides.filter(r => 
    r.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.pickup?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.destination?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 relative flex flex-col h-full">
      <div className="sticky top-0 bg-white z-10 border-b border-slate-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button 
            onClick={() => navigate('/admin/dashboard')}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-800">Live Rides</h1>
            <p className="text-xs text-green-600 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              {rides.length} Active System-wide
            </p>
          </div>
        </div>
        
        <div className="p-3 bg-slate-50 border-t border-slate-100">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by ID or Location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center p-8 text-slate-400 text-sm font-medium">Monitoring live stream...</div>
        ) : filteredRides.length === 0 ? (
          <div className="text-center p-8 text-slate-400 text-sm font-medium">No live rides found matching criteria.</div>
        ) : (
          filteredRides.map(ride => (
            <div key={ride.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{ride.id.slice(0,8)}...</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-extrabold ${
                      ride.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      ride.status === 'accepted' ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {ride.status ? ride.status.replace('_', ' ') : 'unknown'}
                    </span>
                    <span className="text-xs font-bold text-slate-700">Rs. {ride.fare}</span>
                  </div>
                </div>
                <button className="p-1.5 text-slate-400 hover:text-red-500 rounded bg-slate-50">
                   <AlertOctagon size={16} />
                </button>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-green-500 mt-0.5 shrink-0" />
                  <div className="text-xs font-medium text-slate-700 truncate">{ride.pickup?.name || 'Unknown Pickup'}</div>
                </div>
                <div className="ml-1.5 border-l-2 border-dashed border-slate-200 h-2 my-0.5"></div>
                <div className="flex items-start gap-2">
                  <Navigation size={14} className="text-red-500 mt-0.5 shrink-0" />
                  <div className="text-xs font-medium text-slate-700 truncate">{ride.destination?.name || 'Unknown Dropoff'}</div>
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  {Math.floor((Date.now() - (ride.timestamp || Date.now())) / 60000)} mins ago
                </div>
                <button className="text-primary hover:underline">View Map</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
