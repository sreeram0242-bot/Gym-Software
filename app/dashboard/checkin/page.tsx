'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Radio, Clock, UserCheck, Fingerprint, Search, Wifi, WifiOff } from 'lucide-react';
import { getCustomers, getAttendance, findCustomerByNFC, findCustomerByFingerprint, toggleCheckIn, getMemberMonthlyAvgHours, getGymSettings } from '@/lib/actions';
import { Customer, AttendanceRecord } from '@/lib/types';
import { getTemplate, compileTemplate } from '@/lib/templates';

export default function NFCCheckInTerminal() {
  const [gymId, setGymId] = useState<string>('gym_1');
  const [customers, setCustomers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  // Attendance Mode from Settings
  const [attendanceMode, setAttendanceMode] = useState<string>('NFC');
  const [fpPort, setFpPort] = useState<number>(8765);

  // Web NFC State
  const [nfcSupported, setNfcSupported] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Fingerprint Bridge WebSocket State
  const [fpConnected, setFpConnected] = useState<boolean>(false);
  const [fpStatus, setFpStatus] = useState<string>('Connecting to fingerprint agent...');
  const fpWsRef = useRef<WebSocket | null>(null);

  // Manual search state
  const [manualSearch, setManualSearch] = useState('');

  useEffect(() => {
    loadData();

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

    const [custs, atts, gymSettings] = await Promise.all([
      getCustomers(savedId),
      getAttendance(savedId),
      getGymSettings(savedId)
    ]);
    
    setCustomers(custs);
    setAttendance(atts);
    const mode = gymSettings?.attendanceMode || 'NFC';
    const port = gymSettings?.fingerprintAgentPort || 8765;
    setAttendanceMode(mode);
    setFpPort(port);

    // Connect fingerprint WebSocket if needed
    if ((mode === 'FINGERPRINT' || mode === 'BOTH') && !fpWsRef.current) {
      connectFingerprintBridge(savedId, port);
    }
  };

  // Connect to local MFS100 WebSocket bridge agent
  const connectFingerprintBridge = (currentGymId: string, port: number) => {
    try {
      const ws = new WebSocket(`ws://localhost:${port}`);
      fpWsRef.current = ws;

      ws.onopen = () => {
        setFpConnected(true);
        setFpStatus('Fingerprint scanner ready — place finger on sensor');
      };

      ws.onmessage = async (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'scan' && data.fingerprintId) {
            const matched = await findCustomerByFingerprint(currentGymId, data.fingerprintId);
            if (matched) {
              await handleCheckInToggle(matched, currentGymId);
              setFpStatus('Scan registered! Place finger again for next member.');
              setTimeout(() => setFpStatus('Fingerprint scanner ready — place finger on sensor'), 3000);
            } else {
              setFpStatus('Fingerprint not registered. Try again or check member profile.');
              setTimeout(() => setFpStatus('Fingerprint scanner ready — place finger on sensor'), 3000);
            }
          }
        } catch (e) {
          console.error('FP message parse error', e);
        }
      };

      ws.onerror = () => {
        setFpConnected(false);
        setFpStatus('Cannot connect to fingerprint bridge agent. Is it running on this PC?');
      };

      ws.onclose = () => {
        setFpConnected(false);
        fpWsRef.current = null;
        setFpStatus('Fingerprint agent disconnected. Reconnecting...');
        // Auto-retry after 5 seconds
        setTimeout(() => connectFingerprintBridge(currentGymId, port), 5000);
      };
    } catch (e) {
      setFpConnected(false);
      setFpStatus('WebSocket not supported or bridge unreachable.');
    }
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
          await handleCheckInToggle(matched, gymId);
        }
      });
    } catch (err) {
      console.error('NFC Scan Error:', err);
      setIsScanning(false);
    }
  };

  // Shared check-in logic used by NFC, fingerprint, and manual modes
  const handleCheckInToggle = async (matched: any, currentGymId: string) => {
    const { record, action } = await toggleCheckIn(matched.id);
    loadData();

    const gymSettings = await getGymSettings(currentGymId);
    if (gymSettings?.waAttendanceMessages && matched.phone) {
      const templateName = action === 'checkin' ? 'checkin' : 'checkout';
      const rawTemplate = getTemplate(gymSettings, templateName);
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const duration = record.durationMinutes || 0;
      const message = compileTemplate(rawTemplate, {
        name: matched.name,
        time: nowTime,
        duration: duration.toString()
      });
      fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gymId: currentGymId, phone: matched.phone, message })
      }).catch(() => {});
    }
  };

  const handleManualCheckIn = async (customer: any) => {
    await handleCheckInToggle(customer, gymId);
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
            {attendanceMode === 'FINGERPRINT' ? <Fingerprint className="w-3.5 h-3.5 text-blue-900" /> : attendanceMode === 'MANUAL' ? <Search className="w-3.5 h-3.5 text-blue-900" /> : <Radio className="w-3.5 h-3.5 text-blue-900 animate-pulse" />}
            <span>{attendanceMode === 'MANUAL' ? 'Manual Check-in' : attendanceMode === 'FINGERPRINT' ? 'Fingerprint Terminal' : attendanceMode === 'BOTH' ? 'NFC + Fingerprint Terminal' : 'NFC Attendance Terminal'}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Active Members Monitor</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time view of members currently working out.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* NFC Button — shown in NFC and BOTH modes */}
          {(attendanceMode === 'NFC' || attendanceMode === 'BOTH') && nfcSupported && (
            <button
              onClick={startHardwareNFCScan}
              disabled={isScanning}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center space-x-2 transition-all ${
                isScanning ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-blue-900 hover:bg-blue-950 text-white'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>{isScanning ? 'Web NFC Active' : 'Enable Web NFC'}</span>
            </button>
          )}

          {/* Fingerprint Status Badge — shown in FINGERPRINT and BOTH modes */}
          {(attendanceMode === 'FINGERPRINT' || attendanceMode === 'BOTH') && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border ${
              fpConnected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {fpConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              <div>
                <p className="font-bold">{fpConnected ? 'Scanner Connected' : 'Scanner Offline'}</p>
                <p className="text-xs opacity-80 max-w-48 truncate">{fpStatus}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Search Bar — shown in MANUAL mode */}
      {attendanceMode === 'MANUAL' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><Search className="w-4 h-4" /> Search & Check-in Member</h3>
          <input
            value={manualSearch}
            onChange={e => setManualSearch(e.target.value)}
            placeholder="Type member name..."
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-800 outline-none mb-3"
          />
          {manualSearch.trim() && (
            <div className="space-y-2 max-h-56 overflow-auto">
              {customers.filter((c: any) => c.name.toLowerCase().includes(manualSearch.toLowerCase())).map((c: any) => (
                <button key={c.id} onClick={() => handleManualCheckIn(c)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl transition-colors text-left">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.planType}</p>
                  </div>
                  <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">Check-in / Out</span>
                </button>
              ))}
              {customers.filter((c: any) => c.name.toLowerCase().includes(manualSearch.toLowerCase())).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No member found</p>
              )}
            </div>
          )}
        </div>
      )}


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
