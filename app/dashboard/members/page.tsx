'use client';

import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Phone, CreditCard, Calendar, Radio, CheckCircle, Clock, Edit, RefreshCw, X, Shield, Dumbbell, AlertCircle, Trash2, MessageCircle, AlertTriangle, CheckCircle2, Bell, Banknote, Smartphone, ArrowLeftRight, Tag, ChevronRight, Fingerprint } from 'lucide-react';
import { getCustomers, getSubscriptionPlans, getTransactions, getAttendance, getMemberMonthlyAvgHours, addCustomer, updateCustomer, deleteCustomer, renewMemberPayment, collectPendingBalance, getGyms, getGymSettings } from '@/lib/actions';
import { Customer, Transaction, AttendanceRecord, SubscriptionPlan, Gym } from '@/lib/types';
import { getTemplate, compileTemplate } from '@/lib/templates';

export default function MemberManagementPage() {
  const [gymId, setGymId] = useState<string>('gym_1');
  const [gymName, setGymName] = useState<string>('Our Gym');
  const [customers, setCustomers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'due_soon' | 'overdue' | 'all' | 'new' | 'absent' | 'has_due'>('all');
  const [timeFilter, setTimeFilter] = useState<'all_time' | 'today' | 'this_week' | 'this_month'>('all_time');
  const [planFilter, setPlanFilter] = useState<string>('all');
  
  const [absentTrackingEnabled, setAbsentTrackingEnabled] = useState(false);
  const [absentThresholdDays, setAbsentThresholdDays] = useState(3);

  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nfcCardId, setNfcCardId] = useState('');
  const [fingerprintId, setFingerprintId] = useState('');
  const [fpScanning, setFpScanning] = useState(false);
  const [planType, setPlanType] = useState<string>('Monthly');
  const [feeAmount, setFeeAmount] = useState<number | string>(2500);
  const [paidAmount, setPaidAmount] = useState<number | string>(2500);
  const [remainingType, setRemainingType] = useState<'BALANCE' | 'DISCOUNT'>('BALANCE');
  const [balanceDueDate, setBalanceDueDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'SPLIT'>('CASH');
  const [splitCash, setSplitCash] = useState<number | string>(0);
  const [splitUpi, setSplitUpi] = useState<number | string>(0);
  const [lastPaymentDate, setLastPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Selected Member Details Drawer State
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [renewMonths, setRenewMonths] = useState(1);
  const [renewPaidAmount, setRenewPaidAmount] = useState<number | string>(2500);
  const [renewRemainingType, setRenewRemainingType] = useState<'BALANCE' | 'DISCOUNT'>('BALANCE');
  const [renewBalanceDueDate, setRenewBalanceDueDate] = useState<string>('');
  const [renewPaymentMethod, setRenewPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'SPLIT'>('CASH');
  const [renewSplitCash, setRenewSplitCash] = useState<number | string>(0);
  const [renewSplitUpi, setRenewSplitUpi] = useState<number | string>(0);
  const [isEditingMember, setIsEditingMember] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Collect Due Modal State
  const [showCollectDueModal, setShowCollectDueModal] = useState(false);
  const [collectDueMember, setCollectDueMember] = useState<any | null>(null);
  const [collectDueAmount, setCollectDueAmount] = useState<number | string>(0);
  const [collectDueRemainingType, setCollectDueRemainingType] = useState<'BALANCE' | 'DISCOUNT'>('BALANCE');
  const [collectDuePaymentMethod, setCollectDuePaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'SPLIT'>('CASH');
  const [collectDueSplitCash, setCollectDueSplitCash] = useState<number | string>(0);
  const [collectDueSplitUpi, setCollectDueSplitUpi] = useState<number | string>(0);

  // Custom UI Overlays
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEditInit = (cust: any) => {
    setName(cust.name);
    setPhone(cust.phone);
    setNfcCardId(cust.nfcCardId || '');
    setFingerprintId(cust.fingerprintId || '');
    setPlanType(cust.planType);
    setFeeAmount(cust.feeAmount);
    setPaidAmount(cust.feeAmount);
    setLastPaymentDate(cust.lastPaymentDate);
    setIsEditingMember(true);
    setEditingMemberId(cust.id);
    setSelectedMember(null); // Close the details modal so the edit modal is visible
    setShowAddModal(true);
  };

  const handleDeleteMember = (id: string) => {
    setConfirmDialog({
      title: 'Delete Member',
      message: 'Are you sure you want to completely delete this member? This action cannot be undone.',
      onConfirm: async () => {
        await deleteCustomer(id);
        setSelectedMember(null);
        showToast('Member deleted successfully', 'success');
        loadData();
      }
    });
  };

  // Auto-detect existing member when typing phone or NFC
  useEffect(() => {
    if (!showAddModal || isEditingMember) {
      if (!isEditingMember) setInfoMsg('');
      return;
    }

    let found: any;

    if (nfcCardId && nfcCardId.length > 3) {
      found = customers.find(c => c.nfcCardId.toLowerCase() === nfcCardId.toLowerCase());
    }

    if (found) {
      setSelectedMember(found);
      setIsEditingMember(true);
      setEditingMemberId(found.id);
      setName(found.name);
      setPhone(found.phone);
      setNfcCardId(found.nfcCardId);
      setPlanType(found.planType);
      setFeeAmount(found.feeAmount);
      
      setErrorMsg('');
      setInfoMsg(`Existing member "${found.name}" found. Switched to Edit mode.`);
    }
  }, [phone, nfcCardId, showAddModal, isEditingMember, customers]);

  useEffect(() => {
    loadData();

    // Listen to custom open_add_member event
    const handleOpenAddMember = (e: any) => {
      const nfcId = e.detail?.nfcId;
      if (nfcId) {
        setIsEditingMember(false);
        setEditingMemberId(null);
        setName('');
        setPhone('');
        setNfcCardId(nfcId);
        setFeeAmount(2500);
        setInfoMsg('');
        setErrorMsg('');
        setShowAddModal(true);
      }
    };

    window.addEventListener('open_add_member', handleOpenAddMember);

    // Check search query parameters for incoming new NFC scans or open_add flag
    const params = new URLSearchParams(window.location.search);
    const newNfc = params.get('new_nfc');
    const openAdd = params.get('open_add');
    
    if (newNfc || openAdd === 'true') {
      setIsEditingMember(false);
      setEditingMemberId(null);
      setName('');
      setPhone('');
      setNfcCardId(newNfc || '');
      setFingerprintId('');
      setFeeAmount(2500);
      setInfoMsg('');
      setErrorMsg('');
      setShowAddModal(true);

      // Clean query params so it doesn't open again on page refresh
      window.history.replaceState({}, '', window.location.pathname);
    }

    return () => {
      window.removeEventListener('open_add_member', handleOpenAddMember);
    };
  }, []);

  const loadData = async () => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || 'gym_1' : 'gym_1';
    setGymId(savedId);

    const [custs, ps, txs, atts, loadedGyms, gymSettings] = await Promise.all([
      getCustomers(savedId),
      getSubscriptionPlans(savedId),
      getTransactions(savedId),
      getAttendance(savedId),
      getGyms(),
      getGymSettings(savedId)
    ]);

    setCustomers(custs);
    setPlans(ps);
    setTransactions(txs);
    setAttendance(atts);
    setSettings(gymSettings);
    
    // Set default plan to the first available plan if none selected or if plans exist
    if (ps.length > 0) {
      setPlanType(ps[0].name);
      setFeeAmount(ps[0].price);
    }
    
    const matchedGym = loadedGyms.find((g: any) => g.id === savedId);
    if (matchedGym) {
      setGymName(matchedGym.name);
    }

    if (gymSettings) {
      setAbsentTrackingEnabled(gymSettings.absentTrackingEnabled ?? false);
      setAbsentThresholdDays(gymSettings.absentThresholdDays ?? 3);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    setErrorMsg('');

    const cleanPhone = phone.replace(/\D/g, '');
    
    const existingPhone = customers.find(c => c.phone.replace(/\D/g, '') === cleanPhone);
    if (existingPhone && (!isEditingMember || existingPhone.id !== editingMemberId)) {
      setErrorMsg(`Phone number already in use by ${existingPhone.name}. A number is for one customer only.`);
      return;
    }

    const newNfc = nfcCardId.trim() || `NFC-${Math.floor(10000 + Math.random() * 90000)}`;
    const existingNfc = customers.find(c => c.nfcCardId.toLowerCase() === newNfc.toLowerCase());
    if (existingNfc && (!isEditingMember || existingNfc.id !== editingMemberId)) {
      setErrorMsg(`NFC Card ID "${newNfc}" is already assigned to ${existingNfc.name}. An NFC card is for one customer only.`);
      return;
    }

    if (!isEditingMember && paymentMethod === 'SPLIT') {
      const splitSum = Number(splitCash) + Number(splitUpi);
      if (splitSum !== Number(paidAmount)) {
        setErrorMsg(`Split amounts (Cash: ₹${splitCash}, UPI: ₹${splitUpi}) must equal the Total Paid Amount (₹${paidAmount}).`);
        return;
      }
    }

    // Calculate due date based on plan
    const selectedPlan = plans.find(p => p.name === planType);
    const months = selectedPlan ? selectedPlan.durationMonths : 1;
    const dueObj = new Date(lastPaymentDate);
    dueObj.setMonth(dueObj.getMonth() + months);
    const nextDueDate = dueObj.toISOString().split('T')[0];

    if (isEditingMember && editingMemberId) {
      await updateCustomer(editingMemberId, {
        name,
        phone,
        nfcCardId: newNfc,
        fingerprintId: fingerprintId || null,
        planType,
        feeAmount: Number(feeAmount),
        lastPaymentDate,
        nextDueDate
      });
      setIsEditingMember(false);
      setEditingMemberId(null);
    } else {
      const totalPlanPrice = Number(feeAmount);
      const actualPaid = Number(paidAmount);
      const diff = Math.max(0, totalPlanPrice - actualPaid);
      const finalPendingBalance = diff > 0 && remainingType === 'BALANCE' ? diff : 0;
      const discountAmount = diff > 0 && remainingType === 'DISCOUNT' ? diff : 0;
      const splitData = paymentMethod === 'SPLIT' ? { cash: Number(splitCash), upi: Number(splitUpi) } : undefined;

      await addCustomer({
        gymId,
        name,
        phone,
        nfcCardId: newNfc,
        fingerprintId: fingerprintId || null,
        planType,
        feeAmount: totalPlanPrice,
        paidAmount: actualPaid,
        pendingBalance: finalPendingBalance,
        balanceDueDate: finalPendingBalance > 0 ? balanceDueDate : null,
        discountAmount,
        paymentMethod,
        splitDetails: splitData,
        lastPaymentDate,
        nextDueDate
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: `Member ${name} added successfully!`, type: 'success' } }));
      }
    }

    setShowAddModal(false);
    setName('');
    setPhone('');
    setNfcCardId('');
    setInfoMsg('');
    loadData();
  };

  const handleRenewPayment = async (cust: any) => {
    const totalPlanPrice = cust.feeAmount * renewMonths;
    const actualPaid = Number(renewPaidAmount);
    const diff = Math.max(0, totalPlanPrice - actualPaid);
    const finalPendingBalance = diff > 0 && renewRemainingType === 'BALANCE' ? diff : 0;
    const discountAmount = diff > 0 && renewRemainingType === 'DISCOUNT' ? diff : 0;
    const splitData = renewPaymentMethod === 'SPLIT' ? { cash: Number(renewSplitCash), upi: Number(renewSplitUpi) } : undefined;

    const updated = await renewMemberPayment(
      cust.id, 
      renewMonths, 
      totalPlanPrice, 
      actualPaid, 
      renewPaymentMethod, 
      splitData, 
      finalPendingBalance, 
      finalPendingBalance > 0 ? renewBalanceDueDate : null, 
      discountAmount
    );

    if (updated) {
      setSelectedMember(updated);
      loadData();
      showToast(`Membership successfully renewed for ${updated.name}!`, 'success');

      const autoMessagesEnabled = settings?.waAutoMessages ?? true;
      if (autoMessagesEnabled) {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = now.toLocaleDateString();

        const pendingText = finalPendingBalance > 0 
          ? `\n⏳ *Pending Balance:* ₹${finalPendingBalance}${renewBalanceDueDate ? ` (Due by ${renewBalanceDueDate})` : ''}` 
          : '';

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
              amount: actualPaid,
              dueDate: updated.nextDueDate
            }) + `${pendingText}\n\n_Date: ${dateString} ${timeString}_`
          })
        }).then(res => res.json()).then(data => {
          if (data.success && typeof window !== 'undefined') {
             window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: `Renewal receipt sent to ${updated.name}`, type: 'success' } }));
          } else if (typeof window !== 'undefined') {
             window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: `Failed to send renewal receipt: ${data.error}`, type: 'error' } }));
          }
        }).catch(() => {
          if (typeof window !== 'undefined') {
             window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: `Failed to send renewal receipt to ${updated.name}`, type: 'error' } }));
          }
        });
      }
    }
  };

  const handleCollectDueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectDueMember || Number(collectDueAmount) <= 0) return;

    try {
      if (collectDuePaymentMethod === 'SPLIT') {
        const splitSum = Number(collectDueSplitCash) + Number(collectDueSplitUpi);
        if (splitSum !== Number(collectDueAmount)) {
          showToast(`Split amounts must equal the Collect Amount (₹${collectDueAmount}).`, 'error');
          return;
        }
      }

      const splitData = collectDuePaymentMethod === 'SPLIT' 
        ? { cash: Number(collectDueSplitCash), upi: Number(collectDueSplitUpi) } 
        : undefined;

      const remaining = collectDueMember.pendingBalance - Number(collectDueAmount);
      const discountAmount = collectDueRemainingType === 'DISCOUNT' ? remaining : 0;

      const updated = await collectPendingBalance(
        collectDueMember.id,
        Number(collectDueAmount),
        collectDuePaymentMethod,
        splitData,
        discountAmount
      );

      setShowCollectDueModal(false);
      if (selectedMember && selectedMember.id === collectDueMember.id) {
        setSelectedMember(updated);
      }
      showToast(`Collected ₹${collectDueAmount} from ${collectDueMember.name}! Remaining balance: ₹${updated.pendingBalance || 0}`, 'success');
      loadData();

      const autoMessagesEnabled = settings?.waAutoMessages ?? true;
      if (autoMessagesEnabled) {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = now.toLocaleDateString();

        const remainingText = (updated.pendingBalance || 0) > 0 
          ? `\n⏳ *Remaining Balance:* ₹${updated.pendingBalance}` 
          : `\n✅ *All dues cleared!* Outstanding Balance: ₹0`;

        fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gymId,
            phone: collectDueMember.phone,
            message: `🧾 *Due Payment Receipt - ${gymName}*\n\nHi ${collectDueMember.name},\n\nWe have received your balance payment of *₹${collectDueAmount}* (${collectDuePaymentMethod}).${remainingText}\n\nThank you!\n\n_Receipt Generated: ${dateString} ${timeString}_`
          })
        }).catch(() => {});
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to record balance payment', 'error');
    }
  };

  const getAvg = (custId: string) => {
    const atts = attendance.filter(a => a.customerId === custId && a.durationMinutes);
    if (atts.length === 0) return 1.2;
    const totalMins = atts.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
    const avg = (totalMins / 60) / Math.max(1, atts.length);
    return parseFloat(avg.toFixed(1));
  };

  const handleFingerprintScan = () => {
    setFpScanning(true);
    setErrorMsg('');
    const port = settings?.fingerprintAgentPort || 8765;
    try {
      const ws = new WebSocket(`ws://localhost:${port}`);
      
      ws.onopen = () => {
        ws.send(JSON.stringify({ action: 'scan' }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'scan_result') {
            if (data.success && data.fingerprintId) {
              setFingerprintId(data.fingerprintId);
              setInfoMsg('Fingerprint registered successfully!');
            } else {
              setErrorMsg(data.error || 'Failed to scan fingerprint.');
            }
            ws.close();
            setFpScanning(false);
          }
        } catch (e) {
          console.error("Failed to parse FP message", e);
        }
      };
      
      ws.onerror = () => {
        setErrorMsg('Scanner agent not running. Run resources/fingerprint_agent.py');
        setFpScanning(false);
        ws.close();
      };
      
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          setFpScanning(false);
          setErrorMsg('Fingerprint scan timed out (15s).');
        }
      }, 15000);
      
    } catch (e) {
      setErrorMsg('Could not connect to local scanner agent.');
      setFpScanning(false);
    }
  };

  const getLastAttendanceDate = (custId: string) => {
    const atts = attendance.filter(a => a.customerId === custId);
    if (atts.length === 0) return null;
    return new Date(Math.max(...atts.map(a => new Date(a.checkInTime).getTime())));
  };

  const isAbsent = (custId: string) => {
    if (!absentTrackingEnabled) return false;
    const cust = customers.find(c => c.id === custId);
    if (!cust) return false;

    const lastDate = getLastAttendanceDate(custId);
    const joinDate = new Date(cust.joinedDate);
    
    if (!lastDate) {
      // If never attended, check if they joined long enough ago to be considered absent
      const diffTimeJoin = Math.abs(new Date().getTime() - joinDate.getTime());
      const diffDaysJoin = Math.ceil(diffTimeJoin / (1000 * 60 * 60 * 24));
      return diffDaysJoin > absentThresholdDays;
    }
    
    const diffTime = Math.abs(new Date().getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > absentThresholdDays;
  };


  const handleSendAbsenteeMsg = async (cust: any) => {
    try {
      const msg = compileTemplate(getTemplate(settings, 'absentee'), {
        name: cust.name.split(' ')[0],
        gymName,
        phone: cust.phone,
        plan: cust.planType,
        amount: cust.feeAmount,
        dueDate: cust.nextDueDate
      });
      
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gymId, phone: cust.phone, message: msg }),
      });
      const data = await res.json();
      if (data.success) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: 'WhatsApp absentee message sent successfully!', type: 'success' } }));
        }
      } else {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: 'Failed to send message. Make sure WhatsApp is connected in Settings.', type: 'error' } }));
        }
      }
    } catch (error) {
      console.error(error);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: 'Error sending message', type: 'error' } }));
      }
    }
  };

  // Filtered members list
  const filteredCustomers = customers.filter((c) => {
    const searchLower = searchQuery.toLowerCase().trim();
    const phoneQuery = searchQuery.replace(/\D/g, '');
    
    const matchesSearch = searchLower === '' || (
      c.name.toLowerCase().includes(searchLower) ||
      c.nfcCardId.toLowerCase().includes(searchLower) ||
      (phoneQuery !== '' && c.phone.replace(/\D/g, '').includes(phoneQuery))
    );

    let matchesStatus = true;
    if (statusFilter !== 'all' && statusFilter !== 'new' && statusFilter !== 'absent' && statusFilter !== 'has_due') {
      matchesStatus = c.status === statusFilter;
    } else if (statusFilter === 'absent') {
      matchesStatus = isAbsent(c.id);
    } else if (statusFilter === 'has_due') {
      matchesStatus = (c.pendingBalance || 0) > 0;
    }

    let matchesTime = true;
    if (timeFilter !== 'all_time') {
      const joinDate = new Date(c.joinedDate);
      const today = new Date();
      if (timeFilter === 'today') {
        matchesTime = joinDate.toDateString() === today.toDateString();
      } else if (timeFilter === 'this_week') {
        const d = new Date();
        const firstDayOfWeek = new Date(d.setDate(d.getDate() - d.getDay()));
        matchesTime = joinDate >= firstDayOfWeek;
      } else if (timeFilter === 'this_month') {
        matchesTime = joinDate.getMonth() === today.getMonth() && joinDate.getFullYear() === today.getFullYear();
      }
    }

    let matchesPlan = true;
    if (planFilter !== 'all') {
      matchesPlan = c.planType === planFilter;
    }

    return matchesSearch && matchesStatus && matchesTime && matchesPlan;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-950 text-xs font-bold mb-2">
            <Users className="w-3.5 h-3.5 text-blue-900" />
            <span>Member Directory</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gym Members ({customers.length})</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage member details, phone numbers, NFC cards, and payment renewal due dates.
          </p>
        </div>

        <button
          onClick={() => {
            setIsEditingMember(false);
            setEditingMemberId(null);
            setName('');
            setPhone('');
            setNfcCardId('');
            setFingerprintId('');
            setFeeAmount(2500);
            setInfoMsg('');
            setErrorMsg('');
            setShowAddModal(true);
          }}
          className="px-4 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Member</span>
        </button>
      </div>

      {/* Absentee Warning Banner */}
      {absentTrackingEnabled && customers.some(c => isAbsent(c.id)) && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-3 text-purple-900">
            <div className="bg-purple-100 p-2 rounded-lg">
              <AlertCircle className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <p className="text-sm font-bold">
                {customers.filter(c => isAbsent(c.id)).length} members are currently marked as Absent!
              </p>
              <p className="text-xs text-purple-700 mt-0.5">
                They haven't checked in for over {absentThresholdDays} days.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setStatusFilter('absent')}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg transition-colors shadow-sm whitespace-nowrap"
          >
            View Absent Members
          </button>
        </div>
      )}

      {/* Filter & Search Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by Name, Phone, or NFC ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-800 outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-2.5 sm:pb-2">
          {(['all', 'new', 'active', 'due_soon', 'overdue', 'has_due', ...(absentTrackingEnabled ? ['absent'] : [])] as Array<'active' | 'due_soon' | 'overdue' | 'all' | 'new' | 'absent' | 'has_due'>).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'due_soon' ? 'Due Soon' : st === 'new' ? 'New Members' : st === 'has_due' ? 'Pending Due' : st === 'absent' ? `Absent (${absentThresholdDays}+ Days)` : st}
            </button>
          ))}
          
          {statusFilter === 'new' && (
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              className="ml-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-800"
            >
              <option value="all_time">All Time</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
            </select>
          )}

          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="ml-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-800"
          >
            <option value="all">All Plans</option>
            {plans.map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Members Grid View (Responsive Cards + Table) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((cust) => {
          const avgHours = getAvg(cust.id);
          return (
            <div
              key={cust.id}
              onClick={() => setExpandedCustomer(expandedCustomer === cust.id ? null : cust.id)}
              className="bg-white border border-slate-200 hover:border-blue-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-950 font-extrabold text-sm flex items-center justify-center border border-blue-200">
                      {cust.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{cust.name}</h3>
                      <div className="text-xs text-slate-500 font-mono flex items-center gap-1"><Phone className="w-3 h-3" /> {cust.phone}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {(cust.pendingBalance || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300 shadow-sm animate-pulse flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" /> ₹{cust.pendingBalance} Due
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isAbsent(cust.id) 
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : cust.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : cust.status === 'due_soon'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {isAbsent(cust.id) ? 'Absent' : cust.status === 'active' ? 'Active' : cust.status === 'due_soon' ? 'Due Soon' : 'Overdue'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                    <span className="text-slate-400 font-medium">NFC Tag ID:</span>
                    <span className="font-mono font-bold text-slate-800">{cust.nfcCardId}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Plan:</span>
                    <span className="font-bold text-slate-800">{cust.planType} (₹{cust.feeAmount})</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Next Due Date:</span>
                    <span className="font-bold text-blue-950">{cust.nextDueDate}</span>
                  </div>

                  {(cust.pendingBalance || 0) > 0 && (
                    <div className="flex justify-between items-center bg-amber-50/70 p-2 rounded-lg border border-amber-200 text-amber-900">
                      <span className="font-bold text-[11px]">Pending Balance:</span>
                      <span className="font-mono font-black text-amber-700">₹{cust.pendingBalance} {cust.balanceDueDate ? `(by ${cust.balanceDueDate})` : ''}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Monthly Avg Workout:</span>
                    <span className="font-bold text-indigo-700">{avgHours} hrs/day</span>
                  </div>
                </div>
              </div>

              {/* Expanded Inline Transactions */}
              {expandedCustomer === cust.id && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-800 mb-2">Last 2 Transactions</h4>
                  <div className="space-y-2">
                    {transactions
                      .filter(t => t.customerId === cust.id)
                      .slice(0, 2)
                      .map(tx => (
                        <div key={tx.id} className="bg-slate-50 p-2 rounded flex justify-between text-xs">
                          <span className="text-slate-600">{tx.date}</span>
                          <span className="font-bold text-emerald-600">₹{tx.amount}</span>
                        </div>
                      ))}
                    {transactions.filter(t => t.customerId === cust.id).length === 0 && (
                      <div className="text-xs text-slate-500 italic">No recent transactions</div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center gap-2">
                <div className="flex items-center space-x-1.5">
                  {(cust.pendingBalance || 0) > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCollectDueMember(cust);
                        setCollectDueAmount(cust.pendingBalance);
                        setCollectDuePaymentMethod('CASH');
                        setShowCollectDueModal(true);
                      }}
                      className="text-xs font-black text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg flex items-center space-x-1 transition-colors border border-amber-300 shadow-sm"
                      title="Collect remaining balance"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Collect Due</span>
                    </button>
                  )}
                  {isAbsent(cust.id) && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSendAbsenteeMsg(cust);
                      }}
                      className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 transition-colors border border-emerald-200 shadow-sm"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>"Miss you!"</span>
                    </button>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMember(cust);
                  }}
                  className="text-xs font-bold text-blue-900 hover:text-blue-950 flex items-center"
                >
                  View Full Profile <ChevronRight className="w-3.5 h-3.5 inline" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: ADD NEW MEMBER */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl border border-slate-200 animate-in fade-in zoom-in duration-150 max-h-[95vh] overflow-y-auto flex flex-col">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-200 mb-3 shrink-0">
              <h3 className="font-bold text-slate-900 text-lg flex items-center space-x-2">
                {isEditingMember ? <Edit className="w-5 h-5 text-blue-900" /> : <Plus className="w-5 h-5 text-blue-900" />}
                <span>{isEditingMember ? 'Edit Member Details' : 'Add New Member'}</span>
              </h3>
              <button onClick={() => {
                setShowAddModal(false);
                setIsEditingMember(false);
                setEditingMemberId(null);
              }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {infoMsg && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-950 text-xs font-bold rounded-lg flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>{infoMsg}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-800 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-800 outline-none"
                  />
                </div>

                {(!settings?.attendanceMode || settings.attendanceMode === 'NFC' || settings.attendanceMode === 'BOTH') && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      NFC Tag / Card ID
                    </label>
                    <input
                      type="text"
                      placeholder="Auto-gen or tap"
                      value={nfcCardId}
                      onChange={(e) => setNfcCardId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800 focus:ring-2 focus:ring-blue-800 outline-none"
                    />
                  </div>
                )}

                {(!settings?.attendanceMode || settings.attendanceMode === 'FINGERPRINT' || settings.attendanceMode === 'BOTH') && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Fingerprint className="w-3 h-3 text-blue-900" /> Biometric Data
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        placeholder={fingerprintId ? "Registered" : "No Fingerprint"}
                        value={fingerprintId ? "Registered" : ""}
                        className="w-full px-2 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm font-bold text-blue-900 outline-none cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={handleFingerprintScan}
                        disabled={fpScanning}
                        className={`px-3 py-2 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                          fpScanning ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-blue-100 text-blue-900 hover:bg-blue-200'
                        }`}
                      >
                        {fpScanning ? 'Scanning...' : 'Scan'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Membership Plan
                  </label>
                  <select
                    value={planType}
                    onChange={(e) => {
                      const p = e.target.value;
                      setPlanType(p);
                      const selectedPlan = plans.find(plan => plan.name === p);
                      if (selectedPlan) {
                        setFeeAmount(selectedPlan.price);
                        if (!isEditingMember) setPaidAmount(selectedPlan.price);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 outline-none"
                  >
                    {plans.length === 0 ? (
                      <option disabled value="">No plans available</option>
                    ) : (
                      plans.map(p => (
                        <option key={p.id} value={p.name}>
                          {p.name} ({p.durationMonths} {p.durationMonths === 1 ? 'Month' : 'Months'}) - ₹{p.price}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Plan Price / Total Fee (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={feeAmount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFeeAmount(val);
                      if (!isEditingMember && Number(paidAmount) > val) setPaidAmount(val);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 outline-none"
                  />
                </div>
              </div>

              {!isEditingMember && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Amount Paid Today (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={feeAmount}
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        First Payment Date
                      </label>
                      <input
                        type="date"
                        value={lastPaymentDate}
                        onChange={(e) => setLastPaymentDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium outline-none"
                      />
                    </div>
                  </div>

                  {Number(paidAmount) < Number(feeAmount) && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg space-y-2 animate-in fade-in duration-200">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-amber-900">Remaining Unpaid:</span>
                        <span className="font-mono font-black text-sm text-amber-700">₹{Number(feeAmount) - Number(paidAmount)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRemainingType('BALANCE')}
                          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                            remainingType === 'BALANCE'
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Mark as Balance Due</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemainingType('DISCOUNT')}
                          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                            remainingType === 'DISCOUNT'
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <Tag className="w-3.5 h-3.5" />
                          <span>Treat as Discount</span>
                        </button>
                      </div>

                      {remainingType === 'BALANCE' && (
                        <div className="pt-0.5">
                          <label className="block text-[10px] font-bold text-amber-950 mb-0.5">
                            Balance Due Date
                          </label>
                          <input
                            type="date"
                            value={balanceDueDate}
                            onChange={(e) => setBalanceDueDate(e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-medium outline-none focus:border-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Payment Mode
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['CASH', 'UPI', 'CARD', 'SPLIT'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPaymentMethod(mode)}
                          className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                            paymentMethod === mode
                              ? 'bg-blue-900 text-white shadow-sm ring-1 ring-blue-900'
                              : 'bg-white text-slate-700 border border-slate-300'
                          }`}
                        >
                          {mode === 'CASH' ? <Banknote className="w-3.5 h-3.5" /> : mode === 'UPI' ? <Smartphone className="w-3.5 h-3.5" /> : mode === 'CARD' ? <CreditCard className="w-3.5 h-3.5" /> : <ArrowLeftRight className="w-3.5 h-3.5" />}
                          <span>{mode === 'UPI' ? 'UPI' : mode}</span>
                        </button>
                      ))}
                    </div>

                    {paymentMethod === 'SPLIT' && (
                      <div className="mt-2 p-2 bg-blue-50/70 border border-blue-200 rounded-lg grid grid-cols-2 gap-2 animate-in fade-in duration-150">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5 flex items-center gap-1"><Banknote className="w-3 h-3" /> Cash (Rs.)</label>
                          <input
                            type="number"
                            min={0}
                            value={splitCash}
                            onChange={(e) => setSplitCash(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5 flex items-center gap-1"><Smartphone className="w-3 h-3" /> UPI (Rs.)</label>
                          <input
                            type="number"
                            min={0}
                            value={splitUpi}
                            onChange={(e) => setSplitUpi(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end space-x-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                >
                  {isEditingMember ? 'Save Changes' : 'Save Member & Collect Fee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL / DRAWER: MEMBER DETAILS PROFILE */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-start pb-4 border-b border-slate-200 mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-blue-900 text-white text-xl font-black flex items-center justify-center">
                  {selectedMember.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">{selectedMember.name}</h3>
                  <div className="text-xs text-slate-500 font-mono flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedMember.phone}</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button onClick={() => handleEditInit(selectedMember)} className="p-1.5 text-blue-900 hover:bg-blue-50 rounded-lg" title="Edit Member">
                  <Edit className="w-5 h-5" />
                </button>
                <button onClick={() => handleDeleteMember(selectedMember.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg" title="Delete Member">
                  <Trash2 className="w-5 h-5" />
                </button>
                <button onClick={() => setSelectedMember(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg" title="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 font-semibold block mb-0.5">NFC Card ID</span>
                  <span className="font-mono font-bold text-slate-800">{selectedMember.nfcCardId}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 font-semibold block mb-0.5">Monthly Avg Workout</span>
                  <span className="font-bold text-blue-950">
                    {getAvg(selectedMember.id)} hrs / day
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 font-semibold block mb-0.5">Last Payment</span>
                  <span className="font-bold text-slate-800">{selectedMember.lastPaymentDate}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 font-semibold block mb-0.5">Next Due Date</span>
                  <span className="font-bold text-amber-700">{selectedMember.nextDueDate}</span>
                </div>

                {(selectedMember.pendingBalance || 0) > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl col-span-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-amber-800 font-bold block flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Pending Dues / Unpaid Balance</span>
                        <span className="text-[11px] text-amber-700 font-medium">
                          {selectedMember.balanceDueDate ? `Due before: ${selectedMember.balanceDueDate}` : 'No deadline specified'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-black text-amber-800 text-base">₹{selectedMember.pendingBalance}</span>
                        <button
                          onClick={() => {
                            setCollectDueMember(selectedMember);
                            setCollectDueAmount(selectedMember.pendingBalance);
                            setCollectDuePaymentMethod('CASH');
                            setShowCollectDueModal(true);
                          }}
                          className="block mt-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg shadow-sm"
                        >
                          Collect Balance
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Fee Renewal Action Box */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                <div className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                  <RefreshCw className="w-4 h-4 text-blue-900" />
                  <span>Renew Membership & Record Payment</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Renewal Plan Period</label>
                    <select
                      value={renewMonths}
                      onChange={(e) => {
                        const m = Number(e.target.value);
                        setRenewMonths(m);
                        setRenewPaidAmount(selectedMember.feeAmount * m);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 text-xs outline-none"
                    >
                      <option value={1}>+1 Month (₹{selectedMember.feeAmount})</option>
                      <option value={3}>+3 Months (₹{selectedMember.feeAmount * 3})</option>
                      <option value={6}>+6 Months (₹{selectedMember.feeAmount * 6})</option>
                      <option value={12}>+1 Year (₹{selectedMember.feeAmount * 12})</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Amount Paid Today (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={renewPaidAmount}
                      onChange={(e) => setRenewPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-black text-emerald-700 text-xs outline-none"
                    />
                  </div>
                </div>

                {Number(renewPaidAmount) < selectedMember.feeAmount * renewMonths && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2 text-xs">
                    <div className="flex justify-between font-bold text-amber-900">
                      <span>Remaining Unpaid:</span>
                      <span className="font-mono text-amber-700">₹{selectedMember.feeAmount * renewMonths - Number(renewPaidAmount)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRenewRemainingType('BALANCE')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold ${
                          renewRemainingType === 'BALANCE'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-white text-slate-700 border border-slate-300'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" /> Balance Due
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenewRemainingType('DISCOUNT')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold ${
                          renewRemainingType === 'DISCOUNT'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-white text-slate-700 border border-slate-300'
                        }`}
                      >
                        <Tag className="w-3.5 h-3.5" /> Discount
                      </button>
                    </div>

                    {renewRemainingType === 'BALANCE' && (
                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 mb-0.5">Due By Date</label>
                        <input
                          type="date"
                          value={renewBalanceDueDate}
                          onChange={(e) => setRenewBalanceDueDate(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-amber-300 rounded text-xs"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Payment Method Selector for Renewal */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Mode</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['CASH', 'UPI', 'CARD', 'SPLIT'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setRenewPaymentMethod(mode)}
                        className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all flex flex-col items-center justify-center space-y-0.5 ${
                          renewPaymentMethod === mode
                            ? 'bg-blue-900 text-white shadow-sm'
                            : 'bg-white text-slate-700 border border-slate-300'
                        }`}
                      >
                          {mode === 'CASH' ? <Banknote className="w-3.5 h-3.5" /> : mode === 'UPI' ? <Smartphone className="w-3.5 h-3.5" /> : mode === 'CARD' ? <CreditCard className="w-3.5 h-3.5" /> : <ArrowLeftRight className="w-3.5 h-3.5" />}
                        <span className="text-[10px]">{mode === 'UPI' ? 'UPI' : mode}</span>
                      </button>
                    ))}
                  </div>

                  {renewPaymentMethod === 'SPLIT' && (
                    <div className="mt-2 p-2 bg-white border border-blue-200 rounded-lg grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 flex items-center gap-1"><Banknote className="w-3 h-3" /> Cash (Rs.)</label>
                        <input
                          type="number"
                          value={renewSplitCash}
                          onChange={(e) => setRenewSplitCash(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full p-1 border border-slate-300 rounded text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 flex items-center gap-1"><Smartphone className="w-3 h-3" /> UPI (Rs.)</label>
                        <input
                          type="number"
                          value={renewSplitUpi}
                          onChange={(e) => setRenewSplitUpi(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full p-1 border border-slate-300 rounded text-xs font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    onClick={() => handleRenewPayment(selectedMember)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-colors shadow-sm flex items-center justify-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Record Renewal & Send Receipt</span>
                  </button>
                </div>
              </div>

              {/* Full History Section */}
              <div className="mt-6 pt-4 border-t border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm mb-3">All Transaction History</h4>
                <div className="space-y-2">
                  {transactions
                    .filter(t => t.customerId === selectedMember.id)
                    .map(tx => (
                      <div key={tx.id} className="bg-slate-50 p-2.5 rounded-lg flex justify-between items-center border border-slate-100">
                        <div>
                          <div className="font-bold text-slate-800">{tx.description}</div>
                          <div className="text-slate-500">{tx.date}</div>
                        </div>
                        <span className="font-black text-emerald-600">₹{tx.amount}</span>
                      </div>
                    ))}
                  {transactions.filter(t => t.customerId === selectedMember.id).length === 0 && (
                    <div className="text-slate-500 italic p-2 bg-slate-50 rounded-lg border border-slate-100 text-center">No transaction history found.</div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm mb-3">Recent Attendance</h4>
                <div className="space-y-2">
                  {attendance
                    .filter(a => a.customerId === selectedMember.id)
                    .slice(0, 5)
                    .map(a => (
                      <div key={a.id} className="bg-slate-50 p-2.5 rounded-lg flex justify-between items-center border border-slate-100">
                        <div>
                          <div className="font-bold text-slate-800">{a.dateStr}</div>
                          <div className="text-slate-500">In: {new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        {a.checkOutTime ? (
                          <div className="text-right">
                            <span className="font-bold text-blue-900 block">{a.durationMinutes} mins</span>
                            <span className="text-slate-500">Out: {new Date(a.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ) : (
                          <span className="font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">Active Now</span>
                        )}
                      </div>
                    ))}
                  {attendance.filter(a => a.customerId === selectedMember.id).length === 0 && (
                    <div className="text-slate-500 italic p-2 bg-slate-50 rounded-lg border border-slate-100 text-center">No attendance history found.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: COLLECT PENDING DUE */}
      {showCollectDueModal && collectDueMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Collect Due Balance</h3>
                  <p className="text-xs text-slate-500">{collectDueMember.name} • {collectDueMember.phone}</p>
                </div>
              </div>
              <button onClick={() => setShowCollectDueModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCollectDueSubmit} className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex justify-between items-center text-xs">
                <span className="font-bold text-amber-900">Total Unpaid Balance:</span>
                <span className="font-mono font-black text-base text-amber-800">₹{collectDueMember.pendingBalance}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Amount To Collect Today (₹)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={collectDueMember.pendingBalance}
                  value={collectDueAmount}
                  onChange={(e) => setCollectDueAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {Number(collectDueAmount) < collectDueMember.pendingBalance && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2.5 animate-in fade-in duration-200 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-amber-900">Remaining Unpaid:</span>
                    <span className="font-mono font-black text-sm text-amber-700">₹{collectDueMember.pendingBalance - Number(collectDueAmount)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCollectDueRemainingType('BALANCE')}
                      className={`py-2 px-3 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center space-x-1.5 ${
                        collectDueRemainingType === 'BALANCE'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Keep as Balance</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCollectDueRemainingType('DISCOUNT')}
                      className={`py-2 px-3 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center space-x-1.5 ${
                        collectDueRemainingType === 'DISCOUNT'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>Treat as Discount</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Payment Mode
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['CASH', 'UPI', 'CARD', 'SPLIT'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setCollectDuePaymentMethod(mode)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                        collectDuePaymentMethod === mode
                          ? 'bg-blue-900 text-white shadow-sm ring-2 ring-blue-900 ring-offset-1'
                          : 'bg-slate-50 text-slate-700 border border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {mode === 'CASH' ? <Banknote className="w-4 h-4" /> : mode === 'UPI' ? <Smartphone className="w-4 h-4" /> : mode === 'CARD' ? <CreditCard className="w-4 h-4" /> : <ArrowLeftRight className="w-4 h-4" />}
                      <span className="text-[11px]">{mode === 'UPI' ? 'UPI' : mode}</span>
                    </button>
                  ))}
                </div>

                {collectDuePaymentMethod === 'SPLIT' && (
                  <div className="mt-3 p-3 bg-blue-50/70 border border-blue-200 rounded-xl grid grid-cols-2 gap-3 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1"><Banknote className="w-3 h-3" /> Cash (Rs.)</label>
                      <input
                        type="number"
                        min={0}
                        value={collectDueSplitCash}
                        onChange={(e) => setCollectDueSplitCash(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1"><Smartphone className="w-3 h-3" /> UPI (Rs.)</label>
                      <input
                        type="number"
                        min={0}
                        value={collectDueSplitUpi}
                        onChange={(e) => setCollectDueSplitUpi(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCollectDueModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition-colors shadow-sm"
                >
                  Record Payment (₹{collectDueAmount})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM UI CONFIRM MODAL */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">{confirmDialog.title}</h2>
            <p className="text-slate-600 text-sm font-medium mb-6 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM UI TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`flex items-center space-x-3 px-5 py-4 rounded-2xl shadow-lg border ${
            toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-600" />}
            {toast.type === 'info' && <Bell className="w-5 h-5 text-blue-600" />}
            <span className="font-bold text-sm">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
