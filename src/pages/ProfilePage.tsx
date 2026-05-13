import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { User as UserIcon, Mail, Phone, Settings, LogOut, Loader2, ShieldCheck, Car } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getProfile() {
      if (localStorage.getItem('jamjam_demo_user')) {
        setProfile({ 
          full_name: 'Demo Rider', 
          email: localStorage.getItem('jamjam_demo_email') || 'demo@jamjam.com',
          phone: '+977 9800000000',
          role: 'rider',
          kyc_status: 'incomplete'
        });
        setLoading(false);
        return;
      }

      const user = auth.currentUser;
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile({ ...docSnap.data() });
          } else {
            setProfile({ name: 'NepalRide User', phone: user.phoneNumber, role: 'rider', kyc_status: 'incomplete' });
          }
        } catch (error) {
          console.error("Profile fetch error", error);
        }
      }
      setLoading(false);
    }
    getProfile();
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem('jamjam_demo_user');
    localStorage.removeItem('jamjam_demo_email');
    await auth.signOut();
    window.location.href = '/auth';
  };

  const handleDriverMode = () => {
    if (profile?.kyc_status === 'approved') {
      // Navigate to actual driver map (to be built)
      navigate('/driver');
    } else {
      navigate('/driver-onboarding');
    }
  };

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="animate-spin text-[#176C4B]" />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 pb-24"
      id="profile-page"
    >
      <div className="flex flex-col items-center mb-6 mt-6">
        <div className="relative mb-4">
          <div className="w-24 h-24 bg-slate-100 rounded-3xl rotate-45 flex items-center justify-center border-4 border-white shadow-xl">
            <UserIcon className="w-12 h-12 text-[#176C4B] -rotate-45" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 border-4 border-white rounded-full" />
        </div>
        <h2 className="text-xl font-black tracking-tight text-slate-800">{profile?.name || profile?.full_name || 'NepalRide User'}</h2>
        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] mt-1">{profile?.role === 'driver' ? 'Verified Driver' : 'Basic Rider'}</p>
      </div>

      <div className="space-y-6">
        {/* Driver Card */}
        <div className="bg-gradient-to-br from-[#176C4B] to-[#155e41] rounded-3xl p-5 shadow-xl text-white relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
               <ShieldCheck size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg tracking-tight">Earn with NepalRide</h3>
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-0.5">Zero platform fee for 30 days</p>
            </div>
          </div>
          <button 
            onClick={handleDriverMode}
            className="w-full bg-white text-[#176C4B] py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
          >
            {profile?.kyc_status === 'approved' ? 'Switch to Driver Mode' : 'Complete Driver KYC'} <Car size={16} />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Account Info</label>
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="flex items-center gap-4 p-4 border-b border-slate-50">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                <Mail size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</p>
                <p className="text-sm font-bold text-slate-700">{profile?.email || 'No email'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                <Phone size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</p>
                <p className="text-sm font-bold text-slate-700">{profile?.phone || 'Not linked'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Preferences</label>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
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

