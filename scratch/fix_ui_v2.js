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
  /<Shield className="w-3 h-3 text-blue-900" \/> ZKTeco \/ Biomax Device ID/g,
  '<Shield className="w-3 h-3 text-blue-900" /> Member ID'
);

// 4. Replace single "Enroll Now" button with the multi-button setup + polling UI
const oldButtonRegex = /<button[\s\S]*?title="Send Enroll Command"[\s\S]*?<\/button>/m;
const newButtons = `<button
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
                        )}`;
if (content.match(oldButtonRegex)) {
  content = content.replace(oldButtonRegex, newButtons);
} else {
  console.log("Could not find the old button chunk.");
}

// 5. Replace NFC / ID block in selected view
const idBlockRegex = /<span className="text-\[10px\] uppercase font-bold text-slate-400 tracking-wider">NFC \/ ID<\/span>\s*<span className="font-black text-slate-800 text-sm mt-0.5">\{selectedMember\.nfcCardId\}<\/span>/;
const newIdBlock = `<span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Member ID & NFC</span>
                  <span className="font-black text-slate-800 text-sm mt-0.5">{selectedMember.fingerprintId || '-'} / {selectedMember.nfcCardId || '-'}</span>`;
if (content.match(idBlockRegex)) {
  content = content.replace(idBlockRegex, newIdBlock);
} else {
  console.log("Could not find the ID block chunk.");
}

fs.writeFileSync(file, content, 'utf8');
console.log("Successfully ran fix_v2 script!");
