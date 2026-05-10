import { useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'motion/react';
import { Mail, Loader2, ArrowRight } from 'lucide-react';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Check your email for the magic link!' });
    }
    setLoading(false);
  };

  return (
    <div id="auth-page" className="min-h-screen flex flex-col p-8 pt-20 bg-slate-50">
      <div className="mb-12">
        <div className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center text-white font-black italic shadow-2xl shadow-primary/20 text-2xl mb-6">
          JJ
        </div>
        <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">Welcome</h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Login or Signup to Jam Jam</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="relative">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Email Address</label>
          <div className="relative flex items-center">
            <Mail className="absolute left-4 text-slate-300" size={18} />
            <input
              type="email"
              placeholder="name@example.com"
              className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary transition-all font-bold text-slate-700"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <button
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 text-white py-5 rounded-2xl font-black shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <>
              GET MAGIC LINK <ArrowRight size={20} />
            </>
          )}
        </button>
      </form>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mt-6 p-4 rounded-2xl text-sm font-bold text-center",
            message.type === 'success' ? "bg-green-50 text-green-600 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"
          )}
        >
          {message.text}
        </motion.div>
      )}

      <div className="mt-auto text-center pb-10">
        <p className="text-slate-300 text-xs font-bold uppercase tracking-widest">
          Secured by Supabase Auth
        </p>
      </div>
    </div>
  );
}

// Internal helper since utils might not be loaded in simple imports
function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
