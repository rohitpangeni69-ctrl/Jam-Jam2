import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, signInAnonymously } from 'firebase/auth';
import { motion } from 'motion/react';
import { Phone, Loader2, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    // Initialize reCAPTCHA on mount
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  }, []);

  const handleSendOtp = async () => {
    if (phoneNumber.length < 10) {
      setMessage({ type: 'error', text: 'Please enter a valid phone number' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const formattedNumber = phoneNumber.startsWith('+977') ? phoneNumber : `+977${phoneNumber}`;
      const appVerifier = window.recaptchaVerifier;
      
      const confirmation = await signInWithPhoneNumber(auth, formattedNumber, appVerifier);
      setConfirmationResult(confirmation);
      setShowOtp(true);
      setMessage({ type: 'success', text: 'OTP sent to your phone' });
    } catch (error: any) {
      if (
        error.code === 'auth/network-request-failed' || 
        error.message?.includes('network') ||
        error.code === 'auth/admin-restricted-operation' ||
        error.message?.includes('admin-restricted-operation') ||
        error.code === 'auth/operation-not-allowed' ||
        error.message?.includes('operation-not-allowed')
      ) {
        // Fallback for iframe / unconfigured environments
        console.warn("Firebase Auth blocked, using mock session.");
        localStorage.setItem('jamjam_demo_user', 'true');
        localStorage.setItem('jamjam_demo_role', 'rider');
        window.location.reload();
      } else {
        setMessage({ type: 'error', text: error.message || 'Failed to send OTP' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6 || !confirmationResult) return;

    setLoading(true);
    setMessage(null);

    try {
      await confirmationResult.confirm(otp);
      // Navigation handled by App.tsx onAuthStateChange
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Invalid verification code' });
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      if (
        error.code === 'auth/network-request-failed' || 
        error.message?.includes('network') ||
        error.code === 'auth/admin-restricted-operation' ||
        error.message?.includes('admin-restricted-operation') ||
        error.code === 'auth/operation-not-allowed' ||
        error.message?.includes('operation-not-allowed')
      ) {
        // Fallback for iframe / third-party cookie blocked environments or disabled auth provider
        localStorage.setItem('jamjam_demo_user', 'true');
        // Let App.tsx know to bypass Firebase Auth and inject a fake session
        window.location.reload();
      } else {
        setMessage({ type: 'error', text: error.message || 'Guest login failed' });
        setLoading(false);
      }
    }
  };

  return (
    <div id="auth-page" className="min-h-screen flex flex-col p-8 pt-24 bg-[#0F172A] text-[#F8FAFC] relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#22C55E]/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 -left-40 w-96 h-96 bg-[#14B8A6]/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="mb-14 relative z-10">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-20 h-20 bg-gradient-to-br from-[#22C55E] to-[#14B8A6] rounded-3xl flex items-center justify-center text-white font-black italic shadow-[0_0_40px_rgba(34,197,94,0.3)] text-3xl mb-8"
        >
          JJ
        </motion.div>
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl font-black tracking-tight mb-3"
        >
          JamJam
        </motion.h1>
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-[#94A3B8] font-medium text-lg"
        >
          Your premium ride awaits.
        </motion.p>
      </div>

      <div className="space-y-5 relative z-10">
        {!showOtp ? (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="space-y-5"
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#22C55E] to-[#14B8A6] rounded-3xl blur opacity-25 group-focus-within:opacity-50 transition duration-500"></div>
              <div className="relative flex items-center bg-[#1E293B] rounded-3xl p-1 shadow-2xl">
                <div className="flex items-center gap-2 pl-6 pr-4 text-[#F8FAFC] font-semibold border-r border-slate-700">
                  <span className="text-xl">🇳🇵</span>
                  <span>+977</span>
                </div>
                <input
                  type="tel"
                  placeholder="98XXXXXXXX"
                  className="w-full bg-transparent py-5 px-4 outline-none font-semibold text-lg text-[#F8FAFC] placeholder:text-slate-500"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  disabled={loading}
                />
              </div>
            </div>

            <button
              onClick={handleSendOtp}
              disabled={loading || phoneNumber.length < 10}
              className="w-full bg-[#22C55E] hover:bg-[#16a34a] text-slate-900 py-5 rounded-3xl font-bold text-lg shadow-[0_10px_30px_rgba(34,197,94,0.2)] flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : <>Continue <ArrowRight size={24} /></>}
            </button>

            <div className="relative flex items-center py-4">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-sm font-medium">Or try preview</span>
              <div className="flex-grow border-t border-slate-700"></div>
            </div>

            <button
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full bg-[#1E293B] border border-slate-700 hover:border-slate-500 py-5 rounded-3xl font-bold text-lg shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Zap className="text-[#14B8A6]" size={24} /> Preview as Rider
            </button>

            <button
              onClick={() => {
                localStorage.setItem('jamjam_demo_role', 'driver');
                handleGuestLogin();
              }}
              disabled={loading}
              className="w-full bg-[#1E293B] border border-slate-700 hover:border-slate-500 py-5 rounded-3xl font-bold text-lg shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Zap className="text-[#22C55E]" size={24} /> Preview as Driver
            </button>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#22C55E] to-[#14B8A6] rounded-3xl blur opacity-25 group-focus-within:opacity-50 transition duration-500"></div>
              <div className="relative bg-[#1E293B] rounded-3xl p-1 shadow-2xl">
                 <input
                  type="text"
                  placeholder="Enter OTP"
                  className="w-full bg-transparent py-5 px-4 text-center tracking-[0.5em] font-black text-3xl text-[#F8FAFC] placeholder:text-slate-600 outline-none"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={loading}
                />
              </div>
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length < 6}
              className="w-full bg-[#22C55E] text-slate-900 hover:bg-[#16a34a] py-5 rounded-3xl font-bold text-lg shadow-[0_10px_30px_rgba(34,197,94,0.2)] flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : <>Verify Code <ShieldCheck size={24} /></>}
            </button>
            
            <button 
              onClick={() => { setShowOtp(false); setOtp(''); }}
              className="w-full py-4 text-sm font-medium text-[#94A3B8] hover:text-white transition-colors"
              disabled={loading}
            >
              Change phone number
            </button>
          </motion.div>
        )}
      </div>

      <div id="recaptcha-container"></div>

      {message && (
        <motion.div
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           className={cn(
             "mt-8 p-4 rounded-2xl text-sm font-semibold text-center backdrop-blur-md",
             message.type === 'success' ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
           )}
        >
          {message.text}
        </motion.div>
      )}

      <div className="mt-auto text-center pb-8 pt-8">
         <p className="text-[#94A3B8] text-xs font-medium tracking-wide">
           Secured by Firebase
         </p>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

