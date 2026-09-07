'use client';

import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle2, MessageSquare, Phone, RefreshCw, Calendar, Filter, Sparkles, Send, Loader2 } from 'lucide-react';
import { getCustomers, renewMemberPayment, getGymSettings, getGyms } from '@/lib/actions';
import { Customer } from '@/lib/types';
import { getTemplate, compileTemplate } from '@/lib/templates';
import { formatDateDDMMYYYY } from '@/lib/utils';
import { useRemindersData } from '@/lib/hooks';
import { mutate } from 'swr';

// Helper for strict YYYY-MM-DD calculations ignoring local timezones
const getYYYYMMDD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getMidnightUTC = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

// Extracted Component to prevent re-rendering the massive list every 3 seconds
function BatchSendButton({ dueCustomers, gymId, gymName, settings }: { dueCustomers: any[], gymId: string, gymName: string, settings: any }) {
  const [batchSending, setBatchSending] = useState(false);
  const [batchSentCount, setBatchSentCount] = useState<number | null>(null);
  const [failedCount, setFailedCount] = useState<number>(0);

  const handleSendBatchReminders = async () => {
    if (dueCustomers.length === 0 || batchSending) return;
    
    // Prevent closing the tab accidentally
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Request Wake Lock to prevent tab sleep on mobile/laptops
    let wakeLock: any = null;
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {}

    setBatchSending(true);
    setBatchSentCount(0);
    setFailedCount(0);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < dueCustomers.length; i++) {
      const cust = dueCustomers[i];
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
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gymId,
            phone: cust.phone,
            message: waText
          })
        });
        
        if (!res.ok) throw new Error("API failure status: " + res.status);
        
        sent++;
        setBatchSentCount(sent);
      } catch (e) {
        failed++;
        setFailedCount(failed);
        console.error('Batch reminder send failed for', cust.name, e);
      }

      // Anti-ban delay between 3 to 6 seconds
      if (i < dueCustomers.length - 1) {
        const delay = Math.floor(Math.random() * 3000) + 3000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (wakeLock) {
      wakeLock.release().catch(() => {});
    }
    window.removeEventListener('beforeunload', handleBeforeUnload);
    
    setBatchSending(false);
    setTimeout(() => {
      setBatchSentCount(null);
      setFailedCount(0);
    }, 5000);
  };

  if (dueCustomers.length === 0) return null;

  return (
    <button
      onClick={handleSendBatchReminders}
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
          ? `Sending (${batchSentCount}/${dueCustomers.length})${failedCount > 0 ? ` [${failedCount} failed]` : ''}...`
          : `Send Reminders to All (${dueCustomers.length})`}
      </span>
    </button>
  );
}

export default function RemindersPage() {
  const [gymId, setGymId] = useState<string>(''); // '' until useEffect loads real id

  useEffect(() => {
    const saved = localStorage.getItem('active_gym_id');
    if (saved) setGymId(saved);
  }, []);

  const { data, isLoading } = useRemindersData(gymId);
  const customers = data?.custs || [];
  const settings = data?.settings || null;
  const gyms = data?.gyms || [];
  const matchedGym = gyms.find((g: any) => g.id === gymId);
  const gymName = matchedGym?.name || 'Our Gym';
  const reminderThresholdDays = settings?.waReminderWindowDays ?? 3;

  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);

  const handleRecordPayment = async (cust: any) => {
    if (processingPaymentId === cust.id) return;
    setProcessingPaymentId(cust.id);
    
    try {
      const updated = await renewMemberPayment(cust.id, 1, cust.feeAmount);
      mutate(['reminders', gymId]);
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
    } finally {
      setProcessingPaymentId(null);
    }
  };

  // Strict Date logic ignoring Local Timezones
  const todayStr = getYYYYMMDD(new Date());
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + reminderThresholdDays);
  const targetThresholdStr = getYYYYMMDD(targetDate);

  const dueCustomers = customers.filter((cust) => {
    return cust.nextDueDate <= targetThresholdStr || cust.status === 'due_soon' || cust.status === 'overdue';
  });

  return (
    <div className="space-y-4">
      {(isLoading || !gymId) && !data ? (
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
              onChange={(e) => { /* setReminderThresholdDays(Number(e.target.value)) */ }}
              className="bg-white border border-slate-300 text-slate-800 font-bold text-xs rounded-lg py-1.5 px-2.5 focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value={3}>Due in 3 Days (Default)</option>
              <option value={5}>Due in 5 Days</option>
              <option value={7}>Due in 7 Days</option>
              <option value={0}>Only Overdue</option>
            </select>
          </div>

          <BatchSendButton dueCustomers={dueCustomers} gymId={gymId} gymName={gymName} settings={settings} />
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
              const todayUTC = getMidnightUTC(todayStr);
              const dueUTC = getMidnightUTC(cust.nextDueDate);
              const diffDays = Math.round((dueUTC - todayUTC) / (1000 * 60 * 60 * 24));
              const isOverdue = diffDays < 0;

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
                      disabled={processingPaymentId === cust.id}
                      className={`px-3.5 py-2 ${processingPaymentId === cust.id ? 'bg-blue-300 cursor-wait' : 'bg-blue-900 hover:bg-blue-950'} text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center space-x-1.5`}
                    >
                      {processingPaymentId === cust.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>{processingPaymentId === cust.id ? 'Processing...' : 'Record Payment Received'}</span>
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
