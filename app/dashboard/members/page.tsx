'use client';

import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Phone, CreditCard, Calendar, Radio, CheckCircle, Clock, Edit, RefreshCw, X, Shield, Dumbbell, AlertCircle, Trash2 } from 'lucide-react';
import { getCustomers, getSubscriptionPlans, getTransactions, getAttendance, getMemberMonthlyAvgHours, addCustomer, updateCustomer, deleteCustomer, renewMemberPayment, getGyms } from '@/lib/actions';
import { Customer, Transaction, AttendanceRecord, SubscriptionPlan, Gym } from '@/lib/types';

export default function MemberManagementPage() {
  const [gymId, setGymId] = useState<string>('gym_1');
  const [gymName, setGymName] = useState<string>('Our Gym');
  const [customers, setCustomers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'active' | 'due_soon' | 'overdue'>('all');
  const [timeFilter, setTimeFilter] = useState<'all_time' | 'today' | 'this_week' | 'this_month'>('this_month');

  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nfcCardId, setNfcCardId] = useState('');
  const [planType, setPlanType] = useState<string>('Monthly');
  const [feeAmount, setFeeAmount] = useState(2500);
  const [lastPaymentDate, setLastPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Selected Member Details Drawer State
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [renewMonths, setRenewMonths] = useState(1);
  const [isEditingMember, setIsEditingMember] = useState(false);

  const handleEditInit = (cust: any) => {
    setName(cust.name);
    setPhone(cust.phone);
    setNfcCardId(cust.nfcCardId);
    setPlanType(cust.planType);
    setFeeAmount(cust.feeAmount);
    setLastPaymentDate(cust.lastPaymentDate);
    setIsEditingMember(true);
    setShowAddModal(true);
  };

  const handleDeleteMember = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this member?')) {
      await deleteCustomer(id);
      setSelectedMember(null);
      loadData();
    }
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
      setName('');
      setPhone('');
      setNfcCardId(newNfc || '');
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

    const [custs, ps, txs, atts, loadedGyms] = await Promise.all([
      getCustomers(savedId),
      getSubscriptionPlans(savedId),
      getTransactions(savedId),
      getAttendance(savedId),
      getGyms()
    ]);

    setCustomers(custs);
    setPlans(ps);
    setTransactions(txs);
    setAttendance(atts);
    
    const matchedGym = loadedGyms.find((g) => g.id === savedId);
    if (matchedGym) {
      setGymName(matchedGym.name);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    setErrorMsg('');

    const cleanPhone = phone.replace(/\D/g, '');
    
    const existingPhone = customers.find(c => c.phone.replace(/\D/g, '') === cleanPhone);
    if (existingPhone && (!isEditingMember || existingPhone.id !== selectedMember?.id)) {
      setErrorMsg(`Phone number already in use by ${existingPhone.name}. A number is for one customer only.`);
      return;
    }

    const newNfc = nfcCardId.trim() || `NFC-${Math.floor(10000 + Math.random() * 90000)}`;
    const existingNfc = customers.find(c => c.nfcCardId.toLowerCase() === newNfc.toLowerCase());
    if (existingNfc && (!isEditingMember || existingNfc.id !== selectedMember?.id)) {
      setErrorMsg(`NFC Card ID "${newNfc}" is already assigned to ${existingNfc.name}. An NFC card is for one customer only.`);
      return;
    }

    // Calculate due date based on plan
    const selectedPlan = plans.find(p => p.name === planType);
    const months = selectedPlan ? selectedPlan.durationMonths : 1;
    const dueObj = new Date(lastPaymentDate);
    dueObj.setMonth(dueObj.getMonth() + months);
    const nextDueDate = dueObj.toISOString().split('T')[0];

    if (isEditingMember && selectedMember) {
      await updateCustomer(selectedMember.id, {
        name,
        phone,
        nfcCardId: newNfc,
        planType,
        feeAmount: Number(feeAmount),
        lastPaymentDate,
        nextDueDate
      });
      setIsEditingMember(false);
      setSelectedMember(null);
    } else {
      await addCustomer({
        gymId,
        name,
        phone,
        nfcCardId: newNfc,
        planType,
        feeAmount: Number(feeAmount),
        lastPaymentDate,
        nextDueDate
      });

      const autoMessagesEnabled = localStorage.getItem(`wa_auto_messages_${gymId}`) !== 'false';
      if (autoMessagesEnabled) {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = now.toLocaleDateString();

        fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gymId,
            phone,
            message: `🎉 *Welcome to ${gymName}, ${name}!* 🏋️‍♂️🔥\n\nWe are absolutely thrilled to have you join our fitness family! Let's crush those fitness goals together. 💪\n\n*Membership Details:*\n🔹 *Plan:* ${planType}\n🔹 *Amount Paid:* ₹${feeAmount}\n🔹 *Valid Until:* ${nextDueDate}\n\nKeep pushing, you've got this! 💯\n_Receipt Generated: ${dateString} ${timeString}_`
          })
        }).catch(console.error);
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
    const updated = await renewMemberPayment(cust.id, renewMonths, cust.feeAmount * renewMonths);
    if (updated) {
      setSelectedMember(updated);
      loadData();

      const autoMessagesEnabled = localStorage.getItem(`wa_auto_messages_${gymId}`) !== 'false';
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
            message: `✅ *Payment Successfully Received!* 💰\n\nHi ${cust.name}, thank you for renewing your membership. Your payment has been successfully processed! 🚀\n\n*Transaction Details:*\n💳 *Amount Paid:* ₹${cust.feeAmount * renewMonths}\n📅 *New Expiry Date:* ${updated.nextDueDate}\n🔑 *Txn ID:* TXN-${Date.now().toString().slice(-6)}\n\nThank you for your continued dedication. See you at the gym! 🏋️‍♀️🔥\n_Date: ${dateString} ${timeString}_`
          })
        }).catch(console.error);
      }
    }
  };

  const getAvg = (custId: string) => {
    const atts = attendance.filter(a => a.customerId === custId && a.durationMinutes);
    if (atts.length === 0) return 1.2;
    const totalMins = atts.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
    const avg = (totalMins / 60) / Math.max(1, atts.length);
    return parseFloat(avg.toFixed(1));
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
    if (statusFilter !== 'all' && statusFilter !== 'new') {
      matchesStatus = c.status === statusFilter;
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

    return matchesSearch && matchesStatus && matchesTime;
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
            setName('');
            setPhone('');
            setNfcCardId('');
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

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'new', 'active', 'due_soon', 'overdue'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'due_soon' ? 'Due Soon' : st === 'new' ? 'New Members' : st}
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
                      <div className="text-xs text-slate-500 font-mono">📱 {cust.phone}</div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      cust.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : cust.status === 'due_soon'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {cust.status === 'active' ? 'Active' : cust.status === 'due_soon' ? 'Due Soon' : 'Overdue'}
                  </span>
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

              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMember(cust);
                  }}
                  className="text-xs font-bold text-blue-900 hover:text-blue-950 flex items-center"
                >
                  View Full Profile →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: ADD NEW MEMBER */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-900 text-lg flex items-center space-x-2">
                {isEditingMember ? <Edit className="w-5 h-5 text-blue-900" /> : <Plus className="w-5 h-5 text-blue-900" />}
                <span>{isEditingMember ? 'Edit Member Details' : 'Add New Member'}</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-800 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    NFC Tag / Card ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NFC-88219 (or auto-gen)"
                    value={nfcCardId}
                    onChange={(e) => setNfcCardId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800 focus:ring-2 focus:ring-blue-800 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 outline-none"
                  >
                    {plans.map(p => (
                      <option key={p.id} value={p.name}>
                        {p.name} ({p.durationMonths} {p.durationMonths === 1 ? 'Month' : 'Months'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Fee Amount (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={feeAmount}
                    onChange={(e) => setFeeAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  First Payment Date
                </label>
                <input
                  type="date"
                  value={lastPaymentDate}
                  onChange={(e) => setLastPaymentDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
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
                  <div className="text-xs text-slate-500 font-mono">📱 {selectedMember.phone}</div>
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
              </div>

              {/* Fee Renewal Action Box */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                <div className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                  <RefreshCw className="w-4 h-4 text-blue-900" />
                  <span>Renew Membership & Record Payment</span>
                </div>

                <div className="flex items-center space-x-3">
                  <select
                    value={renewMonths}
                    onChange={(e) => setRenewMonths(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 text-xs"
                  >
                    <option value={1}>+1 Month Renewal (₹{selectedMember.feeAmount})</option>
                    <option value={3}>+3 Months Renewal (₹{selectedMember.feeAmount * 3})</option>
                    <option value={6}>+6 Months Renewal (₹{selectedMember.feeAmount * 6})</option>
                    <option value={12}>+1 Year Renewal (₹{selectedMember.feeAmount * 12})</option>
                  </select>

                  <button
                    onClick={() => handleRenewPayment(selectedMember)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors"
                  >
                    Record Payment
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
    </div>
  );
}
