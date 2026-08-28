# 🧠 GymFlow SaaS — Codebase Memory & Architecture Blueprint

> **Purpose**: This document is the single source of truth for the GymFlow SaaS codebase architecture, routes, database models, hardware protocols, and business logic. The AI coding assistant and developers consult this file first to make rapid, surgical, and bug-free updates without scanning the entire project.

---

## 1. 🏗️ Tech Stack & Core Infrastructure

- **Framework**: Next.js 14 (App Router, React 18, TypeScript)
- **Database & ORM**: Prisma ORM with SQLite (local) / PostgreSQL (production ready)
- **Prisma Client**: Generated at `./generated/prisma` (configured in `prisma.config.ts` and `prisma/schema.prisma`)
- **Styling**: Tailwind CSS + Custom CSS Utilities (`app/globals.css`)
- **Icons**: `lucide-react`
- **Charts & Reporting**: `recharts`, `jspdf`, `jspdf-autotable`
- **WhatsApp Gateway**: Baileys-based self-hosted WhatsApp Web socket (`lib/whatsapp.ts`, `app/api/whatsapp/*`)

---

## 2. 🗺️ Complete Route Map & Component Hierarchy

| Route | File Path | Description & Key Responsibilities |
|---|---|---|
| `/` | `app/page.tsx` | Landing page / Reception Terminal Quick Access |
| `/dashboard` | `app/dashboard/page.tsx` | Main KPI overview, today's attendance, revenue summary, WhatsApp status banner |
| `/dashboard/members` | `app/dashboard/members/page.tsx` | Member directory, full profile drawer, card clicks, add/edit member, collect due, renewal, NFC/FP tag assignment, CSV export |
| `/dashboard/staffs` | `app/dashboard/staffs/page.tsx` | Staff directory, role badges, NFC/FP hardware configuration, live shift status cards (exact match with member cards), quick manual Punch IN/OUT, filterable attendance logs (`Today`, `This Week`, `This Month`, `Custom From/To`), and CSV reports |
| `/dashboard/checkin` | `app/dashboard/checkin/page.tsx` | Unified Reception Terminal with Segmented Tabs (`Members Check-in` vs `Staff & Trainers`), Web NFC reader, Biometric scanner WebSocket bridge, live active cards with pulsating badges, manual search & punch bar, and detailed shift logs |
| `/dashboard/revenue` | `app/dashboard/revenue/page.tsx` | Revenue Hub, income/expense tracking, payment modes (Cash, UPI, Split), PDF/CSV reports, charts, `showStoreInRevenue` toggle respect |
| `/dashboard/products` | `app/dashboard/products/page.tsx` | Store / POS catalog, inventory management, point-of-sale checkout, WhatsApp purchase receipts, sales history |
| `/dashboard/reminders` | `app/dashboard/reminders/page.tsx` | Due payments, overdue memberships, automated WhatsApp payment reminder triggers |
| `/dashboard/broadcast` | `app/dashboard/broadcast/page.tsx` | Bulk & selective WhatsApp broadcast messenger, audience filters (`All`, `Active`, `Due Soon`, `Overdue`, `Custom Member Selection`) |
| `/dashboard/settings` | `app/dashboard/settings/page.tsx` | Gym general info, WhatsApp bot controls, Attendance settings, Store/POS settings (`showStoreInRevenue`), custom WhatsApp templates editor, Master password |
| `/superadmin` | `app/superadmin/page.tsx` | Multi-gym tenant management, SaaS subscription control, gym onboarding |
| `/superadmin/login` | `app/superadmin/login/page.tsx` | Master Admin secure authentication |

---

## 3. 🗄️ Database Models & Schema Summary (`prisma/schema.prisma`)

