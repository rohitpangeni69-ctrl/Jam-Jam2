import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User as UserIcon, Mail, Phone, Settings, LogOut, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getProfile() {
      if (localStorage.getItem('jamjam_demo_user')) {
        setProfile({ 
          full_name: 'Demo Rider', 
          email: localStorage.getItem('jamjam_demo_email') || 'demo@jamjam.com',
          phone: '+977 9800000000'
        });
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile({ ...data, email: user.email });
      }
      setLoading(false);
    }
    getProfile();
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem('jamjam_demo_user');
    localStorage.removeItem('jamjam_demo_email');
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="animate-spin text-primary" />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 pb-24"
      id="profile-page"
    >
      <div className="flex flex-col items-center mb-10 mt-6">
        <div className="relative mb-4">
          <div className="w-24 h-24 bg-slate-100 rounded-3xl rotate-45 flex items-center justify-center border-4 border-white shadow-xl">
            <UserIcon className="w-12 h-12 text-primary -rotate-45" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 border-4 border-white rounded-full" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">{profile?.full_name || 'Jam Jam Rider'}</h2>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Verified User</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Account Info</label>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="flex items-center gap-4 p-4 border-b border-slate-50">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                <Mail size={18} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Email</p>
                <p className="text-sm font-bold text-slate-700">{profile?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                <Phone size={18} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Phone</p>
                <p className="text-sm font-bold text-slate-700">{profile?.phone || 'Not linked'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Preferences</label>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button className="flex items-center justify-between p-4 border-b border-slate-50 w-full hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                   <Settings size={18} />
                </div>
                <span className="text-sm font-bold text-slate-700">App Settings</span>
              </div>
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center justify-between p-4 w-full hover:bg-red-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                   <LogOut size={18} />
                </div>
                <span className="text-sm font-black text-red-500 uppercase tracking-widest">Logout Session</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
