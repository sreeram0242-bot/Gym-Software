const fs = require('fs');
const file = 'c:\\Office\\Gym Software\\app\\dashboard\\members\\page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `<button
                        type="button"
                        onClick={async () => {
                          if (!fingerprintId) {
                            showToast('Please enter an ID first (e.g. 101)', 'error');
                            return;
                          }
                          showToast('Sending card enroll command...', 'success');
                          try {
                            await fetch('/api/biometrics/enroll', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ gymId, memberId: 'temp', nfcCardId: fingerprintId, enrollType: 'card' })
                            });
                          } catch (e) {
                            showToast('Failed to send command', 'error');
                          }
                        }}
                        className="shrink-0 px-3 py-2 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                        title="Enroll NFC Card"
                      >
                        <CreditCard className="w-4 h-4" /> Enroll Card
                      </button>`;

const replacement = `<button
                        type="button"
                        onClick={async () => {
                          if (!fingerprintId) {
                            showToast('Please enter an ID first (e.g. 101)', 'error');
                            return;
                          }
                          if (!nfcCardId) {
                            showToast('Please type the NFC Card Number in the NFC Tag ID box first', 'error');
                            return;
                          }
                          showToast('Sending card number to device...', 'success');
                          try {
                            await fetch('/api/biometrics/enroll', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ gymId, memberId: 'temp', nfcCardId: fingerprintId, actualCardNumber: nfcCardId, enrollType: 'card' })
                            });
                          } catch (e) {
                            showToast('Failed to send command', 'error');
                          }
                        }}
                        className="shrink-0 px-3 py-2 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                        title="Send Card to Device"
                      >
                        <CreditCard className="w-4 h-4" /> Send Card
                      </button>`;

// Try regex replacement to ignore exact whitespace matching
const targetRegex = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
if (targetRegex.test(content)) {
  content = content.replace(targetRegex, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Successfully replaced!");
} else {
  console.log("Failed to find target!");
}
