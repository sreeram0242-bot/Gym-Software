'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, TrendingUp, TrendingDown, DollarSign, Plus, ArrowUpRight, ArrowDownRight, Wallet, PieChart as PieChartIcon, Calendar, X, Filter, Settings, Trash2, Edit2, Download, Banknote, Smartphone, ArrowLeftRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { getCustomers, getTransactions, getSubscriptionPlans, addTransaction, updateTransaction, deleteTransaction, addSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan, getGyms } from '@/lib/actions';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, SubscriptionPlan } from '@/lib/types';
import { formatDateDDMMYYYY } from '@/lib/utils';

export default function RevenuePage() {
  const [gymId, setGymId] = useState<string>('gym_1');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE' | 'NEW_MEMBERS'>('ALL');
  const [paymentModeFilter, setPaymentModeFilter] = useState<'ALL' | 'CASH' | 'UPI' | 'CARD'>('ALL');

  // Global Filter State
  const [globalTimeFilter, setGlobalTimeFilter] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'THIS_YEAR' | 'CUSTOM'>('ALL');
  const [globalDateFrom, setGlobalDateFrom] = useState('');
  const [globalDateTo, setGlobalDateTo] = useState('');

  // Add Expense Modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('Rent');
  const [expenseAmount, setExpenseAmount] = useState<number | string>(5000);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');

  // Edit Transaction Modal
  const [showEditTxModal, setShowEditTxModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number | string>(0);
  const [editCategory, setEditCategory] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('CASH');
  const [deleteTxDialog, setDeleteTxDialog] = useState<{ id: string; desc: string; amount: number } | null>(null);

  // Export Modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');

  // Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanMonths, setNewPlanMonths] = useState<number | string>(1);
  const [newPlanPrice, setNewPlanPrice] = useState<number | string>(2500);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [deletePlanDialog, setDeletePlanDialog] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || 'gym_1' : 'gym_1';
    setGymId(savedId);

    const [txs, ps, custs] = await Promise.all([
      getTransactions(savedId),
      getSubscriptionPlans(savedId),
      getCustomers(savedId)
    ]);
    
    setTransactions(txs);
    setPlans(ps);
    setAllCustomers(custs);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || !expenseDesc) return;

    await addTransaction({
      gymId,
      type: 'EXPENSE',
      amount: Number(expenseAmount) || 0,
      category: expenseCategory,
      description: expenseDesc,
      date: expenseDate,
      paymentMethod: expensePaymentMethod
    });

    setShowExpenseModal(false);
    setExpenseDesc('');
    setExpenseAmount(5000);
    loadData();
  };

  const handleEditTxInit = (tx: any) => {
    setEditingTxId(tx.id);
    setEditAmount(tx.amount);
    setEditCategory(tx.category);
    setEditDesc(tx.description);
    setEditDate(tx.date);
    setEditPaymentMethod(tx.paymentMethod || 'CASH');
    setShowEditTxModal(true);
  };

  const handleEditTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTxId || !editAmount) return;

    await updateTransaction(editingTxId, {
      amount: Number(editAmount),
      category: editCategory,
      description: editDesc,
      date: editDate,
      paymentMethod: editPaymentMethod
    });

    setShowEditTxModal(false);
    setEditingTxId(null);
    loadData();
  };

  const handleDeleteTxConfirm = async () => {
    if (!deleteTxDialog) return;
    await deleteTransaction(deleteTxDialog.id);
    setDeleteTxDialog(null);
    loadData();
  };

  const handleAddPlan = async () => {
    const numMonths = Number(newPlanMonths);
    const numPrice = Number(newPlanPrice);
    if (!newPlanName || numPrice <= 0 || numMonths <= 0) return;
    
    if (editingPlanId) {
      await updateSubscriptionPlan(editingPlanId, {
        name: newPlanName,
        durationMonths: numMonths,
        price: numPrice
      });
      setEditingPlanId(null);
    } else {
      await addSubscriptionPlan({
        gymId,
        name: newPlanName,
        durationMonths: numMonths,
        price: numPrice
      });
    }
    
    setNewPlanName('');
    setNewPlanMonths(1);
    setNewPlanPrice(2500);
    loadData();
  };

  const handleEditPlanClick = (plan: any) => {
    setEditingPlanId(plan.id);
    setNewPlanName(plan.name);
    setNewPlanMonths(plan.durationMonths);
    setNewPlanPrice(plan.price);
  };

  const handleCancelEdit = () => {
    setEditingPlanId(null);
    setNewPlanName('');
    setNewPlanMonths(1);
    setNewPlanPrice(2500);
  };

  const handleDeletePlan = (planId: string) => {
    setDeletePlanDialog(planId);
  };

  const executeDeletePlan = async () => {
    if (!deletePlanDialog) return;
    await deleteSubscriptionPlan(deletePlanDialog);
    setDeletePlanDialog(null);
    loadData();
  };

  // Helper filter for global date toolbar
  const isDateInGlobalFilter = (dateStr: string) => {
    if (globalTimeFilter === 'ALL') return true;
    const d = new Date(dateStr);
    const now = new Date();

    if (globalTimeFilter === 'TODAY') {
      return d.toDateString() === now.toDateString();
    }
    if (globalTimeFilter === 'THIS_MONTH') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (globalTimeFilter === 'THIS_YEAR') {
      return d.getFullYear() === now.getFullYear();
    }
    if (globalTimeFilter === 'CUSTOM') {
      if (!globalDateFrom || !globalDateTo) return true;
      const cleanDate = (dateStr || '').split('T')[0];
      const minDate = globalDateFrom <= globalDateTo ? globalDateFrom : globalDateTo;
      const maxDate = globalDateFrom <= globalDateTo ? globalDateTo : globalDateFrom;
      return cleanDate >= minDate && cleanDate <= maxDate;
    }
    return true;
  };

  const filteredGlobalTxs = transactions.filter(t => isDateInGlobalFilter(t.date));

  const totalIncome = filteredGlobalTxs
    .filter((t) => t.type === 'INCOME')
    .reduce((acc, cur) => acc + cur.amount, 0);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayIncome = transactions
    .filter((t) => t.type === 'INCOME' && t.date === todayStr)
    .reduce((acc, cur) => acc + cur.amount, 0);

  const totalExpenses = filteredGlobalTxs
    .filter((t) => t.type === 'EXPENSE')
    .reduce((acc, cur) => acc + cur.amount, 0);

  const netProfit = totalIncome - totalExpenses;
  const newMembersCount = allCustomers.filter(c => c.gymId === gymId && isDateInGlobalFilter(c.joinedDate)).length;

  const cashTotal = filteredGlobalTxs
    .filter(t => t.type === 'INCOME')
    .reduce((acc, cur) => {
      if (cur.paymentMethod === 'CASH') return acc + cur.amount;
      if (cur.paymentMethod === 'SPLIT' && cur.splitDetails) {
        try {
          const parsed = typeof cur.splitDetails === 'string' ? JSON.parse(cur.splitDetails) : cur.splitDetails;
          return acc + (parsed.cash || 0);
        } catch (e) { return acc; }
      }
      return acc;
    }, 0);

  const upiTotal = filteredGlobalTxs
    .filter(t => t.type === 'INCOME')
    .reduce((acc, cur) => {
      if (cur.paymentMethod === 'UPI') return acc + cur.amount;
      if (cur.paymentMethod === 'SPLIT' && cur.splitDetails) {
        try {
          const parsed = typeof cur.splitDetails === 'string' ? JSON.parse(cur.splitDetails) : cur.splitDetails;
          return acc + (parsed.upi || 0);
        } catch (e) { return acc; }
      }
      return acc;
    }, 0);

  const cardTotal = filteredGlobalTxs
    .filter(t => t.type === 'INCOME' && t.paymentMethod === 'CARD')
    .reduce((acc, cur) => acc + cur.amount, 0);

  const chartData = [
    { name: 'May', Income: 14000, Expense: 8000, Net: 6000 },
    { name: 'Jun', Income: 18500, Expense: 12000, Net: 6500 },
    { name: 'Jul', Income: 11500, Expense: 27200, Net: -15700 },
    { name: 'Aug (Cur)', Income: totalIncome, Expense: totalExpenses, Net: netProfit },
  ];

  const filteredTxs = transactions.filter((t) => {
    if (!isDateInGlobalFilter(t.date)) return false;

    if (paymentModeFilter !== 'ALL') {
      if (paymentModeFilter === 'CASH' && t.paymentMethod !== 'CASH' && t.paymentMethod !== 'SPLIT') return false;
      if (paymentModeFilter === 'UPI' && t.paymentMethod !== 'UPI' && t.paymentMethod !== 'SPLIT') return false;
      if (paymentModeFilter === 'CARD' && t.paymentMethod !== 'CARD') return false;
    }

    if (filterType === 'ALL') return true;
    if (filterType === 'NEW_MEMBERS') {
      if (t.type !== 'INCOME') return false;
      const cust = allCustomers.find(c => c.id === t.customerId);
      if (!cust) return false;
      return isDateInGlobalFilter(cust.joinedDate);
    }
    return t.type === filterType;
  });

  const getExportTransactions = () => {
    let exportTxs = transactions;
    if (exportDateFrom && exportDateTo) {
      const minDate = exportDateFrom <= exportDateTo ? exportDateFrom : exportDateTo;
      const maxDate = exportDateFrom <= exportDateTo ? exportDateTo : exportDateFrom;
      exportTxs = transactions.filter(t => {
        const d = (t.date || '').split('T')[0];
        return d >= minDate && d <= maxDate;
      });
    } else if (exportDateFrom) {
      exportTxs = transactions.filter(t => (t.date || '').split('T')[0] >= exportDateFrom);
    } else if (exportDateTo) {
      exportTxs = transactions.filter(t => (t.date || '').split('T')[0] <= exportDateTo);
    } else {
      exportTxs = filteredTxs;
    }
    return exportTxs;
  };

  const executeExport = () => {
    const exportTxs = getExportTransactions();
    let runningBalance = 0;
    
    // Export chronologically (oldest first) to make the running balance logical
    const chronologicalTxs = [...exportTxs].reverse();

    const rows = [
      ['Date (DD/MM/YYYY)', 'Type', 'Category', 'Description', 'Payment Mode', 'Amount (₹)', 'Paid Amount (₹)', 'Discount (₹)', 'Customer', 'Balance (₹)'],
      ...chronologicalTxs.map(t => {
        if (t.type === 'INCOME') runningBalance += t.amount;
        else if (t.type === 'EXPENSE') runningBalance -= t.amount;

        return [
          formatDateDDMMYYYY(t.date),
          t.type,
          t.category,
          `"${t.description?.replace(/"/g, "'") || ''}"`,
          t.paymentMethod || 'CASH',
          t.amount,
          t.paidAmount ?? t.amount,
          t.discountAmount ?? 0,
          t.customerName || '',
          runningBalance
        ];
      })
    ];
    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateLabel = exportDateFrom && exportDateTo ? `${exportDateFrom}-to-${exportDateTo}` : 'export';
    link.download = `gymflow-transactions-${dateLabel}.csv`;
    link.click();
    setShowExportModal(false);
  };

  const executeExportPDF = async () => {
    const exportTxs = getExportTransactions();
    let runningBalance = 0;
    const chronologicalTxs = [...exportTxs].reverse();

    const body = chronologicalTxs.map(t => {
      if (t.type === 'INCOME') runningBalance += t.amount;
      else if (t.type === 'EXPENSE') runningBalance -= t.amount;

      return [
        formatDateDDMMYYYY(t.date),
        t.type,
        t.category,
        t.description?.replace(/"/g, "'") || '-',
        t.paymentMethod || 'CASH',
        `Rs ${t.amount.toLocaleString('en-IN')}`,
        t.customerName || '-',
        `Rs ${runningBalance.toLocaleString('en-IN')}`
      ];
    });

    const gyms = await getGyms();
    const gym = gyms.find((g: any) => g.id === gymId);
    const gymName = gym?.name || 'Gym Ledger Report';
    
    const doc = new jsPDF('landscape');
    
    // Header Branding
    doc.setFontSize(20);
    doc.setTextColor(30, 58, 138); // Deep Navy Blue
    doc.text(gymName, 14, 18);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate Muted
    const dateLabel = exportDateFrom && exportDateTo 
      ? `Period: ${formatDateDDMMYYYY(exportDateFrom)} to ${formatDateDDMMYYYY(exportDateTo)} (${exportTxs.length} Transactions)`
      : `Generated On: ${formatDateDDMMYYYY(new Date().toISOString())} (${exportTxs.length} Transactions)`;
    doc.text(`Financial Ledger & Profit/Loss Report | ${dateLabel}`, 14, 26);
    
    autoTable(doc, {
      startY: 34,
      head: [['Date (DD/MM/YYYY)', 'Type', 'Category', 'Description', 'Payment Mode', 'Amount', 'Customer', 'Balance']],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const rawRow = data.row.raw;
          const typeVal = Array.isArray(rawRow) ? rawRow[1] : '';
          
          if (typeVal === 'EXPENSE') {
            if (data.column.index === 1 || data.column.index === 5) {
              data.cell.styles.textColor = [220, 38, 38]; // Red for expenses
              data.cell.styles.fontStyle = 'bold';
            }
          } else if (typeVal === 'INCOME') {
            if (data.column.index === 1 || data.column.index === 5) {
              data.cell.styles.textColor = [16, 185, 129]; // Green for revenue
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      }
    });

    const fileNameDate = exportDateFrom && exportDateTo ? `${exportDateFrom}-to-${exportDateTo}` : 'export';
    doc.save(`gymflow-report-${fileNameDate}.pdf`);
    setShowExportModal(false);
  };


  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-950 text-xs font-bold mb-2">
            <CreditCard className="w-3.5 h-3.5 text-blue-900" />
            <span>Financial Analytics & Profit Hub</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Revenue & Net Profit Overview</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Track member fee payments, today's collections, operating expenses, and net profit.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              // Pre-fill with current month if empty
              if (!exportDateFrom || !exportDateTo) {
                 const today = new Date();
                 const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                 setExportDateFrom(firstDay.toISOString().split('T')[0]);
                 setExportDateTo(today.toISOString().split('T')[0]);
              }
              setShowExportModal(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm flex items-center space-x-2"
            title="Export filtered transactions to CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center"
            title="Subscription Packages Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowExpenseModal(true)}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Expense</span>
          </button>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {(['ALL', 'TODAY', 'THIS_MONTH', 'THIS_YEAR', 'CUSTOM'] as const).map(f => (
            <button
              key={f}
              onClick={() => setGlobalTimeFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                globalTimeFilter === f ? 'bg-blue-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
        
        {globalTimeFilter === 'CUSTOM' && (
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <input 
              type="date" 
              value={globalDateFrom} 
              onChange={e => setGlobalDateFrom(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-800"
            />
            <span className="text-slate-400 font-bold text-xs">to</span>
            <input 
              type="date" 
              value={globalDateTo} 
              onChange={e => setGlobalDateTo(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-800"
            />
          </div>
        )}
      </div>

      {/* Financial Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Payments */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Total Payments</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">₹{totalIncome.toLocaleString()}</div>
          <div className="text-xs text-emerald-600 font-semibold mt-1">Filtered Income</div>
        </div>

        {/* Card 2: Today's Collection */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Today's Payments</span>
            <Wallet className="w-4 h-4 text-blue-900" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-blue-950">₹{todayIncome.toLocaleString()}</div>
          <div className="text-xs text-blue-900 font-semibold mt-1">Collected Today</div>
        </div>

        {/* Card 3: Gym Expenses */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Gym Expenses</span>
            <ArrowDownRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">₹{totalExpenses.toLocaleString()}</div>
          <div className="text-xs text-rose-600 font-semibold mt-1">Filtered Expenses</div>
        </div>

        {/* Card 4: Net Profit */}
        <div
          className={`border rounded-xl p-4 shadow-sm ${
            netProfit >= 0 ? 'bg-emerald-50/60 border-emerald-300' : 'bg-rose-50/60 border-rose-300'
          }`}
        >
          <div className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center justify-between text-slate-700">
            <span>Net Profit</span>
            <TrendingUp className={`w-4 h-4 ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} />
          </div>
          <div className={`text-2xl sm:text-3xl font-extrabold ${netProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
            ₹{netProfit.toLocaleString()}
          </div>
          <div className="text-xs font-bold mt-1 text-slate-600">Total Income - Expenses</div>
        </div>

        {/* Card 5: New Members */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>New Members</span>
            <Plus className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{newMembersCount}</div>
          <div className="text-xs text-indigo-600 font-semibold mt-1">Joined in Period</div>
        </div>
      </div>

      {/* Payment Modes Collection Breakdown Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-0.5 flex items-center gap-1"><Banknote className="w-3.5 h-3.5" /> Cash in Hand</span>
            <div className="text-xl font-black text-emerald-950">₹{cashTotal.toLocaleString()}</div>
          </div>
          <Banknote className="w-7 h-7 text-emerald-300" />
        </div>

        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider block mb-0.5 flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> UPI / GPay / Bank</span>
            <div className="text-xl font-black text-blue-950">₹{upiTotal.toLocaleString()}</div>
          </div>
          <Smartphone className="w-7 h-7 text-blue-300" />
        </div>

        <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider block mb-0.5 flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Card Payments</span>
            <div className="text-xl font-black text-purple-950">₹{cardTotal.toLocaleString()}</div>
          </div>
          <CreditCard className="w-7 h-7 text-purple-300" />
        </div>
      </div>

      {/* Visual Revenue vs Expense Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold text-slate-900 text-base mb-1">Income vs Expense Monthly Trend</h2>
        <p className="text-xs text-slate-500 mb-6">Financial performance comparison for recent months.</p>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}
                formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, '']}
              />
              <Bar dataKey="Income" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expense" fill="#B91C1C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Transactions List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50/50">
          <div>
            <h2 className="font-bold text-slate-900 text-base">Transaction Logs</h2>
            <p className="text-xs text-slate-500">History of customer membership payments and gym expenses.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['ALL', 'INCOME', 'EXPENSE', 'NEW_MEMBERS'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  filterType === t ? 'bg-blue-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t === 'NEW_MEMBERS' ? 'New Members' : t}
              </button>
            ))}

            <span className="text-slate-300">|</span>

            {(['ALL', 'CASH', 'UPI', 'CARD'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPaymentModeFilter(m)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center space-x-1 ${
                  paymentModeFilter === m ? 'bg-emerald-700 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="flex items-center gap-1">{m === 'CASH' ? <><Banknote className="w-3 h-3" /> Cash</> : m === 'UPI' ? <><Smartphone className="w-3 h-3" /> UPI</> : m === 'CARD' ? <><CreditCard className="w-3 h-3" /> Card</> : 'All Modes'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Description / Customer</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
              {filteredTxs.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tx.type === 'INCOME'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {tx.type}
                    </span>
                  </td>

                  <td className="py-3 px-4 font-bold text-slate-900">
                    <div>{tx.description}</div>
                    {tx.customerName && <div className="text-[11px] text-slate-500 font-normal">Customer: {tx.customerName}</div>}
                  </td>

                  <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap flex items-center gap-1">
                        {tx.paymentMethod === 'UPI' ? <><Smartphone className="w-2.5 h-2.5" /> UPI</> : tx.paymentMethod === 'CARD' ? <><CreditCard className="w-2.5 h-2.5" /> Card</> : tx.paymentMethod === 'SPLIT' ? <><ArrowLeftRight className="w-2.5 h-2.5" /> Split</> : <><Banknote className="w-2.5 h-2.5" /> Cash</>}
                      </span>
                  </td>

                  <td className="py-3 px-4 text-slate-600 font-medium">{tx.category}</td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-xs font-bold">{formatDateDDMMYYYY(tx.date)}</td>
                  <td
                    className={`py-3 px-4 text-right font-extrabold ${
                      tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {tx.type === 'INCOME' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        onClick={() => handleEditTxInit(tx)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Bill / Transaction"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTxDialog({ id: tx.id, desc: tx.description, amount: tx.amount })}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Bill"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTxs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-medium text-xs">
                    No transactions found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD EXPENSE */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-900 text-lg flex items-center space-x-2">
                <Plus className="w-5 h-5 text-rose-600" />
                <span>Record Gym Expense</span>
              </h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Expense Category
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 outline-none"
                >
                  <option value="Rent">Premises Rent</option>
                  <option value="Electricity Bill">Electricity & AC Power Bill</option>
                  <option value="Equipment Maintenance">Equipment Maintenance & Repairs</option>
                  <option value="Trainer Salary">Trainer & Staff Salary</option>
                  <option value="Water & Supplies">Water & Sanitization Supplies</option>
                  <option value="Marketing">Marketing & Advertising</option>
                  <option value="Other">Other Operational Cost</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 5000"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-extrabold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Note *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AC Repair and Gas Refill"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Payment Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CASH', 'UPI', 'CARD'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setExpensePaymentMethod(mode)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                        expensePaymentMethod === mode
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-700 border border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {mode === 'CASH' ? <Banknote className="w-3.5 h-3.5" /> : mode === 'UPI' ? <Smartphone className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                      <span>{mode === 'UPI' ? 'UPI' : mode}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                >
                  Save Expense Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SETTINGS */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-900 text-lg flex items-center space-x-2">
                <Settings className="w-5 h-5 text-blue-900" />
                <span>Subscription Packages</span>
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
               {plans.length === 0 ? (
                 <div className="text-center py-4 text-xs font-semibold text-slate-400">No packages created yet.</div>
               ) : (
                 <div className="space-y-2">
                   {plans.map(p => (
                     <div key={p.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                       <div>
                         <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                         <div className="text-xs text-slate-500 font-semibold">{p.durationMonths} {p.durationMonths === 1 ? 'Month' : 'Months'} • ₹{p.price}</div>
                       </div>
                       <div className="flex items-center space-x-1">
                         <button onClick={() => handleEditPlanClick(p)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors">
                           <Edit2 className="w-4 h-4" />
                         </button>
                         <button onClick={() => handleDeletePlan(p.id)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors">
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
               
               <div className="pt-4 border-t border-slate-200">
                 <div className="flex items-center justify-between mb-3">
                   <h4 className="font-bold text-slate-800 text-sm">{editingPlanId ? 'Edit Package' : 'Create New Package'}</h4>
                   {editingPlanId && (
                     <button onClick={handleCancelEdit} className="text-xs text-slate-500 hover:text-slate-800 font-bold">
                       Cancel
                     </button>
                   )}
                 </div>
                 <div className="grid grid-cols-2 gap-3 mb-3">
                   <input type="text" placeholder="Package Name (e.g. Annual)" value={newPlanName} onChange={e => setNewPlanName(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-800" />
                   <input type="number" min={1} max={60} placeholder="Duration in Months (e.g. 12)" value={newPlanMonths} onChange={e => setNewPlanMonths(e.target.value === '' ? '' : Math.min(60, Math.max(1, Number(e.target.value))))} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-800" />
                   <div className="col-span-2 relative">
                     <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                      <input type="number" placeholder="Price (₹)" value={newPlanPrice} onChange={e => setNewPlanPrice(e.target.value === '' ? '' : Number(e.target.value))} className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-800" />
                   </div>
                 </div>
                 <button onClick={handleAddPlan} className="w-full py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-lg text-sm font-bold transition-colors">
                   {editingPlanId ? 'Update Package' : 'Add Package'}
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT TRANSACTION / BILL */}
      {showEditTxModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-black text-slate-900 text-base flex items-center space-x-2">
                <Edit2 className="w-5 h-5 text-blue-900" />
                <span>Edit Bill / Transaction</span>
              </h3>
              <button onClick={() => setShowEditTxModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditTxSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Category *
                </label>
                <input
                  type="text"
                  required
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Details *
                </label>
                <input
                  type="text"
                  required
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Transaction Date
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Payment Mode
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['CASH', 'UPI', 'CARD', 'SPLIT'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setEditPaymentMethod(mode)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center space-y-1 ${
                        editPaymentMethod === mode
                          ? 'bg-blue-900 text-white shadow-sm ring-2 ring-blue-900 ring-offset-1'
                          : 'bg-slate-50 text-slate-700 border border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {mode === 'CASH' ? <Banknote className="w-4 h-4" /> : mode === 'UPI' ? <Smartphone className="w-4 h-4" /> : mode === 'CARD' ? <CreditCard className="w-4 h-4" /> : <ArrowLeftRight className="w-4 h-4" />}
                      <span className="text-[11px]">{mode === 'UPI' ? 'UPI' : mode}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditTxModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE TRANSACTION CONFIRMATION */}
      {deleteTxDialog && (
        <div className="fixed inset-0 z-[110] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-slate-900 mb-1">Delete Transaction?</h2>
            <p className="text-slate-600 text-xs font-medium mb-4 leading-relaxed">
              Are you sure you want to permanently delete this bill entry (<span className="font-bold text-slate-900">{deleteTxDialog.desc} - ₹{deleteTxDialog.amount}</span>)? This will adjust your total revenue calculations.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTxDialog(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTxConfirm}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXPORT CSV */}
      {showExportModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-black text-slate-900">Custom Export CSV</h2>
              <button onClick={() => setShowExportModal(false)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">From Date</label>
                <input 
                  type="date" 
                  value={exportDateFrom} 
                  onChange={e => setExportDateFrom(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">To Date</label>
                <input 
                  type="date" 
                  value={exportDateTo} 
                  onChange={e => setExportDateTo(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeExport}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
              <button
                onClick={executeExportPDF}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE PLAN CONFIRMATION */}
      {deletePlanDialog && (
        <div className="fixed inset-0 z-[110] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-slate-900 mb-1">Delete Subscription Package?</h2>
            <p className="text-slate-600 text-xs font-medium mb-4 leading-relaxed">
              Are you sure you want to permanently delete this package? Existing members on this plan will not be affected, but new members cannot select it.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletePlanDialog(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDeletePlan}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
