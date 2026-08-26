'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Smartphone, Users, Bell, CreditCard, Dumbbell, ShieldCheck, ChevronDown, LogOut, Sparkles, X, Settings, AlertTriangle, Megaphone, Lock, CheckCircle, Store } from 'lucide-react';
import { getGyms, findCustomerByNFC, toggleCheckIn, getMemberMonthlyAvgHours, getCustomers, getGymSettings, getActiveAnnouncement } from '@/lib/actions';
import { Gym, Customer, AttendanceRecord } from '@/lib/types';
import { getTemplate, compileTemplate } from '@/lib/templates';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [gyms, setGyms] = useState<any[]>([]);
  const [currentGym, setCurrentGym] = useState<any | null>(null);

  // Global Notification for NFC scans
  const [globalNotification, setGlobalNotification] = useState<{
    customerName: string;
    action: 'checkin' | 'checkout';
    record: any;
    avgHours: number;
  } | null>(null);

  const [waStatus, setWaStatus] = useState<string>('connected');
  const [globalAnnouncement, setGlobalAnnouncement] = useState<any | null>(null);
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
      
      const activeAnn = await getActiveAnnouncement();
      setGlobalAnnouncement(activeAnn);

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
            // New NFC Card scanned!
            if (typeof window !== 'undefined') {
              if (window.location.pathname === '/dashboard/members') {
                window.dispatchEvent(new CustomEvent('open_add_member', { detail: { nfcId: buffer } }));
              } else {
                router.push(`/dashboard/members?new_nfc=${buffer}`);
              }
            }
          }
          buffer = '';
        } else if (e.key.length === 1) {
          buffer += e.key;
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      // Smart Sync: Background WhatsApp Reminders
      if (matched) {
        const settings = await getGymSettings(matched.id);
        const autoMessagesEnabled = settings?.waAutoMessages ?? true;
        const reminderWindow = settings?.waReminderWindowDays ?? 3;
        
        const todayStr = new Date().toISOString().split('T')[0];
        const lastSync = localStorage.getItem(`wa_sync_${matched.id}`);
        
        if (autoMessagesEnabled && lastSync !== todayStr) {
          const customers = await getCustomers(matched.id);
          const targetThresholdDate = new Date();
          targetThresholdDate.setDate(new Date().getDate() + reminderWindow);

          const dueCustomers = customers.filter((cust: any) => {
            const dueDate = new Date(cust.nextDueDate);
            return dueDate <= targetThresholdDate || cust.status === 'due_soon' || cust.status === 'overdue';
          });

          const sendWithDelay = async () => {
            for (let i = 0; i < dueCustomers.length; i++) {
              const cust = dueCustomers[i];
              const isOverdue = new Date(cust.nextDueDate) < new Date();
              
              // Add date and time to make every single message 100% unique (Anti-Ban trick)
              const now = new Date();
              const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateString = now.toLocaleDateString();

              const waText = compileTemplate(getTemplate(settings, 'reminder'), {
                name: cust.name,
                gymName: matched.name,
                phone: cust.phone,
                plan: cust.planType,
                amount: cust.feeAmount,
                dueDate: cust.nextDueDate
              }) + `\n\n_Generated: ${dateString} ${timeString}_`;
              
              try {
                await fetch('/api/whatsapp/send', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    gymId: matched.id,
                    phone: cust.phone,
                    message: waText
                  })
                });
              } catch (e) {}

              // Random delay between 4 to 8 seconds to mimic human typing
              if (i < dueCustomers.length - 1) {
                const delay = Math.floor(Math.random() * 4000) + 4000;
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          };

          sendWithDelay();

          localStorage.setItem(`wa_sync_${matched.id}`, todayStr);
        }
      }

      const handleGlobalToast = (e: any) => {
        setGlobalToast(e.detail);
        setTimeout(() => setGlobalToast(null), 3500);
      };
      window.addEventListener('global-toast', handleGlobalToast);

      return () => {
        window.removeEventListener('keydown', handleKeyDown as unknown as EventListener);
        window.removeEventListener('global-toast', handleGlobalToast);
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
    { label: attendanceMode === 'FINGERPRINT' ? 'Fingerprint' : attendanceMode === 'BOTH' ? 'Check-in' : attendanceMode === 'MANUAL' ? 'Check-in' : 'NFC Terminal', href: '/dashboard/checkin', icon: Smartphone, badge: attendanceMode !== 'MANUAL' ? attendanceMode : undefined },
    { label: 'Members', href: '/dashboard/members', icon: Users },
    { label: 'Reminders', href: '/dashboard/reminders', icon: Bell, badge: 'Due' },
    { label: 'Broadcast', href: '/dashboard/broadcast', icon: Megaphone, badge: 'New' },
    { label: 'Revenue', href: '/dashboard/revenue', icon: CreditCard },
    ...(productsEnabled ? [{ label: 'Store / POS', href: '/dashboard/products', icon: Store, badge: 'New' }] : []),
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
    <div className={`min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans md:flex-row pb-20 md:pb-0 ${!animationsEnabled ? 'animations-disabled' : ''}`}>
      
      {/* Global Announcement Banner */}
      {globalAnnouncement && (
        <div className={`fixed top-0 left-0 right-0 z-[100] px-4 py-2 flex items-center justify-center text-xs font-bold text-white ${
          globalAnnouncement.type === 'info' ? 'bg-blue-600' :
          globalAnnouncement.type === 'warning' ? 'bg-amber-600' : 'bg-rose-600'
        }`}>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{globalAnnouncement.title}: {globalAnnouncement.message}</span>
          </div>
          <button onClick={() => setGlobalAnnouncement(null)} className="absolute right-4 hover:bg-white/20 p-1 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Global WA Disconnected Warning */}
      {waStatus !== 'connected' && (
        <div className={`fixed ${globalAnnouncement ? 'top-8' : 'top-0'} left-0 right-0 z-[90] px-4 py-2 flex items-center justify-center text-xs font-bold bg-rose-600 text-white shadow-md animate-in slide-in-from-top-2`}>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4" />
            <span>WhatsApp Disconnected: Payment reminders and notifications are paused.</span>
            <Link href="/dashboard/settings" className="ml-2 underline hover:text-rose-100">Reconnect</Link>
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
      <aside className={`hidden md:flex md:w-64 bg-blue-900 border-r border-slate-200 flex-col sticky top-0 h-screen z-30 shadow-sm ${globalAnnouncement ? 'pt-8' : ''} ${waStatus !== 'connected' ? 'pt-16' : ''}`}>
        {/* Brand */}
        <div className="p-4 border-b border-blue-950 flex items-center justify-between bg-blue-900 text-white">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="Gym Logo" className="w-10 h-10 object-contain rounded-xl shadow-sm bg-white p-1" />
            <div>
              <span className="font-extrabold text-white text-base tracking-tight">GymFlow</span>
              <span className="block text-xs font-semibold text-blue-200">Gym Admin</span>
            </div>
          </div>
        </div>

        {/* Sidebar Nav Content Wrapper (White Background) */}
        <div className="flex-1 bg-white flex flex-col overflow-hidden">

        {/* Gym Tenant Info (Static) */}
        <div className="p-3 border-b border-slate-200 bg-slate-50/70">
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
                {item.badge && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-950 border border-blue-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
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
        </div>
      </aside>

      {/* MOBILE TOP BAR */}
      <header className="md:hidden bg-white border-b border-slate-200 sticky top-0 z-40 px-4 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-2.5">
          <img src="/logo.png" alt="Gym Logo" className="w-8 h-8 object-contain rounded-lg" />
          <div>
            <h1 className="font-bold text-slate-900 text-sm leading-tight">{currentGym?.name || 'Gym Portal'}</h1>
            <p className="text-xs text-blue-900 font-semibold">{currentGym?.ownerName}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
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
            className="p-1.5 text-rose-600 hover:text-rose-700 flex items-center space-x-1.5 bg-rose-50 rounded-lg px-2 py-1 text-xs font-bold transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* MAIN VIEW */}
      <main className="flex-1 overflow-x-hidden px-4 pt-2 pb-4 sm:px-6 sm:pt-3 sm:pb-6 md:px-8 md:pt-0 md:pb-8 max-w-7xl mx-auto w-full page-animate">
        {children}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR (THUMB FRIENDLY) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 px-2 py-1.5 flex items-center justify-around shadow-lg">
        {navItems.filter(item => item.label !== 'Reminders' && item.label !== 'Broadcast').map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors touch-target ${
                isActive ? 'text-blue-900 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-blue-900 scale-110' : 'text-slate-400'}`} />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 bg-blue-900 text-white text-[9px] font-bold px-1 rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* GLOBAL NFC NOTIFICATION POPUP */}
      {globalNotification && (
        <div className="fixed top-20 right-4 sm:right-8 z-[100] max-w-sm w-full animate-in slide-in-from-right-8 fade-in duration-300">
          <div
            className={`p-4 rounded-2xl border shadow-2xl flex items-center justify-between relative ${
              globalNotification.action === 'checkin'
                ? 'bg-blue-900 text-white border-blue-950'
                : 'bg-slate-500 text-white border-slate-600'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-bold text-xl">
                {globalNotification.customerName.charAt(0)}
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                  {globalNotification.action === 'checkin' ? '✓ MEMBER CHECKED IN' : '✓ MEMBER CHECKED OUT'}
                </div>
                <h3 className="font-extrabold text-base leading-tight">{globalNotification.customerName}</h3>
                <p className="text-xs opacity-90 mt-0.5">
                  Avg Monthly: <span className="font-bold underline">{globalNotification.avgHours} hrs/day</span>
                </p>
              </div>
            </div>

            <div className="text-right font-mono text-[10px] bg-white/10 px-2 py-1.5 rounded-lg backdrop-blur-md self-start ml-2">
              <div>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              {globalNotification.record.durationMinutes && (
                <div className="mt-1">Session: {globalNotification.record.durationMinutes}m</div>
              )}
            </div>
            
            <button onClick={() => setGlobalNotification(null)} className="absolute -top-2 -right-2 bg-white text-slate-900 rounded-full p-1 shadow-md hover:bg-slate-100">
               <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
