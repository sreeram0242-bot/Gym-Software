import { Gym, Customer, AttendanceRecord, Transaction } from './types';

const INITIAL_GYMS: Gym[] = [
  {
    id: 'gym_1',
    name: 'Olympus Power Gym',
    ownerName: 'Rahul Sharma',
    email: 'rahul@olympusgym.com',
    phone: '+91 98765 43210',
    userId: 'gym_olympus',
    passwordHash: 'pass1234',
    status: 'active',
    createdAt: '2026-01-15',
    memberCount: 42
  },
  {
    id: 'gym_2',
    name: 'Iron Paradise Fitness',
    ownerName: 'Vikram Singh',
    email: 'vikram@ironparadise.com',
    phone: '+91 98123 76543',
    userId: 'gym_iron',
    passwordHash: 'fitpass88',
    status: 'active',
    createdAt: '2026-03-10',
    memberCount: 28
  },
  {
    id: 'gym_3',
    name: 'Flex & Fit Studio',
    ownerName: 'Priya Mehta',
    email: 'priya@flexfit.com',
    phone: '+91 99001 12233',
    userId: 'gym_flex',
    passwordHash: 'flex9988',
    status: 'active',
    createdAt: '2026-05-20',
    memberCount: 35
  }
];

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust_today_1',
    gymId: 'gym_1',
    name: 'Today Member',
    phone: '9800000001',
    nfcCardId: 'NFC-TODAY',
    planType: 'Monthly',
    feeAmount: 2500,
    lastPaymentDate: '2026-08-01',
    nextDueDate: '2026-09-01',
    status: 'active',
    joinedDate: '2026-08-01'
  },
  {
    id: 'cust_week_1',
    gymId: 'gym_1',
    name: 'This Week Member',
    phone: '9800000002',
    nfcCardId: 'NFC-WEEK',
    planType: 'Quarterly',
    feeAmount: 6500,
    lastPaymentDate: '2026-07-30',
    nextDueDate: '2026-10-30',
    status: 'active',
    joinedDate: '2026-07-30'
  },
  {
    id: 'cust_month_1',
    gymId: 'gym_1',
    name: 'This Month Member',
    phone: '9800000003',
    nfcCardId: 'NFC-MONTH',
    planType: 'Annual',
    feeAmount: 20000,
    lastPaymentDate: '2026-08-10',
    nextDueDate: '2027-08-10',
    status: 'active',
    joinedDate: '2026-08-10' // Pretend they join later this month
  },
  {
    id: 'cust_old_1',
    gymId: 'gym_1',
    name: 'Old Member',
    phone: '9800000004',
    nfcCardId: 'NFC-OLD',
    planType: 'Half-Yearly',
    feeAmount: 11500,
    lastPaymentDate: '2025-12-01',
    nextDueDate: '2026-06-01',
    status: 'overdue',
    joinedDate: '2025-12-01'
  }
];

const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  {
    id: 'att_1',
    gymId: 'gym_1',
    customerId: 'cust_today_1',
    customerName: 'Today Member',
    customerPhone: '9800000001',
    checkInTime: '2026-08-01T07:15:00.000Z',
    dateStr: '2026-08-01'
  }
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx_today_1',
    gymId: 'gym_1',
    type: 'INCOME',
    amount: 2500,
    category: 'Membership Fee',
    description: 'Today Member Joined',
    date: '2026-08-01',
    customerId: 'cust_today_1',
    customerName: 'Today Member'
  },
  {
    id: 'tx_today_2',
    gymId: 'gym_1',
    type: 'EXPENSE',
    amount: 1000,
    category: 'Maintenance',
    description: 'Fixed broken mirror',
    date: '2026-08-01'
  },
  {
    id: 'tx_week_1',
    gymId: 'gym_1',
    type: 'INCOME',
    amount: 6500,
    category: 'Membership Fee',
    description: 'This Week Member Joined',
    date: '2026-07-30',
    customerId: 'cust_week_1',
    customerName: 'This Week Member'
  },
  {
    id: 'tx_month_1',
    gymId: 'gym_1',
    type: 'INCOME',
    amount: 20000,
    category: 'Membership Fee',
    description: 'This Month Member Joined',
    date: '2026-08-10',
    customerId: 'cust_month_1',
    customerName: 'This Month Member'
  },
  {
    id: 'tx_month_2',
    gymId: 'gym_1',
    type: 'EXPENSE',
    amount: 5000,
    category: 'Rent',
    description: 'Partial Rent Payment',
    date: '2026-08-12'
  },
  {
    id: 'tx_old_1',
    gymId: 'gym_1',
    type: 'INCOME',
    amount: 11500,
    category: 'Membership Fee',
    description: 'Old Member Joined',
    date: '2025-12-01',
    customerId: 'cust_old_1',
    customerName: 'Old Member'
  }
];