- **`Gym`**: Multi-tenant gym entity (`id`, `name`, `phone`, `address`, `subStatus`, `subPlan`, `subValidTill`).
- **`Customer`**: Gym members (`id`, `gymId`, `memberId`, `name`, `phone`, `nfcCardId`, `nfcCardId2`, `fingerprintId`, `planType`, `feeAmount`, `pendingBalance`, `balanceDueDate`, `lastPaymentDate`, `nextDueDate`, `status`, `waActive`, `joinedDate`).
- **`Staff`**: Employees & trainers (`id`, `gymId`, `name`, `phone`, `role`, `nfcCardId`, `fingerprintId`, `status`, `joinedDate`).
- **`StaffAttendanceRecord`**: Employee shift punches (`id`, `gymId`, `staffId`, `staffName`, `staffPhone`, `checkInTime`, `checkOutTime`, `durationMinutes`, `dateStr`).
- **`AttendanceRecord`**: Member gym check-ins (`id`, `gymId`, `customerId`, `customerName`, `customerPhone`, `checkInTime`, `checkOutTime`, `durationMinutes`, `dateStr`).
- **`Transaction`**: Financial records (`id`, `gymId`, `type` [INCOME/EXPENSE], `amount`, `paidAmount`, `discountAmount`, `paymentMethod` [CASH/UPI/CARD/SPLIT], `splitDetails`, `category` [Membership Fee, Product Sale, Rent, Salary, Maintenance], `description`, `date`, `time`, `customerId`).
- **`Product`**: Store inventory (`id`, `gymId`, `name`, `category`, `price`, `costPrice`, `stock`, `unit`, `minStockAlert`).
- **`ProductSale`**: Store order history (`id`, `gymId`, `productId`, `productName`, `quantity`, `totalAmount`, `paymentMethod`, `splitDetails`, `customerId`, `customerName`, `date`, `time`).
- **`GymSettings`**: Gym configuration (`id`, `gymId`, `waAutoMessages`, `waAttendanceMessages`, `showStoreInRevenue`, `attendanceMode`, `templateCheckin`, `templateCheckout`, `templateReminder`, `templateStoreReceipt`, `templateWelcome`, etc.).
- **`SubscriptionPlan`**: Membership pricing packages (`id`, `gymId`, `name`, `durationMonths`, `price`, `description`).
- **`Announcement`**: Broadcast notice banner (`id`, `gymId`, `title`, `message`, `type`, `active`).

---

## 4. 🔌 Hardware & Scanner Integration Protocols

### A. USB Keyboard Wedge NFC Reader (Desktop / Global)
- **Location**: `app/dashboard/layout.tsx` (lines 89–185)
- **Mechanism**: Global `keydown` listener collects keystroke buffer (< 50ms interval). On `Enter` key (length > 3):
  1. Searches `findCustomerByNFC(gymId, buffer)`. If found, calls `toggleCheckIn(cust.id)` and shows toast.
  2. If not a customer, searches `findStaffByNFC(gymId, buffer)`. If found, calls `toggleStaffCheckIn(staff.id)` (Punches IN / OUT).
  3. If unassigned, dispatches `open_add_member` event or redirects to `/dashboard/members?new_nfc=...`.

### B. Web NFC API (Android Chrome / Mobile)
- **Location**: `app/dashboard/checkin/page.tsx`
- **Mechanism**: `window.NDEFReader()` scans serial number and triggers customer or staff check-in.

### C. Biometric Fingerprint Scanner (MFS100 / ZKTeco / eSSL)
- **Location**: `app/dashboard/checkin/page.tsx`
- **Mechanism**: WebSocket client connects to local Python driver bridge at `ws://localhost:8765`.
- **Payload**: Receives `{ type: 'scan', fingerprintId: '101' }` and triggers check-in for customer or staff.

---

## 5. ⚙️ Key Business Rules & Critical Invariants

1. **Date Standard**:
   - Always use `getLocalTodayDateString()` from `@/lib/utils` for all date comparisons and database date strings (`YYYY-MM-DD`).
   - Never use `new Date().toISOString().split('T')[0]` directly in components (prevents UTC+5:30 offset date shifting bugs between 12:00 AM and 5:30 AM).

2. **Configurable Auto-Checkout & Shift Cut-off Timers**:
   - Configured in **Settings > Attendance & Timers** (`GymSettings.memberCutoffHours` [default 4h] and `GymSettings.staffCutoffHours` [default 12h]).
   - **For Members**: If a member forgets to punch out and their check-in exceeds `memberCutoffHours`, the session auto-expires. Next tap is automatically logged as a fresh Check-In.
   - **For Staff**: If an employee or trainer forgets to punch out and their shift exceeds `staffCutoffHours`, the shift auto-closes. Next tap begins a new shift.
   - `getAttendance` and `getStaffAttendance` auto-expire orphan sessions in real-time so live counters are always accurate.
   - Durations are calculated in minutes and formatted as `Xh Ym`.

