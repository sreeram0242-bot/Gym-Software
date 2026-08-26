export interface Gym {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  userId: string;
  passwordHash: string;
  status: 'active' | 'suspended';
  createdAt: string;
  memberCount?: number;
}

export interface Customer {
  id: string;
  gymId: string;
  name: string;
  phone: string;
  nfcCardId: string;
  planType: string;
  feeAmount: number;
  lastPaymentDate: string;
  nextDueDate: string;
  pendingBalance?: number;
  balanceDueDate?: string | null;
  status: 'active' | 'overdue' | 'due_soon';
  joinedDate: string;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  gymId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  checkInTime: string; // ISO string
  checkOutTime?: string; // ISO string
  durationMinutes?: number;
  dateStr: string; // YYYY-MM-DD
}

export interface Transaction {
  id: string;
  gymId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  paymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'SPLIT' | string;
  splitDetails?: string | null;
  paidAmount?: number | null;
  discountAmount?: number;
  customerId?: string;
  customerName?: string;
}

export interface SystemStats {
  totalGyms: number;
  activeGyms: number;
  totalMembers: number;
  monthlyRevenue: number;
}

export interface SubscriptionPlan {
  id: string;
  gymId: string;
  name: string;
  durationMonths: number;
  price: number;
}
