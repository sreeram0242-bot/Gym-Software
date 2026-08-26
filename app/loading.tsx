import React from 'react';
import { Loader2 } from 'lucide-react';

export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 text-slate-500 animate-in fade-in zoom-in duration-300">
        <div className="p-4 bg-white shadow-xl rounded-2xl border border-slate-100">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        </div>
        <p className="text-sm font-semibold tracking-wide">Loading GymFlow...</p>
      </div>
    </div>
  );
}
