const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', 'dashboard', 'members', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const startIndex = content.indexOf('{/* MODAL / DRAWER: MEMBER DETAILS PROFILE */}');
const endIndex = content.indexOf('{/* MODAL: COLLECT PENDING DUE */}');

if (startIndex !== -1 && endIndex !== -1) {
  const newModal = `{/* MODAL: MEMBER DETAILS PROFILE (PREMIUM DESIGN) */}
      {selectedMember && (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-50 rounded-[2rem] max-w-3xl w-full shadow-2xl overflow-hidden border border-white/60 flex flex-col max-h-[95vh] ring-1 ring-slate-900/5">
            {/* Header / Banner */}
            <div className="relative bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 p-6 shrink-0">
              <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-5 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              
              <div className="flex justify-between items-start relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-inner backdrop-blur-sm">
                    {selectedMember.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-black text-white text-2xl tracking-tight mb-1">{selectedMember.name}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-blue-100 text-sm font-medium">
                      <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 opacity-80" /> {selectedMember.phone}</span>
                      <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 opacity-80" /> Joined {formatDateDDMMYYYY(selectedMember.joinedDate)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEnrollFingerprint(selectedMember)} className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-50 rounded-xl flex items-center gap-1.5 border border-emerald-500/30 backdrop-blur-sm transition-all" title="Enroll Fingerprint on Wall Machine">
                    <Fingerprint className="w-4 h-4" />
                    <span className="text-xs font-bold hidden sm:inline">Enroll FP</span>
                  </button>
                  <button onClick={() => handleEditInit(selectedMember)} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all" title="Edit Profile">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteMember(selectedMember.id)} className="p-2 bg-rose-500/20 hover:bg-rose-500/40 text-rose-100 rounded-xl border border-rose-500/20 transition-all" title="Delete Profile">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setSelectedMember(null)} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all ml-2">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Content Body */}
            <div className="overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar flex-1">
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center hover:shadow-md transition-shadow">
                  <Tag className="w-6 h-6 text-indigo-400 mb-2" />
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">NFC / ID</span>
                  <span className="font-black text-slate-800 text-sm mt-0.5">{selectedMember.nfcCardId}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center hover:shadow-md transition-shadow">
                  <Dumbbell className="w-6 h-6 text-emerald-400 mb-2" />
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Avg Workout</span>
                  <span className="font-black text-slate-800 text-sm mt-0.5">{getAvg(selectedMember.id)} hrs/day</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center hover:shadow-md transition-shadow">
                  <Banknote className="w-6 h-6 text-blue-400 mb-2" />
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Last Paid</span>
                  <span className="font-black text-slate-800 text-sm mt-0.5">{formatDateDDMMYYYY(selectedMember.lastPaymentDate)}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center hover:shadow-md transition-shadow">
                  <Calendar className="w-6 h-6 text-amber-500 mb-2" />
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Next Due</span>
                  <span className="font-black text-amber-600 text-sm mt-0.5">{formatDateDDMMYYYY(selectedMember.nextDueDate)}</span>
                </div>
              </div>

              {/* Status Banners */}
              <div className="space-y-3">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={\`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 \${selectedMember.waActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}\`}>
                      <MessageCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">WhatsApp Assistant</h4>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">{selectedMember.waActive ? "Activated (Member is receiving updates)" : "Not Activated (Waiting for member to text 'start')"}</p>
                    </div>
                  </div>
                  <span className={\`text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-wider shrink-0 \${
                    selectedMember.waActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }\`}>
                    {selectedMember.waActive ? 'Active' : 'Pending'}
                  </span>
                </div>

                {(selectedMember.pendingBalance || 0) > 0 && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl"></div>
                    <div className="relative z-10 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-sm border border-amber-200">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-black text-amber-950 text-base">Pending Dues</h4>
                        <p className="text-xs font-bold text-amber-700/80 mt-0.5">
                          {selectedMember.balanceDueDate ? \`Due before: \${formatDateDDMMYYYY(selectedMember.balanceDueDate)}\` : 'No deadline specified'}
                        </p>
                      </div>
                    </div>
                    <div className="relative z-10 text-right flex flex-col items-end">
                      <span className="font-black text-amber-900 text-xl tracking-tight">₹{selectedMember.pendingBalance}</span>
                      <button
                        onClick={() => {
                          setCollectDueMember(selectedMember);
                          setCollectDueAmount(selectedMember.pendingBalance);
                          setCollectDuePaymentMethod('CASH');
                          setShowCollectDueModal(true);
                        }}
                        className="mt-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all"
                      >
                        Collect Balance
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Fee Renewal Action Box */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/80 border-b border-slate-100 p-4 sm:px-6">
                  <h4 className="font-black text-slate-800 text-sm flex items-center gap-2 uppercase tracking-wide">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    Renew Membership
                  </h4>
                </div>
                <div className="p-4 sm:p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Plan Period</label>
                      <select
                        value={renewMonths}
                        onChange={(e) => {
                          const m = Number(e.target.value);
                          setRenewMonths(m);
                          setRenewPaidAmount(selectedMember.feeAmount * m);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-800 text-sm focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                      >
                        <option value={1}>+1 Month (₹{selectedMember.feeAmount})</option>
                        <option value={3}>+3 Months (₹{selectedMember.feeAmount * 3})</option>
                        <option value={6}>+6 Months (₹{selectedMember.feeAmount * 6})</option>
                        <option value={12}>+1 Year (₹{selectedMember.feeAmount * 12})</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Amount Paid (₹)</label>
                      <input
                        type="number"
                        min={0}
                        value={renewPaidAmount}
                        onChange={(e) => setRenewPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-black text-emerald-600 text-sm focus:ring-2 focus:ring-emerald-600 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {Number(renewPaidAmount) < selectedMember.feeAmount * renewMonths && (
                    <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-3 animate-in fade-in zoom-in duration-200">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-amber-900 text-sm">Remaining Unpaid:</span>
                        <span className="text-amber-700 text-lg font-black">₹{selectedMember.feeAmount * renewMonths - Number(renewPaidAmount)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setRenewRemainingType('BALANCE')}
                          className={\`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 \${
                            renewRemainingType === 'BALANCE' ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }\`}
                        >
                          <Clock className="w-4 h-4" /> Balance Due
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenewRemainingType('DISCOUNT')}
                          className={\`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 \${
                            renewRemainingType === 'DISCOUNT' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }\`}
                        >
                          <Tag className="w-4 h-4" /> Discount
                        </button>
                      </div>
                      {renewRemainingType === 'BALANCE' && (
                        <div className="pt-2">
                          <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1.5">Due By Date</label>
                          <input
                            type="date"
                            value={renewBalanceDueDate}
                            onChange={(e) => setRenewBalanceDueDate(e.target.value)}
                            className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Mode</label>
                    <div className="grid grid-cols-4 gap-2.5">
                      {(['CASH', 'UPI', 'CARD', 'SPLIT'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setRenewPaymentMethod(mode)}
                          className={\`py-3 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 border \${
                            renewPaymentMethod === mode
                              ? 'bg-blue-900 text-white border-blue-900 shadow-md ring-2 ring-blue-900 ring-offset-1'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }\`}
                        >
                          {mode === 'CASH' ? <Banknote className="w-5 h-5" /> : mode === 'UPI' ? <Smartphone className="w-5 h-5" /> : mode === 'CARD' ? <CreditCard className="w-5 h-5" /> : <ArrowLeftRight className="w-5 h-5" />}
                          <span className="text-[10px] uppercase tracking-wider">{mode === 'UPI' ? 'UPI' : mode}</span>
                        </button>
                      ))}
                    </div>

                    {renewPaymentMethod === 'UPI' && (
                      <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
                        <input
                          type="text"
                          placeholder="UPI ID / Transaction UTR"
                          value={renewUpiId}
                          onChange={(e) => setRenewUpiId(e.target.value)}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Sender / Payer Name"
                          value={renewUpiSenderName}
                          onChange={(e) => setRenewUpiSenderName(e.target.value)}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {renewPaymentMethod === 'SPLIT' && (
                      <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-2 gap-4 animate-in fade-in duration-200">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Cash (₹)</label>
                          <input
                            type="number"
                            value={renewSplitCash}
                            onChange={(e) => setRenewSplitCash(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">UPI (₹)</label>
                          <input
                            type="number"
                            value={renewSplitUpi}
                            onChange={(e) => setRenewSplitUpi(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-2">
                    <button
                      onClick={() => handleRenewPayment(selectedMember)}
                      className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Record Renewal & Send Receipt
                    </button>
                  </div>
                </div>
              </div>

              {/* History Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-4">
                <div>
                  <h4 className="font-black text-slate-800 text-sm mb-3 flex items-center gap-2 uppercase tracking-wide"><Banknote className="w-4 h-4 text-slate-400" /> Transactions</h4>
                  <div className="space-y-3">
                    {transactions.filter(t => t.customerId === selectedMember.id).slice(0, 5).map(tx => (
                      <div key={tx.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:border-slate-300 hover:shadow-md">
                        <div>
                          <div className="font-bold text-slate-800 text-sm mb-0.5">{tx.description}</div>
                          <div className="text-slate-500 font-mono text-[11px] font-semibold">{formatDateDDMMYYYY(tx.date)}</div>
                        </div>
                        <span className="font-black text-emerald-600 text-sm">₹{tx.amount}</span>
                      </div>
                    ))}
                    {transactions.filter(t => t.customerId === selectedMember.id).length === 0 && (
                      <div className="text-slate-400 text-sm font-medium italic p-5 bg-white rounded-2xl border border-slate-100 text-center">No transactions yet.</div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-black text-slate-800 text-sm mb-3 flex items-center gap-2 uppercase tracking-wide"><Clock className="w-4 h-4 text-slate-400" /> Recent Attendance</h4>
                  <div className="space-y-3">
                    {attendance.filter(a => a.customerId === selectedMember.id).slice(0, 5).map(a => (
                      <div key={a.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:border-slate-300 hover:shadow-md">
                        <div>
                          <div className="font-bold text-slate-800 text-sm font-mono mb-0.5">{formatDateDDMMYYYY(a.dateStr)}</div>
                          <div className="text-slate-500 text-[11px] font-bold">In: {new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        {a.checkOutTime ? (
                          <div className="text-right">
                            <span className="font-black text-blue-600 block text-sm mb-0.5">{a.durationMinutes} mins</span>
                            <span className="text-slate-400 text-[10px] font-bold">Out: {new Date(a.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ) : (
                          <span className="font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg text-[11px] border border-emerald-200 shadow-sm">Active Now</span>
                        )}
                      </div>
                    ))}
                    {attendance.filter(a => a.customerId === selectedMember.id).length === 0 && (
                      <div className="text-slate-400 text-sm font-medium italic p-5 bg-white rounded-2xl border border-slate-100 text-center">No attendance yet.</div>
                    )}
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      )}
      {/* MODAL: COLLECT PENDING DUE */}`;
      
  const updatedContent = content.substring(0, startIndex) + newModal + content.substring(endIndex + '{/* MODAL: COLLECT PENDING DUE */}'.length);
  fs.writeFileSync(filePath, updatedContent, 'utf-8');
  console.log('Modal updated successfully!');
} else {
  console.log('Could not find the start or end index.');
}
