'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Smartphone, Bell, CreditCard, Plus, ArrowUpRight, CheckCircle2, Clock, Dumbbell, AlertTriangle, TrendingUp, ChevronRight, Zap } from 'lucide-react';
import { getGyms, getCustomers, getAttendance, getTransactions } from '@/lib/actions';
import { Customer, AttendanceRecord, Transaction, Gym } from '@/lib/types';

export default function DashboardOverview() {
  const [gymId, setGymId] = useState<string>('gym_1');
  const [customers, setCustomers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activeGym, setActiveGym] = useState<any | null>(null);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('attendance_updated', handleUpdate);
    return () => window.removeEventListener('attendance_updated', handleUpdate);
  }, []);

  const loadData = async () => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || 'gym_1' : 'gym_1';
    setGymId(savedId);

    const [gyms, custs, atts, txs] = await Promise.all([
      getGyms(),
      getCustomers(savedId),
      getAttendance(savedId),
      getTransactions(savedId)
    ]);

    setActiveGym(gyms.find(g => g.id === savedId) || gyms[0]);
    setCustomers(custs);
    setAttendance(atts);
    setTransactions(txs);
  };

  // Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = attendance.filter(a => a.dateStr === todayStr);
  const currentlyInGym = todayAttendance.filter(a => !a.checkOutTime);

  const dueSoonCount = customers.filter(c => c.status === 'due_soon' || c.status === 'overdue').length;

  const todayIncome = transactions
    .filter(t => t.date === todayStr && t.type === 'INCOME')
    .reduce((acc, cur) => acc + cur.amount, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner Greeting */}
      <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
          <Dumbbell className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-semibold mb-2 text-blue-100">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>{activeGym?.name || 'Gym Admin Portal'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Welcome Back, {activeGym?.ownerName || 'Gym Owner'}!</h1>
            <p className="text-blue-100 text-xs sm:text-sm mt-1">Here is your gym's live check-in feed and financial summary for today.</p>
          </div>

          <Link
            href="/dashboard/checkin"
            className="px-4 py-2.5 bg-white text-blue-950 hover:bg-blue-50 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md flex items-center space-x-2 flex-shrink-0"
          >
            <Smartphone className="w-4 h-4 text-blue-900" />
            <span>Open NFC Terminal</span>
          </Link>
        </div>
      </div>

      {/* Overview Stat Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Members */}
        <Link href="/dashboard/members" className="bg-white border border-slate-200 hover:border-blue-700 p-4 rounded-xl shadow-sm transition-all group">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Members</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{customers.length}</div>
          <div className="text-xs font-semibold text-blue-900 mt-1 flex items-center">
            <span>Manage All Members</span>
            <ChevronRight className="w-3 h-3 ml-0.5" />
          </div>
        </Link>

        {/* Metric 2: Today's Visits */}
        <Link href="/dashboard/checkin" className="bg-white border border-slate-200 hover:border-blue-700 p-4 rounded-xl shadow-sm transition-all group">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Today Check-Ins</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{todayAttendance.length}</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              {currentlyInGym.length} In Gym
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Real-time NFC & Phone check-ins</div>
        </Link>

        {/* Metric 3: Due Reminders */}
        <Link href="/dashboard/reminders" className="bg-white border border-slate-200 hover:border-amber-400 p-4 rounded-xl shadow-sm transition-all group">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Payment Dues</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{dueSoonCount}</div>
          <div className="text-xs font-semibold text-amber-600 mt-1 flex items-center">
            <span>Send WhatsApp Reminders</span>
            <ChevronRight className="w-3 h-3 ml-0.5" />
          </div>
        </Link>

        {/* Metric 4: Today's Payments */}
        <Link href="/dashboard/revenue" className="bg-white border border-slate-200 hover:border-blue-700 p-4 rounded-xl shadow-sm transition-all group">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Today's Collection</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">₹{todayIncome.toLocaleString()}</div>
          <div className="text-xs text-blue-900 font-semibold mt-1">View Profit Analytics</div>
        </Link>
      </div>

      {/* Quick Actions Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Link
            href="/dashboard/checkin"
            className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-blue-900 font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all"
          >
            <Smartphone className="w-4 h-4 text-blue-900" />
            <span>NFC Card Tap</span>
          </Link>

          <Link
            href="/dashboard/members?open_add=true"
            className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-800 font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all"
          >
            <Plus className="w-4 h-4 text-slate-600" />
            <span>Add Member</span>
          </Link>

          <Link
            href="/dashboard/revenue"
            className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-800 font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all col-span-2 sm:col-span-1"
          >
            <CreditCard className="w-4 h-4 text-slate-600" />
            <span>Record Expense</span>
          </Link>
        </div>
      </div>

      {/* Today's Live Attendance Feed & Overdue Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Live Today's Attendance Log */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-900" />
                <span>Today's Check-In Activity</span>
              </h3>
              <p className="text-xs text-slate-500">Live check-in feed via NFC tag or phone lookup</p>
            </div>
            <Link href="/dashboard/checkin" className="text-xs font-bold text-blue-900 hover:text-blue-950">
              Launch Scanner →
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {todayAttendance.length > 0 ? (
              todayAttendance.map((rec) => {
                const isCurrentlyInside = !rec.checkOutTime;
                return (
                  <div key={rec.id} className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-10 h-10 rounded-full font-bold text-sm flex items-center justify-center border ${
                          isCurrentlyInside
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {rec.customerName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{rec.customerName}</h4>
                        <div className="text-xs text-slate-500 font-mono">Phone: {rec.customerPhone}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-800">
                        In: {new Date(rec.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {isCurrentlyInside ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ● Workout Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-500">
                          Out: {new Date(rec.checkOutTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({rec.durationMinutes} mins)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-slate-600">No member check-ins recorded yet today.</p>
                <p className="text-xs text-slate-400 mt-1">Tap NFC card or type member phone number to log visits.</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Payment Dues Attention Widget */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Urgent Due Reminders</span>
              </h3>
              <Link href="/dashboard/reminders" className="text-xs font-bold text-blue-900">
                View All
              </Link>
            </div>

            <div className="space-y-3">
              {customers
                .filter((c) => c.status === 'due_soon' || c.status === 'overdue')
                .slice(0, 3)
                .map((cust) => (
                  <div key={cust.id} className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{cust.name}</div>
                      <div className="text-[11px] text-slate-500">Due: <span className="font-bold text-amber-700">{cust.nextDueDate}</span></div>
                    </div>
                    <a
                      href={`https://wa.me/91${cust.phone}?text=Hi%20${encodeURIComponent(cust.name)},%20your%20gym%20membership%20fee%20(₹${cust.feeAmount})%20is%20due%20on%20${cust.nextDueDate}.%20Please%20renew.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-md transition-colors shadow-sm"
                    >
                      WhatsApp
                    </a>
                  </div>
                ))}
              {dueSoonCount === 0 && (
                <div className="text-center py-6 text-xs text-slate-500">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                  All member payments are up to date!
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200">
            <Link
              href="/dashboard/reminders"
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center justify-center space-x-1 transition-colors"
            >
              <span>Manage Payment Reminders</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
