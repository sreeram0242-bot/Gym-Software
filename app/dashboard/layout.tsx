'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Smartphone, Users, Bell, CreditCard, Dumbbell, ShieldCheck, ChevronDown, LogOut, Sparkles, X, Settings, AlertTriangle } from 'lucide-react';
import { getGyms, findCustomerByNFC, toggleCheckIn, getMemberMonthlyAvgHours, getCustomers } from '@/lib/actions';
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

  useEffect(() => {
    const initLayout = async () => {
      const loadedGyms = await getGyms();
      setGyms(loadedGyms);

      const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') : null;
      const isMasterAdmin = typeof window !== 'undefined' ? localStorage.getItem('is_master_admin') === 'true' : false;
      
      // Find gym. Master admins can view suspended gyms.
      const matched = loadedGyms.find((g) => g.id === savedId && (g.status === 'active' || isMasterAdmin));
      
      if (!matched) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('active_gym_id');
        }
        router.push('/');
        return;
      }
      
      setCurrentGym(matched);

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
        const autoMessagesEnabled = localStorage.getItem(`wa_auto_messages_${matched.id}`) !== 'false';
        const reminderWindow = Number(localStorage.getItem(`wa_reminder_window_${matched.id}`) || 3);
        
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

              const waText = compileTemplate(getTemplate(matched.id, 'reminder'), {
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

      return () => {
        window.removeEventListener('keydown', handleKeyDown as unknown as EventListener);
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
    const selected = gyms.find((g) => g.id === gymId);
    if (selected) {
      setCurrentGym(selected);
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_gym_id', gymId);
      }
    }
  };

  const navItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'NFC Terminal', href: '/dashboard/checkin', icon: Smartphone, badge: 'NFC' },
    { label: 'Members', href: '/dashboard/members', icon: Users },
    { label: 'Reminders', href: '/dashboard/reminders', icon: Bell, badge: 'Due' },
    { label: 'Revenue', href: '/dashboard/revenue', icon: CreditCard },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans pb-20 md:pb-0">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-slate-200 flex-col sticky top-0 h-screen z-30 shadow-sm">
        {/* Brand */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold shadow-md shadow-blue-800/20">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-base tracking-tight">GymFlow</span>
              <span className="block text-xs font-semibold text-blue-900">Gym Admin</span>
            </div>
          </div>
        </div>

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
      </aside>

      {/* MOBILE TOP BAR */}
      <header className="md:hidden bg-white border-b border-slate-200 sticky top-0 z-40 px-4 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold">
            <Dumbbell className="w-4 h-4" />
          </div>
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
      <main className="flex-1 overflow-x-hidden p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
        {waStatus === 'disconnected' && (
          <div className="mb-6 bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center space-x-3 mb-3 sm:mb-0">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-rose-900 text-sm">WhatsApp Bot is Disconnected</h3>
                <p className="text-xs text-rose-700">Automated payment reminders and notifications are currently paused. Please scan the QR code to reconnect.</p>
              </div>
            </div>
            <Link href="/dashboard/settings" className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-sm whitespace-nowrap transition-colors">
              Reconnect WhatsApp
            </Link>
          </div>
        )}
        {children}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR (THUMB FRIENDLY) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 px-2 py-1.5 flex items-center justify-around shadow-lg">
        {navItems.map((item) => {
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
