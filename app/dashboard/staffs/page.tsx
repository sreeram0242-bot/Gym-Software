'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserPlus, Download, Trash2, Search, Briefcase, LogIn, LogOut, Clock, 
  UserCheck, Calendar, Filter, Edit, Radio, Fingerprint, Phone, CheckCircle, 
  AlertCircle, ChevronRight, X, Sparkles, Shield, Users, FileText, FileSpreadsheet
} from 'lucide-react';
import { getStaffs, getStaffAttendance, addStaff, updateStaff, deleteStaff, toggleStaffCheckIn, getGymSettings, getGyms } from '@/lib/actions';
import { exportToCSV, formatDateDDMMYYYY, getLocalTodayDateString } from '@/lib/utils';
import { exportToPDF } from '@/lib/exportPdf';

export default function StaffPage() {
  const [gymId, setGymId] = useState<string>('gym_1');
  const [gymName, setGymName] = useState<string>('Our Gym');
  const [staffs, setStaffs] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [attendanceMode, setAttendanceMode] = useState<string>('NFC');
  
  // Subpage Tab Switcher: 'directory' (Team & Live Shifts) vs 'attendance' (Attendance Logs)
  const [staffSubTab, setStaffSubTab] = useState<'directory' | 'attendance'>('directory');

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

  // Individual Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTargetStaff, setExportTargetStaff] = useState<any>(null);

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
      const [s, a, settings, loadedGyms] = await Promise.all([
        getStaffs(savedId),
        getStaffAttendance(savedId),
        getGymSettings(savedId),
        getGyms()
      ]);
      setStaffs(s || []);
      setAttendance(a || []);
      setAttendanceMode(settings?.attendanceMode || 'NFC');
      const matchedGym = loadedGyms?.find((g: any) => g.id === savedId);
      if (matchedGym) setGymName(matchedGym.name);
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
    setPunchMethod(attendanceMode === 'MANUAL' ? 'MANUAL' : attendanceMode === 'FINGERPRINT' ? 'FINGERPRINT' : attendanceMode === 'NFC' ? 'NFC' : 'BOTH');
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

  // Filtered Attendance Calculation
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

      // 3. Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = record.staffName?.toLowerCase().includes(q);
        const matchPhone = record.staffPhone?.includes(q);
        const staffObj = staffs.find(s => s.id === record.staffId);
        const matchRole = staffObj?.role?.toLowerCase().includes(q);
        const matchNfc = staffObj?.nfcCardId?.toLowerCase().includes(q);
        const matchFp = staffObj?.fingerprintId?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchRole && !matchNfc && !matchFp) return false;
      }

      return true;
    });
  }, [attendance, staffFilter, dateFilter, customFrom, customTo, search, staffs]);

  // Filtered Staffs List for Directory
  const filteredStaffs = useMemo(() => {
    return staffs.filter(staff => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        staff.name?.toLowerCase().includes(q) ||
        staff.phone?.includes(q) ||
        staff.role?.toLowerCase().includes(q) ||
        staff.nfcCardId?.toLowerCase().includes(q) ||
        staff.fingerprintId?.toLowerCase().includes(q)
      );
    });
  }, [staffs, search]);

  // Today's staff records
  const todayStr = getLocalTodayDateString();
  const todayStaffRecords = useMemo(() => {
    return attendance.filter(a => a.dateStr === todayStr);
  }, [attendance, todayStr]);

  const uniqueTodayStaffRecords = useMemo(() => {
    const map = new Map<string, any>();
    todayStaffRecords.forEach(rec => {
      if (!map.has(rec.staffId)) {
        map.set(rec.staffId, rec);
      } else {
        const existing = map.get(rec.staffId);
        if (existing.checkOutTime && !rec.checkOutTime) {
          map.set(rec.staffId, rec);
        }
      }
    });
    return Array.from(map.values());
  }, [todayStaffRecords]);

  const activeStaffSessions = uniqueTodayStaffRecords.filter(r => !r.checkOutTime);
  const todayPunchesCount = todayStaffRecords.length;

  const totalShiftMinutes = useMemo(() => {
    return filteredAttendance.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);
  }, [filteredAttendance]);

  const avgShiftHours = useMemo(() => {
    const completed = attendance.filter(a => a.durationMinutes && a.durationMinutes > 0);
    if (completed.length === 0) return 0;
    const totalMinutes = completed.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);
    return Math.round((totalMinutes / completed.length / 60) * 10) / 10;
  }, [attendance]);

  // ─── EXPORT HANDLERS (CSV & PDF) ───
  const exportAllAttendanceCSV = () => {
    const exportData = filteredAttendance.map(a => {
      const staffObj = staffs.find(s => s.id === a.staffId);
      const hardwareLabel = staffObj?.nfcCardId 
        ? `NFC (${staffObj.nfcCardId})` 
        : staffObj?.fingerprintId 
          ? `Fingerprint (#${staffObj.fingerprintId})` 
          : 'Manual';

      return {
        Date: formatDateDDMMYYYY(a.dateStr),
        Staff_Name: a.staffName,
        Role: staffObj?.role || 'Staff',
        Phone: a.staffPhone,
        Punch_IN: new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        Punch_OUT: a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Active Shift (On Duty)',
        Duration_Minutes: a.durationMinutes || (a.checkOutTime ? 0 : 'In Progress'),
        Duration_Formatted: a.durationMinutes ? `${Math.floor(a.durationMinutes / 60)}h ${a.durationMinutes % 60}m` : 'In Progress',
        Punch_Method: hardwareLabel
      };
    });

    const filterName = staffFilter !== 'ALL' ? staffs.find(s => s.id === staffFilter)?.name || 'Staff' : 'All_Staff';
    exportToCSV(exportData, `Staff_Shift_Logs_${filterName}_${dateFilter}_${todayStr}.csv`);
  };

  const exportAllAttendancePDF = () => {
    const head = [['Date', 'Staff Name', 'Role', 'Phone', 'Punch IN', 'Punch OUT', 'Duration', 'Hardware Method']];
    const body = filteredAttendance.map(a => {
      const staffObj = staffs.find(s => s.id === a.staffId);
      const hardwareLabel = staffObj?.nfcCardId 
        ? `NFC: ${staffObj.nfcCardId}` 
        : staffObj?.fingerprintId 
          ? `FP: #${staffObj.fingerprintId}` 
          : 'Manual';

      return [
        formatDateDDMMYYYY(a.dateStr),
        a.staffName,
        staffObj?.role || 'Staff',
        a.staffPhone,
        new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Active Shift',
        a.durationMinutes ? `${Math.floor(a.durationMinutes / 60)}h ${a.durationMinutes % 60}m` : 'In Progress',
        hardwareLabel
      ];
    });

    const filterName = staffFilter !== 'ALL' ? staffs.find(s => s.id === staffFilter)?.name || 'Staff' : 'All Staff Members';
    const totalHours = Math.round((totalShiftMinutes / 60) * 10) / 10;

    exportToPDF({
      gymName,
      title: `Staff Attendance & Shift Logs (${filterName})`,
      subtitle: `Filter: ${dateFilter} | Total Shifts: ${filteredAttendance.length} | Cumulative Hours: ${totalHours} hrs`,
      filename: `Staff_Shift_Logs_${filterName.replace(/\s+/g, '_')}_${todayStr}.pdf`,
      head,
      body,
      orientation: 'landscape',
      summaryBoxes: [
        { label: 'Total Shifts', value: String(filteredAttendance.length) },
        { label: 'Total Worked Hours', value: `${totalHours} hrs` },
        { label: 'Currently On Duty', value: `${activeStaffSessions.length} staff` }
      ]
    });
  };

  const exportStaffDirectoryCSV = () => {
    const exportData = filteredStaffs.map(s => ({
      Name: s.name,
      Phone: s.phone,
      Role: s.role,
      Joined_Date: formatDateDDMMYYYY(s.joinedDate),
      NFC_Tag_ID: s.nfcCardId || 'Not Assigned',
      Fingerprint_ID: s.fingerprintId || 'Not Assigned',
      Status: isStaffActiveToday(s.id) ? 'On Duty' : 'Off Duty'
    }));
    exportToCSV(exportData, `Staff_Directory_${todayStr}.csv`);
  };

  const exportStaffDirectoryPDF = () => {
    const head = [['Name', 'Phone', 'Role / Designation', 'Joined Date', 'NFC Badge ID', 'Fingerprint ID', 'Duty Status']];
    const body = filteredStaffs.map(s => [
      s.name,
      s.phone,
      s.role,
      formatDateDDMMYYYY(s.joinedDate),
      s.nfcCardId || 'None',
      s.fingerprintId ? `#${s.fingerprintId}` : 'None',
      isStaffActiveToday(s.id) ? 'ON DUTY' : 'OFF'
    ]);

    exportToPDF({
      gymName,
      title: 'Staff & Trainer Directory Report',
      subtitle: `Total Staff: ${filteredStaffs.length} | Generated On: ${formatDateDDMMYYYY(todayStr)}`,
      filename: `Staff_Directory_${todayStr}.pdf`,
      head,
      body,
      orientation: 'portrait',
      summaryBoxes: [
        { label: 'Total Staff', value: String(staffs.length) },
        { label: 'On Duty Right Now', value: String(activeStaffSessions.length) },
        { label: 'Avg Daily Shift', value: `${avgShiftHours} hrs` }
      ]
    });
  };

  const exportIndividualAttendanceCSV = (staff: any) => {
    const staffLogs = attendance.filter(a => a.staffId === staff.id);
    const exportData = staffLogs.map(a => ({
      Date: formatDateDDMMYYYY(a.dateStr),
      Staff_Name: a.staffName,
      Role: staff.role,
      Phone: a.staffPhone,
      Punch_IN: new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      Punch_OUT: a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'In Progress',
      Duration_Minutes: a.durationMinutes || 0,
      Duration_Formatted: a.durationMinutes ? `${Math.floor(a.durationMinutes / 60)}h ${a.durationMinutes % 60}m` : 'In Progress'
    }));
    exportToCSV(exportData, `Attendance_${staff.name.replace(/\s+/g, '_')}_${todayStr}.csv`);
  };

  const exportIndividualAttendancePDF = (staff: any) => {
    const staffLogs = attendance.filter(a => a.staffId === staff.id);
    const totalMinutes = staffLogs.reduce((acc, c) => acc + (c.durationMinutes || 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    const head = [['Date', 'Punch IN', 'Punch OUT', 'Duration', 'Hardware ID']];
    const body = staffLogs.map(a => [
      formatDateDDMMYYYY(a.dateStr),
      new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Active Shift',
      a.durationMinutes ? `${Math.floor(a.durationMinutes / 60)}h ${a.durationMinutes % 60}m` : 'In Progress',
      staff.nfcCardId ? `NFC: ${staff.nfcCardId}` : staff.fingerprintId ? `FP: #${staff.fingerprintId}` : 'Manual'
    ]);

    exportToPDF({
      gymName,
      title: `Individual Shift Log: ${staff.name} (${staff.role})`,
      subtitle: `Phone: ${staff.phone} | Total Shifts: ${staffLogs.length} | Cumulative Hours: ${totalHours} hrs`,
      filename: `Shift_Log_${staff.name.replace(/\s+/g, '_')}_${todayStr}.pdf`,
      head,
      body,
      orientation: 'portrait',
      summaryBoxes: [
        { label: 'Total Shifts', value: String(staffLogs.length) },
        { label: 'Total Hours', value: `${totalHours} hrs` },
        { label: 'Status', value: isStaffActiveToday(staff.id) ? 'ON DUTY' : 'OFF DUTY' }
      ]
    });
  };

  return (
    <div className="space-y-6">
      
      {/* ─── PAGE HEADER & SUBPAGE TAB SWITCHER ─── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center font-black">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Staff &amp; Shift Management</h1>
              <p className="text-xs text-slate-500 font-medium">Employee biometric &amp; NFC punch records, live shifts, and team directory</p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Employee</span>
          </button>
        </div>
      </div>

      {/* ─── SUBPAGE SEGMENTED TABS SWITCHER (COMPACT & NEAT) ─── */}
      <div className="w-full sm:max-w-md flex bg-slate-100/90 p-1 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={() => setStaffSubTab('directory')}
          className={`flex-1 py-1.5 px-2 sm:py-2 sm:px-3.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
            staffSubTab === 'directory'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="truncate">Team &amp; Live Shifts</span>
          <span className={`text-[9.5px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
            staffSubTab === 'directory' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {staffs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStaffSubTab('attendance')}
          className={`flex-1 py-1.5 px-2 sm:py-2 sm:px-3.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
            staffSubTab === 'attendance'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span className="truncate">Attendance &amp; Logs</span>
          <span className={`text-[9.5px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
            staffSubTab === 'attendance' ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {todayPunchesCount} today
          </span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SUBPAGE 1: TEAM & LIVE SHIFTS (DIRECTORY & STATUS)                         */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {staffSubTab === 'directory' && (
        <div className="space-y-6">
          
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">Total Team</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">{staffs.length}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Registered employees</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">On Duty Right Now</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-black text-slate-900">{activeStaffSessions.length}</p>
                {activeStaffSessions.length > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Active gym staff on shift</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">Today Punches</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Fingerprint className="w-4 h-4" />
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

          {/* Today's Active Shift Status Grid (Same design as member check-in cards) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="font-black text-slate-900 text-base flex items-center space-x-2">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                  <span>Today's Staff Shift Status ({activeStaffSessions.length} On Duty)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live shift tracking and active punch-in status of trainers and front-desk employees
                </p>
              </div>
            </div>

            {uniqueTodayStaffRecords.length === 0 ? (
              <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center">
                <Briefcase className="w-8 h-8 mb-2 opacity-40 text-slate-500" />
                <p className="font-bold text-slate-600 text-sm">No staff punches logged today</p>
                <p className="text-xs mt-0.5 text-slate-400">Scan employee NFC badge or tap fingerprint sensor at check-in terminal.</p>
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
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Team Members Directory Section */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span>Team Directory ({filteredStaffs.length} Employees)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Assigned NFC badges, biometric fingerprint IDs, and employee profiles</p>
              </div>

              {/* Dual Export Buttons (CSV & PDF) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportStaffDirectoryCSV}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Download CSV</span>
                </button>
                <button
                  type="button"
                  onClick={exportStaffDirectoryPDF}
                  className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by staff name, phone, designation, NFC Card or Fingerprint ID..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none shadow-xs"
              />
            </div>

            {/* Staff Grid Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {filteredStaffs.map(staff => {
                const isActive = isStaffActiveToday(staff.id);

                return (
                  <div key={staff.id} className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-all space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-900 font-black text-sm flex items-center justify-center">
                          {staff.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">{staff.name}</h3>
                          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                            {staff.role}
                          </span>
                        </div>
                      </div>

                      {isActive ? (
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> ON DUTY
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                          OFF DUTY
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-400">Phone:</span>
                        <span className="font-mono font-bold text-slate-800">{staff.phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-400">Joined:</span>
                        <span className="font-bold text-slate-700">{formatDateDDMMYYYY(staff.joinedDate)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200/50">
                        <span className="font-semibold text-slate-400">NFC Card:</span>
                        {staff.nfcCardId ? (
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono font-bold">
                            {staff.nfcCardId}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">None</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-400">Fingerprint:</span>
                        {staff.fingerprintId ? (
                          <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-mono font-bold">
                            #{staff.fingerprintId}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">None</span>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setExportTargetStaff(staff);
                          setShowExportModal(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors"
                        title="Download Individual Shift Records"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-600" />
                        <span>Logs</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(staff)}
                          className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Edit Staff Member & Hardware IDs"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Are you sure you want to remove ${staff.name}?`)) {
                              await deleteStaff(staff.id);
                              loadData();
                            }
                          }}
                          className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                          title="Delete Staff"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredStaffs.length === 0 && (
                <div className="col-span-full p-10 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-600">No staff members found matching "{search}".</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SUBPAGE 2: ATTENDANCE & SHIFT LOGS                                         */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {staffSubTab === 'attendance' && (
        <div className="space-y-6">
          
          {/* Header & Controls Toolbar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-600" />
                  <span>Staff Shift &amp; Attendance Logs ({filteredAttendance.length} records)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cumulative shift records, punch-in/out timestamps, and hardware scan logs
                </p>
              </div>

              {/* Dual Export Buttons (CSV & PDF) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportAllAttendanceCSV}
                  disabled={filteredAttendance.length === 0}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Download CSV</span>
                </button>
                <button
                  type="button"
                  onClick={exportAllAttendancePDF}
                  disabled={filteredAttendance.length === 0}
                  className="px-3.5 py-2 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 text-purple-800 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search staff, phone, role..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-600 outline-none"
                />
              </div>

              {/* Staff Member Selector */}
              <div>
                <select
                  value={staffFilter}
                  onChange={(e) => setStaffFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-600 outline-none"
                >
                  <option value="ALL">👥 All Staff Members ({staffs.length})</option>
                  {staffs.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>

              {/* Date Filter Preset */}
              <div>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-600 outline-none"
                >
                  <option value="ALL">📅 All Time Records</option>
                  <option value="TODAY">🗓️ Today Only</option>
                  <option value="THIS_WEEK">📆 This Week</option>
                  <option value="THIS_MONTH">📊 This Month</option>
                  <option value="CUSTOM">⚙️ Custom Date Range...</option>
                </select>
              </div>
            </div>

            {/* Custom Date Range Picker */}
            {dateFilter === 'CUSTOM' && (
              <div className="flex flex-wrap items-center gap-3 bg-purple-50/50 p-3 rounded-xl border border-purple-100">
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> From:
                </span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-600"
                />
                <span className="text-xs font-bold text-purple-900">To:</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>
            )}

            {/* Summary Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs font-semibold text-slate-500 bg-slate-50/70 px-4 py-2.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-4">
                <span>Showing: <strong className="text-slate-800">{filteredAttendance.length}</strong> shifts</span>
                <span>Cumulative Worked: <strong className="text-purple-700">{Math.round((totalShiftMinutes / 60) * 10) / 10} hours</strong></span>
              </div>
              <div className="text-[11px] text-slate-400">
                Live sync active • 1.5s real-time interval
              </div>
            </div>
          </div>

          {/* Shift Logs Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Punch IN</th>
                    <th className="py-3 px-4">Punch OUT</th>
                    <th className="py-3 px-4">Shift Duration</th>
                    <th className="py-3 px-4">Punch Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredAttendance.map(record => {
                    const staffObj = staffs.find(s => s.id === record.staffId);
                    const isActive = !record.checkOutTime;
                    const inDate = new Date(record.checkInTime);
                    const outDate = record.checkOutTime ? new Date(record.checkOutTime) : null;

                    return (
                      <tr key={record.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          {formatDateDDMMYYYY(record.dateStr)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{record.staffName}</div>
                          <span className="text-[10px] text-blue-600 font-semibold">{staffObj?.role || 'Staff'}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {record.staffPhone}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-700">
                          {inDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </td>
                        <td className="py-3 px-4">
                          {outDate ? (
                            <span className="font-bold text-slate-700">
                              {outDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                          ) : (
                            <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full animate-pulse">
                              ● ON DUTY
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {record.durationMinutes ? (
                            <span className="font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                              {Math.floor(record.durationMinutes / 60)}h {record.durationMinutes % 60}m
                            </span>
                          ) : isActive ? (
                            <span className="font-semibold text-emerald-600 text-[11px]">In Progress</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {staffObj?.nfcCardId ? (
                            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 w-fit">
                              <Radio className="w-2.5 h-2.5 text-blue-600" /> NFC: {staffObj.nfcCardId}
                            </span>
                          ) : staffObj?.fingerprintId ? (
                            <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 w-fit">
                              <Fingerprint className="w-2.5 h-2.5 text-purple-600" /> FP: #{staffObj.fingerprintId}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">
                              Manual
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredAttendance.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-bold text-slate-600 text-sm">No attendance records found</p>
                        <p className="text-xs text-slate-400 mt-0.5">Try adjusting the staff or date filter above.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: INDIVIDUAL STAFF EXPORT (CSV / PDF) ─── */}
      {showExportModal && exportTargetStaff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Download Shift Report</h3>
                <p className="text-xs text-slate-500">{exportTargetStaff.name} ({exportTargetStaff.role})</p>
              </div>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Export full work shift attendance history and duration logs for <strong>{exportTargetStaff.name}</strong>.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  exportIndividualAttendanceCSV(exportTargetStaff);
                  setShowExportModal(false);
                }}
                className="py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 flex flex-col items-center justify-center gap-1.5 transition-all shadow-xs"
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>Download CSV</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportIndividualAttendancePDF(exportTargetStaff);
                  setShowExportModal(false);
                }}
                className="py-3 px-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold text-blue-900 flex flex-col items-center justify-center gap-1.5 transition-all shadow-xs"
              >
                <FileText className="w-5 h-5 text-blue-600" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD / EDIT STAFF MEMBER ─── */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {isEditingStaff ? 'Edit Staff Profile & IDs' : 'Register New Employee / Trainer'}
                </h3>
                <p className="text-xs text-slate-500">Configure contact information and NFC/Fingerprint punch hardware IDs</p>
              </div>
              <button onClick={() => setShowStaffModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="font-semibold">{modalError}</div>
              </div>
            )}

            <form onSubmit={handleSaveStaff} className="space-y-4 text-xs">
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
                  <div className="flex flex-wrap gap-2">
                    {attendanceMode === 'BOTH' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPunchMethod('BOTH')}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                            punchMethod === 'BOTH' 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Radio className="w-3.5 h-3.5" /> <Fingerprint className="w-3.5 h-3.5" /> NFC + Fingerprint
                        </button>
                        <button
                          type="button"
                          onClick={() => setPunchMethod('NFC')}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                            punchMethod === 'NFC' 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Radio className="w-3.5 h-3.5" /> NFC Badge Only
                        </button>
                        <button
                          type="button"
                          onClick={() => setPunchMethod('FINGERPRINT')}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                            punchMethod === 'FINGERPRINT' 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Fingerprint className="w-3.5 h-3.5" /> Fingerprint Only
                        </button>
                      </>
                    )}

                    {attendanceMode === 'NFC' && (
                      <button
                        type="button"
                        onClick={() => setPunchMethod('NFC')}
                        className="py-2 px-3.5 rounded-xl text-xs font-bold bg-blue-600 text-white border border-blue-600 shadow-sm flex items-center gap-1.5"
                      >
                        <Radio className="w-3.5 h-3.5" /> NFC Card / Badge
                      </button>
                    )}

                    {attendanceMode === 'FINGERPRINT' && (
                      <button
                        type="button"
                        onClick={() => setPunchMethod('FINGERPRINT')}
                        className="py-2 px-3.5 rounded-xl text-xs font-bold bg-purple-600 text-white border border-purple-600 shadow-sm flex items-center gap-1.5"
                      >
                        <Fingerprint className="w-3.5 h-3.5" /> Fingerprint Biometric
                      </button>
                    )}

                    {attendanceMode === 'MANUAL' && (
                      <button
                        type="button"
                        onClick={() => setPunchMethod('MANUAL')}
                        className="py-2 px-3.5 rounded-xl text-xs font-bold bg-slate-800 text-white border border-slate-800 shadow-sm flex items-center gap-1.5"
                      >
                        Manual Check-in
                      </button>
                    )}
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
                        placeholder="Fingerprint enrollment ID (e.g. 101, 102)..." 
                        className="w-full pl-9 pr-3 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none text-xs font-mono font-bold bg-white" 
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition-colors flex items-center space-x-2"
                >
                  {isSaving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{isEditingStaff ? 'Update Staff Member' : 'Register Staff Member'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
