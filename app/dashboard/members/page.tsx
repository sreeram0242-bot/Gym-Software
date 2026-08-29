'use client';

import React, { useState, useEffect, useDeferredValue, useMemo } from 'react';
import { Users, Plus, Search, Phone, CreditCard, Calendar, Radio, CheckCircle, Clock, Edit, RefreshCw, X, Shield, Dumbbell, AlertCircle, Trash2, MessageCircle, AlertTriangle, CheckCircle2, Bell, Banknote, Smartphone, ArrowLeftRight, Tag, ChevronRight, Fingerprint, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { getCustomers, getSubscriptionPlans, getTransactions, getAttendance, getMemberMonthlyAvgHours, addCustomer, updateCustomer, deleteCustomer, renewMemberPayment, collectPendingBalance, getGyms, getGymSettings, toggleCustomerWaStatus } from '@/lib/actions';
import { Customer, Transaction, AttendanceRecord, SubscriptionPlan, Gym } from '@/lib/types';
import { getTemplate, compileTemplate } from '@/lib/templates';
import { formatDateDDMMYYYY, exportToCSV, getLocalTodayDateString } from '@/lib/utils';
import { exportToPDF } from '@/lib/exportPdf';

export default function MemberManagementPage() {
  const [gymId, setGymId] = useState<string>('gym_1');
  const [gymName, setGymName] = useState<string>('Our Gym');
  const [customers, setCustomers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [displayLimit, setDisplayLimit] = useState<number>(30);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'due_soon' | 'overdue' | 'all' | 'new' | 'absent' | 'has_due'>('all');
  const [waFilter, setWaFilter] = useState<'all' | 'activated' | 'not_activated'>('all');
  const [timeFilter, setTimeFilter] = useState<'all_time' | 'today' | 'this_week' | 'this_month'>('all_time');
  const [planFilter, setPlanFilter] = useState<string>('all');
  
  const [absentTrackingEnabled, setAbsentTrackingEnabled] = useState(false);
  const [absentThresholdDays, setAbsentThresholdDays] = useState(3);

  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nfcCardId, setNfcCardId] = useState('');
  const [nfcCardId2, setNfcCardId2] = useState('');
  const [showSecondaryNfc, setShowSecondaryNfc] = useState(false);
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
  const [upiId, setUpiId] = useState('');
  const [upiSenderName, setUpiSenderName] = useState('');
  const [lastPaymentDate, setLastPaymentDate] = useState(getLocalTodayDateString());
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
  const [renewUpiId, setRenewUpiId] = useState('');
  const [renewUpiSenderName, setRenewUpiSenderName] = useState('');
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
  const [collectDueUpiId, setCollectDueUpiId] = useState('');
  const [collectDueUpiSenderName, setCollectDueUpiSenderName] = useState('');

  // Custom UI Overlays
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 30000);
  };

  const handleEditInit = (cust: any) => {
    setName(cust.name);
    setPhone(cust.phone);
    setNfcCardId(cust.nfcCardId || '');
    setNfcCardId2(cust.nfcCardId2 || '');
    setShowSecondaryNfc(!!cust.nfcCardId2);
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

  const handleEnrollFingerprint = async (cust: Customer) => {
    try {
      showToast('Sending command to scanner...', 'success');
      const res = await fetch('/api/biometrics/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gymId: gymId,
          memberId: cust.id,
          nfcCardId: cust.nfcCardId // Using this as the ADMS PIN
        })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to send command');
      
      showToast('Scanner activated! Please place finger on the machine.', 'success');
    } catch (e: any) {
      showToast(e.message || 'Enrollment error', 'error');
    }
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

    // Background live auto-refresh polling every 3 seconds
    const interval = setInterval(() => {
      if (document.hidden) return;
      loadData();
    }, 30000);

    const handleFocus = () => {
      loadData();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    // Listen to custom open_add_member event
    const handleOpenAddMember = (e: any) => {
      const nfcId = e.detail?.nfcId;
      if (nfcId) {
        setIsEditingMember(false);
        setEditingMemberId(null);
        setName('');
        setPhone('');
        setNfcCardId(nfcId);
        if (plans.length > 0) {
          setFeeAmount(plans[0].price);
          setPaidAmount(plans[0].price);
        } else {
          setFeeAmount(2500);
          setPaidAmount(2500);
        }
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
      if (plans.length > 0) {
        setFeeAmount(plans[0].price);
        setPaidAmount(plans[0].price);
      } else {
        setFeeAmount(2500);
        setPaidAmount(2500);
      }
      setInfoMsg('');
      setErrorMsg('');
      setShowAddModal(true);

      // Clean query params so it doesn't open again on page refresh
      window.history.replaceState({}, '', window.location.pathname);
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
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
        nfcCardId2: showSecondaryNfc && nfcCardId2.trim() ? nfcCardId2.trim() : null,
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
        nfcCardId2: showSecondaryNfc && nfcCardId2.trim() ? nfcCardId2.trim() : null,
        fingerprintId: fingerprintId || null,
        planType,
        feeAmount: totalPlanPrice,
        paidAmount: actualPaid,
        pendingBalance: finalPendingBalance,
        balanceDueDate: finalPendingBalance > 0 ? balanceDueDate : null,
        discountAmount,
        paymentMethod,
        splitDetails: splitData,
        upiId: paymentMethod === 'UPI' ? upiId : undefined,
        upiSenderName: paymentMethod === 'UPI' ? upiSenderName : undefined,
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
    setNfcCardId2('');
    setShowSecondaryNfc(false);
    setUpiId('');
    setUpiSenderName('');
    setInfoMsg('');
    loadData();
  };

  const handleRenewPayment = async (cust: any) => {
    const totalPlanPrice = cust.feeAmount * renewMonths;
    const actualPaid = Number(renewPaidAmount);
    const diff = Math.max(0, totalPlanPrice - actualPaid);
    const finalPendingBalance = diff > 0 && renewRemainingType === 'BALANCE' ? diff : 0;
    const discountAmount = diff > 0 && renewRemainingType === 'DISCOUNT' ? diff : 0;
    const splitData = renewPaymentMethod === 'SPLIT' 
      ? { cash: Number(renewSplitCash), upi: Number(renewSplitUpi) } 
      : renewPaymentMethod === 'UPI' 
      ? { upiId: renewUpiId, upiSenderName: renewUpiSenderName } 
      : undefined;

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
      setRenewUpiId('');
      setRenewUpiSenderName('');
      loadData();
      showToast(`Membership successfully renewed for ${updated.name}!`, 'success');

      const autoMessagesEnabled = settings?.waAutoMessages ?? true;
      if (autoMessagesEnabled) {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = formatDateDDMMYYYY(now.toISOString().split('T')[0]);

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
        : collectDuePaymentMethod === 'UPI'
        ? { upiId: collectDueUpiId, upiSenderName: collectDueUpiSenderName }
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
      setCollectDueUpiId('');
      setCollectDueUpiSenderName('');
      if (selectedMember && selectedMember.id === collectDueMember.id) {
        setSelectedMember(updated);
      }
      showToast(`Collected ₹${collectDueAmount} from ${collectDueMember.name}! Remaining balance: ₹${updated.pendingBalance || 0}`, 'success');
      loadData();

      const autoMessagesEnabled = settings?.waAutoMessages ?? true;
      if (autoMessagesEnabled) {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = formatDateDDMMYYYY(now.toISOString().split('T')[0]);

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

  const isOverdue = (nextDueDate: string) => {
    const today = getLocalTodayDateString();
    return nextDueDate < today;
  };

  // ─── DUAL EXPORT HANDLERS (CSV & PDF) ───
  const exportMembersCSV = () => {
    const exportData = filteredCustomers.map(c => ({
      Member_ID: c.memberId || '',
      Name: c.name,
      Phone: c.phone,
      Plan: c.planType,
      Fee_Amount: c.feeAmount,
      Joined_Date: formatDateDDMMYYYY(c.joinedDate),
      Next_Due_Date: formatDateDDMMYYYY(c.nextDueDate),
      Pending_Balance: c.pendingBalance || 0,
      Status: isOverdue(c.nextDueDate) ? 'Overdue' : 'Active',
      WhatsApp_Active: c.waActive ? 'Yes' : 'No',
      NFC_Card_ID: c.nfcCardId || 'None',
      Fingerprint_ID: c.fingerprintId ? `#${c.fingerprintId}` : 'None'
    }));
    exportToCSV(exportData, `Gym_Members_${getLocalTodayDateString()}.csv`);
  };

  const exportMembersPDF = () => {
    const head = [['Member ID', 'Name', 'Phone', 'Plan', 'Fee', 'Due Date', 'Balance', 'Status']];
    const body = filteredCustomers.map(c => [
      c.memberId || '-',
      c.name,
      c.phone,
      c.planType,
      `Rs ${c.feeAmount}`,
      formatDateDDMMYYYY(c.nextDueDate),
      c.pendingBalance ? `Rs ${c.pendingBalance}` : 'Rs 0',
      isOverdue(c.nextDueDate) ? 'OVERDUE' : 'ACTIVE'
    ]);

    exportToPDF({
      gymName,
      title: 'Gym Members Directory Report',
      subtitle: `Filter: ${statusFilter.toUpperCase()} | Total Members: ${filteredCustomers.length} | Generated On: ${formatDateDDMMYYYY(getLocalTodayDateString())}`,
      filename: `Gym_Members_${getLocalTodayDateString()}.pdf`,
      head,
      body,
      orientation: 'landscape',
      summaryBoxes: [
        { label: 'Total Members', value: String(customers.length) },
        { label: 'Filtered Count', value: String(filteredCustomers.length) },
        { label: 'Overdue Dues', value: `${customers.filter(c => isOverdue(c.nextDueDate)).length} members` }
      ]
    });
  };

  const exportIndividualMember = (memberId: string, format: 'csv' | 'pdf' = 'csv') => {
    const cust = customers.find(c => c.id === memberId);
    if (!cust) return;

    if (format === 'csv') {
      const dataToExport = [{
        Member_ID: cust.memberId || '',
        Name: cust.name,
        Phone: cust.phone,
        Status: isOverdue(cust.nextDueDate) ? 'Overdue' : 'Active',
        Plan: cust.planType,
        Fee_Amount: cust.feeAmount,
        Joined_Date: formatDateDDMMYYYY(cust.joinedDate),
        Next_Due_Date: formatDateDDMMYYYY(cust.nextDueDate),
        Pending_Balance: cust.pendingBalance || 0,
        WhatsApp_Active: cust.waActive ? 'Yes' : 'No',
        NFC_Card: cust.nfcCardId || '',
        Fingerprint_ID: cust.fingerprintId || ''
      }];
      exportToCSV(dataToExport, `Member_${cust.name.replace(/\s+/g, '_')}_${getLocalTodayDateString()}.csv`);
    } else {
      const memberTxs = transactions.filter(t => t.customerId === memberId);
      const memberAtts = attendance.filter(a => a.customerId === memberId);

      const head = [['Date', 'Transaction / Attendance Activity', 'Amount / Duration', 'Status']];
      const body: (string | number)[][] = [
        ['Profile Info', `Plan: ${cust.planType} | Phone: ${cust.phone} | Joined: ${formatDateDDMMYYYY(cust.joinedDate)}`, `Fee: Rs ${cust.feeAmount}`, isOverdue(cust.nextDueDate) ? 'OVERDUE' : 'ACTIVE']
      ];

      memberTxs.slice(0, 15).forEach(t => {
        body.push([
          formatDateDDMMYYYY(t.date),
          `Payment: ${t.category} (${t.paymentMethod || 'CASH'})`,
          `Rs ${t.amount}`,
          'Completed'
        ]);
      });

      memberAtts.slice(0, 15).forEach(a => {
        body.push([
          formatDateDDMMYYYY(a.dateStr),
          `Attendance: In ${new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${a.checkOutTime ? ` - Out ${new Date(a.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`,
          a.durationMinutes ? `${Math.floor(a.durationMinutes / 60)}h ${a.durationMinutes % 60}m` : 'In Progress',
          a.checkOutTime ? 'Completed' : 'Active'
        ]);
      });

      exportToPDF({
        gymName,
        title: `Member Profile & Activity Report: ${cust.name}`,
        subtitle: `Phone: ${cust.phone} | Plan: ${cust.planType} | Next Due: ${formatDateDDMMYYYY(cust.nextDueDate)}`,
        filename: `Member_${cust.name.replace(/\s+/g, '_')}_${getLocalTodayDateString()}.pdf`,
        head,
        body,
        orientation: 'portrait',
        summaryBoxes: [
          { label: 'Plan Fee', value: `Rs ${cust.feeAmount}` },
          { label: 'Due Date', value: formatDateDDMMYYYY(cust.nextDueDate) },
          { label: 'Pending Due', value: `Rs ${cust.pendingBalance || 0}` }
        ]
      });
    }
  };

  // -----------------------------------------------------
  // Effects
  // -----------------------------------------------------

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

  // Filtered members list with React 18 Performance Optimizations
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredCustomers = useMemo(() => {
    if (!customers || !Array.isArray(customers)) return [];
    return customers.filter((c) => {
      const searchLower = deferredSearchQuery.toLowerCase().trim();
      const phoneQuery = deferredSearchQuery.replace(/\D/g, '');
      
      const matchesSearch = searchLower === '' || (
        c.name.toLowerCase().includes(searchLower) ||
        (c.nfcCardId && c.nfcCardId.toLowerCase().includes(searchLower)) ||
        (c.nfcCardId2 && c.nfcCardId2.toLowerCase().includes(searchLower)) ||
        (phoneQuery !== '' && c.phone.replace(/\D/g, '').includes(phoneQuery))
      );

      let matchesStatus = true;
      if (statusFilter === 'new') {
        const joinDate = new Date(c.joinedDate);
        const today = new Date();
        const diffDays = (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24);
        matchesStatus = diffDays <= 7 && diffDays >= 0;
      } else if (statusFilter === 'absent') {
        matchesStatus = isAbsent(c.id);
      } else if (statusFilter === 'has_due') {
        matchesStatus = (c.pendingBalance || 0) > 0;
      } else if (statusFilter !== 'all') {
        const dueDate = new Date(c.nextDueDate);
        const today = new Date();
        today.setHours(0,0,0,0);
        dueDate.setHours(0,0,0,0);
        const diffDays = (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

        if (statusFilter === 'active') {
           matchesStatus = c.status === 'active' && diffDays >= 0;
        } else if (statusFilter === 'due_soon') {
           matchesStatus = c.status === 'active' && diffDays >= 0 && diffDays <= 3;
        } else if (statusFilter === 'overdue') {
           matchesStatus = c.status === 'active' && diffDays < 0;
        }
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

      let matchesWa = true;
      if (waFilter === 'activated') {
        matchesWa = Boolean(c.waActive);
      } else if (waFilter === 'not_activated') {
        matchesWa = !c.waActive;
      }

      return matchesSearch && matchesStatus && matchesTime && matchesPlan && matchesWa;
    });
  }, [customers, deferredSearchQuery, statusFilter, timeFilter, planFilter, waFilter, absentTrackingEnabled, absentThresholdDays, attendance]);

  const displayedCustomers = useMemo(() => {
    return filteredCustomers.slice(0, displayLimit);
  }, [filteredCustomers, displayLimit]);


  return (
    <div className="pt-0 mt-0">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-b-2xl px-4 pb-4 pt-0 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-0">
        <div className="pt-0 mt-0">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-950 text-xs font-bold mb-2 mt-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span>Master Directory</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mt-0 pt-0">Gym Members ({customers.length})</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Manage member details, phone numbers, NFC cards, and payment renewal due dates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setIsEditingMember(false);
                setEditingMemberId(null);
                setName('');
                setPhone('');
                setNfcCardId('');
                setNfcCardId2('');
                setShowSecondaryNfc(false);
                setFingerprintId('');
                setFeeAmount(2500);
                setPaidAmount(2500);
                setInfoMsg('');
                setErrorMsg('');
                setShowAddModal(true);
              }}
              className="px-4 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Member</span>
            </button>
            <button 
              onClick={exportMembersCSV}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center space-x-1.5 border border-slate-200"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>CSV</span>
            </button>
            <button 
              onClick={exportMembersPDF}
              className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center space-x-1.5 border border-blue-200"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>PDF</span>
            </button>
          </div>
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

      {/* Filter & Search Controls Bar - Compact & Mobile Neat */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col lg:flex-row gap-2.5 sm:gap-3 justify-between items-stretch lg:items-center min-w-0 max-w-full overflow-hidden">
        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Name, Phone, or NFC ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-800 outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full lg:w-auto min-w-0 flex-1">
          {(['all', 'new', 'active', 'due_soon', 'overdue', 'has_due', ...(absentTrackingEnabled ? ['absent'] : [])] as Array<'active' | 'due_soon' | 'overdue' | 'all' | 'new' | 'absent' | 'has_due'>).map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setWaFilter('all');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold capitalize transition-all whitespace-nowrap shrink-0 ${
                statusFilter === st && waFilter === 'all'
                  ? 'bg-blue-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'due_soon' ? 'Due Soon' : st === 'new' ? 'New Members' : st === 'has_due' ? 'Pending Due' : st === 'absent' ? `Absent (${absentThresholdDays}+ Days)` : st}
            </button>
          ))}

          {/* WhatsApp Activated / Non-Activated Scrolling Filters */}
          <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-200 shrink-0">
            <button
              onClick={() => {
                if (waFilter === 'activated') {
                  setWaFilter('all');
                } else {
                  setWaFilter('activated');
                  setStatusFilter('all');
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 shrink-0 ${
                waFilter === 'activated'
                  ? 'bg-emerald-600 text-white shadow-2xs ring-1 ring-emerald-600'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <Smartphone className="w-3 h-3" />
              <span>WhatsApp: Active</span>
              <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-bold ${waFilter === 'activated' ? 'bg-white/20 text-white' : 'bg-emerald-200/70 text-emerald-900'}`}>
                {customers.filter(c => c.waActive).length}
              </span>
            </button>

            <button
              onClick={() => {
                if (waFilter === 'not_activated') {
                  setWaFilter('all');
                } else {
                  setWaFilter('not_activated');
                  setStatusFilter('all');
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 shrink-0 ${
                waFilter === 'not_activated'
                  ? 'bg-slate-700 text-white shadow-2xs ring-1 ring-slate-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Smartphone className="w-3 h-3 text-slate-400" />
              <span>Not Active</span>
            </button>
          </div>
          
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
        {displayedCustomers.map((cust) => {
          const avgHours = getAvg(cust.id);
          return (
            <div
              key={cust.id}
              onClick={() => setSelectedMember(cust)}
              className="bg-white border border-slate-200 hover:border-blue-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-950 font-extrabold text-sm flex items-center justify-center border border-blue-200">
                      {cust.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-slate-900 text-sm">{cust.name}</h3>
                        {cust.memberId && (
                          <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.2 rounded">
                            {cust.memberId}
                          </span>
                        )}
                      </div>
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
                        cust.waActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                      title={cust.waActive ? "WhatsApp Bot Activated (Messaged 'start')" : "WhatsApp Not Activated (Waiting for member to text 'start')"}
                    >
                      {cust.waActive ? '● WA Active' : '○ No WA'}
                    </span>
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
                    <span className="text-slate-400 font-medium">NFC Tag(s):</span>
                    <span className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                      <span>{cust.nfcCardId}</span>
                      {cust.nfcCardId2 && (
                        <span className="text-[10px] bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded font-mono font-bold">
                          2: {cust.nfcCardId2}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Plan:</span>
                    <span className="font-bold text-slate-800">{cust.planType} (₹{cust.feeAmount})</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Next Due Date:</span>
                    <span className="font-bold text-blue-950">{formatDateDDMMYYYY(cust.nextDueDate)}</span>
                  </div>

                  {(cust.pendingBalance || 0) > 0 && (
                    <div className="flex justify-between items-center bg-amber-50/70 p-2 rounded-lg border border-amber-200 text-amber-900">
                      <span className="font-bold text-[11px]">Pending Balance:</span>
                      <span className="font-mono font-black text-amber-700">₹{cust.pendingBalance} {cust.balanceDueDate ? `(by ${formatDateDDMMYYYY(cust.balanceDueDate)})` : ''}</span>
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
                          <span className="text-slate-600 font-medium">{formatDateDDMMYYYY(tx.date)}</span>
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

      {/* Load More Button */}
      {filteredCustomers.length > displayedCustomers.length && (
        <div className="flex justify-center mt-6 mb-12">
          <button
            onClick={() => setDisplayLimit(prev => prev + 30)}
            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
          >
            Load More Members ({filteredCustomers.length - displayedCustomers.length} remaining)
          </button>
        </div>
      )}

      {/* Empty State Component */}
      {filteredCustomers.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-900 mx-auto flex items-center justify-center mb-4">
            {waFilter === 'activated' ? (
              <Smartphone className="w-8 h-8 text-emerald-600" />
            ) : statusFilter === 'has_due' ? (
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            ) : (
              <Users className="w-8 h-8 text-blue-900" />
            )}
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {searchQuery
              ? `No members found matching "${searchQuery}"`
              : waFilter === 'activated'
              ? 'No WhatsApp Activated Members Yet'
              : waFilter === 'not_activated'
              ? 'All Members Have WhatsApp Activated!'
              : statusFilter === 'has_due'
              ? 'No Members with Pending Balance Dues'
              : statusFilter === 'overdue'
              ? 'No Overdue Members Found'
              : statusFilter === 'due_soon'
              ? 'No Members Due for Renewal Soon'
              : 'No Members in this Category'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
            {waFilter === 'activated'
              ? "Members automatically appear here once they send 'start' or a message from their registered WhatsApp to your gym number."
              : searchQuery
              ? 'Try searching with a different name, phone number, or NFC card ID.'
              : 'Switch filters or register a new member to get started.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            {(statusFilter !== 'all' || waFilter !== 'all' || searchQuery !== '') && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setWaFilter('all');
                  setSearchQuery('');
                  setPlanFilter('all');
                  setTimeFilter('all_time');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Reset All Filters
              </button>
            )}
            <button
              onClick={() => {
                setIsEditingMember(false);
                setEditingMemberId(null);
                setName('');
                setPhone('');
                setNfcCardId('');
                setNfcCardId2('');
                setShowSecondaryNfc(false);
                setFingerprintId('');
                if (plans.length > 0) {
                  setPlanType(plans[0].name);
                  setFeeAmount(plans[0].price);
                  setPaidAmount(plans[0].price);
                } else {
                  setFeeAmount(2500);
                  setPaidAmount(2500);
                }
                setInfoMsg('');
                setErrorMsg('');
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
            >
              + Add New Member
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW MEMBER */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl border border-slate-200 animate-in fade-in zoom-in duration-150 max-h-[95vh] overflow-y-auto flex flex-col">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-200 mb-3 shrink-0">
              <h3 className="font-bold text-slate-900 text-lg flex items-center space-x-2">
                {isEditingMember ? <Edit className="w-5 h-5 text-blue-900" /> : <Plus className="w-5 h-5 text-blue-900" />}
                <span>{isEditingMember ? 'Edit Member Details' : 'Add New Member'}</span>
              </h3>
              <div className="flex items-center gap-3">
                {isEditingMember && editingMemberId && (
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => exportIndividualMember(editingMemberId, 'csv')} className="text-xs flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md hover:bg-slate-200" title="Download Member CSV">
                      <FileSpreadsheet className="w-3 h-3 text-emerald-600" /> CSV
                    </button>
                    <button type="button" onClick={() => exportIndividualMember(editingMemberId, 'pdf')} className="text-xs flex items-center gap-1 font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100" title="Download Member PDF">
                      <FileText className="w-3 h-3 text-blue-600" /> PDF
                    </button>
                  </div>
                )}
                <button onClick={() => {
                  setShowAddModal(false);
                  setIsEditingMember(false);
                  setEditingMemberId(null);
                }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
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

                {(!settings?.attendanceMode || settings.attendanceMode === 'NFC') && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        NFC Tag ID {showSecondaryNfc ? '(Card 1)' : ''}
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder="Tap card or enter ID"
                          value={nfcCardId}
                          onChange={(e) => setNfcCardId(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                            }
                          }}
                          className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800 focus:ring-2 focus:ring-blue-800 outline-none"
                        />
                        {!showSecondaryNfc && (
                          <button
                            type="button"
                            onClick={() => setShowSecondaryNfc(true)}
                            className="absolute right-1.5 p-1 text-blue-900 hover:text-blue-950 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors flex items-center justify-center"
                            title="Add 2nd NFC Tag / Keyfob"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {showSecondaryNfc && (
                      <div className="animate-in fade-in duration-150">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-blue-950 uppercase tracking-wider">
                            NFC Tag 2 (Secondary / Band)
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setNfcCardId2('');
                              setShowSecondaryNfc(false);
                            }}
                            className="text-[10px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-0.5"
                          >
                            <X className="w-3 h-3" /> Remove
                          </button>
                        </div>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            placeholder="Tap 2nd card / keyfob"
                            value={nfcCardId2}
                            onChange={(e) => setNfcCardId2(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                              }
                            }}
                            className="w-full pl-3 pr-8 py-2 bg-blue-50/50 border border-blue-300 rounded-lg text-sm font-mono font-bold text-slate-800 focus:ring-2 focus:ring-blue-800 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setNfcCardId2('');
                              setShowSecondaryNfc(false);
                            }}
                            className="absolute right-2 p-1 text-slate-400 hover:text-rose-600"
                            title="Remove 2nd NFC"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {settings?.attendanceMode === 'MANTRA_USB' && (
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

                {settings?.attendanceMode === 'BIOMAX_WALL' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-blue-900" /> Biomax Device ID
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter ID from device"
                        value={fingerprintId || ""}
                        onChange={(e) => setFingerprintId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-800 outline-none"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (!fingerprintId) return alert('Please enter a User ID first.');
                            const res = await fetch('/api/biometrics/enroll', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                gymId: settings?.gymId || 'gym_1',
                                memberId: isEditingMember ? editingMemberId : 'new',
                                nfcCardId: fingerprintId
                              })
                            });
                            const data = await res.json();
                            if (res.ok) alert('Enrollment command queued! Place finger on device when it beeps.');
                            else alert(`Error: ${data.error || 'Failed to queue command'}`);
                          } catch (err) {
                            console.error(err);
                            alert('Network error while triggering enrollment.');
                          }
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-bold shrink-0 transition-colors bg-blue-100 text-blue-900 hover:bg-blue-200"
                      >
                        Remote Enroll
                      </button>
                    </div>
                  </div>
                )}

                {settings?.attendanceMode === 'ESSL_WALL' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-emerald-700" /> ZKTeco Device ID
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Device User ID"
                        value={fingerprintId || ""}
                        onChange={(e) => setFingerprintId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-600 outline-none"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (!fingerprintId) return alert('Please enter a User ID first.');
                            const res = await fetch('/api/biometrics/enroll', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                gymId: settings?.gymId || 'gym_1',
                                memberId: isEditingMember ? editingMemberId : 'new',
                                nfcCardId: fingerprintId
                              })
                            });
                            const data = await res.json();
                            if (res.ok) alert('Enrollment command queued! Place finger on device when it beeps.');
                            else alert(`Error: ${data.error || 'Failed to queue command'}`);
                          } catch (err) {
                            console.error(err);
                            alert('Network error while triggering enrollment.');
                          }
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-bold shrink-0 transition-colors bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                      >
                        Remote Enroll
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

                    <div className="col-span-1 sm:col-span-2 bg-blue-50/80 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                      <span className="font-bold text-blue-950 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-900" />
                        Next Renewal Due Date:
                      </span>
                      <span className="font-mono font-bold text-blue-900">
                        {(() => {
                          const selectedPlan = plans.find(p => p.name === planType);
                          const months = selectedPlan ? (selectedPlan.durationMonths || 1) : 1;
                          const d = new Date(lastPaymentDate || new Date());
                          d.setMonth(d.getMonth() + months);
                          return formatDateDDMMYYYY(d.toISOString().split('T')[0]);
                        })()}
                      </span>
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

                    {paymentMethod === 'UPI' && (
                      <div className="mt-2 p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg space-y-2 animate-in fade-in duration-150">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">UPI ID / Transaction UTR / Ref</label>
                          <input
                            type="text"
                            placeholder="e.g. 402819827361 or user@upi"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Sender / Payer Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Member Name on UPI app"
                            value={upiSenderName}
                            onChange={(e) => setUpiSenderName(e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-900 outline-none"
                          />
                        </div>
                      </div>
                    )}

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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  {selectedMember.name}
                  {selectedMember.nfcCardId && (
                    <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-semibold flex items-center">
                      <Tag className="w-3 h-3 mr-1" /> ID: {selectedMember.nfcCardId}
                    </span>
                  )}
                </h3>
                <p className="text-sm text-slate-500 font-medium">Joined {formatDateDDMMYYYY(selectedMember.joinedDate)}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => handleEnrollFingerprint(selectedMember)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg flex items-center gap-1 px-2 border border-transparent hover:border-emerald-200" title="Enroll Fingerprint on Wall Machine">
                  <Fingerprint className="w-4 h-4" />
                  <span className="text-xs font-bold hidden sm:inline">Enroll Finger</span>
                </button>
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
                  <span className="text-slate-400 font-semibold block mb-0.5">NFC Card ID(s)</span>
                  <div className="font-mono font-bold text-slate-800 space-y-0.5">
                    <div>1: {selectedMember.nfcCardId}</div>
                    {selectedMember.nfcCardId2 && (
                      <div className="text-blue-900 text-[11px]">2: {selectedMember.nfcCardId2}</div>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 font-semibold block mb-0.5">Monthly Avg Workout</span>
                  <span className="font-bold text-blue-950">
                    {getAvg(selectedMember.id)} hrs / day
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 font-semibold block mb-0.5">Last Payment</span>
                  <span className="font-bold text-slate-800">{formatDateDDMMYYYY(selectedMember.lastPaymentDate)}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 font-semibold block mb-0.5">Next Due Date</span>
                  <span className="font-bold text-amber-700">{formatDateDDMMYYYY(selectedMember.nextDueDate)}</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl col-span-2 flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 font-bold text-xs block mb-0.5">WhatsApp Bot Status</span>
                    <span className={`font-bold text-xs flex items-center gap-1.5 ${selectedMember.waActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                      <MessageCircle className="w-3.5 h-3.5" />
                      {selectedMember.waActive ? "Activated (Member messaged 'start')" : "Not Activated (Waiting for member to text 'start')"}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                    selectedMember.waActive
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {selectedMember.waActive ? 'Active' : 'Pending Start'}
                  </span>
                </div>

                {(selectedMember.pendingBalance || 0) > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl col-span-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-amber-800 font-bold block flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Pending Dues / Unpaid Balance</span>
                        <span className="text-[11px] text-amber-700 font-medium">
                          {selectedMember.balanceDueDate ? `Due before: ${formatDateDDMMYYYY(selectedMember.balanceDueDate)}` : 'No deadline specified'}
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

                  {renewPaymentMethod === 'UPI' && (
                    <div className="mt-2 p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg space-y-2 animate-in fade-in duration-150">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">UPI ID / Transaction UTR</label>
                        <input
                          type="text"
                          placeholder="e.g. 402819827361 or user@upi"
                          value={renewUpiId}
                          onChange={(e) => setRenewUpiId(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Sender / Payer Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Member Name on UPI"
                          value={renewUpiSenderName}
                          onChange={(e) => setRenewUpiSenderName(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-900 outline-none"
                        />
                      </div>
                    </div>
                  )}

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
                          <div className="text-slate-500 font-mono text-xs">{formatDateDDMMYYYY(tx.date)}</div>
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
                          <div className="font-bold text-slate-800 font-mono">{formatDateDDMMYYYY(a.dateStr)}</div>
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
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
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
                <div className="grid grid-cols-4 gap-1.5">
                  {(['CASH', 'UPI', 'CARD', 'SPLIT'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setCollectDuePaymentMethod(mode)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center space-y-1 ${
                        collectDuePaymentMethod === mode
                          ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-700 ring-offset-1'
                          : 'bg-slate-50 text-slate-700 border border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {mode === 'CASH' ? <Banknote className="w-4 h-4" /> : mode === 'UPI' ? <Smartphone className="w-4 h-4" /> : mode === 'CARD' ? <CreditCard className="w-4 h-4" /> : <ArrowLeftRight className="w-4 h-4" />}
                      <span className="text-[11px]">{mode === 'UPI' ? 'UPI' : mode}</span>
                    </button>
                  ))}
                </div>

                {collectDuePaymentMethod === 'UPI' && (
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 animate-in fade-in">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        UPI ID / Transaction UTR / Ref
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 402819827361 or user@upi"
                        value={collectDueUpiId}
                        onChange={(e) => setCollectDueUpiId(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Payer / Sender Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Member Name on UPI"
                        value={collectDueUpiSenderName}
                        onChange={(e) => setCollectDueUpiSenderName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 outline-none"
                      />
                    </div>
                  </div>
                )}

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
        <div className="fixed inset-0 z-[70] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
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
