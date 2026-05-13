import React from 'react';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Navigation, AlertCircle } from 'lucide-react';
import type { WalletTransaction } from '@/lib/wallet';

interface Props {
  transaction: WalletTransaction;
  key?: React.Key;
}

export function TransactionCard({ transaction }: Props) {
  const isPositive = transaction.amount > 0;
  
  const getIcon = () => {
    if (transaction.type === 'ride_payment') {
       return isPositive ? <ArrowDownLeft size={20} className="text-green-600" /> : <Navigation size={20} className="text-blue-600" />;
    }
    if (transaction.type === 'driver_commission') return <AlertCircle size={20} className="text-orange-600" />;
    if (transaction.type === 'topup') return <CheckCircle2 size={20} className="text-green-600" />;
    return <ArrowUpRight size={20} className="text-slate-600" />;
  };

  const getTitle = () => {
    switch (transaction.type) {
      case 'ride_payment': return isPositive ? 'Ride Earnings' : 'Ride Payment';
      case 'topup': return 'Wallet Loaded';
      case 'driver_commission': return 'Platform Fee Deduction';
      case 'withdrawal': return 'Bank Withdrawal';
      default: return 'Transaction';
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isPositive ? 'bg-green-50' : 'bg-slate-50'}`}>
        {getIcon()}
      </div>
      <div className="flex-1 overflow-hidden">
        <h4 className="font-bold text-slate-800 text-sm truncate">{getTitle()}</h4>
        <p className="text-[10px] font-medium text-slate-400 mt-1">
           {new Date(transaction.created_at).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', month: 'short', day: 'numeric' })} 
           {transaction.reference && ` • Ref: ${transaction.reference.substring(0, 8)}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`font-black tracking-tight ${isPositive ? 'text-green-600' : 'text-slate-800'}`}>
          {isPositive ? '+' : ''} Rs. {Math.abs(transaction.amount)}
        </p>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">{transaction.status}</p>
      </div>
    </div>
  );
}
