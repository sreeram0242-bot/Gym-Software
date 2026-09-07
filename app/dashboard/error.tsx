'use client';
import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard Route Error caught by ErrorBoundary:', error);
  }, [error]);

  return (
    <div className="flex-1 w-full min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white border border-rose-100 rounded-3xl p-8 shadow-xl shadow-rose-500/5 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mb-5 text-rose-600 shadow-inner">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 tracking-tight">
          Unable to Load This Page
        </h2>

        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          A temporary network or device connection issue occurred. Your data is completely safe.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-md shadow-blue-900/10 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>Reload App</span>
          </button>
        </div>

        <Link
          href="/dashboard"
          className="mt-4 text-xs font-semibold text-slate-400 hover:text-slate-600 flex items-center gap-1.5 transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Return to Dashboard Overview</span>
        </Link>
      </div>
    </div>
  );
}
