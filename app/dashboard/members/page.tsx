'use client';

import React, { useState, useEffect, useDeferredValue, useMemo } from 'react';
import { Users, Plus, Search, Phone, CreditCard, Calendar, Radio, CheckCircle, Clock, Edit, RefreshCw, X, Shield, Dumbbell, AlertCircle, Trash2, MessageCircle, AlertTriangle, CheckCircle2, Bell, Banknote, Smartphone, ArrowLeftRight, Tag, ChevronRight, Fingerprint, Download, FileText, FileSpreadsheet, Camera, ImagePlus } from 'lucide-react';
import { useMembersData } from '@/lib/hooks';
import { mutate } from 'swr';
import { getCustomers, getSubscriptionPlans, getTransactions, getAttendance, getMemberMonthlyAvgHours, addCustomer, updateCustomer, deleteCustomer, renewMemberPayment, collectPendingBalance, getGyms, getGymSettings, toggleCustomerWaStatus, getNextAvailableZkTecoId } from '@/lib/actions';
import { Customer, Transaction, AttendanceRecord, SubscriptionPlan, Gym } from '@/lib/types';
import { getTemplate, compileTemplate } from '@/lib/templates';
import { formatDateDDMMYYYY, exportToCSV, getLocalTodayDateString } from '@/lib/utils';
import { exportToPDF } from '@/lib/exportPdf';
import ImageCropper from '@/components/ImageCropper';

