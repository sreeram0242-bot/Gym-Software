import React from 'react';
import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="flex-1 w-full h-full min-h-[50vh] flex flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-slate-400 animate-in fade-in zoom-in duration-300">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="text-sm font-medium animate-pulse">Loading data...</p>
      </div>
      
      {/* Skeletons to mask the visual transition */}
      <div className="w-full max-w-4xl mt-12 space-y-4 opacity-50">
        <div className="w-1/3 h-8 bg-slate-200 rounded-lg animate-pulse" />
        <div className="w-full h-32 bg-slate-200 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="w-full h-24 bg-slate-200 rounded-xl animate-pulse delay-75" />
          <div className="w-full h-24 bg-slate-200 rounded-xl animate-pulse delay-100" />
          <div className="w-full h-24 bg-slate-200 rounded-xl animate-pulse delay-150" />
        </div>
      </div>
    </div>
  );
}
