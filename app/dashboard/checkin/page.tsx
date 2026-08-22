'use client';

import React, { useState, useEffect } from 'react';
import { Radio, Clock, UserCheck } from 'lucide-react';
import { getCustomers, getAttendance, findCustomerByNFC, toggleCheckIn, getMemberMonthlyAvgHours } from '@/lib/actions';
import { Customer, AttendanceRecord } from '@/lib/types';

export default function NFCCheckInTerminal() {
  const [gymId, setGymId] = useState<string>('gym_1');
  const [customers, setCustomers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  // Web NFC State
  const [nfcSupported, setNfcSupported] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  useEffect(() => {
    loadData();

    // Check if Web NFC API is supported
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      setNfcSupported(true);
    }
    
    const handleUpdate = () => loadData();
    window.addEventListener('attendance_updated', handleUpdate);
    return () => window.removeEventListener('attendance_updated', handleUpdate);
  }, []);

  const loadData = async () => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || 'gym_1' : 'gym_1';
    setGymId(savedId);

    const [custs, atts] = await Promise.all([
      getCustomers(savedId),
      getAttendance(savedId)
    ]);
    
    setCustomers(custs);
    setAttendance(atts);
  };

  // Start Hardware Web NFC Scan (for devices with Web NFC support)
  const startHardwareNFCScan = async () => {
    if (!nfcSupported) return;
    try {
      setIsScanning(true);
      // @ts-ignore
      const ndef = new window.NDEFReader();
      await ndef.scan();

      // @ts-ignore
      ndef.addEventListener('reading', async ({ serialNumber }: any) => {
        const matched = await findCustomerByNFC(gymId, serialNumber);
        if (matched) {
          await toggleCheckIn(matched.id);
          loadData();
        }
      });
    } catch (err) {
      console.error('NFC Scan Error:', err);
      setIsScanning(false);
    }
  };
  
  const getAvg = (custId: string) => {
    const atts = attendance.filter(a => a.customerId === custId && a.durationMinutes);
    if (atts.length === 0) return 1.2;
    const totalMins = atts.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
    const avg = (totalMins / 60) / Math.max(1, atts.length);
    return parseFloat(avg.toFixed(1));
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = attendance.filter((a) => a.dateStr === todayStr);
  const activeSessions = todayRecords.filter(a => !a.checkOutTime);

  // Group by customer to prevent multiple cards for the same member
  const uniqueTodayRecords: any[] = [];
  const seenCustomerIds = new Set<string>();

  // Prioritize active sessions, then fallback to most recent checkouts
  const sortedRawRecords = [...todayRecords].sort((a, b) => {
    if (!a.checkOutTime && b.checkOutTime) return -1;
    if (a.checkOutTime && !b.checkOutTime) return 1;
    // Otherwise keep relative order (which is newest first)
    return 0;
  });

  sortedRawRecords.forEach(rec => {
    if (!seenCustomerIds.has(rec.customerId)) {
      seenCustomerIds.add(rec.customerId);
      uniqueTodayRecords.push(rec);
    }
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-950 text-xs font-bold mb-2">
            <Radio className="w-3.5 h-3.5 text-blue-900 animate-pulse" />
            <span>NFC Attendance Terminal</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Active Members Monitor</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time view of members currently working out. Check-ins are strictly managed via NFC cards.
          </p>
        </div>

        {nfcSupported && (
          <button
            onClick={startHardwareNFCScan}
            disabled={isScanning}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center space-x-2 transition-all ${
              isScanning
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                : 'bg-blue-900 hover:bg-blue-950 text-white'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>{isScanning ? '● Web NFC Hardware Active' : 'Enable Device Web NFC'}</span>
          </button>
        )}
      </div>

      {/* SECTION: Member Attendance Cards */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold text-slate-900 text-base mb-1 flex items-center space-x-2">
          <UserCheck className="w-5 h-5 text-blue-900" />
          <span>Today's Attendance Status ({activeSessions.length} Active)</span>
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          Real-time check-in and check-out status of gym members today.
        </p>

        {uniqueTodayRecords.length === 0 ? (
          <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center">
            <UserCheck className="w-8 h-8 mb-3 opacity-40 text-slate-500" />
            <p className="font-bold text-slate-600 text-sm">No attendance logged today</p>
            <p className="text-xs mt-1">Waiting for NFC hardware taps...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {uniqueTodayRecords.map(session => {
              const customer = customers.find(c => c.id === session.customerId);
                const avgHours = getAvg(session.customerId);
                const isActive = !session.checkOutTime;
                
                return (
                  <div key={session.id} className={`p-4 rounded-xl border relative overflow-hidden transition-all hover:shadow-md ${
                    isActive 
                      ? 'border-blue-200 bg-gradient-to-br from-blue-50/50 to-white' 
                      : 'border-slate-200 bg-slate-50/40 opacity-75'
                  }`}>
                    <div className={`absolute top-0 right-0 text-[10px] font-bold px-2 py-1 rounded-bl-lg shadow-sm ${
                      isActive 
                        ? 'bg-blue-900 text-white' 
                        : 'bg-slate-400 text-white'
                    }`}>
                      {isActive ? 'ACTIVE' : 'LEAVED'}
                    </div>
                    
                    <div className="flex items-center space-x-3 mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm border ${
                        isActive 
                          ? 'bg-blue-100 text-blue-950 border-blue-200' 
                          : 'bg-slate-200 text-slate-600 border-slate-300'
                      }`}>
                        {session.customerName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm leading-tight">{session.customerName}</div>
                        <div className="text-[10px] font-mono text-slate-500">{session.customerPhone}</div>
                      </div>
                    </div>
                    
                    <div className={`space-y-1.5 text-xs text-slate-600 mt-4 border-t pt-3 ${
                      isActive ? 'border-blue-100' : 'border-slate-200'
                    }`}>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-400">Check-In:</span>
                        <span className="font-bold text-slate-800">{new Date(session.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      {!isActive && (
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-400">Check-Out:</span>
                          <span className="font-bold text-slate-800">{new Date(session.checkOutTime!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      )}
                      {customer && (
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-400">NFC Card:</span>
                          <span className="font-mono font-bold text-slate-800">{customer.nfcCardId}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-1 mt-1 border-t border-slate-100 border-dashed">
                        <span className="font-semibold text-slate-400">Monthly Avg:</span>
                        <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{avgHours} hrs/day</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* SECTION: Today's Detailed Attendance & Monthly Avg Hours Log */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-900" />
              <span>Today's Member Visit Log ({todayRecords.length})</span>
            </h3>
            <p className="text-xs text-slate-500">Live list of today's check-ins with calculated monthly average workout hours per day.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Member Name</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Check-In Time</th>
                <th className="py-3 px-4">Check-Out Time</th>
                <th className="py-3 px-4 text-center">Visit Duration</th>
                <th className="py-3 px-4 text-center">Monthly Avg (Hrs/Day)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
              {todayRecords.length > 0 ? (
                todayRecords.map((rec) => {
                  const avg = getAvg(rec.customerId);
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-950 text-xs flex items-center justify-center font-bold">
                          {rec.customerName.charAt(0)}
                        </div>
                        <span>{rec.customerName}</span>
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-mono">{rec.customerPhone}</td>

                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {new Date(rec.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="py-3 px-4">
                        {rec.checkOutTime ? (
                          <span className="font-semibold text-slate-800">
                            {new Date(rec.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ● Workout Active
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-slate-700">
                        {rec.durationMinutes ? `${rec.durationMinutes} mins` : 'In Progress'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-800 font-bold rounded-lg text-xs border border-blue-200">
                          {avg} hrs / day
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No attendance records for today yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
