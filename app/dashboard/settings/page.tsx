'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, CheckCircle2, AlertTriangle, RefreshCw, LogOut, MessageSquare, Settings } from 'lucide-react';

export default function SettingsPage() {
  const [gymId, setGymId] = useState<string | null>(null);
  const [waStatus, setWaStatus] = useState<string>('disconnected');
  const [waError, setWaError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [autoMessagesEnabled, setAutoMessagesEnabled] = useState(true);
  const [reminderWindowDays, setReminderWindowDays] = useState(3);
  
  const [absentTrackingEnabled, setAbsentTrackingEnabled] = useState(false);
  const [absentThresholdDays, setAbsentThresholdDays] = useState(3);

  useEffect(() => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') : null;
    setGymId(savedId);
    
    if (savedId && typeof window !== 'undefined') {
      const savedToggle = localStorage.getItem(`wa_auto_messages_${savedId}`);
      if (savedToggle !== null) setAutoMessagesEnabled(savedToggle === 'true');

      const savedWindow = localStorage.getItem(`wa_reminder_window_${savedId}`);
      if (savedWindow !== null) setReminderWindowDays(Number(savedWindow));

      const savedAbsentToggle = localStorage.getItem(`absent_tracking_enabled_${savedId}`);
      if (savedAbsentToggle !== null) setAbsentTrackingEnabled(savedAbsentToggle === 'true');

      const savedAbsentDays = localStorage.getItem(`absent_tracking_days_${savedId}`);
      if (savedAbsentDays !== null) setAbsentThresholdDays(Number(savedAbsentDays));
    }
  }, []);

  const handleToggleAutoMessages = (enabled: boolean) => {
    setAutoMessagesEnabled(enabled);
    if (gymId) localStorage.setItem(`wa_auto_messages_${gymId}`, String(enabled));
  };

  const handleReminderWindowChange = (days: number) => {
    setReminderWindowDays(days);
    if (gymId) localStorage.setItem(`wa_reminder_window_${gymId}`, String(days));
  };

  const handleToggleAbsentTracking = (enabled: boolean) => {
    setAbsentTrackingEnabled(enabled);
    if (gymId) localStorage.setItem(`absent_tracking_enabled_${gymId}`, String(enabled));
  };

  const handleAbsentThresholdChange = (days: number) => {
    setAbsentThresholdDays(days);
    if (gymId) localStorage.setItem(`absent_tracking_days_${gymId}`, String(days));
  };

  useEffect(() => {
    if (!gymId) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/whatsapp/status?gymId=${gymId}`);
        const data = await res.json();
        setWaStatus(data.status);
        setQrCode(data.qr);
        if (data.error) setWaError(data.error);
      } catch (err) {
        console.error('Failed to fetch WA status', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
    // Poll every 3 seconds while not connected
    const interval = setInterval(() => {
      if (waStatus !== 'connected') {
        fetchStatus();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [gymId, waStatus]);

  const handleDisconnect = async () => {
    if (!gymId) return;
    setIsLoading(true);
    try {
      await fetch('/api/whatsapp/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gymId }),
      });
      setWaStatus('disconnected');
      setQrCode(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestMessage = async () => {
    if (!gymId) return;
    const phone = prompt('Enter a phone number with country code (e.g. 919876543210):');
    if (!phone) return;

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gymId, phone, message: 'Hello from GymFlow! 🏋️‍♂️ Your WhatsApp integration is working perfectly.' }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Test message sent successfully!');
      } else {
        alert('Failed to send test message.');
      }
    } catch (err) {
      console.error(err);
      alert('Error sending message');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold mb-2">
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gym Configuration</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage your gym's integrations and preferences.
          </p>
        </div>
      </div>

      {/* WhatsApp Integration Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-md ${
              waStatus === 'connected' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-slate-800 shadow-slate-800/20'
            }`}>
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <span>WhatsApp Bot</span>
                {waStatus === 'connected' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
                  </span>
                )}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Send automatic payment receipts and background reminders.
              </p>
            </div>
          </div>
          {waStatus === 'connected' && (
            <button
              onClick={handleDisconnect}
              disabled={isLoading}
              className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-sm rounded-xl transition-all border border-rose-200 flex items-center space-x-2 disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          )}
        </div>

        <div className="p-6 bg-slate-50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mb-4 text-blue-500" />
              <p className="font-bold">Initializing WhatsApp Engine...</p>
            </div>
          ) : waStatus === 'connected' ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-lg">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">WhatsApp is Active!</h3>
              <p className="text-slate-500 text-sm max-w-md text-center mb-8">
                Your gym is now connected to WhatsApp. Payment receipts and reminders will be sent automatically from your number.
              </p>
              
              <button
                onClick={handleTestMessage}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md flex items-center space-x-2 transition-all"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Send Test Message</span>
              </button>
            </div>
          ) : qrCode ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-100 mb-6">
                <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Scan to Link WhatsApp</h3>
              <ol className="text-sm text-slate-600 space-y-2 max-w-sm text-left bg-white p-4 rounded-xl border border-slate-200">
                <li className="flex items-start"><span className="font-bold mr-2">1.</span> Open WhatsApp on your phone</li>
                <li className="flex items-start"><span className="font-bold mr-2">2.</span> Tap Menu (⋮) or Settings and select Linked Devices</li>
                <li className="flex items-start"><span className="font-bold mr-2">3.</span> Tap on Link a Device</li>
                <li className="flex items-start"><span className="font-bold mr-2">4.</span> Point your phone to this screen to capture the QR code</li>
              </ol>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <AlertTriangle className="w-10 h-10 mb-4 text-amber-500" />
              <p className="font-bold text-slate-800">WhatsApp is Disconnected</p>
              
              {waError ? (
                <div className="mt-4 max-w-sm text-center p-3 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-sm text-red-600 font-bold mb-1">Server Error:</p>
                  <p className="text-xs text-red-500 font-mono break-words">{waError}</p>
                </div>
              ) : (
                <p className="text-sm mt-1">Please wait while the server generates a new QR code...</p>
              )}
              
              {waStatus === 'disconnected' && !isLoading && (
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-all"
                >
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Preferences Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <span>Automation Preferences</span>
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure how and when automated messages are sent.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Enable Automated Messages</h3>
              <p className="text-xs text-slate-500 mt-1">If turned off, no receipts or reminders will be sent automatically.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={autoMessagesEnabled} onChange={(e) => handleToggleAutoMessages(e.target.checked)} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-6">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Daily Reminder Window</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">Number of days before the due date to start sending daily background reminders.</p>
            </div>
            <select
              value={reminderWindowDays}
              onChange={(e) => handleReminderWindowChange(Number(e.target.value))}
              className="bg-slate-50 border border-slate-300 text-slate-800 font-bold text-sm rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value={1}>1 Day Before</option>
              <option value={2}>2 Days Before</option>
              <option value={3}>3 Days Before</option>
              <option value={5}>5 Days Before</option>
              <option value={7}>7 Days Before</option>
            </select>
          </div>
        </div>
      </div>

      {/* Attendance & Absentee Tracking Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <span>Absentee Tracking</span>
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Track members who haven't tapped their NFC cards recently.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Enable Absentee Tracking</h3>
              <p className="text-xs text-slate-500 mt-1">If enabled, absent members will be highlighted in the Members tab.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={absentTrackingEnabled} 
                onChange={(e) => handleToggleAbsentTracking(e.target.checked)} 
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {absentTrackingEnabled && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-6">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Absent Threshold (Days)</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">Mark a member as absent if they haven't checked in for this many days.</p>
              </div>
              <select
                value={absentThresholdDays}
                onChange={(e) => handleAbsentThresholdChange(Number(e.target.value))}
                className="bg-slate-50 border border-slate-300 text-slate-800 font-bold text-sm rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value={2}>2 Days</option>
                <option value={3}>3 Days</option>
                <option value={5}>5 Days</option>
                <option value={7}>7 Days</option>
                <option value={10}>10 Days</option>
                <option value={14}>14 Days</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