export class AppStore {
  private static getStorage<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  }

  private static setStorage<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage save error:', e);
    }
  }

  // --- GYMS ---
  static getGyms(): Gym[] {
    return this.getStorage<Gym[]>('gyms_data_v2', INITIAL_GYMS);
  }

  static addGym(gym: Omit<Gym, 'id' | 'createdAt' | 'status'>): Gym {
    const gyms = this.getGyms();
    const newGym: Gym = {
      ...gym,
      id: `gym_${Date.now()}`,
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
      memberCount: 0
    };
    gyms.unshift(newGym);
    this.setStorage('gyms_data_v2', gyms);
    return newGym;
  }

  static toggleGymStatus(gymId: string): Gym[] {
    const gyms = this.getGyms().map(g => {
      if (g.id === gymId) {
        return { ...g, status: g.status === 'active' ? 'suspended' : 'active' } as Gym;
      }
      return g;
    });
    this.setStorage('gyms_data_v2', gyms);
    return gyms;
  }

  // --- CUSTOMERS ---
  static getCustomers(gymId?: string): Customer[] {
    const all = this.getStorage<Customer[]>('customers_data_v2', INITIAL_CUSTOMERS);
    if (gymId) return all.filter(c => c.gymId === gymId);
    return all;
  }

  static addCustomer(customer: Omit<Customer, 'id' | 'joinedDate' | 'status'>): Customer {
    const customers = this.getCustomers();
    const newCustomer: Customer = {
      ...customer,
      id: `cust_${Date.now()}`,
      joinedDate: new Date().toISOString().split('T')[0],
      status: 'active'
    };
    customers.unshift(newCustomer);
    this.setStorage('customers_data_v2', customers);

    // Record Income Transaction
    this.addTransaction({
      gymId: customer.gymId,
      type: 'INCOME',
      amount: customer.feeAmount,
      category: 'Membership Fee',
      description: `New Joiner: ${customer.name} (${customer.planType})`,
      date: new Date().toISOString().split('T')[0],
      customerId: newCustomer.id,
      customerName: newCustomer.name
    });

    return newCustomer;
  }

  static findCustomerByPhone(phone: string): Customer | undefined {
    const cleanPhone = phone.replace(/\D/g, '');
    const customers = this.getCustomers();
    return customers.find(c => c.phone.replace(/\D/g, '').includes(cleanPhone));
  }

  static findCustomerByNFC(nfcId: string): Customer | undefined {
    const customers = this.getCustomers();
    return customers.find(c => c.nfcCardId.toLowerCase() === nfcId.toLowerCase());
  }

  static updateCustomer(id: string, data: Partial<Customer>): Customer | undefined {
    const customers = this.getCustomers();
    let updated: Customer | undefined;
    const newList = customers.map(c => {
      if (c.id === id) {
        updated = { ...c, ...data };
        return updated;
      }
      return c;
    });
    this.setStorage('customers_data_v2', newList);
    return updated;
  }

  static deleteCustomer(id: string): boolean {
    const customers = this.getCustomers();
    const filtered = customers.filter(c => c.id !== id);
    if (filtered.length !== customers.length) {
      this.setStorage('customers_data_v2', filtered);
      return true;
    }
    return false;
  }

  static renewMemberPayment(customerId: string, addedMonths: number, amount: number): Customer | undefined {
    const customers = this.getCustomers();
    let updatedCust: Customer | undefined;
    const today = new Date().toISOString().split('T')[0];

    const updatedList = customers.map(c => {
      if (c.id === customerId) {
        const currentDue = new Date(c.nextDueDate > today ? c.nextDueDate : today);
        currentDue.setMonth(currentDue.getMonth() + addedMonths);
        const newDueDate = currentDue.toISOString().split('T')[0];

        updatedCust = {
          ...c,
          lastPaymentDate: today,
          nextDueDate: newDueDate,
          status: 'active'
        };
        return updatedCust;
      }
      return c;
    });

    this.setStorage('customers_data_v2', updatedList);

    if (updatedCust) {
      this.addTransaction({
        gymId: updatedCust.gymId,
        type: 'INCOME',
        amount,
        category: 'Membership Fee Renewal',
        description: `Fee Renewal for ${updatedCust.name} (+${addedMonths} Month/s)`,
        date: today,
        customerId: updatedCust.id,
        customerName: updatedCust.name
      });
    }

    return updatedCust;
  }

  // --- ATTENDANCE ---
  static getAttendance(gymId?: string): AttendanceRecord[] {
    const all = this.getStorage<AttendanceRecord[]>('attendance_data_v2', INITIAL_ATTENDANCE);
    if (gymId) return all.filter(a => a.gymId === gymId);
    return all;
  }

  static toggleCheckIn(customer: Customer): { record: AttendanceRecord; action: 'checkin' | 'checkout' } {
    const attendance = this.getAttendance();
    const todayStr = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    // Check if customer is currently checked in without a checkout time today
    const activeSession = attendance.find(a => a.customerId === customer.id && !a.checkOutTime && a.dateStr === todayStr);

    if (activeSession) {
      // Check Out
      const checkInTime = new Date(activeSession.checkInTime);
      const checkOutTime = new Date(nowIso);
      const diffMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));

      const updated = attendance.map(a => {
        if (a.id === activeSession.id) {
          return {
            ...a,
            checkOutTime: nowIso,
            durationMinutes: diffMinutes > 0 ? diffMinutes : 1
          };
        }
        return a;
      });

      this.setStorage('attendance_data_v2', updated);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('attendance_updated'));
      const completed = updated.find(a => a.id === activeSession.id)!;
      return { record: completed, action: 'checkout' };
    } else {
      // Check In
      const newRecord: AttendanceRecord = {
        id: `att_${Date.now()}`,
        gymId: customer.gymId,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        checkInTime: nowIso,
        dateStr: todayStr
      };

      attendance.unshift(newRecord);
      this.setStorage('attendance_data_v2', attendance);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('attendance_updated'));
      return { record: newRecord, action: 'checkin' };
    }
  }

  static getMemberMonthlyAvgHours(customerId: string): number {
    const attendance = this.getAttendance().filter(a => a.customerId === customerId && a.durationMinutes);
    if (attendance.length === 0) return 1.2; // default avg fallback for demo

    const totalMinutes = attendance.reduce((acc, cur) => acc + (cur.durationMinutes || 0), 0);
    const totalHours = totalMinutes / 60;
    const avg = totalHours / Math.max(1, attendance.length);
    return parseFloat(avg.toFixed(1));
  }

  // --- TRANSACTIONS & EXPENSES ---
  static getTransactions(gymId?: string): Transaction[] {
    const all = this.getStorage<Transaction[]>('transactions_data_v2', INITIAL_TRANSACTIONS);
    if (gymId) return all.filter(t => t.gymId === gymId);
    return all;
  }

  static addTransaction(tx: Omit<Transaction, 'id'>): Transaction {
    const transactions = this.getTransactions();
    const newTx: Transaction = {
      ...tx,
      id: `tx_${Date.now()}`
    };
    transactions.unshift(newTx);
    this.setStorage('transactions_data_v2', transactions);
    return newTx;
  }
}
