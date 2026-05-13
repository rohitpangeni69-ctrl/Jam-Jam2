import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, storage } from '@/lib/firebase';
import { motion } from 'motion/react';
import { ShieldCheck, ArrowRight, Truck, Info, Loader2 } from 'lucide-react';
import { DocumentUploadCard } from '@/components/DocumentUploadCard';

type KYCStatus = 'pending' | 'approved' | 'rejected' | 'incomplete';

interface DocumentState {
  status: 'pending' | 'uploading' | 'completed' | 'error';
  url: string;
}

export default function DriverOnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<KYCStatus>('incomplete');
  
  const [vehicleType, setVehicleType] = useState('bike');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [docs, setDocs] = useState<{ [key: string]: DocumentState }>({
    citizenship_front: { status: 'pending', url: '' },
    citizenship_back: { status: 'pending', url: '' },
    license: { status: 'pending', url: '' },
    bluebook: { status: 'pending', url: '' },
    selfie: { status: 'pending', url: '' },
  });

  useEffect(() => {
    async function checkStatus() {
      if (!auth.currentUser) {
        navigate('/auth');
        return;
      }
      
      try {
        const uDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (uDoc.exists()) {
          const data = uDoc.data();
          if (data.kyc_status && data.kyc_status !== 'incomplete') {
            setKycStatus(data.kyc_status);
          }
          if (data.role === 'driver' && data.kyc_status === 'approved') {
             // Already a verified driver, maybe take them to driver home.
             // navigate('/');
          }
        }
        
        const kycDoc = await getDoc(doc(db, 'driver_kyc', auth.currentUser.uid));
        if (kycDoc.exists()) {
          const kycData = kycDoc.data();
          setDocs({
            citizenship_front: { status: kycData.citizenship_front ? 'completed' : 'pending', url: kycData.citizenship_front || '' },
            citizenship_back: { status: kycData.citizenship_back ? 'completed' : 'pending', url: kycData.citizenship_back || '' },
            license: { status: kycData.license ? 'completed' : 'pending', url: kycData.license || '' },
            bluebook: { status: kycData.bluebook ? 'completed' : 'pending', url: kycData.bluebook || '' },
            selfie: { status: kycData.selfie ? 'completed' : 'pending', url: kycData.selfie || '' },
          });
          if (kycData.vehicle_type) setVehicleType(kycData.vehicle_type);
          if (kycData.vehicle_number) setVehicleNumber(kycData.vehicle_number);
        }
      } catch (err) {
        console.error("KYC fetch error", err);
      } finally {
        setLoading(false);
      }
    }
    
    checkStatus();
  }, [navigate]);

  const handleUpload = async (docKey: string, file: File) => {
    if (!auth.currentUser) return;
    
    setDocs(prev => ({ ...prev, [docKey]: { ...prev[docKey], status: 'uploading' } }));
    
    try {
      const storageRef = ref(storage, `drivers/${auth.currentUser.uid}/kyc/${docKey}_${Date.now()}.webp`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Can track progress if needed
          },
          (error) => reject(error),
          async () => {
             const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
             
             // Update driver_kyc document incrementally
             await setDoc(doc(db, 'driver_kyc', auth.currentUser!.uid), {
               [docKey]: downloadURL,
               updated_at: new Date().toISOString()
             }, { merge: true });
             
             setDocs(prev => ({ ...prev, [docKey]: { status: 'completed', url: downloadURL } }));
             resolve();
          }
        );
      });
    } catch (err) {
      console.error(err);
      setDocs(prev => ({ ...prev, [docKey]: { ...prev[docKey], status: 'error' } }));
      throw err;
    }
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) return;
    
    const allUploaded = Object.values<DocumentState>(docs).every(d => d.status === 'completed' && d.url);
    if (!allUploaded || !vehicleNumber.trim()) {
      alert("Please complete all uploads and vehicle information.");
      return;
    }

    setSubmitting(true);
    try {
      await setDoc(doc(db, 'driver_kyc', auth.currentUser.uid), {
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber.toUpperCase(),
        status: 'pending',
        submitted_at: new Date().toISOString()
      }, { merge: true });

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        kyc_status: 'pending',
        role: 'pending_driver', // intermediate role
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber.toUpperCase(),
      });

      setKycStatus('pending');
    } catch (error) {
      console.error("Submission failed", error);
      alert("Failed to submit application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-[#176C4B]" size={32} />
      </div>
    );
  }

  if (kycStatus === 'pending') {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center text-orange-500 mb-6 border-8 border-orange-100">
          <Loader2 className="animate-spin" size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Review in Progress</h2>
        <p className="text-slate-500 font-medium text-sm leading-relaxed max-w-[280px]">
          We are reviewing your documents. This usually takes 2-4 hours during business days. We will notify you once approved.
        </p>
        <button onClick={() => navigate('/')} className="mt-8 py-4 px-8 bg-slate-100 text-slate-700 font-black rounded-2xl tracking-widest text-xs uppercase hover:bg-slate-200 transition-colors">
          Go to Home
        </button>
      </div>
    );
  }

  if (kycStatus === 'rejected') {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-6 border-8 border-red-100">
          <Info size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Application Rejected</h2>
        <p className="text-slate-500 font-medium text-sm leading-relaxed max-w-[280px]">
          Your documents could not be verified. Please ensure images are clear and match your details.
        </p>
        <button onClick={() => setKycStatus('incomplete')} className="mt-8 py-4 px-8 bg-[#176C4B] text-white font-black rounded-2xl tracking-widest text-xs uppercase shadow-xl shadow-[#176C4B]/20 hover:scale-105 transition-all">
          Retry Application
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="bg-[#176C4B] text-white px-6 pt-8 pb-12 rounded-b-[40px] shadow-lg relative z-10">
        <div className="flex items-center gap-2 mb-4 opacity-90">
          <ShieldCheck size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest">Verify to Drive</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-2">Driver KYC</h1>
        <p className="text-white/80 text-sm font-medium">To keep NepalRide safe, we need strict verification before you can start picking up passengers.</p>
      </div>

      <div className="px-5 -mt-6 relative z-20 space-y-4 pb-24">
        
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Vehicle Details</h3>
          
          <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl mb-4">
            <button 
              onClick={() => setVehicleType('bike')}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${vehicleType === 'bike' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Bike (Pathao)
            </button>
            <button 
              onClick={() => setVehicleType('cab')}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${vehicleType === 'cab' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Taxi (Cab)
            </button>
          </div>

          <div className="mb-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Vehicle License Plate</label>
            <input
              type="text"
              placeholder="e.g. BA 1 PA 1234"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 flex-1 px-4 outline-none focus:border-[#176C4B] transition-all font-bold text-slate-700 uppercase"
            />
          </div>
        </div>

        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 mt-6 mb-2">Required Documents</h3>

        <DocumentUploadCard 
          title="Citizenship (Front)" 
          description="Nagarikta front side"
          status={docs.citizenship_front.status}
          imageUrl={docs.citizenship_front.url}
          onUpload={(f) => handleUpload('citizenship_front', f)}
        />

        <DocumentUploadCard 
          title="Citizenship (Back)" 
          description="Nagarikta reverse side"
          status={docs.citizenship_back.status}
          imageUrl={docs.citizenship_back.url}
          onUpload={(f) => handleUpload('citizenship_back', f)}
        />

        <DocumentUploadCard 
          title="Driving License" 
          description="Original card front side"
          status={docs.license.status}
          imageUrl={docs.license.url}
          onUpload={(f) => handleUpload('license', f)}
        />

        <DocumentUploadCard 
          title="Bluebook" 
          description="Current renewed page"
          status={docs.bluebook.status}
          imageUrl={docs.bluebook.url}
          onUpload={(f) => handleUpload('bluebook', f)}
        />

        <DocumentUploadCard 
          title="Selfie with Vehicle" 
          description="To prove ownership/possession"
          status={docs.selfie.status}
          imageUrl={docs.selfie.url}
          onUpload={(f) => handleUpload('selfie', f)}
        />

        <div className="pt-6">
          <button 
            onClick={handleSubmit}
            disabled={submitting || !Object.values<DocumentState>(docs).every(d => d.status === 'completed') || !vehicleNumber}
            className="w-full bg-[#176C4B] hover:bg-[#155e41] disabled:opacity-50 text-white py-5 rounded-2xl font-black shadow-xl shadow-[#176C4B]/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
          >
            {submitting ? <Loader2 className="animate-spin" size={20} /> : <>SUBMIT APPLICATION <ArrowRight size={20} /></>}
          </button>
          <p className="text-center mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-8">
            Double check all images are clear and readable before submitting.
          </p>
        </div>
      </div>
    </div>
  );
}
