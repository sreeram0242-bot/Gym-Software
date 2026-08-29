---
name: zkteco-device-guide
description: >
  Guide for evaluating, buying, and testing ZKTeco/eSSL biometric devices for
  SDK support (port 4370). Use when the user mentions buying a new biometric
  device, testing SDK connectivity, or asking about eSSL/ZKTeco compatibility.
---

# ZKTeco / eSSL Device Evaluation Guide

## Background
This gym SaaS software supports two device integration modes:
1. **ADMS Push** (device → server): Works with ANY device including Biomax N-WL20. Attendance only.
2. **SDK / Port 4370** (server ↔ device): Full two-way control — remote enrollment, delete users, pull logs. Requires ZEM firmware.

The user's **current Biomax N-WL20 is CONFIRMED to NOT support port 4370**. Port 4370 was tested and is closed. Do not retry.

---

## ✅ Good Firmware (Buy!)
| Firmware String | Notes |
|---|---|
| `ZEM800` | ZKTeco standard — fully compatible |
| `ZEM600` | ZKTeco standard — fully compatible |
| `ZEM500` | eSSL K90 Pro common platform — compatible |
| `ZEM200` | Older ZKTeco — compatible |
| `Ver 6.x.x` | ZKTeco firmware 6 — compatible |
| `Ver 5.x.x` | ZKTeco firmware 5 — compatible |

**Rule:** If you see `ZEM` or clean `Ver X.X` → Buy it!

## ❌ Bad Firmware (Walk Away!)
| Firmware String | Notes |
|---|---|
| `A107A2Y2KbioO1bc` | Biomax custom (confirmed not working) |
| `Kbio...` | Biomax/custom locked |
| Random alphanumeric | Custom locked firmware |

**Rule:** If it looks like a random string with no version logic → Avoid!

---

## Recommended Devices
| Device | Reliability | Price (India) |
|---|---|---|
| **ZKTeco K40** (genuine authorized) | ~95% | ₹4,000–6,000 |
| **eSSL K90 Pro** (check ZEM500 firmware) | ~80% | ₹3,500–5,500 |

---

## Pre-Purchase Verification Steps (In Shop)

### Method 1 — Firmware Check
Press **Menu → About / System Info**
- Look for `ZEM` or `Ver X.X` → ✅
- Random string → ❌

### Method 2 — Comm Settings Port Field
Press **Menu → Comm. → TCP/IP**
- Port field shows `4370` → ✅
- No port field → ❌

### Method 3 — Port Test (Laptop Required)
```powershell
Test-NetConnection -ComputerName [device-IP] -Port 4370
```
- `TcpTestSucceeded: True` → ✅ Buy!
- `TcpTestSucceeded: False` → ❌ Walk away

### Method 4 — Browser Test
Open: `http://[device-IP]` in browser
- Login page appears → ✅
- Nothing loads → ❌

### Method 5 — Run project test script (After Purchase)
```bash
node zk_test.js
```
(Already in project root at `c:\Office\Gym Software\zk_test.js`)
- Output shows "Connected! Found X users" → ✅ 100% confirmed
- Timeout/error → ❌ Return device

---

## What to Say to Dealer
> "I need this device to support direct TCP connection on port 4370 for third-party SDK integration. Can you connect to it from a PC using ZKTeco SDK — not USB, not eTimeTrackLite — just raw TCP to port 4370?"

---

## Why Some eSSL Devices Don't Support SDK
- **Business reason:** eSSL wants you to buy their eTimeTrackLite software subscription
- **Newer batches (2023–2025)** ship with locked firmware to force eTimeTrackLite dependency
- **Solution:** Always verify ZEM firmware before purchase; buy from Amazon/Flipkart for easy returns

---

## Buying Recommendation
Buy from **Amazon/Flipkart** with return policy:
- Get device → Run `node zk_test.js` → Works? Keep it. Fails? Return same day.
- Search: `"eSSL K90 Pro"` (sold by eSSL Security) or `"ZKTeco K40"`
