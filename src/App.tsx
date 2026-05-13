import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { auth, db } from '@/lib/firebase';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import BookPage from '@/pages/BookPage';
import SavedPage from '@/pages/SavedPage';
import HistoryPage from '@/pages/HistoryPage';
import ProfilePage from '@/pages/ProfilePage';
import AuthPage from '@/pages/AuthPage';
import WalletPage from '@/pages/WalletPage';
import DriverOnboardingPage from '@/pages/DriverOnboardingPage';
import ActiveRidePage from '@/pages/ActiveRidePage';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import KYCReviewPage from '@/pages/admin/KYCReviewPage';
import LiveRidesPage from '@/pages/admin/LiveRidesPage';
import { BottomNav } from '@/components/BottomNav';
import { useRider } from '@/hooks/useRider';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { IncomingRideModal } from '@/components/IncomingRideModal';

import { ConnectionBanner } from '@/components/ConnectionBanner';

import { useRideRecovery } from '@/hooks/useRideRecovery';

import { nativeBackground } from '@/lib/native/background';

function AppContent({ session }: { session: User | null }) {
  const { ride, setPickup, setDestination, setVehicle, setRouteDetails, setStatus, resetRide } = useRider();
  const [isDriver, setIsDriver] = useState(false);
  const { incomingRide, clearIncomingRide } = usePushNotifications(isDriver);

  // Recovery logic
  const { activeRideId, isRecovering } = useRideRecovery(isDriver ? 'driver' : 'rider');

  useEffect(() => {
    nativeBackground.setupBackgroundRecovery(() => {
      // Refresh logic or recovery trigger if needed when app returns from background
    });

    nativeBackground.checkBatteryOptimization().then((needsOptimization) => {
      if (needsOptimization) {
        // Here we could show a modal to the user. For MVP we'll log it.
        console.warn('OEM battery optimization limits detected. Prompt user to disable in settings.');
      }
    });
  }, []);

  useEffect(() => {
    if (session) {
      const checkDriver = async () => {
        try {
          // Give initialization a tiny ms start to write if this is a fresh simulated login
          await new Promise(r => setTimeout(r, 1500));
          const userDoc = await getDoc(doc(db, 'users', session.uid));
          if (userDoc.exists() && userDoc.data().role === 'driver') {
            setIsDriver(true);
          }
        } catch (e) {
          console.warn("Failed to check driver role:", e);
        }
      };
      checkDriver();
    }
  }, [session]);

  const navigate = useNavigate();
  useEffect(() => {
    if (activeRideId && !isRecovering) {
      // Reopen active ride page if one exists
      navigate(`/ride/${activeRideId}`);
    }
  }, [activeRideId, isRecovering, navigate]);

  return (
    <div id="app-container" className="min-h-screen bg-[#0F172A] font-sans selection:bg-[#22C55E]/20 selection:text-[#22C55E]">
      <ConnectionBanner />
      <main className="max-w-md mx-auto bg-[#0F172A] min-h-screen relative shadow-2xl overflow-x-hidden flex flex-col text-[#F8FAFC]">
        {!session ? (
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
        ) : (
          <>
            {/* Top Header */}
            <header className="h-16 bg-[#1E293B]/80 backdrop-blur-xl border-b border-slate-700/50 px-6 flex items-center justify-between z-40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#22C55E] to-[#14B8A6] rounded-xl flex items-center justify-center text-[#0F172A] font-black italic shadow-[0_0_15px_rgba(34,197,94,0.3)] text-base">
                  JJ
                </div>
                <h1 className="text-xl font-black tracking-tight text-[#F8FAFC]">
                  JamJam
                </h1>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-full">
                <div className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse shadow-[0_0_10px_#22C55E]"></div>
                <span className="text-[10px] font-bold text-[#22C55E] uppercase tracking-wider">Online</span>
              </div>
            </header>

            <div className="flex-1 relative overflow-hidden bg-[#0F172A]">
              <Routes>
                <Route 
                  path="/" 
                  element={
                    <BookPage 
                      ride={ride} 
                      setPickup={setPickup} 
                      setDestination={setDestination} 
                      setVehicle={setVehicle}
                      setRouteDetails={setRouteDetails}
                      setStatus={setStatus}
                      resetRide={resetRide}
                    />
                  } 
                />
                <Route path="/saved" element={<SavedPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/wallet" element={<WalletPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/driver-onboarding" element={<DriverOnboardingPage />} />
                <Route path="/ride/:rideId" element={<ActiveRidePage />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/kyc" element={<KYCReviewPage />} />
                <Route path="/admin/live-rides" element={<LiveRidesPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
            <BottomNav />
            {isDriver && <IncomingRideModal ride={incomingRide} onClose={clearIncomingRide} />}
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (localStorage.getItem('jamjam_demo_user') === 'true') {
      const mockRole = localStorage.getItem('jamjam_demo_role') || 'rider';
      setSession({
        uid: `demo-user-${mockRole}`,
        displayName: `Demo ${mockRole === 'driver' ? 'Driver' : 'Rider'}`,
      } as unknown as User);
      setInitializing(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setSession(user);
      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      if (localStorage.getItem('jamjam_demo_user') === 'true') {
        // Skip firestore init for demo mocked users without real Firebase Auth
        return;
      }
      const initializeUser = async () => {
        try {
          const role = localStorage.getItem('jamjam_demo_role') || 'rider';
          await setDoc(doc(db, 'users', session.uid), {
            id: session.uid,
            phone: session.phoneNumber || '',
            name: session.displayName || 'JamJam User',
            role: role,
            status: 'active',
            updated_at: new Date().toISOString(),
          }, { merge: true });
        } catch (error) {
          console.error("User initialization error:", error);
        }
      };
      initializeUser();
    }
  }, [session]);

  if (initializing) return null;

  return (
    <Router>
      <AppContent session={session} />
    </Router>
  );
}
