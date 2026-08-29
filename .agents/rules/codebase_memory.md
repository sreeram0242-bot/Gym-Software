# 🧠 Codebase Architecture & Memory Rule

Before searching or modifying any code in this repository, always reference `codebase_memory.md` in the project root:

1. **Tech Stack**: Next.js 14 App Router, Prisma ORM (SQLite/Postgres), Tailwind CSS.
2. **Key Routes**:
   - `/dashboard/members`: Member cards, drawer, due collection, renewals.
   - `/dashboard/staffs`: Staff directory, NFC/FP configuration, live shift cards (matching member cards), IN/OUT punches, logs, CSV export with date filters.
   - `/dashboard/checkin`: Unified Reception Terminal with Segmented Tabs (`Members Check-in` vs `Staff & Trainers`), Web NFC + Biometric WebSocket `ws://localhost:8765`, manual search & punch.
   - `/dashboard/revenue`: Revenue Hub, charts, PDF/CSV export, `showStoreInRevenue` toggle respect.
   - `/dashboard/products`: Store POS, stock management, automatic WhatsApp receipts.
   - `/dashboard/broadcast`: Bulk & selective broadcast messaging.
   - `/dashboard/settings`: WhatsApp bot controls, store revenue toggle, templates editor.
3. **Core Conventions**:
   - Use `getLocalTodayDateString()` from `@/lib/utils` for all date logic.
   - All check-in/check-out actions (`toggleCheckIn`, `toggleStaffCheckIn`) support 20-hour midnight shifts.
4. **MANDATORY INSTRUCTION**:
   - **Whenever you make ANY change, update `codebase_memory.md` immediately before completing the turn.**

---

## 🚫 Rule: Biomax N-WL20 Hardware Constraints (CONFIRMED)

The gym's physical Biomax device has the following **permanently confirmed** limitations:
- **Serial:** AMDB25062800133 | **IP:** 10.61.168.51 | **Firmware:** `A107A2Y2KbioO1bc v1.17`
- **Port 4370: CLOSED** — `node-zklib` and ZKTeco SDK do NOT work on this device. This was tested and confirmed.
- **Remote enrollment: IMPOSSIBLE** — All known command formats were tried via ADMS push and all failed. Do NOT attempt again.
- **What WORKS:** One-way ADMS push (device → server) via `/hdata.aspx`. Attendance logs are pushed and processed correctly.
- **Action:** Never suggest remote enrollment for this specific Biomax device. If user asks, explain the confirmed limitation and suggest buying a ZKTeco/eSSL device with ZEM firmware.

---

## 📲 Rule: WhatsApp Reminders Only for waActive Members

- Automated WhatsApp messages (expiry reminders, absentee reminders) must **only** be sent to `Customer` records where `waActive === true`.
- The daily cron endpoint is `/api/whatsapp/cron` — must be triggered externally (e.g., cron-job.org) once per day.
- Absentee messages are rate-limited to **once per 30 days** per member to prevent spam.
- Expiry reminders are rate-limited to **once per `waReminderWindowDays`** per due cycle.

---

## 🔒 Rule: Biometric Manual Punch Enforcement

- `toggleCheckIn(customerId, isManual)` and `toggleStaffCheckIn(staffId, isManual)` accept an `isManual` boolean flag.
- When `isManual = true` and `attendanceMode` is `NFC`, `FINGERPRINT`, or `BOTH`, the server **throws an error** blocking the punch.
- Manual punch callers in `checkin/page.tsx` and `staffs/page.tsx` must always pass `isManual: true`.
- NFC and fingerprint hardware punches must always pass `isManual: false` (default).

