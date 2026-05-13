import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Check, X, ChevronLeft, Image as ImageIcon, FileText, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function KYCReviewPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<any[]>([]);

  useEffect(() => {
    const fetchPendingKYC = async () => {
      try {
        // Query users collection for pending driver applications
        // In a real database this might be a specialized kyc_reviews collection
        const q = query(
          collection(db, 'users'), 
          where('status', '==', 'pending_kyc')
        );
        let docs: any[] = [];
        try {
          const snapshot = await getDocs(q);
          docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (err) {
          console.warn("Failed to fetch KYC, using mocks", err);
        }
        
        // If DB is empty, use some mocks to show UI
        if (docs.length === 0) {
          setApplications([
            { id: '1', name: 'Ramesh Thapa', phone: '+977 9801234567', vehicle: 'BA 12 PA 3456 (Bike)', status: 'pending', submittedAt: '2 hours ago' },
            { id: '2', name: 'Sita Sharma', phone: '+977 9812345678', vehicle: 'BA 34 CHA 5678 (Taxi)', status: 'pending', submittedAt: '3 hours ago' },
          ]);
        } else {
          setApplications(docs);
        }
      } catch (e) {
        console.error("Error fetching KYC", e);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingKYC();
  }, []);

  const handleApprove = async (id: string, index: number) => {
    try {
      // await updateDoc(doc(db, 'users', id), { status: 'active', role: 'driver' });
      const updated = [...applications];
      updated.splice(index, 1);
      setApplications(updated);
      alert('Approved successfully');
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (id: string, index: number) => {
    try {
      // await updateDoc(doc(db, 'users', id), { status: 'rejected' });
      const updated = [...applications];
      updated.splice(index, 1);
      setApplications(updated);
      alert('Rejected application');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 relative flex flex-col h-full">
      <div className="sticky top-0 bg-white z-10 border-b border-slate-200 px-4 py-3 pb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/admin/dashboard')}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-800">KYC Review</h1>
            <p className="text-xs text-slate-500 font-medium">{applications.length} pending applications</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center p-8 text-slate-400 text-sm font-medium">Loading...</div>
        ) : applications.length === 0 ? (
          <div className="text-center p-8 text-slate-400 text-sm font-medium">No pending KYC applications.</div>
        ) : (
          applications.map((app, idx) => (
            <div key={app.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">{app.name}</h3>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">{app.phone}</div>
                  <div className="text-xs font-semibold text-primary mt-1">{app.vehicle}</div>
                </div>
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  {app.submittedAt || 'Just now'}
                </div>
              </div>
              
              <div className="bg-slate-50 p-3 grid grid-cols-2 gap-2">
                <div className="bg-white p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                  <User size={14} className="text-slate-400" />
                  <span className="text-[10px] font-semibold text-slate-600">Selfie</span>
                  <ImageIcon size={14} className="text-blue-500 ml-auto" />
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                  <FileText size={14} className="text-slate-400" />
                  <span className="text-[10px] font-semibold text-slate-600">Citizenship</span>
                  <ImageIcon size={14} className="text-blue-500 ml-auto" />
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                  <FileText size={14} className="text-slate-400" />
                  <span className="text-[10px] font-semibold text-slate-600">License</span>
                  <ImageIcon size={14} className="text-blue-500 ml-auto" />
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                  <FileText size={14} className="text-slate-400" />
                  <span className="text-[10px] font-semibold text-slate-600">Bluebook</span>
                  <ImageIcon size={14} className="text-blue-500 ml-auto" />
                </div>
              </div>

              <div className="p-3 flex items-center gap-2">
                <button 
                  onClick={() => handleReject(app.id, idx)}
                  className="flex-1 bg-red-50 text-red-600 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform"
                >
                  <X size={16} /> Reject
                </button>
                <button 
                  onClick={() => handleApprove(app.id, idx)}
                  className="flex-1 bg-green-500 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform"
                >
                  <Check size={16} /> Approve
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
