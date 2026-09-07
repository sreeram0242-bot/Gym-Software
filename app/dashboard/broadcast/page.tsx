'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Megaphone, 
  Image as ImageIcon, 
  Send, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  Search, 
  CheckSquare, 
  Square,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { useBroadcastData } from '@/lib/hooks';

export default function BroadcastPage() {
  const [gymId, setGymId] = useState<string>(
    typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || '' : ''
  );

  // Sync gymId from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('active_gym_id');
      if (saved && saved !== gymId) {
        setGymId(saved);
      }
    }
  }, []);

  const { data, isLoading } = useBroadcastData(gymId);
  const gyms = data?.gyms || [];
  const customers = data?.custs || [];

  // Fallback to first gym if gymId is empty or not in gyms
  useEffect(() => {
    if (gyms.length > 0) {
      const exists = gyms.some((g: any) => g.id === gymId);
      if (!exists) {
        setGymId(gyms[0].id);
      }
    }
  }, [gyms, gymId]);

  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<'all' | 'active' | 'due_soon' | 'custom'>('all');
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);

  const [isSending, setIsSending] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only members who have activated WhatsApp by sending 'start' (waActive === true)
  const activatedMembers = useMemo(() => {
    return customers.filter((c: any) => c.waActive === true && !c.isArchived);
  }, [customers]);

  // Filtered members for selective picker search
  const filteredSelectiveMembers = useMemo(() => {
    if (!memberSearch.trim()) return activatedMembers;
    const q = memberSearch.toLowerCase();
    return activatedMembers.filter((c: any) =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.planType?.toLowerCase().includes(q)
    );
  }, [activatedMembers, memberSearch]);

  const getRecipientCount = () => {
    if (audience === 'custom') return selectedPhones.length;
    if (audience === 'all') return activatedMembers.length;
    if (audience === 'active') return activatedMembers.filter((c: any) => c.status === 'active').length;
    if (audience === 'due_soon') return activatedMembers.filter((c: any) => c.status === 'due_soon' || c.status === 'overdue').length;
    return 0;
  };

  const handleToggleSelectPhone = (phone: string) => {
    setSelectedPhones(prev => 
      prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]
    );
  };

  const handleSelectAllFiltered = () => {
    const phonesToAdd = filteredSelectiveMembers.map((m: any) => m.phone).filter(Boolean);
    setSelectedPhones(Array.from(new Set([...selectedPhones, ...phonesToAdd])));
  };

  const handleDeselectAllFiltered = () => {
    const phonesToRemove = new Set(filteredSelectiveMembers.map((m: any) => m.phone));
    setSelectedPhones(prev => prev.filter(p => !phonesToRemove.has(p)));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setMediaBase64(event.target?.result as string);
      setErrorMsg('');
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setMediaBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBroadcast = async () => {
    if (!message.trim()) {
      setErrorMsg('Message cannot be empty');
      return;
    }

    if (audience === 'custom' && selectedPhones.length === 0) {
      setErrorMsg('Please select at least one member to send this broadcast to');
      return;
    }

    const count = getRecipientCount();
    if (count === 0) {
      setErrorMsg('No activated WhatsApp recipients found for this selection');
      return;
    }

    if (!confirm(`Are you sure you want to broadcast this message to ${count} members?`)) return;

    setIsSending(true);
    setErrorMsg('');
    setSuccessCount(null);

    try {
      const res = await fetch('/api/whatsapp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gymId,
          message,
          mediaBase64,
          audience,
          selectedPhones: audience === 'custom' ? selectedPhones : undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('global-toast', { 
            detail: { message: `Queued ${data.queuedCount} broadcast messages.`, type: 'success' } 
          }));
        }
        setSuccessCount(data.queuedCount);
        setMessage('');
        removeImage();
      } else {
        const errorText = data.error || 'Failed to send broadcast';
        setErrorMsg(errorText);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: errorText, type: 'error' } }));
        }
      }
    } catch (e) {
      const errorText = 'Network error while sending broadcast';
      setErrorMsg(errorText);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: errorText, type: 'error' } }));
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {isLoading && !data ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-24 bg-slate-200 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-64 bg-slate-200 rounded-2xl" />
            <div className="h-64 bg-slate-200 rounded-2xl" />
          </div>
        </div>
      ) : (
        <div className="space-y-6 max-w-4xl">
          {/* Header */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
                <Megaphone className="w-7 h-7 mr-3 text-blue-900" />
                WhatsApp Broadcast
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Send announcements, offers, or holiday greetings to members who activated WhatsApp.
              </p>
            </div>
            <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{activatedMembers.length} Activated Members</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Composer */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <h2 className="font-bold text-slate-800 text-sm">Compose Broadcast</h2>
                  <span className="text-xs font-semibold text-slate-500">
                    Targeting: <strong className="text-blue-900 capitalize">{audience.replace('_', ' ')}</strong>
                  </span>
                </div>

                <div className="p-6 space-y-5">
                  {/* Audience Selector Tabs */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Target Audience
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 gap-1">
                      {[
                        { id: 'all', label: 'All Activated' },
                        { id: 'active', label: 'Active Plan' },
                        { id: 'due_soon', label: 'Due Soon' },
                        { id: 'custom', label: `Selective (${selectedPhones.length})` }
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setAudience(opt.id as any)}
                          className={`text-xs font-bold py-2 px-2 rounded-lg transition-all text-center truncate ${
                            audience === opt.id
                              ? 'bg-white text-blue-900 shadow-sm border border-slate-200/60'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between flex-wrap gap-2">
                      <p className="text-xs text-blue-700 font-bold flex items-center bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                        <Users className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                        Targeting {getRecipientCount()} activated members
                      </p>
                      <span className="text-[11px] text-slate-400">
                        Only members who texted &quot;start&quot; can receive broadcasts
                      </span>
                    </div>
                  </div>

                  {/* Selective Members Picker (when audience === 'custom') */}
                  {audience === 'custom' && (
                    <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center space-x-2">
                          <UserCheck className="w-4 h-4 text-blue-700" />
                          <h3 className="text-xs font-black uppercase text-blue-950 tracking-wider">
                            Select Activated Members ({selectedPhones.length} selected)
                          </h3>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={handleSelectAllFiltered}
                            className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-2.5 py-1 rounded-lg shadow-2xs hover:bg-blue-50 transition-colors"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={handleDeselectAllFiltered}
                            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs hover:bg-slate-50 transition-colors"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {/* Search bar inside picker */}
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={memberSearch}
                          onChange={e => setMemberSearch(e.target.value)}
                          placeholder="Search activated member by name, phone, or plan..."
                          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-800 outline-none"
                        />
                      </div>

                      {/* Members List */}
                      {activatedMembers.length === 0 ? (
                        <div className="p-4 bg-white border border-amber-200 rounded-xl text-center space-y-1">
                          <p className="text-xs font-bold text-amber-900">No Activated Members Found</p>
                          <p className="text-[11px] text-amber-700">
                            Members must text <strong>start</strong> to your gym&apos;s WhatsApp number to activate their account and appear here.
                          </p>
                        </div>
                      ) : filteredSelectiveMembers.length === 0 ? (
                        <div className="p-4 bg-white border border-slate-200 rounded-xl text-center">
                          <p className="text-xs font-medium text-slate-500">No members match your search &quot;{memberSearch}&quot;.</p>
                        </div>
                      ) : (
                        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl p-2 shadow-2xs">
                          {filteredSelectiveMembers.map((cust: any) => {
                            const isSelected = selectedPhones.includes(cust.phone);
                            return (
                              <div
                                key={cust.id}
                                onClick={() => handleToggleSelectPhone(cust.phone)}
                                className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors text-xs ${
                                  isSelected ? 'bg-blue-50/80 border border-blue-200' : 'hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center space-x-3 min-w-0">
                                  <div className="text-blue-900">
                                    {isSelected ? (
                                      <CheckSquare className="w-4 h-4 text-blue-800" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-300" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                                      <span>{cust.name}</span>
                                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                                        ● WA Active
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                      <span>{cust.phone}</span>
                                      <span>•</span>
                                      <span className="truncate">{cust.planType || 'General'}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                                    cust.status === 'active' 
                                      ? 'bg-emerald-50 text-emerald-700' 
                                      : 'bg-amber-50 text-amber-700'
                                  }`}>
                                    {cust.status || 'active'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Box */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Message Text
                    </label>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      rows={6}
                      placeholder="Type your announcement, festive greeting, or offer here..."
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-800 outline-none resize-y"
                    />
                  </div>

                  {/* Image Upload */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Attach Photo (Optional)
                    </label>

                    {!mediaBase64 ? (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-colors"
                      >
                        <ImageIcon className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                        <p className="text-sm font-bold text-slate-600">Click to upload an image</p>
                        <p className="text-xs text-slate-400 mt-1">PNG or JPG (Max 5MB)</p>
                      </div>
                    ) : (
                      <div className="relative inline-block border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mediaBase64} alt="Attachment" className="max-h-48 object-contain" />
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg shadow-sm hover:bg-red-700 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/png, image/jpeg"
                      className="hidden"
                    />
                  </div>

                  {/* Alerts */}
                  {errorMsg && (
                    <div className="p-3 bg-red-50 text-red-700 text-sm font-bold rounded-xl border border-red-100 flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-2 shrink-0" /> {errorMsg}
                    </div>
                  )}

                  {successCount !== null && (
                    <div className="p-4 bg-emerald-50 text-emerald-800 text-sm font-bold rounded-xl border border-emerald-100 flex flex-col items-center text-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                      <p>Broadcast Queued Successfully!</p>
                      <p className="text-xs font-medium text-emerald-600 mt-1">
                        {successCount} messages added to the anti-ban queue. They will be sent smoothly with human jitter delays.
                      </p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="button"
                    onClick={handleBroadcast}
                    disabled={isSending || getRecipientCount() === 0 || !message.trim()}
                    className="w-full py-4 bg-blue-900 hover:bg-blue-950 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center space-x-2"
                  >
                    {isSending ? (
                      <span className="flex items-center">
                        <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Queuing...
                      </span>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        <span>Send Broadcast to {getRecipientCount()} Activated Members</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Safety Warning Panel */}
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-amber-900 flex items-center mb-3 text-sm">
                  <AlertTriangle className="w-5 h-5 mr-2" /> Anti-Ban Safety System
                </h3>
                <div className="space-y-3 text-xs text-amber-800 font-medium leading-relaxed">
                  <p>
                    To protect your WhatsApp number from being banned, this software uses an <strong>Automated Human-Simulated Queue</strong>.
                  </p>
                  <p>
                    When you click send, messages are <strong>never</strong> blasted simultaneously. The bot will wait <strong>4–8 seconds</strong> between every single recipient.
                  </p>
                  <p>
                    <strong>WhatsApp Guidelines:</strong><br />
                    • Only sends to members who messaged &quot;start&quot; to opt-in.<br />
                    • Do not spam members with daily promotions.<br />
                    • Keep your server running while queued broadcasts finish sending.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-600 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Opt-In Member Protection</span>
                </div>
                <p className="leading-relaxed">
                  WhatsApp anti-spam algorithms penalize sending unsolicited messages. By only sending broadcasts to members who have messaged <strong>start</strong>, your account reputation remains healthy.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
