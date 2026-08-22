'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Dumbbell, Smartphone, CreditCard, Users, ArrowRight, Database, KeyRound, Lock, AlertCircle } from 'lucide-react';
import { getGyms } from '@/lib/actions';

export default function LandingPage() {
  const router = useRouter();
  
  // Login State
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Clear existing session on landing page load
  useEffect(() => {
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Gym Partner Login
    const gyms = await getGyms();
    const gymMatch = gyms.find(
      (g) => g.userId === userId && g.passwordHash === password && g.status === 'active'
    );

    if (gymMatch) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_gym_id', gymMatch.id);
      }
      router.push('/dashboard');
    } else {
      // Check if gym exists but is suspended
      const suspendedGym = gyms.find((g) => g.userId === userId && g.passwordHash === password && g.status === 'suspended');
      if (suspendedGym) {
        setErrorMsg('Your account has been suspended. Please contact the Master Admin.');
      } else {
        setErrorMsg('Invalid Gym User ID or Password.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans relative overflow-hidden">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-900 flex items-center justify-center text-white shadow-md shadow-blue-800/20">
              <Dumbbell className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-slate-900">GymFlow</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-950 border border-blue-200">SaaS v1.0</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero & Login Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
          
          <div className="p-8">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-black text-slate-900 mb-2">
                Welcome Back
              </h2>
              <p className="text-slate-500 text-sm">
                Enter your credentials to manage your gym.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-2 text-rose-700 text-sm font-semibold">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  User ID
                </label>
                <div className="relative">
                  <KeyRound className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="gym_user_id"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-800 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-800 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-lg text-white font-bold text-sm transition-colors flex items-center justify-center space-x-2 shadow-md mt-6 bg-blue-900 hover:bg-blue-950 shadow-blue-900/20"
              >
                <span>Login to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>


          </div>
        </div>

        {/* Floating decoration */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-3xl -z-10 mix-blend-multiply"></div>
      </main>
    </div>
  );
}
