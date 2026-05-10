import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import BookPage from '@/pages/BookPage';
import SavedPage from '@/pages/SavedPage';
import HistoryPage from '@/pages/HistoryPage';
import ProfilePage from '@/pages/ProfilePage';
import AuthPage from '@/pages/AuthPage';
import { BottomNav } from '@/components/BottomNav';
import { useRider } from '@/hooks/useRider';
import { User } from '@supabase/supabase-js';

export default function App() {
  const { ride, setPickup, setDestination, setVehicle, setRouteDetails, setStatus, resetRide } = useRider();
  const [session, setSession] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (localStorage.getItem('jamjam_demo_user')) {
      setSession({
        id: 'mock-user-123',
        aud: 'authenticated',
        role: 'authenticated',
        email: localStorage.getItem('jamjam_demo_email') || 'demo@jamjam.com',
        app_metadata: {},
        user_metadata: { full_name: 'Demo Rider' },
        created_at: new Date().toISOString(),
      } as any);
      setInitializing(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session?.user ?? null);
      setInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!localStorage.getItem('jamjam_demo_user')) {
        setSession(session?.user ?? null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && !localStorage.getItem('jamjam_demo_user')) {
      // Auto-create/upsert profile row
      supabase.from('profiles').upsert({
        id: session.id,
        full_name: session.user_metadata?.full_name || 'Jam Jam Rider',
        updated_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.error("Profile upsert error:", error);
      });
    }
  }, [session]);

  if (initializing) return null;

  return (
    <Router>
      <div id="app-container" className="min-h-screen bg-slate-100 font-sans selection:bg-primary/20 selection:text-primary">
        <main className="max-w-md mx-auto bg-white min-h-screen relative shadow-2xl shadow-slate-200 overflow-x-hidden flex flex-col">
          {!session ? (
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="*" element={<Navigate to="/auth" replace />} />
            </Routes>
          ) : (
            <>
              {/* Top Header */}
              <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-40 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white font-black italic shadow-lg shadow-primary/20 text-sm">
                    JJ
                  </div>
                  <h1 className="text-lg font-bold tracking-tight text-slate-800">
                    Jam Jam <span className="text-primary font-medium text-xs ml-0.5 uppercase tracking-widest">Nepal</span>
                  </h1>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1 bg-green-50 border border-green-100 rounded-full">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[9px] font-bold text-green-700 uppercase tracking-wider">Online</span>
                </div>
              </header>

              <div className="flex-1 relative overflow-hidden">
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
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
              <BottomNav />
            </>
          )}
        </main>
      </div>
    </Router>
  );
}
