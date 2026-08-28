'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Megaphone, Image as ImageIcon, Send, X, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { getCustomers } from '@/lib/actions';

export default function BroadcastPage() {
  const [gymId, setGymId] = useState<string>('gym_1');
  const [customers, setCustomers] = useState<any[]>([]);
  
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('active');
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  
  const [isSending, setIsSending] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      if (document.hidden) return;
      loadData();
    }, 30000);

    const handleFocus = () => loadData();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const loadData = async () => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_gym_id') || 'gym_1' : 'gym_1';
    setGymId(savedId);
    const custs = await getCustomers(savedId);
    setCustomers(custs);
  };

  const getRecipientCount = () => {
    if (audience === 'custom') return selectedPhones.length;
    const activeCustomers = customers.filter(c => c.waActive === true);
    if (audience === 'all') return activeCustomers.length;
    return activeCustomers.filter(c => c.status === audience).length;
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
    
    const count = getRecipientCount();
    if (count === 0) {
      setErrorMsg('No recipients found for this selection');
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
          window.dispatchEvent(new CustomEvent('global-toast', { detail: { message: `Queued ${data.queuedCount} broadcast messages.`, type: 'success' } }));
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
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <Megaphone className="w-7 h-7 mr-3 text-blue-900" />
            WhatsApp Broadcast
          </h1>
          <p className="text-sm text-slate-500 mt-1">Send announcements, offers, or holiday greetings to your members.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Composer */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-800 text-sm">Compose Message</h2>
            </div>
            
            <div className="p-6 space-y-5">
              
              {/* Audience Selector - Compact & Mobile Friendly */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Target Audience</label>
                <div className="flex bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 gap-1">
                  {['all', 'active', 'due_soon'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setAudience(opt)}
                      className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-all capitalize ${
                        audience === opt ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {opt.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-blue-700 font-bold mt-2 flex items-center bg-blue-50 w-max px-3 py-1 rounded-full border border-blue-100">
                  <Users className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  Sending to {getRecipientCount()} members
                </p>
              </div>

              {/* Message Box */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Message Text</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={6}
                  placeholder="Type your announcement here..."
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-800 outline-none resize-y"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Attach Photo (Optional)</label>
                
                {!mediaBase64 ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-colors"
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
                  <AlertTriangle className="w-4 h-4 mr-2" /> {errorMsg}
                </div>
              )}

              {successCount !== null && (
                <div className="p-4 bg-emerald-50 text-emerald-800 text-sm font-bold rounded-xl border border-emerald-100 flex flex-col items-center text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                  <p>Broadcast Queued Successfully!</p>
                  <p className="text-xs font-medium text-emerald-600 mt-1">
                    {successCount} messages have been added to the anti-ban queue. They will be sent slowly over the next few minutes.
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleBroadcast}
                disabled={isSending || getRecipientCount() === 0 || !message.trim()}
                className="w-full py-4 bg-blue-900 hover:bg-blue-950 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center space-x-2"
              >
                {isSending ? (
                  <span className="flex items-center">
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                    Queuing...
                  </span>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Send Broadcast to {getRecipientCount()} Members</span>
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
                To protect your WhatsApp number from being banned, this software uses a <strong>Smart Queue</strong>.
              </p>
              <p>
                When you click send, messages are NOT sent instantly. The bot will wait <strong>4-8 seconds</strong> between every single message, and simulate human typing.
              </p>
              <p>
                <strong>Important Rules:</strong><br/>
                • Do not broadcast every day.<br/>
                • Limit broadcasts to maximum 2-3 times a month.<br/>
                • Do not close your server immediately after sending, as it takes time to process the queue.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
