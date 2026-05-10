import { NavLink } from 'react-router-dom';
import { MapPin, Bookmark, History, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const navItems = [
    { to: '/', icon: MapPin, label: 'Book' },
    { to: '/saved', icon: Bookmark, label: 'Saved' },
    { to: '/history', icon: History, label: 'History' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav id="bottom-nav" className="shrink-0 h-16 bg-white border-t border-slate-200 px-6 z-50">
      <div className="flex justify-between items-center h-full max-w-sm mx-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 transition-all duration-300 px-3',
                isActive ? 'text-primary scale-110' : 'text-slate-400 grayscale opacity-70'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("w-5 h-5", isActive ? "stroke-[3px]" : "stroke-[2px]")} />
                <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
                <div className={cn(
                  "w-1 h-1 rounded-full transition-all duration-300",
                  isActive ? "bg-primary" : "bg-transparent"
                )} />
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
