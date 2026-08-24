'use client';

import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle2, MessageSquare, Phone, RefreshCw, Calendar, Filter, Sparkles, Send } from 'lucide-react';
import { getCustomers, renewMemberPayment, getGymSettings, getGyms } from '@/lib/actions';
import { Customer } from '@/lib/types';
import { getTemplate, compileTemplate } from '@/lib/templates';

export default function RemindersPage() {
  const [gymId, setGymId] = useState<string>('gym_1');
  const [customers, setCustomers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [gymName, setGymName] = useState<string>('Our Gym');
  const [reminderThresholdDays, setReminderThresholdDays] = useState<number>(3); // 3 days default as requested

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || 'gym_1' : 'gym_1';
    setGymId(savedId);

    const [custs, gymSettings, loadedGyms] = await Promise.all([
      getCustomers(savedId),
      getGymSettings(savedId),
      getGyms()
    ]);
    
    setCustomers(custs);
    setSettings(gymSettings);
    
    const matchedGym = loadedGyms.find(g => g.id === savedId);
    if (matchedGym) setGymName(matchedGym.name);

    if (gymSettings && gymSettings.waReminderWindowDays !== undefined) {
      setReminderThresholdDays(gymSettings.waReminderWindowDays);
    }
  };

  const handleRecordPayment = async (cust: any) => {
    const updated = await renewMemberPayment(cust.id, 1, cust.feeAmount);
    loadData();
    if (updated) {
      const autoMessagesEnabled = settings?.waAutoMessages ?? true;
      if (autoMessagesEnabled) {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = now.toLocaleDateString();

        fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gymId,
            phone: cust.phone,
            message: compileTemplate(getTemplate(settings, 'receipt'), {
              name: updated.name,
              gymName,
              phone: updated.phone,
              plan: updated.planType,
              amount: cust.feeAmount,
              dueDate: updated.nextDueDate
            }) + `\n\n_Date: ${dateString} ${timeString}_`
          })
        }).catch(console.error);
      }
    }
  };

  // Filter members by due date
  const today = new Date();
  const targetThresholdDate = new Date();
  targetThresholdDate.setDate(today.getDate() + reminderThresholdDays);

  const dueCustomers = customers.filter((cust) => {
    const dueDate = new Date(cust.nextDueDate);
    return dueDate <= targetThresholdDate || cust.status === 'due_soon' || cust.status === 'overdue';
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold mb-2">
            <Bell className="w-3.5 h-3.5 text-amber-600" />
            <span>Automated Payment Reminders</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Payment Due Reminders</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Send instant WhatsApp reminders and renew memberships with 1-click receipts.
          </p>
        </div>

        {/* Custom Days Selector */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-600 pl-2">Due Window:</span>
          <select
            value={reminderThresholdDays}
            onChange={(e) => setReminderThresholdDays(Number(e.target.value))}
            className="bg-white border border-slate-300 text-slate-800 font-bold text-xs rounded-lg py-1.5 px-2.5 focus:ring-2 focus:ring-amber-500 outline-none"
          >
            <option value={3}>Due in 3 Days (Default)</option>
            <option value={5}>Due in 5 Days</option>
            <option value={7}>Due in 7 Days</option>
            <option value={0}>Only Overdue</option>
          </select>
        </div>
      </div>

      {/* Due Members List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h2 className="font-bold text-slate-900 text-base flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Members Due for Payment ({dueCustomers.length})</span>
          </h2>
          <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
            Window: Next {reminderThresholdDays} Days
          </span>
        </div>

        {dueCustomers.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {dueCustomers.map((cust) => {
              const isOverdue = new Date(cust.nextDueDate) < new Date();
              const now = new Date();
              const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateString = now.toLocaleDateString();
              
              const waText = encodeURIComponent(
                compileTemplate(getTemplate(settings, 'reminder'), {
                  name: cust.name,
                  gymName,
                  phone: cust.phone,
                  plan: cust.planType,
                  amount: cust.feeAmount,
                  dueDate: cust.nextDueDate
                }) + `\n\n_Generated: ${dateString} ${timeString}_`
              );

              return (
                <div key={cust.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-start space-x-3">
                    <div
                      className={`w-11 h-11 rounded-full font-black text-sm flex items-center justify-center flex-shrink-0 border ${
                        isOverdue ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {cust.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-slate-900 text-base">{cust.name}</h3>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isOverdue ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isOverdue ? 'Overdue' : 'Due Soon'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 mt-1">
                        <span className="font-mono">📱 {cust.phone}</span>
                        <span>Plan: <strong>{cust.planType}</strong> (₹{cust.feeAmount})</span>
                        <span>Due Date: <strong className={isOverdue ? 'text-rose-600' : 'text-amber-700'}>{cust.nextDueDate}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <a
                      href={`https://wa.me/91${cust.phone.replace(/\D/g, '')}?text=${waText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center space-x-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send WhatsApp Alert</span>
                    </a>

                    <button
                      onClick={() => handleRecordPayment(cust)}
                      className="px-3.5 py-2 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center space-x-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Record Payment Received</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="font-bold text-slate-800 text-base">No upcoming payment dues found!</p>
            <p className="text-xs text-slate-500 mt-1">All gym members are currently paid up within the selected window.</p>
          </div>
        )}
      </div>
    </div>
  );
}
