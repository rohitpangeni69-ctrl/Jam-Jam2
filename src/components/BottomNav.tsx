import { NavLink } from 'react-router-dom';
import { MapPin, Bookmark, History, Wallet, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const navItems = [
    { to: '/', icon: MapPin, label: 'Book' },
    { to: '/history', icon: History, label: 'History' },
    { to: '/wallet', icon: Wallet, label: 'Wallet' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav id="bottom-nav" className="shrink-0 h-[72px] bg-[#1E293B] border-t border-slate-700/50 px-6 z-50">
      <div className="flex justify-between items-center h-full max-w-sm mx-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 transition-all duration-300 px-3',
                isActive ? 'text-[#22C55E] -translate-y-1' : 'text-slate-400 hover:text-slate-300'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("w-6 h-6", isActive ? "stroke-[2.5px] fill-[#22C55E]/20" : "stroke-[2px]")} />
                <span className="text-[10px] font-semibold">{item.label}</span>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-300 mt-0.5",
                  isActive ? "bg-[#14B8A6] shadow-[0_0_8px_#14B8A6]" : "bg-transparent"
                )} />
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
