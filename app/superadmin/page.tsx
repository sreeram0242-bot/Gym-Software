'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Plus, Search, Building2, UserPlus, Key, Phone, Mail, CheckCircle, AlertCircle, ArrowLeft, Users, Eye, EyeOff, Dumbbell, Lock, Sparkles, Filter, LogOut, Trash2 } from 'lucide-react';
import { getGyms, getCustomers, addGym, toggleGymStatus, findCustomerByPhone, getMemberMonthlyAvgHours, getGlobalStats, getAnnouncements, createAnnouncement, deleteAnnouncement, updateGymStatus } from '@/lib/actions';
import { Gym, Customer } from '@/lib/types';

export default function SuperAdminPage() {
  const router = useRouter();
  const [gyms, setGyms] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'gyms' | 'add_gym' | 'global_search' | 'announcements'>('gyms');

  const [globalStats, setGlobalStats] = useState({ totalGyms: 0, totalMembers: 0, saasMRR: 0, globalGymRevenue: 0 });
  const [announcements, setAnnouncements] = useState<any[]>([]);
  
  // Announcement Form State
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annType, setAnnType] = useState('info');


  // Form State for Adding New Gym
  const [gymName, setGymName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Global Customer Search State
  const [searchPhoneQuery, setSearchPhoneQuery] = useState('');
  const [searchedCustomer, setSearchedCustomer] = useState<any | null>(null);

  // Load Data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMasterAdmin = localStorage.getItem('is_master_admin');
      if (isMasterAdmin !== 'true') {
        router.push('/superadmin/login');
        return;
      }
    }
    loadData();
  }, []);

  const loadData = async () => {
    const [loadedGyms, loadedCusts, stats, anns] = await Promise.all([
      getGyms(),
      getCustomers('all'),
      getGlobalStats(),
      getAnnouncements()
    ]);

    // Attach count of members
    const gymsWithCounts = loadedGyms.map((g: any) => ({
      ...g,
      memberCount: loadedCusts.filter((c: any) => c.gymId === g.id).length
    }));

    setGyms(gymsWithCounts);
    setCustomers(loadedCusts);
    setGlobalStats(stats);
    setAnnouncements(anns);
  };

  const handleCreateGym = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gymName || !ownerName || !userId || !password) return;

    await addGym({
      name: gymName,
      ownerName,
      email: email || `${userId}@gymsaas.com`,
      phone: phone || '+91 90000 00000',
      userId: userId.trim(),
      passwordHash: password
    });

    setSuccessMsg(`Gym "${gymName}" successfully created! Owner user ID: ${userId}`);
    setGymName('');
    setOwnerName('');
    setEmail('');
    setPhone('');
    setUserId('');
    setPassword('');
    loadData();
    setTimeout(() => {
      setSuccessMsg('');
      setActiveTab('gyms');
    }, 2000);
  };

  const handleToggleGymStatus = async (gymId: string) => {
    await toggleGymStatus(gymId);
    loadData();
  };

  const handleGlobalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhoneQuery.trim()) return;

    const found = await findCustomerByPhone(searchPhoneQuery);
    setSearchedCustomer(found || null);
  };

  // Generate Quick Credentials suggestion
  const generateSuggestedCredentials = (name: string) => {
    if (!name) return;
    const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    setUserId(`gym_${clean}`);
    setPassword(`pass_${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const getAvg = (custId: string) => {
    return 1.2; 
  };

  const handleLoginAs = (gymId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_gym_id', gymId);
    }
    router.push('/dashboard');
  };

  const handleToggleSuspend = async (gymId: string, currentStatus: string) => {
    const newStatus = (currentStatus === 'suspended' || currentStatus === 'locked') ? 'active' : 'suspended';
    await updateGymStatus(gymId, newStatus);
    loadData();
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle || !annMessage) return;
    await createAnnouncement({ title: annTitle, message: annMessage, type: annType });
    setAnnTitle('');
    setAnnMessage('');
    loadData();
  };

  const handleDeleteAnnouncement = async (id: string) => {
    await deleteAnnouncement(id);
    loadData();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => {
                if (typeof window !== 'undefined') localStorage.removeItem('is_master_admin');
                router.push('/superadmin/login');
              }}
              className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
              title="Secure Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-lg bg-blue-950 text-white flex items-center justify-center font-bold shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 text-base sm:text-lg leading-tight">Master Admin Portal</h1>
              <p className="text-xs text-slate-500 font-medium">SaaS Platform Owner Control Panel</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('add_gym')}
              className="bg-blue-900 hover:bg-blue-950 text-white text-xs sm:text-sm font-semibold px-3 py-2 rounded-lg transition-colors shadow-sm flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add New Gym</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Metric Cards Banner (God View) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Total Onboarded Gyms</span>
              <Building2 className="w-4 h-4 text-blue-900" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{globalStats.totalGyms}</div>
            <div className="text-xs text-blue-900 font-medium mt-1">Multi-Tenant Platform</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Estimated SaaS MRR</span>
              <Sparkles className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              ₹{globalStats.saasMRR.toLocaleString()}
            </div>
            <div className="text-xs text-emerald-600 font-medium mt-1">At ₹1,499 / gym</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Total Global Members</span>
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{globalStats.totalMembers}</div>
            <div className="text-xs text-indigo-600 font-medium mt-1">Across All Gyms</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Global Gym Revenue</span>
              <Building2 className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">₹{globalStats.globalGymRevenue.toLocaleString()}</div>
            <div className="text-xs text-amber-600 font-medium mt-1">Combined Economy</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mb-6 bg-white rounded-t-xl px-4 pt-2">
          <button
            onClick={() => setActiveTab('gyms')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'gyms'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Manage Gyms ({gyms.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('add_gym')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'add_gym'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Onboard New Gym</span>
          </button>

          <button
            onClick={() => setActiveTab('global_search')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'global_search'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Global Phone Search</span>
          </button>
        </div>

        {/* TAB 1: MANAGE GYMS LIST */}
        {activeTab === 'gyms' && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50/50">
              <div>
                <h2 className="font-bold text-slate-900 text-base">Registered Gym Partners</h2>
                <p className="text-xs text-slate-500">Manage owner credentials, user IDs, and subscription access.</p>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-950 rounded-md border border-blue-200">
                {gyms.length} Total Gyms
              </span>
            </div>

            {/* Desktop Table View */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Gym & Owner Name</th>
                    <th className="py-3 px-4">Login Credentials</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 text-center">Members</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                  {gyms.map((gym) => (
                    <tr key={gym.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div className="flex items-center space-x-3">
                          <img src="/logo.png" alt="Gym Logo" className="w-9 h-9 object-contain rounded-lg shadow-sm border border-slate-200 bg-white" />
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{gym.name}</div>
                            <div className="text-xs text-slate-500">Owner: {gym.ownerName}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-xs max-w-xs">
                          <div><span className="text-slate-400">User ID:</span> <span className="font-bold text-slate-800">{gym.userId}</span></div>
                          <div><span className="text-slate-400">Pass:</span> <span className="font-bold text-blue-950">{gym.passwordHash}</span></div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        <div className="flex items-center space-x-1 text-slate-700">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{gym.phone}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-slate-500 text-xs mt-0.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{gym.email}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                          {gym.memberCount || 0} Members
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {gym.status === 'active' ? (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md flex items-center w-fit mx-auto">
                            <CheckCircle className="w-3 h-3 mr-1" /> Active
                          </span>
                        ) : gym.status === 'locked' ? (
                          <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-md flex items-center w-fit mx-auto font-bold animate-pulse">
                            <Lock className="w-3 h-3 mr-1" /> Locked
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-md flex items-center w-fit mx-auto">
                            <AlertCircle className="w-3 h-3 mr-1" /> Suspended
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button 
                            onClick={() => handleLoginAs(gym.id)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Login as Gym"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleToggleSuspend(gym.id, gym.status)}
                            className={`p-1.5 rounded transition-colors ${gym.status === 'active' ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                            title={gym.status === 'active' ? 'Suspend Gym' : 'Reactivate Gym'}
                          >
                            {gym.status === 'active' ? <Lock className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: ADD NEW GYM FORM */}
        {activeTab === 'add_gym' && (
          <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-200">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-950 flex items-center justify-center font-bold">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-lg">Onboard New Gym Partner</h2>
                <p className="text-xs text-slate-500">Create access credentials for gym owner login.</p>
              </div>
            </div>

            {successMsg && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-semibold flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateGym} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Gym Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Titan Power Gym"
                    value={gymName}
                    onChange={(e) => {
                      setGymName(e.target.value);
                      generateSuggestedCredentials(e.target.value);
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-800 focus:bg-white outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Gym Owner Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Sharma"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-800 focus:bg-white outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Owner Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="owner@gymdomain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-800 focus:bg-white outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Owner Mobile Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-800 focus:bg-white outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3 mt-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-blue-900">
                  <Key className="w-4 h-4 text-blue-950" />
                  <span>Assign Access Login Credentials</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">User ID *</label>
                    <input
                      type="text"
                      required
                      placeholder="gym_titan"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-blue-800 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Secret Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-blue-800 outline-none pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('gyms')}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Onboard Gym & Save Credentials</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: GLOBAL CUSTOMER PHONE SEARCH */}
        {activeTab === 'global_search' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h2 className="font-bold text-slate-900 text-lg mb-1 flex items-center space-x-2">
                <Search className="w-5 h-5 text-blue-900" />
                <span>Global Phone Search Across All Gyms</span>
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Master search engine to view customer profile, assigned gym, NFC ID, and current payment status by phone number.
              </p>

              <form onSubmit={handleGlobalSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    required
                    placeholder="Enter phone number (e.g. 9876500001)..."
                    value={searchPhoneQuery}
                    onChange={(e) => setSearchPhoneQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-800 focus:bg-white outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs rounded-lg transition-colors shadow-sm flex items-center space-x-1.5"
                >
                  <Search className="w-4 h-4" />
                  <span>Search</span>
                </button>
              </form>
            </div>

            {/* Results Display */}
            {searchedCustomer ? (
              <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-950 font-bold text-lg flex items-center justify-center border border-blue-200">
                      {searchedCustomer.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-lg">{searchedCustomer.name}</h3>
                      <p className="text-xs text-slate-500 font-mono">NFC ID: {searchedCustomer.nfcCardId}</p>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      searchedCustomer.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : searchedCustomer.status === 'due_soon'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {searchedCustomer.status === 'active'
                      ? '● Active Member'
                      : searchedCustomer.status === 'due_soon'
                      ? '⚠️ Payment Due Soon'
                      : '🚨 Overdue'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 font-semibold block mb-0.5">Assigned Gym</span>
                    <span className="font-bold text-slate-800">
                      {gyms.find((g: any) => g.id === searchedCustomer.gymId)?.name || searchedCustomer.gymId}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 font-semibold block mb-0.5">Phone Number</span>
                    <span className="font-bold text-slate-800">{searchedCustomer.phone}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 font-semibold block mb-0.5">Plan Type</span>
                    <span className="font-bold text-slate-800">{searchedCustomer.planType} (₹{searchedCustomer.feeAmount})</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 font-semibold block mb-0.5">Last Payment</span>
                    <span className="font-bold text-slate-800">{searchedCustomer.lastPaymentDate}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 font-semibold block mb-0.5">Next Due Date</span>
                    <span className="font-bold text-blue-950">{searchedCustomer.nextDueDate}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 font-semibold block mb-0.5">Monthly Avg Hours</span>
                    <span className="font-bold text-slate-800">
                      {getAvg(searchedCustomer.id)} hrs/day
                    </span>
                  </div>
                </div>
              </div>
            ) : searchPhoneQuery ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="font-semibold">No member found matching "{searchPhoneQuery}"</p>
                <p className="text-xs text-slate-400 mt-1">Try entering digits without country codes.</p>
              </div>
            ) : null}
          </div>
        )}

        {/* TAB 4: GLOBAL ANNOUNCEMENTS */}
        {activeTab === 'announcements' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-200">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-900 flex items-center justify-center font-bold">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-lg">Global System Broadcast</h2>
                  <p className="text-xs text-slate-500">Send an alert banner to all gym owners' dashboards instantly.</p>
                </div>
              </div>

              <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Announcement Title
                  </label>
                  <input
                    type="text"
                    required
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    placeholder="e.g. Scheduled Maintenance"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Message
                  </label>
                  <textarea
                    required
                    value={annMessage}
                    onChange={(e) => setAnnMessage(e.target.value)}
                    placeholder="Provide details about the announcement..."
                    rows={3}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-800 outline-none"
                  ></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Alert Type
                  </label>
                  <select
                    value={annType}
                    onChange={(e) => setAnnType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-800 outline-none"
                  >
                    <option value="info">Info (Blue)</option>
                    <option value="warning">Warning (Yellow)</option>
                    <option value="critical">Critical (Red)</option>
                  </select>
                </div>
                <div className="pt-2">
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md">
                    Broadcast Announcement
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                <h3 className="font-bold text-slate-900">Recent Announcements</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {announcements.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">No announcements found.</div>
                ) : (
                  announcements.map((ann) => (
                    <div key={ann.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${ann.active ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                          <span className="font-bold text-slate-900 text-sm">{ann.title}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            ann.type === 'info' ? 'bg-blue-100 text-blue-700' : 
                            ann.type === 'warning' ? 'bg-amber-100 text-amber-700' : 
                            'bg-rose-100 text-rose-700'
                          }`}>{ann.type}</span>
                        </div>
                        <p className="text-xs text-slate-500 mb-1">{ann.message}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{new Date(ann.createdAt).toLocaleString()}</p>
                      </div>
                      <button onClick={() => handleDeleteAnnouncement(ann.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
