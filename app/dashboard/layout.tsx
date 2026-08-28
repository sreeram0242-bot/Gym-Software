'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Smartphone, Users, Bell, CreditCard, Dumbbell, ShieldCheck, ChevronDown, LogOut, Sparkles, X, Settings, AlertTriangle, Megaphone, Lock, CheckCircle, Store, Briefcase } from 'lucide-react';
import { getGyms, findCustomerByNFC, findStaffByNFC, toggleCheckIn, toggleStaffCheckIn, getMemberMonthlyAvgHours, getCustomers, getGymSettings, getActiveAnnouncement } from '@/lib/actions';
import { Gym, Customer, AttendanceRecord } from '@/lib/types';
import { getTemplate, compileTemplate } from '@/lib/templates';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [gyms, setGyms] = useState<any[]>([]);
  const [currentGym, setCurrentGym] = useState<any | null>(null);

  // Global Notification for Member Scans (Top Right)
  const [globalNotification, setGlobalNotification] = useState<{
    customerName: string;
    action: 'checkin' | 'checkout';
    record: any;
    avgHours: number;
  } | null>(null);

  // Global Notification for Staff Punches (Bottom Right)
  const [globalStaffNotification, setGlobalStaffNotification] = useState<{
    staffName: string;
    staffRole: string;
    action: 'checkin' | 'checkout';
    record: any;
    durationMinutes?: number | null;
  } | null>(null);

  const [waStatus, setWaStatus] = useState<string>('connected');
  const [globalToast, setGlobalToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [productsEnabled, setProductsEnabled] = useState<boolean>(false);
  const [attendanceMode, setAttendanceMode] = useState<string>('NFC');
  const [animationsEnabled, setAnimationsEnabled] = useState<boolean>(true);
  
  // Track if we are in Master Admin impersonation mode
  const isMasterAdmin = typeof window !== 'undefined' ? localStorage.getItem('is_master_admin') === 'true' : false;

  useEffect(() => {
    const initLayout = async () => {
      const loadedGyms = await getGyms();
      setGyms(loadedGyms);

      const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') : null;

      // Find gym. Master admins can view suspended gyms.
      const matched = loadedGyms.find((g: any) => g.id === savedId && (g.status === 'active' || isMasterAdmin));
      
      if (!matched) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('active_gym_id');
        }
        router.push('/');
        return;
      }
      
      setCurrentGym(matched);

      // Load gym settings for feature toggles
      try {
        const { getGymSettings: fetchSettings } = await import('@/lib/actions');
        const gymSettings = await fetchSettings(matched.id);
        setProductsEnabled(gymSettings?.productsEnabled ?? false);
        setAttendanceMode(gymSettings?.attendanceMode ?? 'NFC');
        if (typeof window !== 'undefined') {
          localStorage.setItem('products_enabled', String(gymSettings?.productsEnabled ?? false));
        }
      } catch (e) {
        // Use cached localStorage value as fallback
        const cached = typeof window !== 'undefined' ? localStorage.getItem('products_enabled') === 'true' : false;
        setProductsEnabled(cached);
      }

      // Check animations
      if (typeof window !== 'undefined') {
        const anim = localStorage.getItem('animations_enabled');
        if (anim === 'false') setAnimationsEnabled(false);
      }

      // WhatsApp Status Check
      const checkWaStatus = async (id: string) => {
        try {
          const res = await fetch(`/api/whatsapp/status?gymId=${id}`);
          if (res.ok) {
            const data = await res.json();
            setWaStatus(data.status);
          }
        } catch (e) {}
      };
      checkWaStatus(matched.id);
      const waInterval = setInterval(() => checkWaStatus(matched.id), 60000);

      // Automated Daily Reminders (Due, Overdue, Absentee)
      const runDailyReminders = async (id: string) => {
        try {
          const lastRunKey = `last_auto_reminders_${id}`;
          const today = new Date().toISOString().split('T')[0];
          if (localStorage.getItem(lastRunKey) !== today) {
            localStorage.setItem(lastRunKey, today);
            fetch('/api/whatsapp/auto-reminders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ gymId: id })
            }).catch(() => {});
          }
        } catch (e) {}
      };
      runDailyReminders(matched.id);

      // Global NFC scanner keyboard listener
      let buffer = '';
      let lastKeyTime = Date.now();
      let notificationTimeout: NodeJS.Timeout;

      const handleKeyDown = async (e: KeyboardEvent) => {
        // Don't intercept if they are actively typing in an input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        const now = Date.now();
        if (now - lastKeyTime > 50) {
          buffer = ''; // Reset if typing is too slow (human typing)
        }
        lastKeyTime = now;

        if (e.key === 'Enter' && buffer.length > 3) {
          // Attempt to find customer by NFC
          const matchedCust = await findCustomerByNFC(matched.id, buffer);
          if (matchedCust) {
            const { record, action } = await toggleCheckIn(matchedCust.id);
            const avgHours = 1.2; // default
            
            setGlobalNotification({
              customerName: matchedCust.name,
              action: action as 'checkin' | 'checkout',
              record,
              avgHours
            });

            if (notificationTimeout) clearTimeout(notificationTimeout);
            notificationTimeout = setTimeout(() => {
              setGlobalNotification(null);
            }, 5000);

            // Fetch settings to check if Attendance WA messages are enabled
            const gymSettings = await getGymSettings(matched.id);
            if (gymSettings?.waAttendanceMessages && matchedCust.phone) {
              const templateName = action === 'checkin' ? 'checkin' : 'checkout';
              const rawTemplate = getTemplate(gymSettings, templateName);
              
              const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const duration = record.durationMinutes || 0;
              
              const message = compileTemplate(rawTemplate, {
                gymName: matched.name,
                name: matchedCust.name,
                time: nowTime,
                duration: duration.toString()
              });

              fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  gymId: matched.id,
                  phone: matchedCust.phone,
                  message
                })
              }).then(res => res.json()).then(data => {
                if (data.success && typeof window !== 'undefined') {
                   window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: `Attendance message sent to ${matchedCust.name}`, type: 'success' } }));
                } else if (typeof window !== 'undefined') {
                   window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: `Failed to send attendance message: ${data.error}`, type: 'error' } }));
                }
              }).catch(() => {
                if (typeof window !== 'undefined') {
                   window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: `Failed to send attendance message to ${matchedCust.name}`, type: 'error' } }));
                }
              });
            }

          } else {
            // Check if it's a Staff Member
            const matchedStaff = await findStaffByNFC(matched.id, buffer);
            if (matchedStaff) {
              const staffRes = await toggleStaffCheckIn(matchedStaff.id);
              const isPunchIn = staffRes?.action === 'checkin';
              
              setGlobalStaffNotification({
                staffName: matchedStaff.name,
                staffRole: matchedStaff.role || 'Staff',
                action: isPunchIn ? 'checkin' : 'checkout',
                record: staffRes?.record,
                durationMinutes: staffRes?.record?.durationMinutes
              });

              if (notificationTimeout) clearTimeout(notificationTimeout);
              notificationTimeout = setTimeout(() => {
                setGlobalStaffNotification(null);
              }, 5000);
            } else {
              // New unregistered NFC Card scanned!
              if (typeof window !== 'undefined') {
                if (window.location.pathname === '/dashboard/members') {
                  window.dispatchEvent(new CustomEvent('open_add_member', { detail: { nfcId: buffer } }));
                } else {
                  router.push(`/dashboard/members?new_nfc=${buffer}`);
                }
              }
            }
          }
          buffer = '';
        } else if (e.key.length === 1) {
          buffer += e.key;
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      const handleGlobalToast = (e: any) => {
        setGlobalToast(e.detail);
        setTimeout(() => setGlobalToast(null), 3500);
      };
      window.addEventListener('global-toast', handleGlobalToast);

      const handleStaffPunchEvent = (e: any) => {
        if (e.detail) {
          setGlobalStaffNotification({
            staffName: e.detail.staffName,
            staffRole: e.detail.staffRole || 'Staff',
            action: e.detail.action || 'checkin',
            record: e.detail.record,
            durationMinutes: e.detail.durationMinutes
          });
          if (notificationTimeout) clearTimeout(notificationTimeout);
          notificationTimeout = setTimeout(() => {
            setGlobalStaffNotification(null);
          }, 5000);
        }
      };
      window.addEventListener('staff_punch_event', handleStaffPunchEvent);

      return () => {
        window.removeEventListener('keydown', handleKeyDown as unknown as EventListener);
        window.removeEventListener('global-toast', handleGlobalToast);
        window.removeEventListener('staff_punch_event', handleStaffPunchEvent);
        if (notificationTimeout) clearTimeout(notificationTimeout);
        clearInterval(waInterval);
      };
    };

    const cleanupPromise = initLayout();

    return () => {
      // Best effort cleanup in an async effect
      cleanupPromise.then(cleanupFn => {
        if (typeof cleanupFn === 'function') cleanupFn();
      });
    };
  }, [router]);

  const handleSwitchGym = (gymId: string) => {
    const selected = gyms.find((g: any) => g.id === gymId);
    if (selected) {
      setCurrentGym(selected);
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_gym_id', gymId);
      }
    }
  };

  const navItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: attendanceMode === 'FINGERPRINT' ? 'Fingerprint' : attendanceMode === 'BOTH' ? 'Check-in' : attendanceMode === 'MANUAL' ? 'Check-in' : 'NFC Terminal', href: '/dashboard/checkin', icon: Smartphone },
    { label: 'Members', href: '/dashboard/members', icon: Users },
    { label: 'Staffs', href: '/dashboard/staffs', icon: Briefcase },
    { label: 'Reminders', href: '/dashboard/reminders', icon: Bell },
    { label: 'Broadcast', href: '/dashboard/broadcast', icon: Megaphone },
    { label: 'Revenue', href: '/dashboard/revenue', icon: CreditCard },
    ...(productsEnabled ? [{ label: 'Store / POS', href: '/dashboard/products', icon: Store }] : []),
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  // Listen for settings_updated event to refresh productsEnabled
  useEffect(() => {
    const handleSettingsUpdate = () => {
      if (typeof window !== 'undefined') {
        setProductsEnabled(localStorage.getItem('products_enabled') === 'true');
        setAnimationsEnabled(localStorage.getItem('animations_enabled') !== 'false');
      }
    };
    window.addEventListener('settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('settings_updated', handleSettingsUpdate);
  }, []);

  if (!currentGym) return null; // Loading or unauthorized

  // Handle suspended gym state for normal users
  if (currentGym.status === 'suspended' && !isMasterAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-md bg-white border border-rose-200 rounded-2xl shadow-xl overflow-hidden p-8">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-rose-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Account Suspended</h2>
          <p className="text-slate-500 mb-8">
            Your gym platform access has been temporarily suspended due to billing or policy violations. Please contact the platform administrator to restore your access.
          </p>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') localStorage.removeItem('active_gym_id');
              router.push('/');
            }}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans md:flex-row pb-20 md:pb-0 max-w-full overflow-x-clip ${!animationsEnabled ? 'animations-disabled' : ''}`}>
      


      {/* Global WA Disconnected Warning */}
      {(waStatus === 'disconnected' || waStatus === 'scan_qr') && (
        <div className={`fixed top-0 left-0 right-0 z-[90] px-4 py-2 flex items-center justify-center text-xs font-bold bg-rose-600 text-white shadow-md animate-in slide-in-from-top-2`}>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4" />
            <span>
              {waStatus === 'scan_qr' 
                ? 'WhatsApp Setup: Scan the QR code in Settings to connect your number.'
                : 'WhatsApp Disconnected: Payment reminders and notifications are paused.'}
            </span>
            <Link href="/dashboard/settings?tab=whatsapp" className="ml-2 underline hover:text-rose-100">
              {waStatus === 'scan_qr' ? 'Setup Now' : 'Reconnect'}
            </Link>
          </div>
        </div>
      )}

      {/* Global Right-Bottom Toast for Messages */}
      {globalToast && (
        <div className={`fixed bottom-20 md:bottom-6 right-6 z-[200] flex items-center space-x-2 px-4 py-3 rounded-xl shadow-xl animate-in slide-in-from-right-4 fade-in ${
          globalToast.type === 'error' ? 'bg-rose-600 text-white' : 
          globalToast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
        }`}>
          {globalToast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span className="font-bold text-sm">{globalToast.message}</span>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className={`hidden md:flex md:w-64 bg-white border-r border-slate-200 flex-col sticky z-30 shadow-sm top-0 h-screen`}>
        {/* Brand */}
        <div className="h-12 px-4 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900 shrink-0">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="Gym Logo" className="w-7 h-7 object-contain rounded-xl shadow-sm border border-slate-200 bg-white p-0.5" />
            <div className="flex flex-col justify-center">
              <span className="font-extrabold text-slate-900 text-sm tracking-tight leading-tight">GymFlow</span>
              <span className="block text-[10px] font-semibold text-slate-500 leading-tight">Gym Admin</span>
            </div>
          </div>
        </div>

        {/* Gym Tenant Info (Static) */}
        <div className="p-3 border-b border-slate-200 bg-slate-50/70 space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
              Active Gym Portal
            </label>
            <div className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs font-extrabold text-slate-800 shadow-sm flex items-center justify-between">
              <span>{currentGym?.name}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div className="mt-1.5 px-1 flex items-center justify-between text-xs text-slate-500">
              <span>Owner: {currentGym?.ownerName}</span>
              <span className="font-mono text-blue-900 text-xs font-semibold">{currentGym?.userId}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {/* Live WhatsApp Status Pill */}
            <Link
              href="/dashboard/settings?tab=whatsapp"
              className={`inline-flex items-center justify-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                waStatus === 'connected'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  : waStatus === 'initializing'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                  : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
              }`}
              title="Click to manage WhatsApp bot connection"
            >
              <span className={`w-2 h-2 rounded-full ${
                waStatus === 'connected' ? 'bg-emerald-500 animate-pulse' 
                : waStatus === 'initializing' ? 'bg-blue-500 animate-pulse' 
                : 'bg-amber-500'
              }`} />
              <Smartphone className="w-3.5 h-3.5" />
              <span>{
                waStatus === 'connected' ? 'WhatsApp Connected' 
                : waStatus === 'initializing' ? 'Connecting...' 
                : waStatus === 'scan_qr' ? 'Needs QR Scan' 
                : 'WhatsApp Offline'
              }</span>
            </Link>

            {/* Live NFC Terminal Badge */}
            <Link
              href="/dashboard/checkin"
              className="inline-flex items-center justify-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
            >
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </div>
              <span>NFC Terminal Active</span>
            </Link>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                  isActive
                    ? 'bg-blue-900 text-white shadow-md shadow-blue-900/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50">
          <button
            onClick={() => {
              let dest = '/';
              if (typeof window !== 'undefined') {
                localStorage.removeItem('active_gym_id');
                if (localStorage.getItem('is_master_admin') === 'true') {
                  dest = '/superadmin';
                }
              }
              router.push(dest);
            }}
            className="w-full flex items-center space-x-2 text-xs font-semibold text-rose-600 hover:text-rose-700 p-2 rounded-lg hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Secure Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN VIEW */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* MOBILE TOP BAR */}
        <header className="md:hidden bg-white border-b border-slate-200 sticky top-0 z-40 px-4 h-12 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <img src="/logo.png" alt="Gym Logo" className="w-7 h-7 object-contain rounded-lg shadow-sm border border-slate-200" />
            <div>
              <h1 className="font-bold text-slate-900 text-sm leading-tight">{currentGym?.name || 'Gym Portal'}</h1>
              <p className="text-xs text-blue-900 font-semibold">{currentGym?.ownerName}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Link
              href="/dashboard/settings?tab=whatsapp"
              className={`p-1.5 rounded-lg flex items-center gap-1 text-[11px] font-bold ${
                waStatus === 'connected' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : waStatus === 'initializing'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                waStatus === 'connected' ? 'bg-emerald-500' 
                : waStatus === 'initializing' ? 'bg-blue-500 animate-pulse' 
                : 'bg-amber-500'
              }`} />
              <span>{
                waStatus === 'connected' ? 'WA' 
                : waStatus === 'initializing' ? '...' 
                : 'Off'
              }</span>
            </Link>

            <button 
              onClick={() => {
                let dest = '/';
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('active_gym_id');
                  if (localStorage.getItem('is_master_admin') === 'true') {
                    dest = '/superadmin';
                  }
                }
                router.push(dest);
              }}
              className="p-1.5 text-rose-600 hover:text-rose-700 flex items-center space-x-1 bg-rose-50 rounded-lg px-2 py-1 text-xs font-bold transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* MAIN VIEW */}
        <main key={pathname} className="flex-1 min-w-0 px-3 pt-0 pb-20 sm:px-5 sm:pt-0 sm:pb-6 md:px-8 md:pt-0 md:pb-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (SLEEK & COMPACT) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-50 px-1 py-1 shadow-lg">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-1 justify-between">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all shrink-0 min-w-[54px] ${
                  isActive 
                    ? 'bg-blue-50 text-blue-900 font-black shadow-2xs border border-blue-200/60' 
                    : 'text-slate-500 hover:text-slate-800 font-semibold'
                }`}
              >
                <Icon className={`w-4 h-4 mb-0.5 transition-transform ${isActive ? 'text-blue-600 scale-110' : 'text-slate-400'}`} />
                <span className="text-[9.5px] leading-tight tracking-tight whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* MEMBER CHECK-IN NOTIFICATION POPUP (TOP RIGHT CORNER) */}
      {globalNotification && (
        <div className="fixed top-20 right-4 sm:right-8 z-[100] max-w-sm w-full animate-in slide-in-from-right-8 fade-in duration-300">
          <div
            className={`p-4 rounded-2xl border shadow-2xl flex items-center justify-between relative ${
              globalNotification.action === 'checkin'
                ? 'bg-blue-900 text-white border-blue-950'
                : 'bg-slate-700 text-white border-slate-800'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-bold text-xl">
                {globalNotification.customerName.charAt(0)}
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider opacity-80 flex items-center gap-1">
                  <span>{globalNotification.action === 'checkin' ? '✓ MEMBER CHECKED IN' : '✓ MEMBER CHECKED OUT'}</span>
                </div>
                <h3 className="font-extrabold text-base leading-tight">{globalNotification.customerName}</h3>
                <p className="text-xs opacity-90 mt-0.5">
                  Avg Monthly: <span className="font-bold underline">{globalNotification.avgHours} hrs/day</span>
                </p>
              </div>
            </div>

            <div className="text-right font-mono text-[10px] bg-white/10 px-2 py-1.5 rounded-lg backdrop-blur-md self-start ml-2">
              <div>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              {globalNotification.record?.durationMinutes && (
                <div className="mt-1">Session: {globalNotification.record.durationMinutes}m</div>
              )}
            </div>
            
            <button onClick={() => setGlobalNotification(null)} className="absolute -top-2 -right-2 bg-white text-slate-900 rounded-full p-1 shadow-md hover:bg-slate-100">
               <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STAFF CHECK-IN / SHIFT NOTIFICATION POPUP (BOTTOM RIGHT CORNER) */}
      {globalStaffNotification && (
        <div className="fixed bottom-6 right-4 sm:right-8 z-[100] max-w-sm w-full animate-in slide-in-from-bottom-8 fade-in duration-300">
          <div
            className={`p-4 rounded-2xl border shadow-2xl flex items-center justify-between relative ${
              globalStaffNotification.action === 'checkin'
                ? 'bg-purple-900 text-white border-purple-950'
                : 'bg-rose-900 text-white border-rose-950'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-bold text-xl">
                {globalStaffNotification.staffName.charAt(0)}
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider opacity-80 flex items-center gap-1">
                  <span>{globalStaffNotification.action === 'checkin' ? '✓ STAFF PUNCH IN (SHIFT STARTED)' : '✓ STAFF PUNCH OUT (SHIFT ENDED)'}</span>
                </div>
                <h3 className="font-extrabold text-base leading-tight">{globalStaffNotification.staffName}</h3>
                <p className="text-xs opacity-90 mt-0.5 font-semibold">
                  Role: <span className="font-bold underline">{globalStaffNotification.staffRole}</span>
                </p>
              </div>
            </div>

            <div className="text-right font-mono text-[10px] bg-white/10 px-2 py-1.5 rounded-lg backdrop-blur-md self-start ml-2">
              <div>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              {globalStaffNotification.durationMinutes ? (
                <div className="mt-1 font-bold">Shift: {Math.floor(globalStaffNotification.durationMinutes / 60)}h {globalStaffNotification.durationMinutes % 60}m</div>
              ) : null}
            </div>
            
            <button onClick={() => setGlobalStaffNotification(null)} className="absolute -top-2 -right-2 bg-white text-slate-900 rounded-full p-1 shadow-md hover:bg-slate-100">
               <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
