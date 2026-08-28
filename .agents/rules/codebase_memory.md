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
