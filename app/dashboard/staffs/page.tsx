'use client';

import React, { useState, useEffect } from 'react';
import { UserPlus, Download, Trash2, Search, Briefcase } from 'lucide-react';
import { getStaffs, getStaffAttendance, addStaff, deleteStaff } from '@/lib/actions';
import { exportToCSV, formatDateDDMMYYYY } from '@/lib/utils';

export default function StaffPage() {
  const [gymId, setGymId] = useState<string>('gym_1');
  const [staffs, setStaffs] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || 'gym_1' : 'gym_1';
    setGymId(savedId);
    
    const [s, a] = await Promise.all([
      getStaffs(savedId),
      getStaffAttendance(savedId)
    ]);
    setStaffs(s);
    setAttendance(a);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('attendance_updated', handleUpdate);
    return () => window.removeEventListener('attendance_updated', handleUpdate);
  }, []);

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      gymId,
      name: formData.get('name'),
      phone: formData.get('phone'),
      role: formData.get('role') || 'Trainer',
      nfcCardId: formData.get('nfcCardId'),
      fingerprintId: formData.get('fingerprintId'),
    };
    await addStaff(data);
    setShowAddModal(false);
    loadData();
  };

  const exportStaffInfo = () => {
    const exportData = staffs.map(s => ({
      ID: s.id,
      Name: s.name,
      Phone: s.phone,
      Role: s.role,
      Joined_Date: s.joinedDate,
      NFC_ID: s.nfcCardId || '',
      Fingerprint_ID: s.fingerprintId || ''
    }));
    exportToCSV(exportData, 'Staff_List.csv');
  };

  const exportTotalAttendance = () => {
    const exportData = attendance.map(a => ({
      Date: a.dateStr,
      Name: a.staffName,
      Check_In: new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      Check_Out: a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active',
      Duration_Minutes: a.durationMinutes || ''
    }));
    exportToCSV(exportData, 'Staff_Attendance.csv');
  };

  const exportIndividualAttendance = (staffId: string, staffName: string) => {
    const records = attendance.filter(a => a.staffId === staffId);
    const exportData = records.map(a => ({
      Date: a.dateStr,
      Name: a.staffName,
      Check_In: new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      Check_Out: a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active',
      Duration_Minutes: a.durationMinutes || ''
    }));
    exportToCSV(exportData, `${staffName}_Attendance.csv`);
  };

  const filteredStaffs = staffs.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.phone.includes(search));

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-blue-600" /> Staff Management
          </h1>
          <p className="text-sm text-slate-500">Manage trainers, admins, and track staff attendance.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button onClick={exportStaffInfo} className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Export Staff
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm">
            <UserPlus className="w-4 h-4" /> Add Staff
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Staff List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search staff..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-semibold text-slate-800">Team Members ({filteredStaffs.length})</h2>
            </div>
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {filteredStaffs.map(staff => (
                <div key={staff.id} className="p-4 hover:bg-slate-50 flex justify-between items-center group">
                  <div>
                    <h3 className="font-bold text-slate-900">{staff.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">{staff.role} • {staff.phone}</p>
                    <div className="mt-1 flex gap-2">
                      {staff.nfcCardId && <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">NFC</span>}
                      {staff.fingerprintId && <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold">FP</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => exportIndividualAttendance(staff.id, staff.name)} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg" title="Download Attendance">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={async () => { if(confirm('Delete staff?')) { await deleteStaff(staff.id); loadData(); } }} className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {filteredStaffs.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">No staff found.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Attendance Log */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="font-semibold text-slate-800">Recent Attendance</h2>
              <button onClick={exportTotalAttendance} className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md">
                <Download className="w-3 h-3" /> Export All
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-slate-100 text-xs uppercase text-slate-500">
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Staff Name</th>
                    <th className="p-4 font-semibold">In Time</th>
                    <th className="p-4 font-semibold">Out Time</th>
                    <th className="p-4 font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {attendance.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/50">
                      <td className="p-4 whitespace-nowrap text-slate-600 font-medium">{formatDateDDMMYYYY(record.dateStr)}</td>
                      <td className="p-4 font-bold text-slate-900">{record.staffName}</td>
                      <td className="p-4 text-emerald-600 font-semibold">{new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="p-4 text-slate-600">{record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 animate-pulse">ACTIVE</span>}</td>
                      <td className="p-4 text-slate-500">{record.durationMinutes ? `${record.durationMinutes} min` : '-'}</td>
                    </tr>
                  ))}
                  {attendance.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">No attendance records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-800">Add New Staff</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Full Name</label>
                <input required type="text" name="name" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Phone</label>
                  <input required type="text" name="phone" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Role</label>
                  <input type="text" name="role" defaultValue="Trainer" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">NFC Card ID (Optional)</label>
                <input type="text" name="nfcCardId" placeholder="Scan card..." className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Fingerprint ID (Optional)</label>
                <input type="text" name="fingerprintId" placeholder="E.g. 101" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md">Save Staff</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
