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
  nfcCardId2?: string | null;
  fingerprintId?: string | null;
  planType: string;
  feeAmount: number;
  lastPaymentDate: string;
  nextDueDate: string;
  pendingBalance?: number;
  balanceDueDate?: string | null;
  status: 'active' | 'overdue' | 'due_soon';
  joinedDate: string;
  waActive?: boolean;
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
  time?: string | null; // HH:mm AM/PM
  paymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'SPLIT' | string;
  splitDetails?: string | null;
  upiId?: string | null;
  upiSenderName?: string | null;
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

export interface Product {
  id: string;
  gymId: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  active: boolean;
  createdAt: string;
}

export interface ProductSaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ProductSale {
  id: string;
  gymId: string;
  customerId?: string | null;
  customerName?: string | null;
  totalAmount: number;
  paymentMethod: string;
  splitDetails?: string | null;
  date: string;
  items?: ProductSaleItem[];
}

export interface GymSettings {
  gymId: string;
  gymName?: string;
  ownerName?: string;
  email?: string;
  ownerPhone?: string;
  upiId?: string | null;
  upiName?: string | null;
  address?: string | null;
  waConnected?: boolean;
  waAutoMessages?: boolean;
  waAttendanceMessages?: boolean;
  waAutoReply?: boolean;
  waAutoArchive?: boolean;
  waReminderWindowDays?: number;
  absentTrackingEnabled?: boolean;
  absentThresholdDays?: number;
  templateWelcome?: string;
  templateReceipt?: string;
  templateReminder?: string;
  templateAbsentee?: string;
  templateCheckIn?: string;
  templateCheckOut?: string;
  // Feature toggles
  productsEnabled?: boolean;
  // Attendance hardware: MANUAL | NFC | FINGERPRINT | BOTH
  attendanceMode?: string;
  fingerprintAgentPort?: number;
}