3. **Store Sales vs Revenue Hub Visibility (`showStoreInRevenue`)**:
   - Configured in **Settings > Store / POS** (`GymSettings.showStoreInRevenue`).
   - In `app/dashboard/revenue/page.tsx`, `effectiveTransactions` filters out `category === 'Product Sale'` when `showStoreInRevenue === false`.
   - Store sales always remain accessible in **Store > Sales History** (`app/dashboard/products/page.tsx`).

4. **WhatsApp Automation & Multi-Trigger Reminders**:
   - **Due & Subscription Reminders**: Auto-sent to members with `waActive: true` when membership expires within `waReminderWindowDays` (default 3 days) if `waAutoMessages === true`.
   - **Overdue Membership Reminders**: Auto-sent to members whose `nextDueDate < today` and have `waActive: true`.
   - **Absentee Follow-up Messages**: Auto-sent to members with `waActive: true` who haven't visited in `>= absentThresholdDays` if `absentTrackingEnabled === true`.
   - **Anti-Spam Daily Shield**: Uses `Customer.lastReminderSentDate` and `Customer.lastAbsenteeSentDate` to ensure no member receives duplicate automated reminders on the same day.
   - **Payment & Store Receipts**: Auto-dispatched on membership renewal and store checkout.
   - **Automated Engine**: Triggered via `processDailyAutomatedReminders(gymId)` and endpoint `/api/whatsapp/auto-reminders`.
   - Templates stored in `lib/templates.ts` and customizable in **Settings > Templates**.

5. **Member Card Interactions**:
   - Clicking anywhere on a member card in `/dashboard/members` opens the full profile drawer.
   - Action buttons inside cards (`Collect Due`, `WhatsApp`, `Delete`) use `e.stopPropagation()` to prevent unwanted drawer toggles.

6. **Check-In Notification Popups Position**:
   - **Member Check-Ins**: Displayed in the **Top Right Corner** (`globalNotification`).
   - **Staff Punches (Shift IN/OUT)**: Displayed in the **Bottom Right Corner** (`globalStaffNotification`, triggered via `staff_punch_event` or global USB NFC).

7. **Staff Data Uniqueness**:
   - Strict duplicate prevention for `phone`, `nfcCardId`, and `fingerprintId` enforced in both UI (`handleSaveStaff`) and backend database actions (`addStaff`, `updateStaff`).

8. **Real-time Attendance Sync**:
   - Both `toggleCheckIn` and `toggleStaffCheckIn` emit `attendance_updated` custom events.
   - `/dashboard/checkin` and `/dashboard/staffs` listen for updates and poll at 1.5s interval to ensure real-time UI synchronization across tabs without needing page refresh.

9. **Strict Hardware Attendance Mode Enforcement**:
   - When `GymSettings.attendanceMode` is set to `NFC`, `FINGERPRINT`, or `BOTH`, manual punch in/out buttons on staff status cards and team lists are hidden across `/dashboard/checkin` and `/dashboard/staffs`.
   - Punches are exclusively logged via NFC card scan or biometric fingerprint touch.
   - The Add/Edit Employee modal automatically filters and restricts punch method selectors to the active hardware mode.

10. **Staff Page Subpages Architecture (`app/dashboard/staffs/page.tsx`)**:
    - Segmented tab navigation dividing staff management into two dedicated subpages:
      - **Subpage 1: 👥 Team & Live Shifts**: KPI metrics (Total staff, On Duty Now with pulsating indicators, Today Punches, Avg Shift Duration), Active Staff Shift Status Grid (matching member card aesthetics with live minutes on duty), and Team Members Directory.
      - **Subpage 2: 📋 Attendance & Shift Logs**: Shift records table, search & filtering by employee and date presets (`All Time`, `Today`, `This Week`, `This Month`, `Custom Range`), cumulative shift hours calculator, and real-time auto-sync.