export default function MemberManagementPage() {
  const [gymId, setGymId] = useState<string>('gym_1');







  useEffect(() => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || 'gym_1' : 'gym_1';
    // setGymId(savedId);
  }, []);

  const { data, isLoading } = useMembersData(gymId);
  const customers: any[] = data?.custs || [];
  const plans: any[] = data?.ps || [];
  const transactions: any[] = data?.txs || [];
  const attendance: any[] = data?.atts || [];
  const settings = data?.gymSettings || null;
  const nextAvailableId = data?.nextId || '';

  const gyms: any[] = data?.gyms || [];
  const matchedGym = gyms.find((g: any) => g.id === gymId);
  const gymName = matchedGym?.name || 'Our Gym';

  const absentTrackingEnabled = settings?.absentTrackingEnabled ?? false;
  const absentThresholdDays = settings?.absentThresholdDays ?? 3;

  const [displayLimit, setDisplayLimit] = useState<number>(30);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'due_soon' | 'overdue' | 'all' | 'new' | 'absent' | 'has_due'>('all');
  const [waFilter, setWaFilter] = useState<'all' | 'activated' | 'not_activated'>('all');
  const [timeFilter, setTimeFilter] = useState<'all_time' | 'today' | 'this_week' | 'this_month'>('all_time');
  const [planFilter, setPlanFilter] = useState<string>('all');
  



  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalSessionIdRef = React.useRef(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nfcCardId, setNfcCardId] = useState('');
  const [nfcCardId2, setNfcCardId2] = useState('');
  const [showSecondaryNfc, setShowSecondaryNfc] = useState(false);
  const [fingerprintId, setFingerprintId] = useState('');
  const [mantraFpData, setMantraFpData] = useState('');
  const [profilePic, setProfilePic] = useState<string>('');
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [fpPollStatus, setFpPollStatus] = useState<'IDLE'|'POLLING'|'SUCCESS'|'ERROR'>('IDLE');
  const [fpCommandId, setFpCommandId] = useState<string|null>(null);
  const [enrollingMemberId, setEnrollingMemberId] = useState<string|null>(null);
  const [cardPollStatus, setCardPollStatus] = useState<'IDLE'|'POLLING'|'SUCCESS'|'ERROR'>('IDLE');
  const [cardCommandId, setCardCommandId] = useState<string|null>(null);
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

  const duplicateMember = useMemo(() => {
    if (!fingerprintId.trim()) return null;
    return customers.find(c => c.fingerprintId && String(c.fingerprintId).trim() === fingerprintId.trim() && c.id !== editingMemberId);
  }, [fingerprintId, customers, editingMemberId]);

  // Helper to match card strings with or without leading zeros
  const matchCard = (a?: string | null, b?: string | null) => {
    if (!a || !b) return false;
    const cleanA = a.trim().toLowerCase();
    const cleanB = b.trim().toLowerCase();
    if (cleanA === cleanB) return true;
    const stripA = cleanA.replace(/^0+/, '');
    const stripB = cleanB.replace(/^0+/, '');
    return !!stripA && !!stripB && stripA === stripB;
  };

  const duplicateNfcMember = useMemo(() => {
    if (!nfcCardId.trim()) return null;
    return customers.find(c => 
      c.id !== editingMemberId && (
        matchCard(c.nfcCardId, nfcCardId) || 
        matchCard(c.nfcCardId2, nfcCardId)
      )
    );
  }, [nfcCardId, customers, editingMemberId]);

  const duplicateNfc2Member = useMemo(() => {
    if (!nfcCardId2.trim()) return null;
    return customers.find(c => 
      c.id !== editingMemberId && (
        matchCard(c.nfcCardId, nfcCardId2) || 
        matchCard(c.nfcCardId2, nfcCardId2)
      )
    );
  }, [nfcCardId2, customers, editingMemberId]);

  const nextSuggestedId = useMemo(() => {
    const existingIds = customers
      .map(c => parseInt(c.fingerprintId, 10))
      .filter(n => !isNaN(n) && n > 0);
    if (existingIds.length === 0) return '101';
    return String(Math.max(...existingIds) + 1);
  }, [customers]);

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
    setMantraFpData(cust.mantraFpData || '');
    setProfilePic(cust.profilePic || '');
    setFpPollStatus(cust.fingerprintId ? 'SUCCESS' : 'IDLE');
    setCardPollStatus('IDLE');
    setPlanType(cust.planType);
    setFeeAmount(cust.feeAmount);
    setPaidAmount(cust.feeAmount);
    setLastPaymentDate(cust.lastPaymentDate);
    setIsEditingMember(true);
    setEditingMemberId(cust.id);
    setSelectedMember(null); // Close the details modal so the edit modal is visible
    setShowAddModal(true);
  };
  const handleImageUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Image must be under 2MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };


  /**
   * Centralized modal close handler.
   * If a fingerprint was enrolled (or is mid-enrollment) on the device
   * but the member was NOT saved, we must clean up the ghost fingerprint
   * from the physical device so it doesn't block future enrollments.
   */
  const closeAddModal = async () => {
    // If this is a NEW member form (not editing), and a fingerprint enroll command was
    // ever sent to the device (POLLING = in progress, SUCCESS = completed, ERROR = device
    // rejected but may have partial user record), delete the ghost fingerprint from the machine.
    const fpWasSentToDevice = !isEditingMember && fingerprintId && (
      fpPollStatus === 'POLLING' || fpPollStatus === 'SUCCESS' || fpPollStatus === 'ERROR'
    );
    if (fpWasSentToDevice) {
      console.log(`[Ghost Cleanup] Cancelling modal with fpPollStatus=${fpPollStatus}. Deleting PIN ${fingerprintId} from device.`);
      fetch('/api/biometrics/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gymId, pin: fingerprintId })
      }).catch(e => console.error('Ghost fingerprint cleanup failed:', e));
    }
    // Reset modal state
    setShowAddModal(false);
    setIsEditingMember(false);
    setEditingMemberId(null);
    setFingerprintId(nextAvailableId);
    setMantraFpData('');
    setFpPollStatus('IDLE');
    setFpCommandId(null);
    setEnrollingMemberId(null);
    setCardPollStatus('IDLE');
    setCardCommandId(null);
  };

  // Handle ghost fingerprint cleanup on browser tab close / refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Trigger delete if enroll was attempted (POLLING, SUCCESS, or ERROR)
      const fpWasSentToDevice = !isEditingMember && fingerprintId && (
        fpPollStatus === 'POLLING' || fpPollStatus === 'SUCCESS' || fpPollStatus === 'ERROR'
      );
      if (fpWasSentToDevice) {
        // keepalive: true ensures the request survives the page unload
        fetch('/api/biometrics/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gymId, pin: fingerprintId }),
          keepalive: true
        }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditingMember, fingerprintId, fpPollStatus, gymId]);

  const handleDeleteMember = (id: string) => {
    setConfirmDialog({
      title: 'Delete Member',
      message: 'Are you sure you want to completely delete this member? This action cannot be undone.',
      onConfirm: async () => {
        await deleteCustomer(id);
        setSelectedMember(null);
        showToast('Member deleted successfully', 'success');
        mutate(['members', gymId]);
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

  // Polling for biometric command success (Fingerprint & Card)
  useEffect(() => {
    if (fpPollStatus !== 'POLLING' && cardPollStatus !== 'POLLING') return;
    const interval = setInterval(async () => {
      // Check Fingerprint command
      if (fpPollStatus === 'POLLING') {
        try {
          const res = await fetch(`/api/biometrics/command-status?id=${fpCommandId || ''}&pin=${fingerprintId || ''}&gymId=${gymId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'SUCCESS') {
              setFpPollStatus('SUCCESS');
              setFpCommandId(null);
              setEnrollingMemberId(null);
              showToast('Fingerprint Enrolled & Saved!', 'success');
            } else if (data.status === 'ERROR' || data.status === 'FAILED') {
              setFpPollStatus('ERROR');
              setFpCommandId(null);
              setEnrollingMemberId(null);
              showToast('Fingerprint Enrollment Failed on Device. Please try again.', 'error');
            } else if (data.status === 'TIMEOUT') {
              setFpPollStatus('ERROR');
              setFpCommandId(null);
              setEnrollingMemberId(null);
              showToast(data.message || 'Enrollment timed out. Device did not detect a scan.', 'error');
            }
          }
        } catch (e) { }
      }

      // Check Card sync command
      if (cardPollStatus === 'POLLING') {
        try {
          const res = await fetch(`/api/biometrics/command-status?id=${cardCommandId || ''}&pin=${fingerprintId || ''}&gymId=${gymId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'SUCCESS') {
              setCardPollStatus('SUCCESS');
              setCardCommandId(null);
              showToast('Card Synced to Device!', 'success');
            } else if (data.status === 'ERROR') {
              setCardPollStatus('ERROR');
              setCardCommandId(null);
              showToast('Card Sync Failed', 'error');
            }
          }
        } catch (e) { }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [fpPollStatus, cardPollStatus, fpCommandId, cardCommandId, fingerprintId]);

  // Timeout for biometric enrollment polling (client-side safety net, server also enforces 90s)
  useEffect(() => {
    if (fpPollStatus === 'POLLING') {
      const timer = setTimeout(() => {
        if (fpPollStatus === 'POLLING') {
          setFpPollStatus('ERROR');
          setFpCommandId(null);
          setEnrollingMemberId(null);
          showToast('Enrollment timed out. The device did not detect a fingerprint scan.', 'error');
        }
      }, 95000); // 95 seconds — slightly over server-side 90s so server timeout message arrives first
      return () => clearTimeout(timer);
    }
  }, [fpPollStatus]);

  // Timeout for card enrollment polling
  useEffect(() => {
    if (cardPollStatus === 'POLLING') {
      const timer = setTimeout(() => {
        if (cardPollStatus === 'POLLING') {
          setCardPollStatus('ERROR');
          setCardCommandId(null);
          showToast('Card enrollment timed out on device', 'error');
        }
      }, 45000); // 45 seconds timeout
      return () => clearTimeout(timer);
    }
  }, [cardPollStatus]);

  useEffect(() => {
    mutate(['members', gymId]);

    // Background live auto-refresh polling every 3 seconds
    const interval = setInterval(() => {
      if (document.hidden) return;
      mutate(['members', gymId]);
    }, 30000);

    const handleFocus = () => {
      mutate(['members', gymId]);
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
    // setIsLoading(true);
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || 'gym_1' : 'gym_1';
    setGymId(savedId);

    const [custs, ps, txs, atts, loadedGyms, gymSettings, nextId] = await Promise.all([
      getCustomers(savedId),
      getSubscriptionPlans(savedId),
      getTransactions(savedId),
      getAttendance(savedId),
      getGyms(),
      getGymSettings(savedId),
      getNextAvailableZkTecoId(savedId)
    ]);

    // setCustomers(custs);
    // setPlans(ps);
    // setTransactions(txs);
    // setAttendance(atts);
    // setSettings(gymSettings);
    // setNextAvailableId(nextId);
    
    const matchedGym = loadedGyms.find((g: any) => g.id === savedId);
    if (matchedGym) {
      // setGymName(matchedGym.name);
    }

    if (gymSettings) {
      // setAbsentTrackingEnabled...
      // setAbsentThresholdDays...
    }
    
    // setIsLoading(false);
    return custs; // Return fresh customers so callers can sync selectedMember
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

    if (fingerprintId && fingerprintId.trim()) {
      const cleanFp = fingerprintId.trim();
      const existingFp = customers.find(c => c.fingerprintId === cleanFp);
      if (existingFp && (!isEditingMember || existingFp.id !== editingMemberId)) {
        setErrorMsg(`Member ID (ZKTeco ID) "${cleanFp}" is already in use by ${existingFp.name}. Please use the Next Available ID.`);
        return;
      }
    }

    const newNfc = nfcCardId.trim() || `NFC-${Math.floor(10000 + Math.random() * 90000)}`;
    if (nfcCardId.trim() && duplicateNfcMember) {
      setErrorMsg(`NFC Card ID "${nfcCardId.trim()}" is already assigned to ${duplicateNfcMember.name}. Duplicate NFC cards are strictly prohibited.`);
      return;
    }

    if (showSecondaryNfc && nfcCardId2.trim()) {
      if (matchCard(nfcCardId, nfcCardId2)) {
        setErrorMsg(`Primary and Secondary NFC Card cannot be identical.`);
        return;
      }
      if (duplicateNfc2Member) {
        setErrorMsg(`Secondary NFC Card ID "${nfcCardId2.trim()}" is already assigned to ${duplicateNfc2Member.name}.`);
        return;
      }
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

    setIsSubmitting(true);
    const savedName = name;

    try {
      if (isEditingMember && editingMemberId) {
        await updateCustomer(editingMemberId, {
          name: savedName, phone, nfcCardId: newNfc, nfcCardId2: showSecondaryNfc && nfcCardId2.trim() ? nfcCardId2.trim() : null,
          fingerprintId: fingerprintId || null, mantraFpData, profilePic: profilePic || null, planType, feeAmount: Number(feeAmount),
          lastPaymentDate, nextDueDate
        });
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: `Member ${savedName} updated successfully!`, type: 'success' } }));
      } else {
        const totalPlanPrice = Number(feeAmount);
        const actualPaid = Number(paidAmount);
        const diff = Math.max(0, totalPlanPrice - actualPaid);
        const finalPendingBalance = diff > 0 && remainingType === 'BALANCE' ? diff : 0;
        const discountAmount = diff > 0 && remainingType === 'DISCOUNT' ? diff : 0;
        const splitData = paymentMethod === 'SPLIT' ? { cash: Number(splitCash), upi: Number(splitUpi) } : undefined;

        await addCustomer({
          gymId, name: savedName, phone, nfcCardId: newNfc, nfcCardId2: showSecondaryNfc && nfcCardId2.trim() ? nfcCardId2.trim() : null,
          fingerprintId: fingerprintId || null, mantraFpData, profilePic: profilePic || null, planType, feeAmount: totalPlanPrice,
          paidAmount: actualPaid, pendingBalance: finalPendingBalance, balanceDueDate: finalPendingBalance > 0 ? balanceDueDate : null,
          discountAmount, paymentMethod, splitDetails: splitData, upiId: paymentMethod === 'UPI' ? upiId : undefined,
          upiSenderName: paymentMethod === 'UPI' ? upiSenderName : undefined, lastPaymentDate, nextDueDate
        });
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: `Member ${savedName} added successfully!`, type: 'success' } }));
      }
      
      // Re-fetch from DB, then sync the detail panel to the real saved record
      const freshData = await mutate(['members', gymId]);
      const freshCustomers = freshData?.custs;
      if (!isEditingMember && freshCustomers) {
        const realMember = freshCustomers.find((c: any) => c.name === savedName && !c.id?.startsWith('temp_'));
        if (realMember) setSelectedMember(realMember);
      }

      // Close modal and clear forms only on success
      setShowAddModal(false);
      setIsEditingMember(false);
      setEditingMemberId(null);
      setName('');
      setPhone('');
      setNfcCardId('');
      setNfcCardId2('');
      setProfilePic('');
      setShowSecondaryNfc(false);
      setUpiId('');
      setUpiSenderName('');
      setInfoMsg('');
      setFingerprintId('');
      setFpPollStatus('IDLE');
      setFpCommandId(null);
      setCardPollStatus('IDLE');
      setCardCommandId(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save member. Please check the entered data.');
      showToast(err.message || 'Failed to save member', 'error');
    } finally {
      setIsSubmitting(false);
    }
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
      mutate(['members', gymId]);
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
      mutate(['members', gymId]);

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
          a.durationMinutes ? (a.durationMinutes < 60 ? `${a.durationMinutes}m` : `${Math.floor(a.durationMinutes / 60)}h ${a.durationMinutes % 60}m`) : 'In Progress',
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
              setMantraFpData(data.fingerprintId);
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

  const handleOpenAddModal = () => {
    setIsEditingMember(false);
    setEditingMemberId(null);
    setName('');
    setPhone('');
    setNfcCardId('');
    setNfcCardId2('');
    setShowSecondaryNfc(false);
    setFingerprintId(nextSuggestedId);
    setFeeAmount(2500);
    setPaidAmount(2500);
    setInfoMsg('');
    setErrorMsg('');
    setShowAddModal(true);
  };

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
              onClick={handleOpenAddModal}
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
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-48">
              <div>
                <div className="flex items-center space-x-3 pb-3 border-b border-slate-100 mb-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-200 rounded w-1/2" />
                    <div className="h-3 bg-slate-200 rounded w-1/3" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-3 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start justify-items-stretch">

        {displayedCustomers.map((cust) => {
          const avgHours = getAvg(cust.id);
          return (
            <div
              key={cust.id}
              onClick={() => setSelectedMember(cust)}
              className="bg-white border border-slate-200 hover:border-blue-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between w-full"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center space-x-3">
                    {cust.profilePic ? (
                      <img src={cust.profilePic} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-950 font-extrabold text-sm flex items-center justify-center border border-blue-200 shrink-0">
                        {cust.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="font-bold text-slate-900 text-sm truncate">{cust.name}</h3>
                        {cust.memberId && (
                          <span className="whitespace-nowrap shrink-0 text-[10px] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded">
                            M-{cust.memberId}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono flex items-center gap-1"><Phone className="w-3 h-3 shrink-0" /> <span className="truncate">{cust.phone}</span></div>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-1.5 pl-2">
                    {(cust.pendingBalance || 0) > 0 && (
                      <span className="whitespace-nowrap shrink-0 px-2 py-0.5 rounded text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300 shadow-sm animate-pulse flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" /> ₹{cust.pendingBalance} Due
                      </span>
                    )}
                    <span
                      className={`whitespace-nowrap shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${
                        cust.waActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                      title={cust.waActive ? "WhatsApp Bot Activated (Messaged 'start')" : "WhatsApp Not Activated (Waiting for member to text 'start')"}
                    >
                      {cust.waActive ? '● WA Active' : '○ No WA'}
                    </span>
                    <span
                      className={`whitespace-nowrap shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${
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
      )}
      
      {/* ADD/EDIT MEMBER MODAL */}
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
      {!isLoading && filteredCustomers.length === 0 && (
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
                setFingerprintId(nextSuggestedId);
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
                <button type="button" onClick={closeAddModal} className="text-slate-400 hover:text-slate-600">
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
              <div className="flex gap-4">
                <div className="flex flex-col items-center justify-center shrink-0">
                  <div className="relative w-20 h-20 bg-slate-100 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden hover:bg-slate-200 transition-colors cursor-pointer group">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      title="Upload Profile Picture"
                    />
                    {profilePic ? (
                      <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 mt-1 uppercase">Photo</span>
                </div>
                
                <div className="flex-1 flex flex-col justify-center">
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                {/* Member ID — shown whenever ANY hardware that needs a numeric PIN is enabled:
                    - ZKTeco wall-mount uses it as the device PIN for FP/card enrollment
                    - Mantra USB scanner uses it as the local fingerprintId for scan matching */}
                {(settings?.attendanceWallMountEnabled || settings?.attendanceMantraEnabled) && (

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-blue-900" /> Member ID *
                      </label>
                      <span className="text-[10px] font-medium text-slate-400">
                        {nextAvailableId && !isEditingMember ? `Next Available: ${nextAvailableId}` : 'Numeric Only'}
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="Enter ID (e.g. 101)"
                      value={fingerprintId || ""}
                      onChange={(e) => {
                        setFingerprintId(e.target.value);
                        if (fpPollStatus === 'SUCCESS') setFpPollStatus('IDLE');
                      }}
                      className={`w-full px-3 py-2 bg-white border ${duplicateMember ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-300 focus:ring-blue-800'} rounded-lg text-sm font-bold text-slate-800 focus:ring-2 outline-none`}
                    />
                    {duplicateMember && (
                      <div className="mt-1 flex flex-col gap-0.5 animate-in fade-in duration-150">
                        <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          Already assigned to {duplicateMember.name}!
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setFingerprintId(nextSuggestedId);
                            if (fpPollStatus === 'SUCCESS') setFpPollStatus('IDLE');
                          }}
                          className="text-[10px] text-blue-700 hover:text-blue-900 font-bold underline text-left cursor-pointer"
                        >
                          👉 Click to use next free ID: {nextSuggestedId}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Access & Biometrics Panel with LIVE TICKS */}
              <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                  <Shield className="w-3.5 h-3.5 text-blue-900" /> Access & Biometric Enrollment
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* CARD 1: NFC CARD & NFC TICK */}
                  {(settings?.attendanceNfcEnabled ?? true) && (
                    <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-blue-600" /> NFC Card ID
                          </label>
                          {/* TICK 1: NFC TICK */}
                          {duplicateNfcMember ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded-full">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Already Taken
                            </span>
                          ) : cardPollStatus === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Synced
                            </span>
                          ) : cardPollStatus === 'POLLING' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-300 px-2 py-0.5 rounded-full animate-pulse">
                              <RefreshCw className="w-3 h-3 animate-spin text-blue-600" /> Sending...
                            </span>
                          ) : cardPollStatus === 'ERROR' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded-full">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Sync Failed
                            </span>
                          ) : nfcCardId.trim() ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Card Linked
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> No Card
                            </span>
                          )}
                        </div>

                        <div className="relative flex items-center">
                          <input
                            type="text"
                            placeholder="Tap card or enter ID"
                            value={nfcCardId}
                            onChange={(e) => {
                              setNfcCardId(e.target.value);
                              if (cardPollStatus === 'ERROR' || cardPollStatus === 'SUCCESS') setCardPollStatus('IDLE');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.preventDefault();
                            }}
                            className={`w-full pl-3 pr-8 py-2 border rounded-lg text-sm font-mono font-bold text-slate-800 outline-none ${duplicateNfcMember ? 'border-rose-400 focus:ring-2 focus:ring-rose-400 bg-rose-50/20' : 'bg-slate-50 border-slate-300 focus:ring-2 focus:ring-blue-800'}`}
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
                        {duplicateNfcMember && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-rose-600 animate-in fade-in duration-150">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Card already assigned to {duplicateNfcMember.name}!</span>
                          </div>
                        )}

                        {showSecondaryNfc && (
                          <div className="mt-2 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold text-blue-950 uppercase">2nd NFC (Backup)</label>
                              <button
                                type="button"
                                onClick={() => {
                                  setNfcCardId2('');
                                  setShowSecondaryNfc(false);
                                }}
                                className="text-[10px] text-rose-600 hover:text-rose-800 font-bold"
                              >
                                Remove
                              </button>
                            </div>
                            <input
                              type="text"
                              placeholder="Tap 2nd card / keyfob"
                              value={nfcCardId2}
                              onChange={(e) => setNfcCardId2(e.target.value)}
                              className={`w-full px-3 py-1.5 border rounded-lg text-xs font-mono font-bold text-slate-800 outline-none ${duplicateNfc2Member ? 'border-rose-400 bg-rose-50/20 focus:ring-2 focus:ring-rose-400' : 'bg-blue-50/50 border-blue-200'}`}
                            />
                            {duplicateNfc2Member && (
                              <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-rose-600 animate-in fade-in duration-150">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>Card already assigned to {duplicateNfc2Member.name}!</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {settings?.attendanceWallMountEnabled && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!fingerprintId) {
                              showToast('Please enter Member ID first', 'error');
                              return;
                            }
                            if (duplicateMember) {
                              showToast(`Member ID ${fingerprintId} is already assigned to ${duplicateMember.name}. Please enter a new ID.`, 'error');
                              return;
                            }
                            if (!nfcCardId.trim()) {
                              showToast('Please enter or tap an NFC Card number first', 'error');
                              return;
                            }
                            if (duplicateNfcMember) {
                              showToast(`Card ${nfcCardId} is already assigned to ${duplicateNfcMember.name}. Duplicate cards are not allowed.`, 'error');
                              return;
                            }
                            setCardPollStatus('POLLING');
                            try {
                              const res = await fetch('/api/biometrics/enroll', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ gymId, memberId: 'temp', nfcCardId: fingerprintId, actualCardNumber: nfcCardId.trim(), enrollType: 'card' })
                              });
                              if (res.ok) {
                                const data = await res.json();
                                if (data.directSync) {
                                  setCardPollStatus('SUCCESS');
                                  showToast('Card saved directly to device!', 'success');
                                } else if (data.commandId) {
                                  setCardCommandId(data.commandId);
                                }
                              } else {
                                setCardPollStatus('ERROR');
                                showToast('Failed to send card to device', 'error');
                              }
                            } catch (e) {
                              setCardPollStatus('ERROR');
                              showToast('Failed to send card to device', 'error');
                            }
                          }}
                          disabled={cardPollStatus === 'POLLING'}
                          className="w-full py-2 px-3 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                          title="Send Card to Device"
                        >
                          <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                          {cardPollStatus === 'POLLING' ? 'Syncing...' : 'Send Card to Device'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* CARD 2: FINGERPRINT & FP TICK */}
                  {settings?.attendanceWallMountEnabled && (
                    <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Fingerprint className="w-3.5 h-3.5 text-indigo-600" /> Fingerprint
                          </label>
                          {/* TICK 2: FINGERPRINT TICK */}
                          {fpPollStatus === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> FP Saved
                            </span>
                          ) : fpPollStatus === 'POLLING' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-300 px-2 py-0.5 rounded-full animate-pulse">
                              <RefreshCw className="w-3 h-3 animate-spin text-blue-600" /> Place finger 3x...
                            </span>
                          ) : fpPollStatus === 'ERROR' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded-full">
                              <AlertCircle className="w-3 h-3 text-rose-600" /> Failed
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> Not Enrolled
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 leading-normal">
                          {fpPollStatus === 'POLLING' 
                            ? 'Device is waiting! Touch member finger 3 times on the scanner.'
                            : fpPollStatus === 'SUCCESS'
                            ? 'Fingerprint enrolled & registered on the machine.'
                            : 'Click below to start 3-tap fingerprint enrollment.'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          if (!fingerprintId) {
                            showToast('Please enter Member ID first (e.g. 101)', 'error');
                            return;
                          }
                          if (duplicateMember) {
                            showToast(`Member ID ${fingerprintId} is already assigned to ${duplicateMember.name}. Use a new ID like ${nextSuggestedId}.`, 'error');
                            return;
                          }
                          setFpPollStatus('POLLING');
                          try {
                            const res = await fetch('/api/biometrics/enroll', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ gymId, memberId: 'temp', nfcCardId: fingerprintId, enrollType: 'fp' })
                            });
                            if (res.ok) {
                              const data = await res.json();
                              if (data.commandId) setFpCommandId(data.commandId);
                            }
                          } catch (e) {
                            setFpPollStatus('ERROR');
                            showToast('Failed to send enroll command', 'error');
                          }
                        }}
                        disabled={fpPollStatus === 'POLLING'}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 ${
                          fpPollStatus === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                            : fpPollStatus === 'POLLING'
                            ? 'bg-blue-50 text-blue-900 border border-blue-300 animate-pulse'
                            : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border border-indigo-300'
                        }`}
                      >
                        <Fingerprint className="w-3.5 h-3.5 text-indigo-600" />
                        {fpPollStatus === 'POLLING' 
                          ? 'Waiting for Finger (3x)...' 
                          : fpPollStatus === 'SUCCESS' 
                          ? 'Re-enroll Fingerprint' 
                          : 'Enroll Fingerprint on Device'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {settings?.attendanceMantraEnabled && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Fingerprint className="w-3 h-3 text-blue-900" /> USB Biometric Scanner (Mantra)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      placeholder={mantraFpData ? "Registered" : "No Fingerprint"}
                      value={mantraFpData ? "Registered" : ""}
                      className="w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-blue-900 outline-none cursor-not-allowed"
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

              {/* Ghost fingerprint warning — shown when FP enrolled but form not yet saved */}
              {!isEditingMember && (fpPollStatus === 'SUCCESS' || fpPollStatus === 'POLLING') && (
                <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-amber-800 font-semibold leading-snug">
                    {fpPollStatus === 'SUCCESS'
                      ? 'Fingerprint enrolled on device. Save this member now — cancelling will delete the fingerprint from the machine.'
                      : 'Fingerprint enrollment in progress. Save after enrollment completes — cancelling will abort and delete from device.'}
                  </p>
                </div>
              )}

              <div className="pt-3 flex justify-end space-x-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 text-white rounded-lg text-xs font-bold transition-colors shadow-sm ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-950'}`}
                >
                  {isSubmitting ? 'Saving...' : (isEditingMember ? 'Save Changes' : 'Save Member & Collect Fee')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MEMBER DETAILS PROFILE (COMPACT & SLEEK) */}
      {selectedMember && (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-50 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-white/60 flex flex-col max-h-[92vh] ring-1 ring-slate-900/5">
            {/* Header / Banner (Compact) */}
            <div className="relative bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 p-3.5 sm:p-4 shrink-0">
              <div className="flex justify-between items-center relative z-10">
                <div className="flex items-center gap-3 min-w-0">
                  {selectedMember.profilePic ? (
                    <img src={selectedMember.profilePic} alt="Profile" className="w-10 h-10 rounded-xl object-cover border border-white/20 shadow-inner shrink-0" />
                  ) : (
                    <div className="w-10 h-10 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center text-white text-base font-black shadow-inner shrink-0">
                      {selectedMember.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-black text-white text-base sm:text-lg tracking-tight truncate leading-snug">{selectedMember.name}</h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-blue-100 text-xs font-medium">
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3 opacity-75" /> {selectedMember.phone}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3 opacity-75" /> Joined {formatDateDDMMYYYY(selectedMember.joinedDate)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button onClick={() => handleEditInit(selectedMember)} className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/10 transition-all" title="Edit Profile">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteMember(selectedMember.id)} className="p-1.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-100 rounded-lg border border-rose-500/20 transition-all" title="Delete Profile">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setSelectedMember(null)} className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/10 transition-all ml-1" title="Close">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Content Body (Compact) */}
            <div className="overflow-y-auto p-3 sm:p-4 space-y-3 custom-scrollbar flex-1">
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-center items-center text-center">
                  <Tag className="w-4 h-4 text-indigo-500 mb-1" />
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Member ID & NFC</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 truncate max-w-full">{selectedMember.fingerprintId || '-'} / {selectedMember.nfcCardId || '-'}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-center items-center text-center">
                  <Dumbbell className="w-4 h-4 text-emerald-500 mb-1" />
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Avg Workout</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5">{getAvg(selectedMember.id)} hrs/day</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-center items-center text-center">
                  <Banknote className="w-4 h-4 text-blue-500 mb-1" />
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Last Paid</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5">{formatDateDDMMYYYY(selectedMember.lastPaymentDate)}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-center items-center text-center">
                  <Calendar className="w-4 h-4 text-amber-500 mb-1" />
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Next Due</span>
                  <span className="font-bold text-amber-600 text-xs mt-0.5">{formatDateDDMMYYYY(selectedMember.nextDueDate)}</span>
                </div>
              </div>

              {/* Status Banners */}
              <div className="space-y-2">
                <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedMember.waActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-xs">WhatsApp Assistant</h4>
                      <p className="text-[10px] text-slate-500 truncate">{selectedMember.waActive ? "Activated (Member is receiving updates)" : "Not Activated (Waiting for text 'start')"}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 ml-2 ${
                    selectedMember.waActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    {selectedMember.waActive ? 'Active' : 'Pending'}
                  </span>
                </div>

                {(selectedMember.pendingBalance || 0) > 0 && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-2.5 sm:p-3 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-amber-950 text-xs">Pending Dues</h4>
                        <p className="text-[10px] text-amber-700/80">
                          {selectedMember.balanceDueDate ? `Due: ${formatDateDDMMYYYY(selectedMember.balanceDueDate)}` : 'No deadline'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="font-black text-amber-900 text-sm">₹{selectedMember.pendingBalance}</span>
                      <button
                        onClick={() => {
                          setCollectDueMember(selectedMember);
                          setCollectDueAmount(selectedMember.pendingBalance);
                          setCollectDuePaymentMethod('CASH');
                          setShowCollectDueModal(true);
                        }}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg transition-all"
                      >
                        Collect
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Fee Renewal Action Box (Compact) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 py-1.5 px-3">
                  <h4 className="font-bold text-slate-700 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                    Renew Membership
                  </h4>
                </div>
                <div className="p-3 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Plan Period</label>
                      <select
                        value={renewMonths}
                        onChange={(e) => {
                          const m = Number(e.target.value);
                          setRenewMonths(m);
                          setRenewPaidAmount(selectedMember.feeAmount * m);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                      >
                        <option value={1}>+1 Month (₹{selectedMember.feeAmount})</option>
                        <option value={3}>+3 Months (₹{selectedMember.feeAmount * 3})</option>
                        <option value={6}>+6 Months (₹{selectedMember.feeAmount * 6})</option>
                        <option value={12}>+1 Year (₹{selectedMember.feeAmount * 12})</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Amount Paid (₹)</label>
                      <input
                        type="number"
                        min={0}
                        value={renewPaidAmount}
                        onChange={(e) => setRenewPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 font-bold text-emerald-600 text-xs focus:ring-2 focus:ring-emerald-600 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {Number(renewPaidAmount) < selectedMember.feeAmount * renewMonths && (
                    <div className="p-2.5 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2 animate-in fade-in zoom-in duration-200">
                      <div className="flex justify-between items-center font-bold text-xs">
                        <span className="text-amber-900">Remaining Unpaid:</span>
                        <span className="text-amber-700 font-black">₹{selectedMember.feeAmount * renewMonths - Number(renewPaidAmount)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRenewRemainingType('BALANCE')}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                            renewRemainingType === 'BALANCE' ? 'bg-amber-500 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" /> Balance Due
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenewRemainingType('DISCOUNT')}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                            renewRemainingType === 'DISCOUNT' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Tag className="w-3.5 h-3.5" /> Discount
                        </button>
                      </div>
                      {renewRemainingType === 'BALANCE' && (
                        <div className="pt-1">
                          <label className="block text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1">Due By Date</label>
                          <input
                            type="date"
                            value={renewBalanceDueDate}
                            onChange={(e) => setRenewBalanceDueDate(e.target.value)}
                            className="w-full py-1.5 px-2.5 bg-white border border-amber-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payment Mode</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['CASH', 'UPI', 'CARD', 'SPLIT'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setRenewPaymentMethod(mode)}
                          className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                            renewPaymentMethod === mode
                              ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {mode === 'CASH' ? <Banknote className="w-4 h-4" /> : mode === 'UPI' ? <Smartphone className="w-4 h-4" /> : mode === 'CARD' ? <CreditCard className="w-4 h-4" /> : <ArrowLeftRight className="w-4 h-4" />}
                          <span className="text-[9px] uppercase tracking-wider">{mode === 'UPI' ? 'UPI' : mode}</span>
                        </button>
                      ))}
                    </div>

                    {renewPaymentMethod === 'UPI' && (
                      <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in fade-in duration-200">
                        <input
                          type="text"
                          placeholder="UPI ID / Transaction UTR"
                          value={renewUpiId}
                          onChange={(e) => setRenewUpiId(e.target.value)}
                          className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Sender / Payer Name"
                          value={renewUpiSenderName}
                          onChange={(e) => setRenewUpiSenderName(e.target.value)}
                          className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {renewPaymentMethod === 'SPLIT' && (
                      <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-2 animate-in fade-in duration-200">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cash (₹)</label>
                          <input
                            type="number"
                            value={renewSplitCash}
                            onChange={(e) => setRenewSplitCash(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">UPI (₹)</label>
                          <input
                            type="number"
                            value={renewSplitUpi}
                            onChange={(e) => setRenewSplitUpi(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-1">
                    <button
                      onClick={() => handleRenewPayment(selectedMember)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Record Renewal & Send Receipt
                    </button>
                  </div>
                </div>
              </div>

              {/* History Grid (Compact) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pb-2">
                <div>
                  <h4 className="font-bold text-slate-700 text-xs mb-1.5 flex items-center gap-1.5 uppercase tracking-wide"><Banknote className="w-3.5 h-3.5 text-slate-400" /> Transactions</h4>
                  <div className="space-y-1.5">
                    {transactions.filter(t => t.customerId === selectedMember.id).slice(0, 4).map(tx => (
                      <div key={tx.id} className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs flex justify-between items-center text-xs">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 truncate">{tx.description}</div>
                          <div className="text-slate-400 font-mono text-[10px]">{formatDateDDMMYYYY(tx.date)}</div>
                        </div>
                        <span className="font-black text-emerald-600 text-xs ml-2 shrink-0">₹{tx.amount}</span>
                      </div>
                    ))}
                    {transactions.filter(t => t.customerId === selectedMember.id).length === 0 && (
                      <div className="text-slate-400 text-xs italic p-3 bg-white rounded-lg border border-slate-100 text-center">No transactions yet.</div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="font-bold text-slate-700 text-xs flex items-center gap-1.5 uppercase tracking-wide"><Clock className="w-3.5 h-3.5 text-slate-400" /> Recent Attendance</h4>
                    <button
                      onClick={() => exportIndividualMember(selectedMember.id, 'pdf')}
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors"
                      title="Download Member Report (PDF)"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {attendance.filter(a => a.customerId === selectedMember.id).slice(0, 4).map(a => (
                      <div key={a.id} className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-slate-800 font-mono">{formatDateDDMMYYYY(a.dateStr)}</div>
                          <div className="text-slate-400 text-[10px]">In: {new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        {a.checkOutTime ? (
                          <div className="text-right shrink-0 ml-2">
                            <span className="font-bold text-blue-600 block text-[11px]">{a.durationMinutes}m</span>
                            <span className="text-slate-400 text-[10px]">Out: {new Date(a.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ) : (
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200">Active</span>
                        )}
                      </div>
                    ))}
                    {attendance.filter(a => a.customerId === selectedMember.id).length === 0 && (
                      <div className="text-slate-400 text-xs italic p-3 bg-white rounded-lg border border-slate-100 text-center">No attendance yet.</div>
                    )}
                  </div>
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
          <div className={`flex items-center space-x-3 px-5 py-4 rounded-2xl shadow-lg border relative overflow-hidden ${
            toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <div className="absolute bottom-0 left-0 h-1 bg-current opacity-20 toast-progress" />
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-600" />}
            {toast.type === 'info' && <Bell className="w-5 h-5 text-blue-600" />}
            <span className="font-bold text-sm">{toast.message}</span>
          </div>
        </div>
      )}

      {/* IMAGE CROPPER MODAL */}
      {imageToCrop && (
        <ImageCropper
          imageSrc={imageToCrop}
          onCropCompleteAction={(croppedImg) => {
            setProfilePic(croppedImg);
            setImageToCrop(null);
          }}
          onCancel={() => setImageToCrop(null)}
        />
      )}

      {/* MOBILE FLOATING ACTION BUTTON */}
      <button
        onClick={handleOpenAddModal}
        className="md:hidden fixed bottom-24 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-95 transition-transform"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
