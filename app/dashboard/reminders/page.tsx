'use client';

import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle2, MessageSquare, Phone, RefreshCw, Calendar, Filter, Sparkles, Send } from 'lucide-react';
import { getCustomers, renewMemberPayment, getGymSettings, getGyms } from '@/lib/actions';
import { Customer } from '@/lib/types';
import { getTemplate, compileTemplate } from '@/lib/templates';
import { formatDateDDMMYYYY } from '@/lib/utils';

export default function RemindersPage() {
  const [gymId, setGymId] = useState<string>('gym_1');
  const [isLoading, setIsLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [gymName, setGymName] = useState<string>('Our Gym');
  const [reminderThresholdDays, setReminderThresholdDays] = useState<number>(3); // 3 days default as requested

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      if (document.hidden) return;
      loadData();
    }, 30000);

    const handleFocus = () => loadData();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
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
    
    const matchedGym = loadedGyms.find((g: any) => g.id === savedId);
    if (matchedGym) setGymName(matchedGym.name);

    if (gymSettings && gymSettings.waReminderWindowDays !== undefined) {
      setReminderThresholdDays(gymSettings.waReminderWindowDays);
    }
    setIsLoading(false);
  };

  const [batchSending, setBatchSending] = useState(false);
  const [batchSentCount, setBatchSentCount] = useState<number | null>(null);

  const handleSendBatchReminders = async (recipients: any[]) => {
    if (recipients.length === 0 || batchSending) return;
    setBatchSending(true);
    setBatchSentCount(0);

    let sent = 0;
    for (let i = 0; i < recipients.length; i++) {
      const cust = recipients[i];
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateString = now.toLocaleDateString();

      const waText = compileTemplate(getTemplate(settings, 'reminder'), {
        name: cust.name,
        gymName,
        phone: cust.phone,
        plan: cust.planType,
        amount: cust.feeAmount,
        dueDate: formatDateDDMMYYYY(cust.nextDueDate)
      }) + `\n\n_Generated: ${dateString} ${timeString}_`;

      try {
        await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gymId,
            phone: cust.phone,
            message: waText
          })
        });
        sent++;
        setBatchSentCount(sent);
      } catch (e) {
        console.error('Batch reminder send failed for', cust.name, e);
      }

      // Anti-ban delay between 3 to 6 seconds
      if (i < recipients.length - 1) {
        const delay = Math.floor(Math.random() * 30000) + 3000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    setBatchSending(false);
    setTimeout(() => setBatchSentCount(null), 5000);
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
              phone: cust.phone,
              plan: updated.planType,
              amount: cust.feeAmount,
              date: dateString,
              nextDueDate: formatDateDDMMYYYY(updated.nextDueDate)
            }) + `\n\n_Generated: ${dateString} ${timeString}_`
          })
        }).catch(() => {});
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
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-28 bg-slate-200 rounded-2xl" />
          <div className="h-16 bg-slate-200 rounded-2xl" />
          <div className="h-64 bg-slate-200 rounded-2xl" />
        </div>
      ) : (<>
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
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

        <div className="flex flex-wrap items-center gap-3">
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

          {/* Batch Send WhatsApp Reminders Button */}
          {dueCustomers.length > 0 && (
            <button
              onClick={() => handleSendBatchReminders(dueCustomers)}
              disabled={batchSending}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm flex items-center space-x-2 ${
                batchSending
                  ? 'bg-amber-100 text-amber-800 cursor-wait'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>
                {batchSending
                  ? `Sending Reminders (${batchSentCount}/${dueCustomers.length})...`
                  : `Send Reminders to All (${dueCustomers.length})`}
              </span>
            </button>
          )}
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
                  dueDate: formatDateDDMMYYYY(cust.nextDueDate)
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
                        {(() => {
                          const todayMidnight = new Date();
                          todayMidnight.setHours(0, 0, 0, 0);
                          const dueMidnight = new Date(cust.nextDueDate);
                          dueMidnight.setHours(0, 0, 0, 0);
                          const diffDays = Math.round((dueMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));

                          if (diffDays < 0) {
                            return (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                Overdue ({Math.abs(diffDays)}d ago)
                              </span>
                            );
                          } else if (diffDays === 0) {
                            return (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                Due Today!
                              </span>
                            );
                          } else if (diffDays <= 2) {
                            return (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Due in {diffDays} {diffDays === 1 ? 'day' : 'days'}
                              </span>
                            );
                          } else {
                            return (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                                Due in {diffDays} days
                              </span>
                            );
                          }
                        })()}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 mt-1">
                        <span className="font-mono flex items-center gap-1"><Phone className="w-3 h-3" /> {cust.phone}</span>
                        <span>Plan: <strong>{cust.planType}</strong> (₹{cust.feeAmount})</span>
                        <span>Due Date: <strong className={isOverdue ? 'text-rose-600' : 'text-amber-700'}>{formatDateDDMMYYYY(cust.nextDueDate)}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <a
                      href={`https://wa.me/91${cust.phone.replace(/\D/g, '').replace(/^91/, '')}?text=${waText}`}
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
      </>)}
    </div>
  );
}