11. **Universal Dual Export Architecture (Both CSV & PDF)**:
    - Powered by reusable PDF engine `lib/exportPdf.ts` (`jsPDF` + `jspdf-autotable`) and CSV generator `exportToCSV` in `lib/utils.ts`.
    - Every download across the entire SaaS offers **both Download CSV and Download PDF**:
      1. **Staff Shift Logs & Filtered Attendance** (`/dashboard/staffs`): Bulk CSV & PDF with summary KPI boxes.
      2. **Staff Team Directory** (`/dashboard/staffs`): Employee contact, designation, and hardware ID list.
      3. **Individual Staff Shift Logs** (`/dashboard/staffs`): Shift-by-shift breakdown and cumulative hours worked.
      4. **Today's Member Visit Log** (`/dashboard/checkin`): Daily workout check-in/out records.
      5. **Today's Staff Shift Log** (`/dashboard/checkin`): Daily employee shift punches.
      6. **Member Directory & Filtered Lists** (`/dashboard/members`): Member contact, plans, fee, dues, and status.
      7. **Individual Member Profile & Activity** (`/dashboard/members`): Member info, payment transactions, and check-in history.
      8. **Revenue Hub & Financial Statements** (`/dashboard/revenue`): Income, expenses, net profit, and payment modes.
      9. **POS Store Sales History** (`/dashboard/products`): Itemized sales orders, products sold, and payment methods.
12. **Mobile Tab Hierarchy & Responsive Compact Layout**:
    - All tab switchers and navigation pills across the SaaS adhere to a compact, neat mobile standard:
      - **Mobile Bottom Navigation (`app/dashboard/layout.tsx`)**: Height `h-14`, compact `w-4 h-4` icons, `text-[9.5px]` labels, `no-scrollbar` smooth horizontal touch scrolling, active pill background `bg-blue-50 text-blue-900 border border-blue-200/60`.
      - **Check-in Terminal (`checkin/page.tsx`)**: Compact segmented switcher `py-1.5 px-2 sm:py-2.5 sm:px-4 text-[11px] sm:text-xs`, `w-3.5 h-3.5` icons, small count badge `text-[9.5px]`.
      - **Staff Management (`staffs/page.tsx`)**: Full-width mobile segmented switcher `py-1.5 px-2 sm:py-2 sm:px-3.5 text-[11px] sm:text-xs`.
      - **Settings Hub (`settings/page.tsx`)**: Compact scrollable tab strip `px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm`, `no-scrollbar` touch container.
      - **Store & POS (`products/page.tsx`)**: Compact store tabs `px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm`, category pills `px-2.5 py-1 text-[11px]`.
      - **Member Directory (`members/page.tsx`)**: Compact filter pills `px-2.5 py-1 text-[11px] sm:text-xs`, horizontal scroll with `gap-1.5`.
      - **Revenue Hub (`revenue/page.tsx`)**: Date & transaction filter pills `px-2.5 py-1 text-[11px] sm:text-xs`.
      - **WhatsApp Broadcast (`broadcast/page.tsx`)**: Target audience tabs `py-1.5 text-xs`.

---

## 6. 📂 Key Files Reference Map

- **Actions & Database Operations**: `lib/actions.ts`
- **Prisma Client Instance**: `lib/db.ts`
- **PDF Export Engine**: `lib/exportPdf.ts`
- **WhatsApp Web Service**: `lib/whatsapp.ts`
- **WhatsApp Templates**: `lib/templates.ts`
- **Type Definitions**: `lib/types.ts`
- **Date & CSV Utilities**: `lib/utils.ts`
- **Navigation & Global Scanner Layout**: `app/dashboard/layout.tsx`

---

## 7. 🔄 Automatic Memory Update Protocol (Strict Rule)

Whenever any change is made to the codebase (e.g. adding a setting, changing a route, updating a schema model, adding new hardware logic, or altering business rules):
1. **Always update `codebase_memory.md` immediately** after completing the change.
2. Ensure the Route Map, Database Models, and Business Rules reflect the latest implementation state.
3. This ensures all future assistant turns and developer sessions operate on 100% accurate, up-to-date architectural knowledge.
