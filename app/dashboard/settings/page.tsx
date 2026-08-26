'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings, Smartphone, MessageSquare, ShieldCheck, Store, FileText,
  Save, RefreshCw, LogOut, CheckCircle2, AlertTriangle, Fingerprint,
  Radio, Lock, Eye, EyeOff, Package, Wifi, WifiOff, Send, RotateCcw,
  ChevronRight, Key, Search, Shield, Check, QrCode, Printer, Megaphone
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getTemplate, TemplateType, DEFAULT_TEMPLATES } from '@/lib/templates';
import { getGymSettings, updateGymSettings, getGyms, changeGymPassword } from '@/lib/actions';

type TabType = 'general' | 'whatsapp' | 'attendance' | 'store' | 'templates' | 'password';

const TABS: { key: TabType; label: string; icon: React.ReactNode }[] = [
  { key: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
  { key: 'whatsapp', label: 'WhatsApp', icon: <Smartphone className="w-4 h-4" /> },
  { key: 'attendance', label: 'Attendance', icon: <Fingerprint className="w-4 h-4" /> },
  { key: 'store', label: 'Store / POS', icon: <Store className="w-4 h-4" /> },
  { key: 'templates', label: 'Templates', icon: <FileText className="w-4 h-4" /> },
  { key: 'password', label: 'Password', icon: <Key className="w-4 h-4" /> },
];

function Toggle({ enabled, onChange, label, desc }: { enabled: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${enabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [gymId, setGymId] = useState<string | null>(null);
  const [gymUserId, setGymUserId] = useState<string>('');
  const [settings, setSettings] = useState<any>(null);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // WhatsApp State
  const [waStatus, setWaStatus] = useState<string>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [waLoading, setWaLoading] = useState(true);
  const [autoMessages, setAutoMessages] = useState(true);
  const [attendanceMessages, setAttendanceMessages] = useState(true);
  const [autoReply, setAutoReply] = useState(true);
  const [autoArchive, setAutoArchive] = useState(false);
  const [reminderDays, setReminderDays] = useState(3);
  const [absentTracking, setAbsentTracking] = useState(false);
  const [absentDays, setAbsentDays] = useState(3);

  // Attendance Mode State
  const [attendanceMode, setAttendanceMode] = useState<'MANUAL' | 'NFC' | 'FINGERPRINT' | 'BOTH'>('NFC');
  const [fpPort, setFpPort] = useState(8765);

  // Store State
  const [productsEnabled, setProductsEnabled] = useState(false);

  // UI State
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  // Templates State
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('welcome');
  const [templateContent, setTemplateContent] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Password Change State
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  useEffect(() => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') : null;
    const savedUserId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_user_id') : null;
    setGymId(savedId);
    setGymUserId(savedUserId || '');
    if (savedId) loadSettings(savedId);
  }, []);

  const loadSettings = async (id: string) => {
    const data = await getGymSettings(id);
    setSettings(data);
    setAutoMessages(data.waAutoMessages ?? true);
    setAttendanceMessages(data.waAttendanceMessages ?? true);
    setAutoReply(data.waAutoReply ?? true);
    setAutoArchive(data.waAutoArchive ?? false);
    setReminderDays(data.waReminderWindowDays ?? 3);
    setAbsentTracking(data.absentTrackingEnabled ?? false);
    setAbsentDays(data.absentThresholdDays ?? 3);
    setAttendanceMode((data.attendanceMode as any) ?? 'NFC');
    setFpPort(data.fingerprintAgentPort ?? 8765);
    setProductsEnabled(data.productsEnabled ?? false);
    
    if (typeof window !== 'undefined') {
      setAnimationsEnabled(localStorage.getItem('animations_enabled') !== 'false');
    }
  };

  const handlePrintQRCode = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    if (!printWindow) return;
    
    const qrSvg = document.getElementById('wa-invite-qr')?.outerHTML;
    const phone = settings?.ownerPhone || 'your gym number';
    const gymName = settings?.gymName || 'Our Gym';

    printWindow.document.write(`
      <html>
        <head>
          <title>Print WhatsApp Invite QR</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fff; text-align: center; }
            h1 { font-size: 32px; font-weight: 900; color: #0f172a; margin-bottom: 10px; }
            p { font-size: 18px; color: #475569; margin-bottom: 30px; }
            .qr-container { padding: 20px; background: #fff; border: 4px solid #1e40af; border-radius: 20px; }
            svg { width: 300px; height: 300px; }
            .footer { margin-top: 20px; font-size: 16px; color: #0f172a; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Welcome to ${gymName}</h1>
          <p>Scan this code to instantly activate your live check-in & automated services!</p>
          <div class="qr-container">
            ${qrSvg || ''}
          </div>
          <div class="footer">Or message "Start" to ${phone} on WhatsApp</div>
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    setTemplateContent(getTemplate(settings, selectedTemplate));
  }, [settings, selectedTemplate]);

  // Poll WA status
  useEffect(() => {
    if (!gymId) return;
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/whatsapp/status?gymId=${gymId}`);
        const data = await res.json();
        setWaStatus(data.status);
        setQrCode(data.qr);
      } catch { /* offline */ } finally {
        setWaLoading(false);
      }
    };
    fetchStatus();
    const interval = setInterval(() => { if (waStatus !== 'connected') fetchStatus(); }, 3000);
    return () => clearInterval(interval);
  }, [gymId, waStatus]);

  const showSuccess = (text: string) => { setSaveMsg({ type: 'success', text }); setTimeout(() => setSaveMsg(null), 3000); };
  const showError = (text: string) => { setSaveMsg({ type: 'error', text }); setTimeout(() => setSaveMsg(null), 4000); };

  const saveSetting = async (data: any) => {
    if (gymId) { await updateGymSettings(gymId, data); showSuccess('Saved!'); }
  };

  const handleToggle = async (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    await saveSetting({ [key]: value });
  };

  const handlePasswordChange = async () => {
    if (!gymId) return;
    if (!currentPass || !newPass || !confirmPass) { showError('All fields are required'); return; }
    if (newPass.length < 4) { showError('New password must be at least 4 characters'); return; }
    if (newPass !== confirmPass) { showError('New passwords do not match'); return; }
    setPassLoading(true);
    try {
      const result = await changeGymPassword(gymId, currentPass, newPass);
      if (result.success) {
        showSuccess('Password changed successfully!');
        setCurrentPass(''); setNewPass(''); setConfirmPass('');
      } else {
        showError(result.error || 'Failed to change password');
      }
    } finally {
      setPassLoading(false);
    }
  };

  const handleDisconnectWA = async () => {
    if (!gymId) return;
    setWaLoading(true);
    try {
      await fetch('/api/whatsapp/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gymId }) });
      setWaStatus('disconnected'); setQrCode(null);
    } finally { setWaLoading(false); }
  };

  const handleTestMessage = async () => {
    if (!gymId) return;
    const phone = prompt('Enter phone with country code (e.g. 919876543210):');
    if (!phone) return;
    const res = await fetch('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gymId, phone, message: 'Hello from GymFlow! 🏋️ Your WhatsApp is working perfectly.' }) });
    const data = await res.json();
    if (data.success) alert('Test message sent!'); else alert('Failed to send.');
  };

  const handleSaveTemplate = async () => {
    if (!gymId) return;
    const key: Record<TemplateType, string> = { welcome: 'templateWelcome', receipt: 'templateReceipt', reminder: 'templateReminder', absentee: 'templateAbsentee', checkin: 'templateCheckIn', checkout: 'templateCheckOut' };
    const newSettings = await updateGymSettings(gymId, { [key[selectedTemplate]]: templateContent });
    setSettings(newSettings);
    showSuccess('Template saved!');
  };

  const handleAttendanceModeChange = async (mode: 'MANUAL' | 'NFC' | 'FINGERPRINT' | 'BOTH') => {
    setAttendanceMode(mode);
    await saveSetting({ attendanceMode: mode });
  };

  const handleProductsToggle = async (enabled: boolean) => {
    setProductsEnabled(enabled);
    await updateGymSettings(gymId!, { productsEnabled: enabled });
    // Update localStorage so sidebar can react immediately
    if (typeof window !== 'undefined') {
      localStorage.setItem('products_enabled', String(enabled));
      window.dispatchEvent(new Event('settings_updated'));
    }
    showSuccess(enabled ? 'Store / POS enabled! Refresh to see in sidebar.' : 'Store / POS disabled.');
  };

  const handleAnimationsToggle = (enabled: boolean) => {
    setAnimationsEnabled(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('animations_enabled', String(enabled));
      window.dispatchEvent(new Event('settings_updated'));
    }
    showSuccess(enabled ? 'UI Animations enabled.' : 'UI Animations disabled.');
  };

  const ATTENDANCE_MODES = [
    { key: 'MANUAL', label: 'Manual Search Only', icon: <Search className="w-4 h-4" />, desc: 'Staff searches by name to check-in. No hardware required.' },
    { key: 'NFC', label: 'NFC Card Only', icon: <Radio className="w-4 h-4" />, desc: 'Members tap their NFC card at the terminal. (Current behavior)' },
    { key: 'FINGERPRINT', label: 'Fingerprint Only', icon: <Fingerprint className="w-4 h-4" />, desc: 'Mantra MFS100 USB fingerprint scanner. Local bridge agent required.' },
    { key: 'BOTH', label: 'NFC + Fingerprint', icon: <Shield className="w-4 h-4" />, desc: 'Both NFC and fingerprint scanner active simultaneously.' },
  ];

  return (
    <>
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold mb-2">
            <Settings className="w-3.5 h-3.5" /><span>Configuration</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gym Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage all gym preferences, hardware, and integrations.</p>
        </div>
        {saveMsg && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${saveMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            {saveMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {saveMsg.text}
          </div>
        )}
      </div>

      {/* Tab Nav */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${activeTab === tab.key ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">

          {/* ─── GENERAL TAB ─── */}
          {activeTab === 'general' && (
            <div className="space-y-8">
              {/* Gym Info */}
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-4">Gym Profile</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Gym Name', key: 'gymName', placeholder: 'Iron Pulse Fitness' },
                    { label: 'Owner Phone (for WhatsApp)', key: 'ownerPhone', placeholder: '9876543210' },
                    { label: 'UPI ID', key: 'upiId', placeholder: 'gymname@upi' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">{field.label}</label>
                      <input
                        type="text"
                        defaultValue={settings?.[field.key] || ''}
                        onBlur={async (e) => { await saveSetting({ [field.key]: e.target.value }); }}
                        placeholder={field.placeholder}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-800 outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* UI Preferences */}
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-4">UI Preferences</h3>
                <div className="bg-white border border-slate-200 rounded-xl px-4 py-2">
                  <Toggle
                    label="Smooth Animations"
                    desc="Enable smooth page transitions and hover effects (disable for max performance)"
                    enabled={animationsEnabled}
                    onChange={handleAnimationsToggle}
                  />
                </div>
              </div>

            </div>
          )}

          {/* ─── PASSWORD TAB ─── */}
          {activeTab === 'password' && (
            <div className="space-y-8">
              {/* Change Password */}
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <Key className="w-4 h-4" /> Change Password
                </h3>
                <p className="text-xs text-slate-500 mb-4">Update your gym login password. Current password is required for verification.</p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 max-w-md">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPass ? 'text' : 'password'}
                        value={currentPass}
                        onChange={e => setCurrentPass(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full px-3.5 py-2.5 pr-10 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-800 outline-none"
                      />
                      <button type="button" onClick={() => setShowCurrentPass(!showCurrentPass)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700">
                        {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        value={newPass}
                        onChange={e => setNewPass(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full px-3.5 py-2.5 pr-10 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-800 outline-none"
                      />
                      <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700">
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPass}
                      onChange={e => setConfirmPass(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-800 outline-none"
                    />
                  </div>
                  <button
                    onClick={handlePasswordChange}
                    disabled={passLoading}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {passLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    {passLoading ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── WHATSAPP TAB ─── */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-6">
              {/* Connection Status */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Smartphone className="w-4 h-4" /> WhatsApp Connection
                  </h3>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${waStatus === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {waStatus === 'connected' ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                    {waStatus === 'connected' ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
                
                <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-blue-900 text-sm flex items-center gap-1.5"><Megaphone className="w-4 h-4" /> Message Broadcast</h4>
                    <p className="text-xs text-blue-700 mt-0.5">Send a message to all your members instantly.</p>
                  </div>
                  <Link href="/dashboard/broadcast" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors">
                    Go to Broadcast
                  </Link>
                </div>

                {waStatus === 'connected' ? (
                  <div className="flex gap-3">
                    <button onClick={handleTestMessage} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
                      <Send className="w-4 h-4" /> Send Test Message
                    </button>
                    <button onClick={handleDisconnectWA} className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-sm font-semibold rounded-lg flex items-center gap-2">
                      <LogOut className="w-4 h-4" /> Disconnect
                    </button>
                  </div>
                ) : (
                  <div>
                    {qrCode ? (
                      <div className="text-center">
                        <p className="text-sm text-slate-600 mb-3 font-medium">Scan this QR code with WhatsApp on your phone</p>
                        <div className="inline-block p-3 bg-white border-2 border-slate-200 rounded-xl">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={qrCode} alt="WhatsApp QR Code" className="w-56 h-56" />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">WhatsApp → Linked Devices → Link a device</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-slate-500 text-sm py-4">
                        <RefreshCw className={`w-5 h-5 ${waLoading ? 'animate-spin' : ''}`} />
                        {waLoading ? 'Connecting to WhatsApp...' : 'Waiting for QR code...'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Printable Invite QR Code */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-1">
                      <QrCode className="w-5 h-5 text-blue-700" /> WhatsApp Invite QR Code
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm">
                      Print this QR code and place it at your front desk. Customers can simply scan it to automatically message "Start" and activate your bot, without needing to save your number.
                    </p>
                  </div>
                  
                  {settings?.ownerPhone ? (
                    <div className="flex flex-col items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                        <QRCodeSVG 
                          id="wa-invite-qr"
                          value={`https://wa.me/91${settings.ownerPhone}?text=Start`}
                          size={120}
                          level="H"
                          includeMargin={false}
                          fgColor="#0f172a"
                        />
                      </div>
                      <button 
                        onClick={handlePrintQRCode}
                        className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors w-full justify-center"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print Poster
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200 font-semibold max-w-[200px] text-center">
                      Please enter your "Owner Phone" in the General tab first to generate your QR Code.
                    </div>
                  )}
                </div>
              </div>

              {/* Automation Toggles */}
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-3">Automation Settings</h3>
                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 px-4">
                  <Toggle enabled={autoMessages} label="Auto-send Payment Receipts" desc="Send receipt automatically when a member pays" onChange={v => handleToggle('waAutoMessages', v, setAutoMessages)} />
                  <Toggle enabled={attendanceMessages} label="Auto-send Check-in/Check-out Messages" desc="Notify members on entry and exit" onChange={v => handleToggle('waAttendanceMessages', v, setAttendanceMessages)} />
                  <Toggle enabled={autoReply} label="Auto-reply to Member Queries" desc="Reply automatically when members message the bot" onChange={v => handleToggle('waAutoReply', v, setAutoReply)} />
                  <Toggle enabled={autoArchive} label="Auto-archive Chats After Payment" desc="Archive conversation thread after dues are cleared" onChange={v => handleToggle('waAutoArchive', v, setAutoArchive)} />
                </div>
              </div>

              {/* Reminder Settings */}
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-3">Reminder Configuration</h3>
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Renewal Reminder Window</p>
                      <p className="text-xs text-slate-500">Days before expiry to start sending reminders</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 5, 7].map(d => (
                        <button key={d} onClick={async () => { setReminderDays(d); await saveSetting({ waReminderWindowDays: d }); }}
                          className={`w-8 h-8 text-xs rounded-lg font-bold border transition-colors ${reminderDays === d ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400'}`}
                        >{d}</button>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-4">
                    <Toggle enabled={absentTracking} label="Absentee Follow-up Messages" desc="Message members who haven't visited for a while" onChange={v => handleToggle('absentTrackingEnabled', v, setAbsentTracking)} />
                    {absentTracking && (
                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-sm text-slate-600 font-medium">Threshold:</span>
                        {[2, 3, 5, 7, 10].map(d => (
                          <button key={d} onClick={async () => { setAbsentDays(d); await saveSetting({ absentThresholdDays: d }); }}
                            className={`w-8 h-8 text-xs rounded-lg font-bold border transition-colors ${absentDays === d ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400'}`}
                          >{d}</button>
                        ))}
                        <span className="text-xs text-slate-500">days absent</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── ATTENDANCE TAB ─── */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1">Attendance Mode</h3>
                <p className="text-sm text-slate-500 mb-4">Choose how members check-in at the gym. This controls what hardware and UI the Check-in terminal uses.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ATTENDANCE_MODES.map(mode => (
                    <button key={mode.key} onClick={() => handleAttendanceModeChange(mode.key as any)}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${attendanceMode === mode.key ? 'border-slate-900 bg-slate-50 shadow-sm' : 'border-slate-200 hover:border-slate-400'}`}
                    >
                      {mode.icon}
                      <div>
                        <p className={`text-sm font-bold ${attendanceMode === mode.key ? 'text-slate-900' : 'text-slate-700'}`}>{mode.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{mode.desc}</p>
                      </div>
                      {attendanceMode === mode.key && <CheckCircle2 className="w-5 h-5 text-slate-900 ml-auto flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fingerprint Config */}
              {(attendanceMode === 'FINGERPRINT' || attendanceMode === 'BOTH') && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2 text-blue-800 font-bold">
                    <Fingerprint className="w-5 h-5" /> Mantra MFS100 Configuration
                  </div>
                  <p className="text-sm text-blue-700">
                    The MFS100 USB fingerprint scanner connects via a <strong>local WebSocket bridge agent</strong> installed on the gym PC. Download and run the GymFlow Bridge Agent on the PC where the MFS100 is plugged in.
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-blue-700 uppercase tracking-wider mb-1.5">Bridge Agent WebSocket Port</label>
                      <input
                        type="number"
                        value={fpPort}
                        onChange={e => setFpPort(Number(e.target.value))}
                        onBlur={async () => { await saveSetting({ fingerprintAgentPort: fpPort }); showSuccess('Port saved!'); }}
                        className="w-32 px-3.5 py-2.5 bg-white border border-blue-200 rounded-lg text-sm font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="mt-5">
                      <p className="text-xs text-blue-600 font-medium">Default: <code className="bg-blue-100 px-1.5 py-0.5 rounded">ws://localhost:8765</code></p>
                    </div>
                  </div>
                  <div className="bg-blue-100/60 rounded-lg p-3">
                    <p className="text-xs text-blue-700 font-semibold mb-2">How to set up fingerprint check-in:</p>
                    <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
                      <li>Install Mantra MFS100 driver on Windows PC</li>
                      <li>Download & run the GymFlow Bridge Agent (.exe) on the same PC</li>
                      <li>Enroll member fingerprints by editing each member profile → set Fingerprint ID</li>
                      <li>The Check-in terminal will now detect scans automatically</li>
                    </ol>
                  </div>
                </div>
              )}

              {attendanceMode === 'NFC' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                  <Radio className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">NFC Mode Active</p>
                    <p className="text-sm text-emerald-700">Members tap their NFC card at the web NFC terminal. Requires Android Chrome browser on the reception PC/tablet. Each member's NFC Card ID is set in their profile.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── STORE TAB ─── */}
          {activeTab === 'store' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1">Store / POS Feature</h3>
                <p className="text-sm text-slate-500 mb-4">Enable a full product catalog and Point-of-Sale system. Sell supplements, accessories, and gym merchandise — all sales auto-appear in the Revenue Hub.</p>
                <div className="bg-white border-2 border-slate-200 rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${productsEnabled ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        <Store className={`w-6 h-6 ${productsEnabled ? 'text-emerald-600' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">Enable Store & POS</p>
                        <p className="text-xs text-slate-500">Adds a "Store / POS" tab to the sidebar navigation</p>
                      </div>
                    </div>
                    <button onClick={() => handleProductsToggle(!productsEnabled)}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 ${productsEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${productsEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {productsEnabled && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-emerald-800 font-semibold mb-2">
                    <CheckCircle2 className="w-4 h-4" /> Store is enabled
                  </div>
                  <ul className="text-sm text-emerald-700 space-y-1">
                    <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Product catalog with categories (Supplements, Accessories, Drinks, etc.)</li>
                    <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Point-of-Sale cart with cash / UPI / card / split payments</li>
                    <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Live stock tracking &amp; low-stock alerts</li>
                    <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Every sale auto-creates an Income entry in Revenue Hub</li>
                    <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Sales history tab with date filters</li>
                  </ul>
                  <p className="text-xs text-emerald-600 mt-3 font-medium">Navigate to "Store / POS" in the sidebar to add products and start selling.</p>
                </div>
              )}

              {!productsEnabled && (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Enable the Store feature above to manage products and process sales.</p>
                </div>
              )}
            </div>
          )}

          {/* ─── TEMPLATES TAB ─── */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1">WhatsApp Message Templates</h3>
                <p className="text-sm text-slate-500 mb-4">Customize the messages sent to members. Use placeholders like <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{'{{name}}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{'{{amount}}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{'{{joinDate}}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{'{{dueDate}}'}</code>.</p>
              </div>

              {/* Template Selector */}
              <div className="flex flex-wrap gap-2 mb-4">
                {(['welcome', 'receipt', 'reminder', 'absentee', 'checkin', 'checkout'] as TemplateType[]).map(t => (
                  <button key={t} onClick={() => setSelectedTemplate(t)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${selectedTemplate === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >{t}</button>
                ))}
              </div>

              <textarea
                value={templateContent}
                onChange={e => setTemplateContent(e.target.value)}
                rows={9}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:ring-2 focus:ring-slate-800 outline-none resize-none"
              />

              <div className="flex gap-3">
                <button onClick={handleSaveTemplate} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg">
                  <Save className="w-4 h-4" /> Save Template
                </button>
                <button onClick={() => setShowResetConfirm(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg">
                  <RotateCcw className="w-4 h-4" /> Reset to Default
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ animation: animationsEnabled ? 'fadeIn 0.2s ease-out' : 'none' }}>
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0 text-rose-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Reset Template?</h3>
                <p className="text-xs text-slate-500 mt-0.5">This cannot be undone.</p>
              </div>
            </div>
            <div className="p-5 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowResetConfirm(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button 
                onClick={() => {
                  setTemplateContent(DEFAULT_TEMPLATES[selectedTemplate]);
                  setShowResetConfirm(false);
                }} 
                className="px-4 py-2 text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-sm"
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
