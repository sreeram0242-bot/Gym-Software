const fs = require('fs');
const file = 'c:\\Office\\Gym Software\\app\\dashboard\\members\\page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add polling state
if (!content.includes('const [pollStatus')) {
  content = content.replace(
    /const \[fpScanning, setFpScanning\] = useState\(false\);/,
    `const [fpScanning, setFpScanning] = useState(false);\n  const [pollStatus, setPollStatus] = useState('IDLE');\n  const [activeCommandId, setActiveCommandId] = useState(null);`
  );
}

// 2. Add polling effect
const effectStr = `
  // Polling for biometric command success
  useEffect(() => {
    if (pollStatus !== 'POLLING' || !activeCommandId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(\`/api/biometrics/command-status?id=\${activeCommandId}\`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'SUCCESS') {
            setPollStatus('SUCCESS');
            setActiveCommandId(null);
            showToast('Enrollment Successful!', 'success');
          } else if (data.status === 'ERROR') {
            setPollStatus('ERROR');
            setActiveCommandId(null);
            showToast('Enrollment Failed', 'error');
          }
        }
      } catch (e) {
        // ignore fetch errors during polling
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [pollStatus, activeCommandId]);
`;
if (!content.includes('// Polling for biometric command success')) {
  content = content.replace(
    /export default function MemberManagementPage\(\) \{[\s\S]*?const \[errorMsg, setErrorMsg\] = useState\(''\);/,
    match => match + '\n' + effectStr
  );
}

// 3. Rename ZKTeco Label
content = content.replace(
  /<Shield className="w-3 h-3 text-blue-900" \/> ZKTeco \/ Biomax Device ID/,
  '<Shield className="w-3 h-3 text-blue-900" /> Member ID'
);

// 4. Replace buttons and add tick marks
const oldButtonChunkRegex = /<button[\s\S]*?title="Send Enroll Command"[\s\S]*?<\/button>/m;
const newButtons = `<div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!fingerprintId) {
                              showToast('Please enter an ID first (e.g. 101)', 'error');
                              return;
                            }
                            setPollStatus('POLLING');
                            try {
                              const res = await fetch('/api/biometrics/enroll', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ gymId, memberId: 'temp', nfcCardId: fingerprintId, enrollType: 'fp' })
                              });
                              if (res.ok) {
                                const data = await res.json();
                                if (data.commandId) {
                                  setActiveCommandId(data.commandId);
                                }
                              }
                            } catch (e) {
                              setPollStatus('ERROR');
                              showToast('Failed to send command', 'error');
                            }
                          }}
                          disabled={pollStatus === 'POLLING'}
                          className="shrink-0 px-3 py-2 bg-indigo-100 text-indigo-900 hover:bg-indigo-200 border border-indigo-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                          title="Enroll Fingerprint"
                        >
                          <Fingerprint className="w-4 h-4" /> Enroll FP
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!fingerprintId) {
                              showToast('Please enter an ID first', 'error');
                              return;
                            }
                            if (!nfcCardId) {
                              showToast('Please type the NFC Card Number above first', 'error');
                              return;
                            }
                            setPollStatus('POLLING');
                            try {
                              const res = await fetch('/api/biometrics/enroll', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ gymId, memberId: 'temp', nfcCardId: fingerprintId, actualCardNumber: nfcCardId, enrollType: 'card' })
                              });
                              if (res.ok) {
                                const data = await res.json();
                                if (data.commandId) {
                                  setActiveCommandId(data.commandId);
                                }
                              }
                            } catch (e) {
                              setPollStatus('ERROR');
                              showToast('Failed to send command', 'error');
                            }
                          }}
                          disabled={pollStatus === 'POLLING'}
                          className="shrink-0 px-3 py-2 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                          title="Send Card to Device"
                        >
                          <CreditCard className="w-4 h-4" /> Send Card
                        </button>
                        
                        {pollStatus === 'POLLING' && (
                          <div className="flex items-center gap-1 text-xs font-bold text-blue-600 animate-pulse">
                            <RefreshCw className="w-4 h-4 animate-spin" /> Waiting...
                          </div>
                        )}
                        {pollStatus === 'SUCCESS' && (
                          <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" /> Saved!
                          </div>
                        )}
                        {pollStatus === 'ERROR' && (
                          <div className="flex items-center gap-1 text-xs font-bold text-rose-600">
                            <AlertCircle className="w-4 h-4" /> Failed
                          </div>
                        )}
                      </div>`;
if (content.match(oldButtonChunkRegex)) {
  content = content.replace(oldButtonChunkRegex, newButtons);
} else {
  console.log("Could not find the old button chunk.");
}

// 5. Add Member ID display in Selected Member View
const memberIdDisplayRegex = /<span className="text-\[10px\] font-bold text-slate-400 uppercase tracking-wider">NFC Card<\/span>\s*<span className="font-black text-slate-800 text-sm mt-0.5">\{selectedMember\.nfcCardId\}<\/span>\s*<\/div>/;
const newDisplay = `<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NFC Card</span>
                  <span className="font-black text-slate-800 text-sm mt-0.5">{selectedMember.nfcCardId}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center hover:shadow-md transition-shadow">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                    <Shield className="w-4 h-4 text-slate-500" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Member ID</span>
                  <span className="font-black text-slate-800 text-sm mt-0.5">{selectedMember.fingerprintId || '-'}</span>
                </div>`;
if (content.match(memberIdDisplayRegex)) {
  content = content.replace(memberIdDisplayRegex, newDisplay);
} else {
  console.log("Could not find the NFC Card display chunk.");
}

fs.writeFileSync(file, content, 'utf8');
console.log("Successfully ran fix script!");
