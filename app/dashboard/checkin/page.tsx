'use client';

import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { Radio, Clock, UserCheck, Fingerprint, Search, Wifi, WifiOff, Briefcase, LogIn, LogOut, Shield, Users, FileText, FileSpreadsheet } from 'lucide-react';
import { 
  getCustomers, getAttendance, findCustomerByNFC, findCustomerByFingerprint, toggleCheckIn, 
  getMemberMonthlyAvgHours, getGymSettings, getStaffs, getStaffAttendance, findStaffByNFC, 
  findStaffByFingerprint, toggleStaffCheckIn, getGyms
} from '@/lib/actions';
import { Customer, AttendanceRecord } from '@/lib/types';
import { getTemplate, compileTemplate } from '@/lib/templates';
import { getLocalTodayDateString, exportToCSV, formatDateDDMMYYYY } from '@/lib/utils';
import { exportToPDF } from '@/lib/exportPdf';

export default function CheckInTerminal() {
  const [gymId, setGymId] = useState<string>('gym_1');
  const [gymName, setGymName] = useState<string>('Our Gym');
  const [activeTab, setActiveTab] = useState<'members' | 'staff'>('members');
  
  // Members State
  const [customers, setCustomers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  // Staff State
  const [staffs, setStaffs] = useState<any[]>([]);
  const [staffAttendance, setStaffAttendance] = useState<any[]>([]);

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
  const fpRetryCountRef = useRef<number>(0);

  // Manual search state
  const [manualSearch, setManualSearch] = useState('');
  const deferredSearchQuery = useDeferredValue(manualSearch);
  const [punchLoading, setPunchLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      if (document.hidden) return;
      loadData();
    }, 1500);

    const handleFocus = () => loadData();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      setNfcSupported(true);
    }
    
    const handleUpdate = () => loadData();
    window.addEventListener('attendance_updated', handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('attendance_updated', handleUpdate);
    };
  }, []);

  const loadData = async () => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || 'gym_1' : 'gym_1';
    setGymId(savedId);

    const [custs, atts, stfs, stfAtts, gymSettings, loadedGyms] = await Promise.all([
      getCustomers(savedId),
      getAttendance(savedId),
      getStaffs(savedId),
      getStaffAttendance(savedId),
      getGymSettings(savedId),
      getGyms()
    ]);
    
    setCustomers(custs || []);
    setAttendance(atts || []);
    setStaffs(stfs || []);
    setStaffAttendance(stfAtts || []);

    const mode = gymSettings?.attendanceMode || 'NFC';
    const port = gymSettings?.fingerprintAgentPort || 8765;
    setAttendanceMode(mode);
    setFpPort(port);
    const matched = loadedGyms?.find((g: any) => g.id === savedId);
    if (matched) setGymName(matched.name);

    // Connect fingerprint WebSocket if needed
    if ((mode === 'FINGERPRINT' || mode === 'BOTH') && !fpWsRef.current) {
      connectFingerprintBridge(savedId, port);
    }
  };

  // ─── DUAL EXPORT HANDLERS (CSV & PDF) ───
  const exportMemberVisitsCSV = () => {
    const exportData = todayMemberRecords.map(r => ({
      Date: formatDateDDMMYYYY(r.dateStr),
      Member_Name: r.customerName,
      Phone: r.customerPhone,
      Check_IN: new Date(r.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      Check_OUT: r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'In Gym',
      Duration_Minutes: r.durationMinutes || (r.checkOutTime ? 0 : 'In Progress'),
      Monthly_Avg_Hours: `${getAvg(r.customerId)} hrs/day`
    }));
    exportToCSV(exportData, `Today_Member_Visits_${getLocalTodayDateString()}.csv`);
  };

  const exportMemberVisitsPDF = () => {
    const head = [['Member Name', 'Phone', 'Check-IN', 'Check-OUT', 'Workout Duration', 'Monthly Avg']];
    const body = todayMemberRecords.map(r => [
      r.customerName,
      r.customerPhone,
      new Date(r.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'IN GYM',
      r.durationMinutes ? `${Math.floor(r.durationMinutes / 60)}h ${r.durationMinutes % 60}m` : 'In Progress',
      `${getAvg(r.customerId)} hrs/day`
    ]);

    exportToPDF({
      gymName,
      title: "Today's Member Visit Report",
      subtitle: `Date: ${formatDateDDMMYYYY(getLocalTodayDateString())} | Total Visits: ${todayMemberRecords.length} | Currently in Gym: ${activeMemberSessions.length}`,
      filename: `Member_Visits_${getLocalTodayDateString()}.pdf`,
      head,
      body,
      orientation: 'portrait',
      summaryBoxes: [
        { label: 'Total Visits Today', value: String(todayMemberRecords.length) },
        { label: 'Currently In Gym', value: String(activeMemberSessions.length) },
        { label: 'Completed Visits', value: String(todayMemberRecords.length - activeMemberSessions.length) }
      ]
    });
  };

  const exportTodayStaffShiftsCSV = () => {
    const exportData = todayStaffRecords.map(r => {
      const staffObj = staffs.find(s => s.id === r.staffId);
      return {
        Date: formatDateDDMMYYYY(r.dateStr),
        Staff_Name: r.staffName,
        Role: staffObj?.role || 'Staff',
        Phone: r.staffPhone,
        Punch_IN: new Date(r.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        Punch_OUT: r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'On Duty',
        Duration_Minutes: r.durationMinutes || 0,
        Hardware_ID: staffObj?.nfcCardId ? `NFC: ${staffObj.nfcCardId}` : staffObj?.fingerprintId ? `FP: #${staffObj.fingerprintId}` : 'Manual'
      };
    });
    exportToCSV(exportData, `Today_Staff_Shifts_${getLocalTodayDateString()}.csv`);
  };

  const exportTodayStaffShiftsPDF = () => {
    const head = [['Staff Member', 'Role', 'Phone', 'Punch IN', 'Punch OUT', 'Shift Duration', 'Hardware ID']];
    const body = todayStaffRecords.map(r => {
      const staffObj = staffs.find(s => s.id === r.staffId);
      return [
        r.staffName,
        staffObj?.role || 'Staff',
        r.staffPhone,
        new Date(r.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'ON DUTY',
        r.durationMinutes ? `${Math.floor(r.durationMinutes / 60)}h ${r.durationMinutes % 60}m` : 'In Progress',
        staffObj?.nfcCardId ? `NFC: ${staffObj.nfcCardId}` : staffObj?.fingerprintId ? `FP: #${staffObj.fingerprintId}` : 'Manual'
      ];
    });

    exportToPDF({
      gymName,
      title: "Today's Staff Shift Report",
      subtitle: `Date: ${formatDateDDMMYYYY(getLocalTodayDateString())} | Total Shifts: ${todayStaffRecords.length} | Currently On Duty: ${activeStaffSessions.length}`,
      filename: `Staff_Shifts_${getLocalTodayDateString()}.pdf`,
      head,
      body,
      orientation: 'portrait',
      summaryBoxes: [
        { label: 'Total Shifts', value: String(todayStaffRecords.length) },
        { label: 'Currently On Duty', value: String(activeStaffSessions.length) },
        { label: 'Completed Shifts', value: String(todayStaffRecords.length - activeStaffSessions.length) }
      ]
    });
  };

  // Connect to local MFS100 WebSocket bridge agent
  const connectFingerprintBridge = (currentGymId: string, port: number) => {
    try {
      const ws = new WebSocket(`ws://localhost:${port}`);
      fpWsRef.current = ws;

      ws.onopen = () => {
        fpRetryCountRef.current = 0;
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
              setFpStatus(`Member Scan: ${matched.name}`);
              setTimeout(() => setFpStatus('Fingerprint scanner ready — place finger on sensor'), 30000);
            } else {
              const matchedStaff = await findStaffByFingerprint(currentGymId, data.fingerprintId);
              if (matchedStaff) {
                const staffRes = await toggleStaffCheckIn(matchedStaff.id);
                const isPunchIn = staffRes?.action === 'checkin';
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('staff_punch_event', {
                    detail: {
                      staffName: matchedStaff.name,
                      staffRole: matchedStaff.role || 'Staff',
                      action: staffRes?.action,
                      record: staffRes?.record,
                      durationMinutes: staffRes?.record?.durationMinutes
                    }
                  }));
                }
                setFpStatus(`Staff ${isPunchIn ? 'Punch IN' : 'Punch OUT'}: ${matchedStaff.name}`);
                await loadData();
                setTimeout(() => setFpStatus('Fingerprint scanner ready — place finger on sensor'), 30000);
              } else {
                setFpStatus('Fingerprint not registered. Try again or check profile.');
                setTimeout(() => setFpStatus('Fingerprint scanner ready — place finger on sensor'), 30000);
              }
            }
          }
        } catch (e) {
          console.error('FP message parse error', e);
        }
      };

      ws.onerror = () => {
        setFpConnected(false);
        setFpStatus('Cannot connect to fingerprint bridge. Is Python agent running?');
      };

      ws.onclose = () => {
        setFpConnected(false);
        fpWsRef.current = null;
        if (fpRetryCountRef.current < 3) {
          fpRetryCountRef.current += 1;
          setFpStatus(`Fingerprint agent offline. Retrying (${fpRetryCountRef.current}/3)...`);
          setTimeout(() => connectFingerprintBridge(currentGymId, port), 5000);
        } else {
          setFpStatus('Fingerprint bridge offline. Click Reconnect when ready.');
        }
      };
    } catch (e) {
      setFpConnected(false);
      setFpStatus('WebSocket unreachable.');
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
        } else {
          const matchedStaff = await findStaffByNFC(gymId, serialNumber);
          if (matchedStaff) {
            const staffRes = await toggleStaffCheckIn(matchedStaff.id);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('staff_punch_event', {
                detail: {
                  staffName: matchedStaff.name,
                  staffRole: matchedStaff.role || 'Staff',
                  action: staffRes?.action,
                  record: staffRes?.record,
                  durationMinutes: staffRes?.record?.durationMinutes
                }
              }));
            }
            await loadData();
          }
        }
      });
    } catch (err) {
      console.error('NFC Scan Error:', err);
      setIsScanning(false);
    }
  };

  // Shared member check-in logic
  const handleCheckInToggle = async (matched: any, currentGymId: string, isManual: boolean = false) => {
    try {
      const { record, action } = await toggleCheckIn(matched.id, isManual);
      await loadData();

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
    } catch (err: any) {
      alert(err?.message || 'Check-in failed');
    }
  };

  const handleManualCheckIn = async (customer: any) => {
    await handleCheckInToggle(customer, gymId, true);
  };

  const handleManualStaffPunch = async (staffId: string) => {
    setPunchLoading(staffId);
    try {
      const staffRes = await toggleStaffCheckIn(staffId, true); // isManual = true
      const staffObj = staffs.find(s => s.id === staffId);
      if (staffObj && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('staff_punch_event', {
          detail: {
            staffName: staffObj.name,
            staffRole: staffObj.role || 'Staff',
            action: staffRes?.action,
            record: staffRes?.record,
            durationMinutes: staffRes?.record?.durationMinutes
          }
        }));
      }
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Punch failed');
    } finally {
      setPunchLoading(null);
    }
  };

  // Monthly Average Hours Calculation for Members
  const avgDurationMap = useMemo(() => {
    const totalMinsMap = new Map<string, number>();
    const countsMap = new Map<string, number>();
    
    attendance.forEach(a => {
      if (a.durationMinutes) {
        totalMinsMap.set(a.customerId, (totalMinsMap.get(a.customerId) || 0) + a.durationMinutes);
        countsMap.set(a.customerId, (countsMap.get(a.customerId) || 0) + 1);
      }
    });

    const resultMap = new Map<string, number>();
    totalMinsMap.forEach((totalMins, custId) => {
      const count = countsMap.get(custId) || 1;
      const avg = (totalMins / 60) / count;
      resultMap.set(custId, parseFloat(avg.toFixed(1)));
    });
    
    return resultMap;
  }, [attendance]);

  const getAvg = (custId: string) => avgDurationMap.get(custId) || 1.2;

  const todayStr = getLocalTodayDateString();

  // MEMBER ATTENDANCE PROCESSING
  const todayMemberRecords = attendance.filter((a) => a.dateStr === todayStr);
  const activeMemberSessions = todayMemberRecords.filter(a => !a.checkOutTime);

  const uniqueTodayMemberRecords: any[] = [];
  const seenCustomerIds = new Set<string>();
  const sortedRawMemberRecords = [...todayMemberRecords].sort((a, b) => {
    if (!a.checkOutTime && b.checkOutTime) return -1;
    if (a.checkOutTime && !b.checkOutTime) return 1;
    return 0;
  });

  sortedRawMemberRecords.forEach(rec => {
    if (!seenCustomerIds.has(rec.customerId)) {
      seenCustomerIds.add(rec.customerId);
      uniqueTodayMemberRecords.push(rec);
    }
  });

  // STAFF ATTENDANCE PROCESSING
  const todayStaffRecords = staffAttendance.filter((a) => a.dateStr === todayStr);
  const activeStaffSessions = todayStaffRecords.filter(a => !a.checkOutTime);

  const uniqueTodayStaffRecords: any[] = [];
  const seenStaffIds = new Set<string>();
  const sortedRawStaffRecords = [...todayStaffRecords].sort((a, b) => {
    if (!a.checkOutTime && b.checkOutTime) return -1;
    if (a.checkOutTime && !b.checkOutTime) return 1;
    return 0;
  });

  sortedRawStaffRecords.forEach(rec => {
    if (!seenStaffIds.has(rec.staffId)) {
      seenStaffIds.add(rec.staffId);
      uniqueTodayStaffRecords.push(rec);
    }
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-950 text-xs font-bold mb-2">
            {attendanceMode === 'FINGERPRINT' ? <Fingerprint className="w-3.5 h-3.5 text-blue-900" /> : attendanceMode === 'MANUAL' ? <Search className="w-3.5 h-3.5 text-blue-900" /> : <Radio className="w-3.5 h-3.5 text-blue-900 animate-pulse" />}
            <span>{attendanceMode === 'MANUAL' ? 'Manual Check-in' : attendanceMode === 'FINGERPRINT' ? 'Fingerprint Terminal' : attendanceMode === 'BOTH' ? 'NFC + Fingerprint Terminal' : 'NFC Attendance Terminal'}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {activeTab === 'members' ? 'Active Members Monitor' : 'Active Staff & Trainers Monitor'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {activeTab === 'members' 
              ? "Real-time view of members currently working out in the gym."
              : "Real-time view of trainers & staff on duty with IN/OUT punches."}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* NFC Button */}
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

          {/* Fingerprint Status Badge */}
          {(attendanceMode === 'FINGERPRINT' || attendanceMode === 'BOTH') && (
            <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold border ${
              fpConnected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {fpConnected ? <Wifi className="w-4 h-4 shrink-0" /> : <WifiOff className="w-4 h-4 shrink-0" />}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold">{fpConnected ? 'Scanner Connected' : 'Scanner Offline'}</p>
                  {!fpConnected && (
                    <button
                      onClick={() => {
                        fpRetryCountRef.current = 0;
                        connectFingerprintBridge(gymId, fpPort);
                      }}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold transition-colors shadow-xs"
                    >
                      Reconnect
                    </button>
                  )}
                </div>
                <p className="text-[11px] opacity-80 truncate max-w-56">{fpStatus}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Segmented Tab Switcher (Members vs Staff) - Sleek & Compact */}
      <div className="flex bg-slate-100/90 p-1 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs gap-1 sm:gap-1.5">
        <button
          onClick={() => { setActiveTab('members'); setManualSearch(''); loadData(); }}
          className={`flex-1 py-1.5 px-2 sm:py-2.5 sm:px-4 rounded-lg sm:rounded-xl font-black text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'members'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white/60'
          }`}
        >
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Members Check-in</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-black shrink-0 ${activeTab === 'members' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'}`}>
            {activeMemberSessions.length} Active
          </span>
        </button>

        <button
          onClick={() => { setActiveTab('staff'); setManualSearch(''); loadData(); }}
          className={`flex-1 py-1.5 px-2 sm:py-2.5 sm:px-4 rounded-lg sm:rounded-xl font-black text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'staff'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white/60'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Staff &amp; Trainers</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-black shrink-0 ${activeTab === 'staff' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'}`}>
            {activeStaffSessions.length} On Duty
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 🏋️ MEMBERS CHECK-IN VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'members' && (
        <>
          {/* Manual Search Bar — shown in MANUAL mode */}
          {attendanceMode === 'MANUAL' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" /> Search &amp; Check-in Member
              </h3>
              <input
                value={manualSearch}
                onChange={e => setManualSearch(e.target.value)}
                placeholder="Type member name or phone..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-600 outline-none mb-3"
              />
              {manualSearch.trim() && (
                <div className="space-y-2 max-h-56 overflow-auto">
                  {(() => {
                    const filtered = customers.filter((c: any) => 
                      c.name.toLowerCase().includes(manualSearch.toLowerCase()) || 
                      c.phone.includes(manualSearch)
                    );
                    return (
                      <>
                        {filtered.map((c: any) => (
                          <button 
                            key={c.id} 
                            onClick={() => handleManualCheckIn(c)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl transition-colors text-left"
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-900">{c.name}</p>
                              <p className="text-xs text-slate-500 font-semibold">{c.planType} • {c.phone}</p>
                            </div>
                            <span className="text-xs font-bold text-blue-700 bg-blue-100 px-3 py-1.5 rounded-full">
                              Check-in / Out
                            </span>
                          </button>
                        ))}
                        {filtered.length === 0 && (
                          <p className="text-sm text-slate-400 text-center py-4">No member found matching "{manualSearch}"</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* SECTION: Member Attendance Cards */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="font-black text-slate-900 text-base mb-1 flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <span>Today's Member Attendance Status ({activeMemberSessions.length} Active in Gym)</span>
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Real-time check-in and check-out status of gym members today.
            </p>

            {uniqueTodayMemberRecords.length === 0 ? (
              <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center">
                <UserCheck className="w-8 h-8 mb-3 opacity-40 text-slate-500" />
                <p className="font-bold text-slate-600 text-sm">No member attendance logged today</p>
                <p className="text-xs mt-1">Waiting for NFC hardware taps or manual check-ins...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {uniqueTodayMemberRecords.map(session => {
                  const customer = customers.find(c => c.id === session.customerId);
                  const avgHours = getAvg(session.customerId);
                  const isActive = !session.checkOutTime;
                  const checkInDate = new Date(session.checkInTime);
                  const elapsedMinutes = Math.floor((Date.now() - checkInDate.getTime()) / 60000);
                    
                  return (
                    <div key={session.id} className={`p-4 rounded-2xl border relative overflow-hidden transition-all hover:shadow-md ${
                      isActive 
                        ? 'border-blue-300 bg-gradient-to-br from-blue-50/70 via-white to-emerald-50/30 shadow-sm' 
                        : 'border-slate-200 bg-slate-50/50 opacity-80'
                    }`}>
                      <div className={`absolute top-0 right-0 text-[10px] font-black px-2.5 py-1 rounded-bl-xl shadow-xs flex items-center gap-1 ${
                        isActive 
                          ? 'bg-emerald-600 text-white animate-pulse' 
                          : 'bg-slate-400 text-white'
                      }`}>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
                        <span>{isActive ? `IN GYM (${elapsedMinutes}m)` : 'COMPLETED'}</span>
                      </div>
                      
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm border ${
                          isActive 
                            ? 'bg-blue-900 text-white border-blue-900 shadow-sm' 
                            : 'bg-slate-200 text-slate-600 border-slate-300'
                        }`}>
                          {session.customerName.charAt(0)}
                        </div>
                        <div className="min-w-0 pr-12">
                          <div className="font-bold text-slate-900 text-sm leading-tight truncate">{session.customerName}</div>
                          <div className="text-[10px] font-mono text-slate-500">{session.customerPhone}</div>
                        </div>
                      </div>
                      
                      <div className={`space-y-1.5 text-xs text-slate-600 mt-4 border-t pt-3 ${
                        isActive ? 'border-blue-100' : 'border-slate-200'
                      }`}>
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-400">Check-In:</span>
                          <span className="font-bold text-slate-800">{checkInDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true})}</span>
                        </div>
                        {!isActive && (
                          <div className="flex justify-between">
                            <span className="font-semibold text-slate-400">Check-Out:</span>
                            <span className="font-bold text-slate-800">{new Date(session.checkOutTime!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true})}</span>
                          </div>
                        )}
                        {customer && (
                          <div className="flex justify-between">
                            <span className="font-semibold text-slate-400">NFC Card:</span>
                            <span className="font-mono font-bold text-slate-800">{customer.nfcCardId || 'N/A'}</span>
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

          {/* SECTION: Today's Detailed Member Attendance Log */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/50">
              <div>
                <h3 className="font-black text-slate-900 text-base flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Today's Member Visit Log ({todayMemberRecords.length})</span>
                </h3>
                <p className="text-xs text-slate-500">Live list of today's member check-ins with workout durations.</p>
              </div>

              {/* Dual Export Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportMemberVisitsCSV}
                  disabled={todayMemberRecords.length === 0}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={exportMemberVisitsPDF}
                  disabled={todayMemberRecords.length === 0}
                  className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 text-blue-900 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>PDF</span>
                </button>
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
                    <th className="py-3 px-4 text-center">Monthly Avg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                  {todayMemberRecords.length > 0 ? (
                    todayMemberRecords.map((rec) => {
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
        </>
      )}

      {/* ========================================================================= */}
      {/* 👔 STAFF / TRAINERS CHECK-IN VIEW (DESIGN MATCHED EXACTLY LIKE MEMBERS) */}
      {/* ========================================================================= */}
      {activeTab === 'staff' && (
        <>
          {/* Manual Search Bar for Staff */}
          {attendanceMode === 'MANUAL' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" /> Search &amp; Punch Staff Shift
              </h3>
              <input
                value={manualSearch}
                onChange={e => setManualSearch(e.target.value)}
                placeholder="Type trainer or staff name..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-600 outline-none mb-3"
              />
              {manualSearch.trim() && (
                <div className="space-y-2 max-h-56 overflow-auto">
                  {(() => {
                    const filtered = staffs.filter((s: any) => 
                      s.name.toLowerCase().includes(manualSearch.toLowerCase()) || 
                      s.phone.includes(manualSearch) ||
                      (s.role && s.role.toLowerCase().includes(manualSearch.toLowerCase()))
                    );
                    return (
                      <>
                        {filtered.map((s: any) => {
                          const isStaffActive = activeStaffSessions.some(a => a.staffId === s.id);
                          return (
                            <button 
                              key={s.id} 
                              onClick={() => handleManualStaffPunch(s.id)}
                              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl transition-colors text-left"
                            >
                              <div>
                                <p className="text-sm font-bold text-slate-900">{s.name}</p>
                                <p className="text-xs text-slate-500 font-semibold">{s.role} • {s.phone}</p>
                              </div>
                              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                                isStaffActive 
                                  ? 'bg-rose-100 text-rose-800 hover:bg-rose-200' 
                                  : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              }`}>
                                {isStaffActive ? 'Punch OUT' : 'Punch IN'}
                              </span>
                            </button>
                          );
                        })}
                        {filtered.length === 0 && (
                          <p className="text-sm text-slate-400 text-center py-4">No staff member found matching "{manualSearch}"</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* SECTION: Staff Attendance Cards (Same design as members) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="font-black text-slate-900 text-base mb-1 flex items-center space-x-2">
              <Briefcase className="w-5 h-5 text-blue-600" />
              <span>Today's Staff Shift Status ({activeStaffSessions.length} On Duty)</span>
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Real-time shift tracking and IN/OUT punch cards for trainers and gym employees.
            </p>

            {uniqueTodayStaffRecords.length === 0 ? (
              <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center">
                <Briefcase className="w-8 h-8 mb-3 opacity-40 text-slate-500" />
                <p className="font-bold text-slate-600 text-sm">No staff punches logged today</p>
                <p className="text-xs mt-1">Scan employee NFC badge, tap fingerprint sensor, or use quick punch...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {uniqueTodayStaffRecords.map(session => {
                  const staffObj = staffs.find(s => s.id === session.staffId);
                  const isActive = !session.checkOutTime;
                  const checkInDate = new Date(session.checkInTime);
                  const elapsedMinutes = Math.floor((Date.now() - checkInDate.getTime()) / 60000);
                  const isPunching = punchLoading === session.staffId;

                  return (
                    <div key={session.id} className={`p-4 rounded-2xl border relative overflow-hidden transition-all hover:shadow-md ${
                      isActive 
                        ? 'border-purple-300 bg-gradient-to-br from-purple-50/70 via-white to-emerald-50/30 shadow-sm' 
                        : 'border-slate-200 bg-slate-50/50 opacity-80'
                    }`}>
                      <div className={`absolute top-0 right-0 text-[10px] font-black px-2.5 py-1 rounded-bl-xl shadow-xs flex items-center gap-1 ${
                        isActive 
                          ? 'bg-emerald-600 text-white animate-pulse' 
                          : 'bg-slate-400 text-white'
                      }`}>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
                        <span>{isActive ? `ON DUTY (${elapsedMinutes}m)` : 'COMPLETED'}</span>
                      </div>
                      
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm border ${
                          isActive 
                            ? 'bg-purple-900 text-white border-purple-900 shadow-sm' 
                            : 'bg-slate-200 text-slate-600 border-slate-300'
                        }`}>
                          {session.staffName.charAt(0)}
                        </div>
                        <div className="min-w-0 pr-12">
                          <div className="font-bold text-slate-900 text-sm leading-tight truncate">{session.staffName}</div>
                          <div className="text-[10px] font-mono text-slate-500 font-semibold">{staffObj?.role || 'Staff'} • {session.staffPhone}</div>
                        </div>
                      </div>
                      
                      <div className={`space-y-1.5 text-xs text-slate-600 mt-4 border-t pt-3 ${
                        isActive ? 'border-purple-100' : 'border-slate-200'
                      }`}>
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-400">Punch IN:</span>
                          <span className="font-bold text-slate-800">{checkInDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true})}</span>
                        </div>
                        {!isActive && (
                          <div className="flex justify-between">
                            <span className="font-semibold text-slate-400">Punch OUT:</span>
                            <span className="font-bold text-slate-800">{new Date(session.checkOutTime!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true})}</span>
                          </div>
                        )}
                        {staffObj && (
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-slate-400">Hardware ID:</span>
                            <span className="font-mono font-bold text-slate-800 text-[11px]">
                              {staffObj.nfcCardId ? `NFC: ${staffObj.nfcCardId}` : staffObj.fingerprintId ? `FP: #${staffObj.fingerprintId}` : 'Manual'}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2 mt-1 border-t border-slate-100 border-dashed">
                          <span className="font-semibold text-slate-400">Shift Total:</span>
                          <span className="font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            {session.durationMinutes ? `${Math.floor(session.durationMinutes / 60)}h ${session.durationMinutes % 60}m` : 'In Progress'}
                          </span>
                        </div>

                        {/* Manual Punch Button only when attendanceMode is MANUAL */}
                        {attendanceMode === 'MANUAL' && (
                          <div className="pt-2">
                            <button
                              onClick={() => handleManualStaffPunch(session.staffId)}
                              disabled={isPunching}
                              className={`w-full py-1.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                                isActive 
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                            >
                              {isPunching ? (
                                <span className="animate-spin text-xs">⌛</span>
                              ) : isActive ? (
                                <><LogOut className="w-3.5 h-3.5" /> Punch OUT</>
                              ) : (
                                <><LogIn className="w-3.5 h-3.5" /> Punch IN</>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION: Today's Detailed Staff Shift Log Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/50">
              <div>
                <h3 className="font-black text-slate-900 text-base flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Today's Staff Shift Log ({todayStaffRecords.length})</span>
                </h3>
                <p className="text-xs text-slate-500">Live list of staff check-in and check-out punches with shift hours.</p>
              </div>

              {/* Dual Export Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportTodayStaffShiftsCSV}
                  disabled={todayStaffRecords.length === 0}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={exportTodayStaffShiftsPDF}
                  disabled={todayStaffRecords.length === 0}
                  className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 text-blue-900 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Role &amp; Phone</th>
                    <th className="py-3 px-4">Punch IN Time</th>
                    <th className="py-3 px-4">Punch OUT Time</th>
                    <th className="py-3 px-4 text-center">Shift Duration</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                  {todayStaffRecords.length > 0 ? (
                    todayStaffRecords.map((rec) => {
                      const staffObj = staffs.find(s => s.id === rec.staffId);
                      return (
                        <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-950 text-xs flex items-center justify-center font-bold">
                              {rec.staffName.charAt(0)}
                            </div>
                            <span>{rec.staffName}</span>
                          </td>

                          <td className="py-3 px-4 text-slate-600">
                            <div className="font-semibold text-slate-800">{staffObj?.role || 'Staff'}</div>
                            <div className="font-mono text-[11px] text-slate-400">{rec.staffPhone}</div>
                          </td>

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
                                ● On Duty Now
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center font-bold text-slate-700">
                            {rec.durationMinutes ? `${Math.floor(rec.durationMinutes / 60)}h ${rec.durationMinutes % 60}m` : 'In Progress'}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-1 font-bold rounded-lg text-xs border ${
                              rec.checkOutTime 
                                ? 'bg-slate-100 text-slate-600 border-slate-200' 
                                : 'bg-emerald-100 text-emerald-800 border-emerald-200 animate-pulse'
                            }`}>
                              {rec.checkOutTime ? 'Completed' : 'On Duty'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        No staff punches logged for today yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
