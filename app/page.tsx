'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Dumbbell, Smartphone, CreditCard, Users, ArrowRight, Zap, CheckCircle, BarChart3, Database } from 'lucide-react';
import { AppStore } from '@/lib/store';
import { Gym } from '@/lib/types';

export default function LandingPage() {
  const router = useRouter();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string>('gym_1');

  useEffect(() => {
    setGyms(AppStore.getGyms());
  }, []);

  const handleSelectGymAndNavigate = (gymId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_gym_id', gymId);
    }
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
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

          <div className="flex items-center space-x-3">
            <Link
              href="/superadmin"
              className="inline-flex items-center space-x-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:text-blue-900 bg-slate-100 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors border border-slate-200"
            >
              <ShieldCheck className="w-4 h-4 text-blue-900" />
              <span>Master Admin Portal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 text-blue-950 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold mb-6">
              <Zap className="w-4 h-4 text-blue-900" />
              <span>Oracle Cloud Native SaaS Platform</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
              Next-Gen <span className="text-blue-900">Gym Software</span> with NFC & Smart Reminders
            </h1>

            <p className="text-slate-600 text-base sm:text-lg mb-8 leading-relaxed">
              Empower your gym owners with tap-and-go NFC check-ins, automated WhatsApp payment reminders, monthly member attendance tracking, and real-time net profit analytics.
            </p>

            {/* Portal Switcher Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm text-left max-w-2xl mx-auto">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>Select Portal to Access</span>
                <span className="text-xs text-blue-900 font-normal">2 Portals Available</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Master Portal Card */}
                <Link
                  href="/superadmin"
                  className="group relative p-5 bg-white border border-slate-200 hover:border-blue-800 rounded-xl transition-all shadow-sm hover:shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-950 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-lg group-hover:text-blue-900 transition-colors">1. Master Portal</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      SaaS Owner control center. Add new gyms, generate gym login credentials, and global customer search by phone.
                    </p>
                  </div>
                  <div className="mt-4 flex items-center text-xs font-bold text-blue-900 group-hover:translate-x-1 transition-transform">
                    Enter Master Portal <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </Link>

                {/* Gym Owner Portal Card */}
                <div className="p-5 bg-white border border-blue-200 rounded-xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-blue-900 text-white flex items-center justify-center mb-3">
                      <Dumbbell className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-lg">2. Gym Owner Portal</h3>
                    <p className="text-xs text-slate-500 mt-1 mb-3">
                      Mobile-optimized dashboard for daily gym check-ins, NFC scanner, dues & revenue tracking.
                    </p>

                    <label className="block text-xs font-semibold text-slate-700 mb-1">Demo Gym Login:</label>
                    <select
                      value={selectedGymId}
                      onChange={(e) => setSelectedGymId(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-800 focus:outline-none"
                    >
                      {gyms.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.ownerName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => handleSelectGymAndNavigate(selectedGymId)}
                    className="mt-4 w-full py-2 px-3 bg-blue-900 hover:bg-blue-950 text-white rounded-lg font-semibold text-xs transition-colors flex items-center justify-center space-x-1 shadow-sm"
                  >
                    <span>Launch Gym Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs text-slate-500">
                <span className="flex items-center">
                  <Database className="w-3.5 h-3.5 mr-1 text-slate-400" /> Oracle DB Ready Schema
                </span>
                <span className="flex items-center">
                  <Smartphone className="w-3.5 h-3.5 mr-1 text-slate-400" /> 100% Mobile Optimized
                </span>
              </div>
            </div>
          </div>

          {/* Feature Highlights Grid */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">NFC Card & Phone Check-In</h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                Scan customer NFC cards or type phone numbers to log exact daily timing and calculate monthly average workout hours per day.
              </p>
            </div>

            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center mb-4">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">Automated Payment Reminders</h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                Track 3-day due alerts or custom reminder windows with 1-click WhatsApp message triggers for quick collections.
              </p>
            </div>

            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">Net Profit Analytics</h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                Clear revenue overview with today's collections, total income, gym expenses breakdown, and net profit calculations.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
          © 2026 GymFlow SaaS. Built with Next.js, TypeScript, and Oracle Cloud ready database schema.
        </div>
      </footer>
    </div>
  );
}
