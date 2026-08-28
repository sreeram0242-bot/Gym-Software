'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserPlus, Download, Trash2, Search, Briefcase, LogIn, LogOut, Clock, 
  UserCheck, Calendar, Filter, Edit, Radio, Fingerprint, Phone, CheckCircle, 
  AlertCircle, ChevronRight, X, Sparkles, Shield, Users
} from 'lucide-react';
import { getStaffs, getStaffAttendance, addStaff, updateStaff, deleteStaff, toggleStaffCheckIn } from '@/lib/actions';
import { exportToCSV, formatDateDDMMYYYY, getLocalTodayDateString } from '@/lib/utils';

export default function StaffPage() {
  const [gymId, setGymId] = useState<string>('gym_1');
  const [staffs, setStaffs] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  
  // Modal State for Add / Edit Staff
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [isEditingStaff, setIsEditingStaff] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  
  const [staffName, setStaffName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffRole, setStaffRole] = useState('Trainer');
  const [punchMethod, setPunchMethod] = useState<'BOTH' | 'NFC' | 'FINGERPRINT' | 'MANUAL'>('BOTH');
  const [nfcCardId, setNfcCardId] = useState('');
  const [fingerprintId, setFingerprintId] = useState('');
  const [joinedDate, setJoinedDate] = useState(getLocalTodayDateString());
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Search & Filters State
  const [search, setSearch] = useState('');
  const [staffFilter, setStaffFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [punchLoading, setPunchLoading] = useState<string | null>(null);

  const loadData = async () => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || 'gym_1' : 'gym_1';
    setGymId(savedId);
    
    try {
      const [s, a] = await Promise.all([
        getStaffs(savedId),
        getStaffAttendance(savedId)
      ]);
      setStaffs(s || []);
      setAttendance(a || []);
    } catch (e) {
      console.error('Error loading staff data:', e);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('attendance_updated', handleUpdate);
    return () => window.removeEventListener('attendance_updated', handleUpdate);
  }, []);

  const openAddModal = () => {
    setIsEditingStaff(false);
    setEditingStaffId(null);
    setStaffName('');
    setStaffPhone('');
    setStaffRole('Trainer');
    setPunchMethod('BOTH');
    setNfcCardId('');
    setFingerprintId('');
    setJoinedDate(getLocalTodayDateString());
    setModalError(null);
    setShowStaffModal(true);
  };

  const openEditModal = (staff: any) => {
    setIsEditingStaff(true);
    setEditingStaffId(staff.id);
    setStaffName(staff.name || '');
    setStaffPhone(staff.phone || '');
    setStaffRole(staff.role || 'Trainer');
    
    if (staff.nfcCardId && staff.fingerprintId) setPunchMethod('BOTH');
    else if (staff.nfcCardId) setPunchMethod('NFC');
    else if (staff.fingerprintId) setPunchMethod('FINGERPRINT');
    else setPunchMethod('MANUAL');

    setNfcCardId(staff.nfcCardId || '');
    setFingerprintId(staff.fingerprintId || '');
    setJoinedDate(staff.joinedDate || getLocalTodayDateString());
    setModalError(null);
    setShowStaffModal(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = staffName.trim();
    const cleanPhone = staffPhone.trim();
    const cleanNfc = nfcCardId.trim();
    const cleanFp = fingerprintId.trim();

    if (!cleanName) {
      setModalError('Please enter the employee full name.');
      return;
    }
    if (!cleanPhone) {
      setModalError('Please enter the employee contact phone number.');
      return;
    }

    // 1. Check duplicate phone
    const dupPhone = staffs.find(s => s.phone === cleanPhone && s.id !== editingStaffId);
    if (dupPhone) {
      setModalError(`Phone number "${cleanPhone}" is already assigned to staff: ${dupPhone.name} (${dupPhone.role}).`);
      return;
    }

    // 2. Check duplicate NFC Card ID
    if (cleanNfc) {
      const dupNfc = staffs.find(s => s.nfcCardId && s.nfcCardId.toLowerCase() === cleanNfc.toLowerCase() && s.id !== editingStaffId);
      if (dupNfc) {
        setModalError(`NFC Card ID "${cleanNfc}" is already assigned to staff: ${dupNfc.name}.`);
        return;
      }
    }

    // 3. Check duplicate Fingerprint ID
    if (cleanFp) {
      const dupFp = staffs.find(s => s.fingerprintId && s.fingerprintId.toLowerCase() === cleanFp.toLowerCase() && s.id !== editingStaffId);
      if (dupFp) {
        setModalError(`Fingerprint ID "${cleanFp}" is already assigned to staff: ${dupFp.name}.`);
        return;
      }
    }

    setIsSaving(true);
    setModalError(null);

    try {
      const payload = {
        gymId,
        name: cleanName,
        phone: cleanPhone,
        role: staffRole.trim() || 'Trainer',
        nfcCardId: cleanNfc || null,
        fingerprintId: cleanFp || null,
        joinedDate: joinedDate || getLocalTodayDateString(),
        status: 'active'
      };

      if (isEditingStaff && editingStaffId) {
        await updateStaff(editingStaffId, payload);
      } else {
        await addStaff(payload);
      }

      setShowStaffModal(false);
      await loadData();
    } catch (err: any) {
      console.error('Error saving staff:', err);
      setModalError(err?.message || 'Failed to save staff member. Please check details and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualPunch = async (staffId: string) => {
    setPunchLoading(staffId);
    try {
      const staffRes = await toggleStaffCheckIn(staffId);
      const staffObj = staffs.find(s => s.id === staffId);
      if (staffObj && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('staff_punch_event', {
          detail: {
            staffName: staffObj.name,
            staffRole: staffObj.role,
            action: staffRes?.action,
            record: staffRes?.record,
            durationMinutes: staffRes?.record?.durationMinutes
          }
        }));
      }
      await loadData();
    } catch (err) {
      console.error('Punch error:', err);
    } finally {
      setPunchLoading(null);
    }
  };

  const isStaffActiveToday = (staffId: string) => {
    return attendance.some(a => a.staffId === staffId && !a.checkOutTime);
  };

  const exportStaffInfo = () => {
    const exportData = staffs.map(s => ({
      ID: s.id,
      Name: s.name,
      Phone: s.phone,
      Role: s.role,
      Joined_Date: s.joinedDate,
      NFC_Tag_ID: s.nfcCardId || 'Not Assigned',
      Fingerprint_ID: s.fingerprintId || 'Not Assigned',
      Status: s.status || 'Active'
    }));
    exportToCSV(exportData, `Gym_Staff_List_${getLocalTodayDateString()}.csv`);
  };

  const filteredAttendance = useMemo(() => {
    const today = getLocalTodayDateString();
    const now = new Date();

    return attendance.filter(record => {
      // 1. Filter by Staff
      if (staffFilter !== 'ALL' && record.staffId !== staffFilter) return false;

      // 2. Filter by Date
      if (dateFilter === 'TODAY' && record.dateStr !== today) return false;
      
      if (dateFilter === 'THIS_WEEK') {
        const startOfWeek = new Date(now);
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        const recordDate = new Date(record.dateStr);
        if (recordDate < startOfWeek) return false;
      }
      
      if (dateFilter === 'THIS_MONTH') {
        const recordDate = new Date(record.dateStr);
        if (recordDate.getMonth() !== now.getMonth() || recordDate.getFullYear() !== now.getFullYear()) return false;
      }

      if (dateFilter === 'CUSTOM') {
        if (customFrom && record.dateStr < customFrom) return false;
        if (customTo && record.dateStr > customTo) return false;
      }

      return true;
    });
  }, [attendance, staffFilter, dateFilter, customFrom, customTo]);

  const exportAttendanceReport = () => {
    const exportData = filteredAttendance.map(a => ({
      Date: a.dateStr,
      Staff_Name: a.staffName,
      Phone: a.staffPhone,
      Punch_In_Time: new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      Punch_Out_Time: a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active (Currently In)',
      Duration_Minutes: a.durationMinutes || (a.checkOutTime ? 0 : 'In Progress'),
      Duration_Formatted: a.durationMinutes ? `${Math.floor(a.durationMinutes / 60)}h ${a.durationMinutes % 60}m` : 'In Progress'
    }));

    const filename = staffFilter !== 'ALL' 
      ? `Staff_Attendance_${staffs.find(s => s.id === staffFilter)?.name || 'Member'}_${dateFilter}.csv`
      : `Staff_Attendance_Report_${dateFilter}_${getLocalTodayDateString()}.csv`;

    exportToCSV(exportData, filename);
  };

  const exportIndividualAttendance = (staffId: string, staffName: string) => {
    const records = filteredAttendance.filter(a => a.staffId === staffId);

    const exportData = records.map(a => ({
      Date: a.dateStr,
      Staff_Name: a.staffName,
      Punch_In: new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      Punch_Out: a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active (Currently In)',
      Duration: a.durationMinutes ? `${Math.floor(a.durationMinutes / 60)}h ${a.durationMinutes % 60}m` : 'In Progress'
    }));
    exportToCSV(exportData, `${staffName.replace(/\s+/g, '_')}_Attendance_${dateFilter}.csv`);
  };

  const filteredStaffs = staffs.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.phone.includes(search) ||
    (s.role && s.role.toLowerCase().includes(search.toLowerCase())) ||
    (s.nfcCardId && s.nfcCardId.toLowerCase().includes(search.toLowerCase())) ||
    (s.fingerprintId && s.fingerprintId.toLowerCase().includes(search.toLowerCase()))
  );

  // Statistics
  const activeStaffCount = useMemo(() => {
    const today = getLocalTodayDateString();
    return attendance.filter(a => a.dateStr === today && !a.checkOutTime).length;
  }, [attendance]);

  const todayPunchesCount = useMemo(() => {
    const today = getLocalTodayDateString();
    return attendance.filter(a => a.dateStr === today).length;
  }, [attendance]);

  const avgShiftHours = useMemo(() => {
    const completed = attendance.filter(a => a.durationMinutes && a.durationMinutes > 0);
    if (completed.length === 0) return '0.0';
    const totalMinutes = completed.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
    return (totalMinutes / 60 / completed.length).toFixed(1);
  }, [attendance]);

  // Today's Unique Staff Attendance Cards (Same design as members)
  const todayStr = getLocalTodayDateString();
  const todayStaffRecords = attendance.filter((a) => a.dateStr === todayStr);
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
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-1.5">
            <Shield className="w-3.5 h-3.5" /> Staff Attendance &amp; Hardware Punch
          </div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-blue-600" /> Employee &amp; Attendance Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage trainers, receptionists, configure NFC &amp; Biometric Fingerprint IDs, and monitor live IN/OUT punches.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button onClick={exportStaffInfo} className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-xs border border-slate-200">
            <Download className="w-4 h-4" /> Export Staff Directory
          </button>
          <button onClick={openAddModal} className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-xs shadow-sm">
            <UserPlus className="w-4 h-4" /> + Add New Employee
          </button>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Total Staff</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{staffs.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Trainers &amp; Employees</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">On Duty Right Now</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 flex items-center gap-2">
            {activeStaffCount}
            {activeStaffCount > 0 && <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full animate-pulse">● LIVE</span>}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Currently inside the gym</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Today's Shifts</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <LogIn className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{todayPunchesCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Punches logged today</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Avg Shift Duration</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{avgShiftHours} <span className="text-sm font-semibold text-slate-400">hrs</span></p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Per completed shift</p>
        </div>
      </div>

      {/* SECTION: Today's Active Staff Shift Cards (Exact same design as member cards) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="font-black text-slate-900 text-base mb-1 flex items-center space-x-2">
          <Briefcase className="w-5 h-5 text-blue-600" />
          <span>Today's Staff Shift Status ({activeStaffSessions.length} On Duty)</span>
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          Real-time check-in and check-out status of gym trainers and staff today.
        </p>

        {uniqueTodayStaffRecords.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center">
            <Briefcase className="w-8 h-8 mb-2 opacity-40 text-slate-500" />
            <p className="font-bold text-slate-600 text-sm">No staff punches logged today</p>
            <p className="text-xs mt-0.5 text-slate-400">Scan employee NFC badge, tap fingerprint sensor, or use quick punch below.</p>
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

                    {/* Quick Punch Button on card */}
                    <div className="pt-2">
                      <button
                        onClick={() => handleManualPunch(session.staffId)}
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Staff Directory */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search staff, phone, NFC or FP ID..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none shadow-sm"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="font-black text-slate-800 text-sm flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600" /> Team Members ({filteredStaffs.length})
              </h2>
              <span className="text-[11px] text-slate-500 font-bold">Quick IN/OUT Punch</span>
            </div>
            
            <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto custom-scrollbar">
              {filteredStaffs.map(staff => {
                const isActive = isStaffActiveToday(staff.id);
                const isPunching = punchLoading === staff.id;

                return (
                  <div key={staff.id} className="p-4 hover:bg-slate-50 flex justify-between items-start group transition-colors">
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-900 font-extrabold text-xs flex items-center justify-center flex-shrink-0">
                          {staff.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-slate-900 text-sm truncate">{staff.name}</h3>
                            {isActive ? (
                              <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full flex-shrink-0 animate-pulse">
                                ● ON DUTY
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded-full flex-shrink-0">
                                ○ OFF
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-semibold">{staff.role} • {staff.phone}</p>
                        </div>
                      </div>

                      {/* Punch Hardware Badges */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5 pl-10">
                        {staff.nfcCardId ? (
                          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-mono font-bold flex items-center gap-1">
                            <Radio className="w-2.5 h-2.5 text-blue-600" /> NFC: {staff.nfcCardId}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-mono">No NFC</span>
                        )}

                        {staff.fingerprintId ? (
                          <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-mono font-bold flex items-center gap-1">
                            <Fingerprint className="w-2.5 h-2.5 text-purple-600" /> FP: #{staff.fingerprintId}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-mono">No FP</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pt-0.5">
                      {/* Manual Quick Punch IN / OUT Button */}
                      <button
                        onClick={() => handleManualPunch(staff.id)}
                        disabled={isPunching}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm ${
                          isActive 
                            ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                        title={isActive ? 'Punch OUT (End Shift)' : 'Punch IN (Start Shift)'}
                      >
                        {isPunching ? (
                          <span className="animate-spin text-xs">⌛</span>
                        ) : isActive ? (
                          <><LogOut className="w-3.5 h-3.5" /> Punch OUT</>
                        ) : (
                          <><LogIn className="w-3.5 h-3.5" /> Punch IN</>
                        )}
                      </button>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditModal(staff)} className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg" title="Edit Staff Details & Hardware IDs">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => exportIndividualAttendance(staff.id, staff.name)} className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg" title="Download Employee Attendance Log CSV">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={async () => { if(confirm(`Are you sure you want to remove ${staff.name}?`)) { await deleteStaff(staff.id); loadData(); } }} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg" title="Delete Staff Member">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredStaffs.length === 0 && (
                <div className="p-10 text-center text-slate-400 text-xs">
                  <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-600">No staff members found.</p>
                  <p className="text-[11px] mt-1 text-slate-400">Click "+ Add New Employee" above to register your team.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Attendance Logs & Filtering */}
        <div className="lg:col-span-2 space-y-4">
          {/* Comprehensive Filter Toolbar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-blue-600" /> Filter By:
                </span>
                
                {/* Staff Select */}
                <select
                  value={staffFilter}
                  onChange={(e) => setStaffFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="ALL">👥 All Staff Members</option>
                  {staffs.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>

                {/* Date Quick Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  {(['ALL', 'TODAY', 'THIS_WEEK', 'THIS_MONTH', 'CUSTOM'] as const).map(df => (
                    <button
                      key={df}
                      onClick={() => setDateFilter(df)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        dateFilter === df 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {df === 'ALL' ? 'All Time' : df === 'TODAY' ? 'Today' : df === 'THIS_WEEK' ? 'This Week' : df === 'THIS_MONTH' ? 'This Month' : 'Custom Dates'}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={exportAttendanceReport} 
                className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 px-3.5 py-2 rounded-xl border border-blue-200 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> Export Logs ({filteredAttendance.length})
              </button>
            </div>

            {/* Custom Date Range Pickers (shown when dateFilter === 'CUSTOM') */}
            {dateFilter === 'CUSTOM' && (
              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 bg-slate-50/70 p-3 rounded-xl">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-600">From Date:</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-600">To Date:</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                {(customFrom || customTo) && (
                  <button onClick={() => { setCustomFrom(''); setCustomTo(''); }} className="text-xs text-rose-600 font-bold hover:underline">
                    Clear Range
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Attendance Log Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="font-black text-slate-800 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" /> Attendance Punches ({filteredAttendance.length} Records)
              </h2>
              <span className="text-xs text-slate-500 font-semibold">Real-time NFC &amp; Biometric Log</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="p-3.5 font-bold">Date</th>
                    <th className="p-3.5 font-bold">Staff Member</th>
                    <th className="p-3.5 font-bold">Punch IN</th>
                    <th className="p-3.5 font-bold">Punch OUT</th>
                    <th className="p-3.5 font-bold">Shift Duration</th>
                    <th className="p-3.5 font-bold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredAttendance.map((record) => {
                    const durationText = record.durationMinutes 
                      ? `${Math.floor(record.durationMinutes / 60)}h ${record.durationMinutes % 60}m` 
                      : (record.checkOutTime ? '0 min' : 'In Progress');

                    return (
                      <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 whitespace-nowrap text-slate-600 font-semibold font-mono">
                          {formatDateDDMMYYYY(record.dateStr)}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{record.staffName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{record.staffPhone}</div>
                        </td>
                        <td className="p-3.5 text-emerald-700 font-bold">
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
                            <LogIn className="w-3 h-3" />
                            {new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-700 font-medium">
                          {record.checkOutTime ? (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200 font-bold">
                              <LogOut className="w-3 h-3" />
                              {new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 animate-pulse inline-flex items-center gap-1">
                              ● ACTIVE (ON DUTY)
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-700 font-mono font-bold">
                          {durationText}
                        </td>
                        <td className="p-3.5 text-right">
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${record.checkOutTime ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse'}`}>
                            {record.checkOutTime ? 'Completed' : 'Working Now'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAttendance.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400 text-xs font-medium">
                        <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        No attendance punch logs found for the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Staff Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                {isEditingStaff ? <Edit className="w-5 h-5 text-blue-600" /> : <UserPlus className="w-5 h-5 text-blue-600" />}
                <span>{isEditingStaff ? 'Edit Staff & Attendance IDs' : 'Register New Employee'}</span>
              </h3>
              <button onClick={() => setShowStaffModal(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="p-6 space-y-4 text-xs">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                  <input 
                    required 
                    type="text" 
                    value={staffName}
                    onChange={e => setStaffName(e.target.value)}
                    placeholder="e.g. Vikramaditya" 
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-xs font-bold text-slate-800" 
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Phone Number *</label>
                  <input 
                    required 
                    type="text" 
                    value={staffPhone}
                    onChange={e => setStaffPhone(e.target.value)}
                    placeholder="9876543210" 
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-xs font-bold text-slate-800" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Role / Designation</label>
                  <select
                    value={staffRole}
                    onChange={e => setStaffRole(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-xs font-bold text-slate-800 bg-white"
                  >
                    <option value="Trainer">🏋️‍♂️ Fitness Trainer</option>
                    <option value="Head Trainer">🥇 Head Coach / Trainer</option>
                    <option value="Personal Trainer">⭐ Personal Trainer</option>
                    <option value="Receptionist">💻 Receptionist / Front Desk</option>
                    <option value="Gym Manager">👔 Gym Manager</option>
                    <option value="Housekeeping">🧹 Housekeeping / Maintenance</option>
                    <option value="Other">💼 Other Staff</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Date Joined</label>
                  <input 
                    type="date"
                    value={joinedDate}
                    onChange={e => setJoinedDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-xs font-bold text-slate-800 bg-white"
                  />
                </div>
              </div>

              {/* Hardware Punch Method Setup */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Attendance Punch Method</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['BOTH', 'NFC', 'FINGERPRINT', 'MANUAL'] as const).map(method => (
                      <button
                        type="button"
                        key={method}
                        onClick={() => setPunchMethod(method)}
                        className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-colors flex items-center justify-center gap-1 ${
                          punchMethod === method 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {method === 'BOTH' ? 'NFC + FP' : method}
                      </button>
                    ))}
                  </div>
                </div>

                {(punchMethod === 'NFC' || punchMethod === 'BOTH') && (
                  <div className="bg-blue-50/60 border border-blue-100 p-3 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block font-bold text-blue-900 uppercase">NFC Card ID (Employee Badge)</label>
                      <button
                        type="button"
                        onClick={() => setNfcCardId(`STAFF-NFC-${Math.floor(1000 + Math.random() * 9000)}`)}
                        className="text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        Generate Random Tag ID
                      </button>
                    </div>
                    <div className="relative">
                      <Radio className="absolute left-3 top-2.5 w-3.5 h-3.5 text-blue-600" />
                      <input 
                        type="text" 
                        value={nfcCardId}
                        onChange={e => setNfcCardId(e.target.value)}
                        placeholder="Scan card on USB reader or type badge ID..." 
                        className="w-full pl-9 pr-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-xs font-mono font-bold bg-white" 
                      />
                    </div>
                  </div>
                )}

                {(punchMethod === 'FINGERPRINT' || punchMethod === 'BOTH') && (
                  <div className="bg-purple-50/60 border border-purple-100 p-3 rounded-xl space-y-1.5">
                    <label className="block font-bold text-purple-900 uppercase">Fingerprint Machine ID</label>
                    <div className="relative">
                      <Fingerprint className="absolute left-3 top-2.5 w-3.5 h-3.5 text-purple-600" />
                      <input 
                        type="text" 
                        value={fingerprintId}
                        onChange={e => setFingerprintId(e.target.value)}
                        placeholder="Biometric terminal User ID (e.g. 101, 102)" 
                        className="w-full pl-9 pr-3 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none text-xs font-mono font-bold bg-white" 
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowStaffModal(false)} 
                  className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <span className="animate-spin">⌛</span> : <CheckCircle className="w-4 h-4" />}
                  <span>{isEditingStaff ? 'Update Staff Member' : 'Save & Register Staff'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
