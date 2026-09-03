const fs = require('fs');
const file = 'c:\\Office\\Gym Software\\app\\dashboard\\members\\page.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `                  <span className="font-black text-slate-800 text-sm mt-0.5">{selectedMember.nfcCardId}</span>
                </div>`;
                
const replacementStr = `                  <span className="font-black text-slate-800 text-sm mt-0.5">{selectedMember.nfcCardId}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center hover:shadow-md transition-shadow">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                    <Shield className="w-4 h-4 text-slate-500" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Member ID</span>
                  <span className="font-black text-slate-800 text-sm mt-0.5">{selectedMember.fingerprintId || '-'}</span>
                </div>`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Successfully added Member ID to display");
} else {
  console.log("Failed to find target string");
}
