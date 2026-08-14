'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, TrendingUp, TrendingDown, DollarSign, Plus, ArrowUpRight, ArrowDownRight, Wallet, PieChart as PieChartIcon, Calendar, X, Filter, Settings, Trash2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { AppStore } from '@/lib/store';
import { Transaction, SubscriptionPlan } from '@/lib/types';

export default function RevenuePage() {
  const [gymId, setGymId] = useState<string>('gym_1');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE' | 'NEW_MEMBERS'>('ALL');

  // Global Filter State
  const [globalTimeFilter, setGlobalTimeFilter] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'THIS_YEAR' | 'CUSTOM'>('ALL');
  const [globalDateFrom, setGlobalDateFrom] = useState('');
  const [globalDateTo, setGlobalDateTo] = useState('');

  // Add Expense Modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('Rent');
  const [expenseAmount, setExpenseAmount] = useState(5000);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  // Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanMonths, setNewPlanMonths] = useState(1);
  const [newPlanPrice, setNewPlanPrice] = useState(2500);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || 'gym_1' : 'gym_1';
    setGymId(savedId);

    const txs = AppStore.getTransactions(savedId);
    setTransactions(txs);

    const ps = AppStore.getSubscriptionPlans(savedId);
    setPlans(ps);
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || !expenseDesc) return;

    AppStore.addTransaction({
      gymId,
      type: 'EXPENSE',
      amount: Number(expenseAmount),
      category: expenseCategory,
      description: expenseDesc,
      date: expenseDate
    });

    setShowExpenseModal(false);
    setExpenseDesc('');
    loadData();
  };

  const handleAddPlan = () => {
    if (!newPlanName || newPlanPrice <= 0 || newPlanMonths <= 0) return;
    AppStore.addSubscriptionPlan({
      gymId,
      name: newPlanName,
      durationMonths: newPlanMonths,
      price: newPlanPrice
    });
    setNewPlanName('');
    setNewPlanMonths(1);
    setNewPlanPrice(2500);
    loadData();
  };

  const handleDeletePlan = (id: string) => {
    if (window.confirm('Delete this subscription package?')) {
      AppStore.deleteSubscriptionPlan(id);
      loadData();
    }
  };

  const allCustomers = AppStore.getCustomers(gymId);

  // Global Time Filter Logic
  const isDateInGlobalFilter = (dateStr: string) => {
    if (globalTimeFilter === 'ALL') return true;
    const d = new Date(dateStr);
    const today = new Date();
    
    if (globalTimeFilter === 'TODAY') {
      return d.toDateString() === today.toDateString();
    }
    if (globalTimeFilter === 'THIS_MONTH') {
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }
    if (globalTimeFilter === 'THIS_YEAR') {
      return d.getFullYear() === today.getFullYear();
    }
    if (globalTimeFilter === 'CUSTOM') {
      if (!globalDateFrom || !globalDateTo) return true;
      const from = new Date(globalDateFrom);
      const to = new Date(globalDateTo);
      to.setHours(23, 59, 59, 999);
      return d >= from && d <= to;
    }
    return true;
  };

  const filteredGlobalTxs = transactions.filter(t => isDateInGlobalFilter(t.date));

  const totalIncome = filteredGlobalTxs
    .filter((t) => t.type === 'INCOME')
    .reduce((acc, cur) => acc + cur.amount, 0);

  // Still show today's payments fixed as it's specifically labelled "Today's Payments"
  const todayStr = new Date().toISOString().split('T')[0];
  const todayIncome = transactions
    .filter((t) => t.type === 'INCOME' && t.date === todayStr)
    .reduce((acc, cur) => acc + cur.amount, 0);

  const totalExpenses = filteredGlobalTxs
    .filter((t) => t.type === 'EXPENSE')
    .reduce((acc, cur) => acc + cur.amount, 0);

  const netProfit = totalIncome - totalExpenses;
  const newMembersCount = allCustomers.filter(c => c.gymId === gymId && isDateInGlobalFilter(c.joinedDate)).length;

  // Monthly Chart Mock Data aggregation
  const chartData = [
    { name: 'May', Income: 14000, Expense: 8000, Net: 6000 },
    { name: 'Jun', Income: 18500, Expense: 12000, Net: 6500 },
    { name: 'Jul', Income: 11500, Expense: 27200, Net: -15700 },
    { name: 'Aug (Cur)', Income: totalIncome, Expense: totalExpenses, Net: netProfit },
  ];

  const filteredTxs = transactions.filter((t) => {
    if (!isDateInGlobalFilter(t.date)) return false;

    if (filterType === 'ALL') return true;
    if (filterType === 'NEW_MEMBERS') {
      if (t.type !== 'INCOME') return false;
      const cust = allCustomers.find(c => c.id === t.customerId);
      if (!cust) return false;
      return isDateInGlobalFilter(cust.joinedDate);
    }
    return t.type === filterType;
  });

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
              <Bar dataKey="Income" fill="#2563EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expense" fill="#EF4444" radius={[4, 4, 0, 0]} />
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

          <div className="flex items-center space-x-2">
            {(['ALL', 'INCOME', 'EXPENSE', 'NEW_MEMBERS'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  filterType === t ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t === 'NEW_MEMBERS' ? 'New Members Income' : t}
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
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
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

                  <td className="py-3 px-4 text-slate-600 font-medium">{tx.category}</td>
                  <td className="py-3 px-4 text-slate-500 font-mono text-xs">{tx.date}</td>
                  <td
                    className={`py-3 px-4 text-right font-extrabold ${
                      tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {tx.type === 'INCOME' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD EXPENSE */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
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
                  onChange={(e) => setExpenseAmount(Number(e.target.value))}
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
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
                       <button onClick={() => handleDeletePlan(p.id)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors">
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                   ))}
                 </div>
               )}
               
               <div className="pt-4 border-t border-slate-200">
                 <h4 className="font-bold text-slate-800 text-sm mb-3">Create New Package</h4>
                 <div className="grid grid-cols-2 gap-3 mb-3">
                   <input type="text" placeholder="Package Name" value={newPlanName} onChange={e => setNewPlanName(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-800" />
                   <input type="number" placeholder="Months" value={newPlanMonths} onChange={e => setNewPlanMonths(Number(e.target.value))} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-800" />
                   <div className="col-span-2 relative">
                     <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                     <input type="number" placeholder="Price" value={newPlanPrice} onChange={e => setNewPlanPrice(Number(e.target.value))} className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-800" />
                   </div>
                 </div>
                 <button onClick={handleAddPlan} className="w-full py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-lg text-sm font-bold transition-colors">
                   Add Package
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
