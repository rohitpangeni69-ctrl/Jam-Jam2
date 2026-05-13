import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUpRight, ArrowDownRight, QrCode, ShieldCheck, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { subscribeToWallet, subscribeToTransactions, mockTopUpWallet } from '@/lib/wallet';
import type { Wallet, WalletTransaction } from '@/lib/wallet';
import { auth } from '@/lib/firebase';
import { TransactionCard } from '@/components/TransactionCard';

export default function WalletPage() {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState('');
  const [isToppingUp, setIsToppingUp] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubWallet = subscribeToWallet(auth.currentUser.uid, (walletBase) => {
      setBalance(walletBase?.balance || 0);
      setLoading(false);
    });
    const unsubTxns = subscribeToTransactions(auth.currentUser.uid, (txns) => {
      setTransactions(txns);
    });

    return () => {
      unsubWallet();
      unsubTxns();
    };
  }, []);

  const handleTopup = async () => {
    const amt = parseFloat(topupAmount);
    if (!amt || amt <= 0) return;
    
    setIsToppingUp(true);
    try {
      await mockTopUpWallet(auth.currentUser!.uid, amt);
      setShowLoadModal(false);
      setTopupAmount('');
    } catch (e) {
       console.error("Topup error", e);
       alert("Top-up failed");
    } finally {
       setIsToppingUp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-[#176C4B]" size={32} />
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-y-auto pb-20">
      {/* eSewa Style Header */}
      <div className="bg-gradient-to-b from-[#60C04F] to-[#55ab46] px-6 pt-6 pb-20 rounded-b-[40px] text-white shadow-lg relative">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden rounded-b-[40px] opacity-10 pointer-events-none">
          <div className="w-64 h-64 border-[40px] border-white rounded-full absolute -top-10 -right-20"></div>
          <div className="w-32 h-32 border-[20px] border-white rounded-full absolute top-20 -left-10"></div>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-6 opacity-90">
            <ShieldCheck size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Secured by eSewa</span>
          </div>

          <p className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">Available Balance</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">NPR</span>
            <span className="text-5xl font-black tracking-tight">{balance.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions Card */}
      <div className="px-4 -mt-12 relative z-20">
        <div className="bg-white rounded-3xl p-4 shadow-xl border border-slate-100 flex justify-between items-center px-8">
          <button onClick={() => setShowLoadModal(true)} className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 bg-[#60C04F]/10 text-[#60C04F] rounded-2xl flex items-center justify-center group-hover:-translate-y-1 group-hover:shadow-md transition-all">
              <ArrowDownRight size={24} className="stroke-[3px]" />
            </div>
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Load</span>
          </button>
          
          <button className="flex flex-col items-center gap-2 group opacity-50 cursor-not-allowed">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center">
              <ArrowUpRight size={24} className="stroke-[3px]" />
            </div>
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Send</span>
          </button>
          
          <button className="flex flex-col items-center gap-2 group py-2">
            <div className="w-12 h-12 bg-[#60C04F] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#60C04F]/30 group-hover:-translate-y-1 transition-all">
              <QrCode size={24} className="stroke-[3px]" />
            </div>
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Scan</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {balance < 0 && (
           <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl text-sm font-bold flex items-start gap-3">
             <AlertCircle size={20} className="shrink-0 mt-0.5" />
             <p>Your wallet balance is negative. You will not be able to accept cash rides until you clear your commission debt.</p>
           </div>
        )}

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
            Payment Methods
            <ChevronRight size={16} className="text-slate-300" />
          </h3>
          <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="w-10 h-10 bg-[#60C04F] rounded-xl flex items-center justify-center shadow-inner">
               <span className="text-white font-black text-xs italic tracking-tighter">eSewa</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-slate-800 text-sm">Linked eSewa</p>
              <p className="text-[10px] text-slate-400 font-medium">980****123</p>
            </div>
            <div className="px-2 py-1 bg-[#60C04F]/10 text-[#60C04F] text-[9px] font-black uppercase tracking-widest rounded-lg">
              Primary
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Recent Transactions</h3>
          <div className="space-y-3">
            {transactions.length === 0 ? (
               <p className="text-slate-400 text-sm font-medium text-center py-8">No transactions yet.</p>
            ) : (
               transactions.map((tx) => (
                 <TransactionCard key={tx.id} transaction={tx} />
               ))
            )}
          </div>
        </div>
      </div>

      {/* Load Funds Modal */}
      <AnimatePresence>
        {showLoadModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setShowLoadModal(false)}
          >
            <motion.div 
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-12 sm:pb-6 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden" />
              <h2 className="text-lg font-black text-slate-800 mb-2">Load Funds</h2>
              <p className="text-xs text-slate-400 font-medium mb-6">Enter amount to load into your NepalRide wallet via eSewa. (Demo)</p>
              
              <div className="relative mb-6">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">Rs.</span>
                <input 
                  type="number"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-14 pr-4 outline-none focus:border-[#60C04F] transition-all font-black text-2xl text-slate-700" 
                />
              </div>

              <button 
                 onClick={handleTopup}
                 disabled={isToppingUp || !topupAmount}
                 className="w-full disabled:opacity-50 bg-[#60C04F] hover:bg-[#55ab46] text-white py-4 rounded-xl font-black shadow-lg shadow-[#60C04F]/20 transition-all uppercase tracking-widest text-sm flex justify-center items-center gap-2"
              >
                {isToppingUp ? <Loader2 className="animate-spin" size={18} /> : <>Continue to eSewa <ArrowRight size={18} /></>}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Add arrow right
function ArrowRight(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
  );
}
