const fs = require('fs');

const file = 'c:\\Office\\Gym Software\\app\\dashboard\\members\\page.tsx';
let raw = fs.readFileSync(file, 'utf8');
let isCrlf = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

// 1. Update states
const oldStateStr = `  const [fingerprintId, setFingerprintId] = useState('');
  const [pollStatus, setPollStatus] = useState<'IDLE'|'POLLING'|'SUCCESS'|'ERROR'>('IDLE');
  const [activeCommandId, setActiveCommandId] = useState<string|null>(null);
  const [fpScanning, setFpScanning] = useState(false);`;

const newStateStr = `  const [fingerprintId, setFingerprintId] = useState('');
  const [fpPollStatus, setFpPollStatus] = useState<'IDLE'|'POLLING'|'SUCCESS'|'ERROR'>('IDLE');
  const [fpCommandId, setFpCommandId] = useState<string|null>(null);
  const [cardPollStatus, setCardPollStatus] = useState<'IDLE'|'POLLING'|'SUCCESS'|'ERROR'>('IDLE');
  const [cardCommandId, setCardCommandId] = useState<string|null>(null);
  const [fpScanning, setFpScanning] = useState(false);`;

if (!content.includes(oldStateStr)) {
  console.error("Could not find oldStateStr");
  process.exit(1);
}
content = content.replace(oldStateStr, newStateStr);

// 2. Update polling effect
const oldEffectRegex = /\/\/ Polling for biometric command success[\s\S]*?\}, \[pollStatus, activeCommandId\]\);/;
const newEffectStr = `// Polling for biometric command success (Fingerprint & Card)
  useEffect(() => {
    if (fpPollStatus !== 'POLLING' && cardPollStatus !== 'POLLING') return;
    const interval = setInterval(async () => {
      // Check Fingerprint command
      if (fpPollStatus === 'POLLING') {
        try {
          const res = await fetch(\`/api/biometrics/command-status?id=\${fpCommandId || ''}&pin=\${fingerprintId || ''}\`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'SUCCESS') {
              setFpPollStatus('SUCCESS');
              setFpCommandId(null);
              showToast('Fingerprint Enrolled & Saved!', 'success');
            } else if (data.status === 'ERROR') {
              setFpPollStatus('ERROR');
              setFpCommandId(null);
              showToast('Fingerprint Enrollment Failed', 'error');
            }
          }
        } catch (e) { }
      }

      // Check Card sync command
      if (cardPollStatus === 'POLLING') {
        try {
          const res = await fetch(\`/api/biometrics/command-status?id=\${cardCommandId || ''}&pin=\${fingerprintId || ''}\`);
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
  }, [fpPollStatus, cardPollStatus, fpCommandId, cardCommandId, fingerprintId]);`;

if (!content.match(oldEffectRegex)) {
  console.error("Could not find oldEffectRegex");
  process.exit(1);
}
content = content.replace(oldEffectRegex, newEffectStr);

// 3. Update handleEditInit to set tick status
content = content.replace(
  /setFingerprintId\(cust\.fingerprintId \|\| ''\);/,
  `setFingerprintId(cust.fingerprintId || '');\n    setFpPollStatus(cust.fingerprintId ? 'SUCCESS' : 'IDLE');\n    setCardPollStatus('IDLE');`
);

// 4. Update modal fields layout
const oldFieldsStart = `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">`;
const oldFieldsEnd = `<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Membership Plan`;

const startIndex = content.indexOf(oldFieldsStart);
const endIndex = content.indexOf(oldFieldsEnd);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not locate old fields block", { startIndex, endIndex });
  process.exit(1);
}

const newFieldsLayout = `<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                {settings?.attendanceWallMountEnabled && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-blue-900" /> Member ID *
                      </label>
                      <span className="text-[10px] font-medium text-slate-400">Device PIN</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Enter ID (e.g. 101)"
                      value={fingerprintId || ""}
                      onChange={(e) => {
                        setFingerprintId(e.target.value);
                        if (fpPollStatus === 'SUCCESS') setFpPollStatus('IDLE');
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-800 outline-none"
                    />
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
                          {cardPollStatus === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Synced
                            </span>
                          ) : cardPollStatus === 'POLLING' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-300 px-2 py-0.5 rounded-full animate-pulse">
                              <RefreshCw className="w-3 h-3 animate-spin text-blue-600" /> Sending...
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
                            onChange={(e) => setNfcCardId(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.preventDefault();
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
                              className="w-full px-3 py-1.5 bg-blue-50/50 border border-blue-200 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none"
                            />
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
                            if (!nfcCardId.trim()) {
                              showToast('Please enter or tap an NFC Card number first', 'error');
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
                                if (data.commandId) setCardCommandId(data.commandId);
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
                        className={\`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 \${
                          fpPollStatus === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                            : fpPollStatus === 'POLLING'
                            ? 'bg-blue-50 text-blue-900 border border-blue-300 animate-pulse'
                            : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border border-indigo-300'
                        }\`}
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
                      placeholder={fingerprintId ? "Registered" : "No Fingerprint"}
                      value={fingerprintId ? "Registered" : ""}
                      className="w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-blue-900 outline-none cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={handleFingerprintScan}
                      disabled={fpScanning}
                      className={\`px-3 py-2 rounded-lg text-xs font-bold shrink-0 transition-colors \${
                        fpScanning ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-blue-100 text-blue-900 hover:bg-blue-200'
                      }\`}
                    >
                      {fpScanning ? 'Scanning...' : 'Scan'}
                    </button>
                  </div>
                </div>
              )}

              `;

content = content.slice(0, startIndex) + newFieldsLayout + content.slice(endIndex);

if (isCrlf) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(file, content, 'utf8');
console.log("Successfully rearranged modal fields and upgraded two ticks!");
