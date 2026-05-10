import { vehicleTypes } from '@/data/transportData';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function VehicleSelector({ selectedId, onSelect }: Props) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, x: -10 },
    show: { opacity: 1, x: 0 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      id="vehicle-selector" 
      className="space-y-2 max-h-60 overflow-y-auto no-scrollbar pr-1"
    >
      {vehicleTypes.map((vehicle) => {
        const Icon = vehicle.icon;
        const isSelected = selectedId === vehicle.id;
        
        return (
          <motion.button
            variants={item}
            key={vehicle.id}
            onClick={() => onSelect(vehicle.id)}
            className={cn(
              "w-full flex items-center justify-between p-3 border-2 transition-all rounded-2xl cursor-pointer outline-none",
              isSelected 
                ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20" 
                : "border-slate-50 bg-white hover:border-slate-100"
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border transition-colors",
                isSelected ? "bg-white border-primary/10 text-primary" : "bg-slate-50 border-slate-50 text-slate-400"
              )}>
                <Icon size={22} />
              </div>
              <div className="text-left">
                <p className={cn("text-sm font-bold", isSelected ? "text-slate-900" : "text-slate-600")}>
                  {vehicle.name}
                </p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                  {vehicle.capacity} Seats • Rural Ready
                </p>
              </div>
            </div>
            {isSelected && (
               <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center mr-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
               </div>
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
