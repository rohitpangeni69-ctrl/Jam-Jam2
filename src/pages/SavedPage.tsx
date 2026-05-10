import { motion } from 'motion/react';
import { Bookmark, Home, Briefcase, Plus, MapPin } from 'lucide-react';
import { savedPlaces } from '@/data/transportData';

export default function SavedPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 pb-24"
      id="saved-page"
    >
      <div className="mb-8 mt-4">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Saved</h1>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Your favorite destinations</p>
      </div>

      <div className="space-y-4">
        {savedPlaces.map((place) => (
          <div key={place.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 group hover:border-primary/20 transition-all cursor-pointer">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary/5 group-hover:text-primary transition-all">
              {place.name === 'Home' ? <Home size={20} /> : place.name === 'Work' ? <Briefcase size={20} /> : <Bookmark size={20} />}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-800 text-sm">{place.name}</h3>
              <p className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{place.address}</p>
            </div>
            <div className="w-8 h-8 rounded-full border border-slate-50 flex items-center justify-center text-slate-300">
               <MapPin size={14} />
            </div>
          </div>
        ))}

        <button className="w-full py-5 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-300 hover:text-primary hover:border-primary/20 transition-all mt-4">
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
            <Plus size={20} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest">Add New Place</span>
        </button>
      </div>
    </motion.div>
  );
}
