import { vehicleTypes } from '@/data/transportData';
import { MapPin, Clock, Info } from 'lucide-react';

interface Props {
  vehicleId: string | null;
  distance: number | null; // km
  duration: number | null; // mins
}

export function FareCard({ vehicleId, distance, duration }: Props) {
  const vehicle = vehicleTypes.find((v) => v.id === vehicleId);
  
  if (!vehicle || !distance) return null;

  const totalFare = Math.round(vehicle.baseFare + (distance * vehicle.perKm));

  return (
    <div id="fare-card" className="bg-slate-900 rounded-2xl p-5 text-white shadow-2xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
      
      <div className="flex justify-between items-start mb-5 relative z-10">
        <div>
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Total est. Fare</p>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-bold text-primary">NPR</span>
            <h2 className="text-3xl font-black italic tracking-tighter">{totalFare.toLocaleString()}.00</h2>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Distance</p>
          <p className="text-lg font-bold">{distance.toFixed(1)} <span className="text-xs text-slate-500">km</span></p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 relative z-10">
        <div className="flex items-center gap-3 bg-white/5 border border-white/5 p-3 rounded-xl backdrop-blur-sm">
          <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
            <Clock size={16} />
          </div>
          <div>
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-tight">Est. Duration</p>
            <p className="text-xs font-bold">{Math.round(duration || 0)} mins</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white/5 border border-white/5 p-3 rounded-xl backdrop-blur-sm">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">
            <MapPin size={16} />
          </div>
          <div>
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-tight">Route Quality</p>
            <p className="text-xs font-bold text-green-400">Rural Ready</p>
          </div>
        </div>
      </div>
    </div>
  );
}
