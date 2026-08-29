'use server';

import prisma from './db';
import { getLocalTodayDateString, formatDateDDMMYYYY } from './utils';
import { getTemplate, compileTemplate } from './templates';
import { WhatsAppManager } from './whatsapp';

// Global in-memory fallback store for offline development and testing
const globalAny: any = global;

if (!globalAny.mockStore) {
  const today = getLocalTodayDateString();
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthStr = nextMonth.toISOString().split('T')[0];

  globalAny.mockStore = {
    gyms: [
      {
        id: 'gym_1',
        name: 'Iron Pulse Fitness',
        ownerName: 'Sreeram',
        email: 'sree@gymflow.io',
        phone: '9876543210',
        userId: 'sree',
        passwordHash: 'sree',
        status: 'active',
        createdAt: today,
        memberCount: 3
      },
      {
        id: 'gym_2',
        name: 'Titan Core Gym',
        ownerName: 'Admin',
        email: 'admin@gymflow.io',
        phone: '9988776655',
        userId: 'admin',
        passwordHash: 'admin',
        status: 'active',
        createdAt: today,
        memberCount: 1
      }
    ],
    customers: [
      {
        id: 'cust_1',
        gymId: 'gym_1',
        name: 'Suresh Kumar',
        phone: '919876543210',
        nfcCardId: 'NFC-101',
        fingerprintId: null,
        planType: 'Standard Plan',
        feeAmount: 2500,
        pendingBalance: 1000,
        balanceDueDate: nextMonthStr,
        lastPaymentDate: today,
        nextDueDate: nextMonthStr,
        status: 'active',
        joinedDate: today
      },
      {
        id: 'cust_2',
        gymId: 'gym_1',
        name: 'Priya Sharma',
        phone: '919876543211',
        nfcCardId: 'NFC-102',
        fingerprintId: null,
        planType: 'VIP Plan',
        feeAmount: 4500,
        pendingBalance: 0,
        balanceDueDate: null,
        lastPaymentDate: today,
        nextDueDate: nextMonthStr,
        status: 'active',
        joinedDate: today
      },
      {
        id: 'cust_3',
        gymId: 'gym_1',
        name: 'Rahul Verma',
        phone: '919876543212',
        nfcCardId: 'NFC-103',
        fingerprintId: null,
        planType: 'Standard Plan',
        feeAmount: 2500,
        pendingBalance: 0,
        balanceDueDate: null,
        lastPaymentDate: today,
        nextDueDate: nextMonthStr,
        status: 'active',
        joinedDate: today
      }
    ],
    plans: [
      { id: 'plan_1', gymId: 'gym_1', name: 'Standard Plan', durationMonths: 1, price: 2500 },
      { id: 'plan_2', gymId: 'gym_1', name: 'VIP Plan', durationMonths: 3, price: 4500 },
      { id: 'plan_3', gymId: 'gym_1', name: 'Annual Beast', durationMonths: 12, price: 18000 }
    ],
    transactions: [
      {
        id: 'tx_1',
        gymId: 'gym_1',
        type: 'INCOME',
        amount: 1500,
        paidAmount: 1500,
        discountAmount: 0,
        paymentMethod: 'UPI',
        splitDetails: null,
        category: 'Membership Fee',
        description: 'New Joiner: Suresh Kumar (Standard Plan) [₹1000 Due]',
        date: today,
        customerId: 'cust_1',
        customerName: 'Suresh Kumar'
      },
      {
        id: 'tx_2',
        gymId: 'gym_1',
        type: 'INCOME',
        amount: 4500,
        paidAmount: 4500,
        discountAmount: 0,
        paymentMethod: 'CARD',
        splitDetails: null,
        category: 'Membership Fee',
        description: 'New Joiner: Priya Sharma (VIP Plan)',
        date: today,
        customerId: 'cust_2',
        customerName: 'Priya Sharma'
      },
      {
        id: 'tx_3',
        gymId: 'gym_1',
        type: 'EXPENSE',
        amount: 5000,
        paidAmount: 5000,
        discountAmount: 0,
        paymentMethod: 'CASH',
        splitDetails: null,
        category: 'Rent',
        description: 'Premises Floor Rent',
        date: today,
        customerId: null,
        customerName: null
      }
    ],
    settings: {
      gym_1: {
        gymId: 'gym_1',
        gymName: 'Iron Pulse Fitness',
        ownerPhone: '9876543210',
        upiId: 'ironpulse@upi',
        waConnected: false,
        waAutoMessages: true,
        waAutoReply: true,
        waAttendanceMessages: true,
        waAutoArchive: false,
        waReminderWindowDays: 3,
        absentTrackingEnabled: false,
        absentThresholdDays: 3,
        productsEnabled: false,
        attendanceMode: 'NFC',
        fingerprintAgentPort: 8765
      }
    },
    attendance: [
      {
        id: 'att_1',
        gymId: 'gym_1',
        customerId: 'cust_1',
        customerName: 'Suresh Kumar',
        customerPhone: '919876543210',
        checkInTime: new Date(Date.now() - 3600000).toISOString(),
        checkOutTime: new Date().toISOString(),
        durationMinutes: 60,
        dateStr: today
      }
    ],
    announcements: [
      {
        id: 'ann_1',
        title: 'GymFlow Payments & Dues Upgrade Live!',
        message: 'You can now collect partial payments, track pending balances, and record split payments!',
        type: 'INFO',
        active: true,
        createdAt: today
      }
    ],
    products: [
      {
        id: 'prod_1',
        gymId: 'gym_1',
        name: 'Whey Protein (1kg)',
        category: 'Supplement',
        price: 1800,
        stock: 10,
        unit: 'unit',
        active: true,
        createdAt: today
      },
      {
        id: 'prod_2',
        gymId: 'gym_1',
        name: 'Creatine Monohydrate (250g)',
        category: 'Supplement',
        price: 650,
        stock: 15,
        unit: 'unit',
        active: true,
        createdAt: today
      },
      {
        id: 'prod_3',
        gymId: 'gym_1',
        name: 'Gym Gloves',
        category: 'Accessories',
        price: 350,
        stock: 20,
        unit: 'unit',
        active: true,
        createdAt: today
      }
    ],
    productSales: []
  };
}

const store = globalAny.mockStore;

// --- SETTINGS ---
export async function getGymSettings(gymId: string) {
  try {
    const [gym, settings] = await Promise.all([
      prisma.gym.findUnique({ where: { id: gymId } }),
      prisma.gymSettings.findUnique({ where: { gymId } })
    ]);

    let resolvedSettings = settings;
    if (!resolvedSettings) {
      resolvedSettings = await prisma.gymSettings.create({ data: { gymId } });
    }

    return {
      ...resolvedSettings,
      gymId,
      gymName: gym?.name || 'Our Gym',
      ownerName: gym?.ownerName || '',
      ownerPhone: gym?.phone || '',
      email: gym?.email || '',
      upiId: resolvedSettings?.upiId || '',
      upiName: resolvedSettings?.upiName || '',
      address: resolvedSettings?.address || ''
    };
  } catch (e) {
    if (!store.settings[gymId]) {
      store.settings[gymId] = {
        gymId,
        gymName: 'Iron Pulse Fitness',
        ownerName: 'Admin',
        ownerPhone: '9876543210',
        email: 'admin@gymflow.io',
        upiId: 'ironpulse@upi',
        upiName: 'Iron Pulse Fitness',
        address: 'Main Road, City',
        waConnected: false,
        waAutoMessages: true,
        waAutoReply: true,
        waAttendanceMessages: true,
        waAutoArchive: false,
        waReminderWindowDays: 3,
        absentTrackingEnabled: false,
        absentThresholdDays: 3,
        productsEnabled: false,
        showStoreInRevenue: true,
        attendanceMode: 'NFC',
        fingerprintAgentPort: 8765
      };
    }
    return store.settings[gymId];
  }
}

export async function updateGymSettings(gymId: string, data: any) {
  try {
    const gymUpdate: any = {};
    if (data.gymName !== undefined) gymUpdate.name = data.gymName;
    if (data.ownerName !== undefined) gymUpdate.ownerName = data.ownerName;
    if (data.ownerPhone !== undefined) gymUpdate.phone = data.ownerPhone;
    if (data.email !== undefined) gymUpdate.email = data.email;

    if (Object.keys(gymUpdate).length > 0) {
      await prisma.gym.update({
        where: { id: gymId },
        data: gymUpdate
      });
    }

    // Filter out gym-only fields before sending to gymSettings
    const { gymName, ownerName, ownerPhone, email, ...settingsData } = data;

    const updatedSettings = await prisma.gymSettings.upsert({
      where: { gymId },
      update: settingsData,
      create: { gymId, ...settingsData }
    });

    const gym = await prisma.gym.findUnique({ where: { id: gymId } });

    return {
      ...updatedSettings,
      gymId,
      gymName: gym?.name || data.gymName,
      ownerName: gym?.ownerName || data.ownerName,
      ownerPhone: gym?.phone || data.ownerPhone,
      email: gym?.email || data.email
    };
  } catch (e) {
    store.settings[gymId] = { ...(store.settings[gymId] || {}), ...data, gymId };
    return store.settings[gymId];
  }
}

// --- GYMS ---
export async function getGyms() {
  try {
    return await prisma.gym.findMany({ orderBy: { createdAt: 'desc' } });
  } catch (e) {
    return store.gyms;
  }
}

export async function addGym(gym: any) {
  try {
    return await prisma.gym.create({
      data: {
        name: gym.name,
        ownerName: gym.ownerName,
        email: gym.email,
        phone: gym.phone,
        userId: gym.userId,
        passwordHash: gym.passwordHash,
        status: 'active',
        createdAt: getLocalTodayDateString(),
        memberCount: 0
      }
    });
  } catch (e) {
    const newGym = {
      id: `gym_${Date.now()}`,
      name: gym.name,
      ownerName: gym.ownerName,
      email: gym.email,
      phone: gym.phone,
      userId: gym.userId,
      passwordHash: gym.passwordHash,
      status: 'active',
      createdAt: getLocalTodayDateString(),
      memberCount: 0
    };
    store.gyms.unshift(newGym);
    return newGym;
  }
}

export async function toggleGymStatus(gymId: string) {
  try {
    const gym = await prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) return null;
    return await prisma.gym.update({
      where: { id: gymId },
      data: { status: gym.status === 'active' ? 'suspended' : 'active' }
    });
  } catch (e) {
    const gym = store.gyms.find((g: any) => g.id === gymId);
    if (gym) {
      gym.status = gym.status === 'active' ? 'suspended' : 'active';
      return gym;
    }
    return null;
  }
}

export async function changeGymPassword(gymId: string, currentPassword: string, newPassword: string) {
  try {
    const gym = await prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) return { success: false, error: 'Gym not found' };
    if (gym.passwordHash !== currentPassword) return { success: false, error: 'Current password is incorrect' };
    await prisma.gym.update({ where: { id: gymId }, data: { passwordHash: newPassword } });
    return { success: true };
  } catch (e) {
    const gym = store.gyms.find((g: any) => g.id === gymId);
    if (!gym) return { success: false, error: 'Gym not found' };
    if (gym.passwordHash !== currentPassword) return { success: false, error: 'Current password is incorrect' };
    gym.passwordHash = newPassword;
    return { success: true };
  }
}

// --- CUSTOMERS ---
export async function getCustomers(gymId?: string) {
  try {
    if (!gymId) return await prisma.customer.findMany({ orderBy: { joinedDate: 'desc' } });
    return await prisma.customer.findMany({
      where: { gymId },
      orderBy: { joinedDate: 'desc' }
    });
  } catch (e) {
    if (!gymId) return store.customers;
    return store.customers.filter((c: any) => c.gymId === gymId);
  }
}

export async function addCustomer(data: any) {
  const paidAmount = data.paidAmount !== undefined ? Number(data.paidAmount) : Number(data.feeAmount);
  const pendingBalance = data.pendingBalance !== undefined ? Number(data.pendingBalance) : 0;
  const discountAmount = data.discountAmount !== undefined ? Number(data.discountAmount) : 0;
  const paymentMethod = data.paymentMethod || 'CASH';
  const splitDetails = data.splitDetails ? (typeof data.splitDetails === 'string' ? data.splitDetails : JSON.stringify(data.splitDetails)) : null;

  const waActive = false; // Only activates when member sends 'start' to WhatsApp bot

  const memberId = data.memberId || ('M-' + Math.floor(1000 + Math.random() * 9000).toString());

  try {
    const newCust = await prisma.customer.create({
      data: {
        memberId: memberId,
        gymId: data.gymId,
        name: data.name,
        phone: data.phone,
        nfcCardId: data.nfcCardId,
        nfcCardId2: data.nfcCardId2 || null,
        fingerprintId: data.fingerprintId || null,
        planType: data.planType,
        feeAmount: data.feeAmount,
        pendingBalance: pendingBalance,
        balanceDueDate: data.balanceDueDate || null,
        lastPaymentDate: data.lastPaymentDate,
        nextDueDate: data.nextDueDate,
        status: 'active',
        waActive: false,
        joinedDate: getLocalTodayDateString()
      }
    });

    if (paidAmount > 0) {
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      await prisma.transaction.create({
        data: {
          gymId: newCust.gymId,
          type: 'INCOME',
          amount: paidAmount,
          paidAmount: paidAmount,
          discountAmount: discountAmount,
          paymentMethod: paymentMethod,
          splitDetails: splitDetails,
          upiId: data.upiId || null,
          upiSenderName: data.upiSenderName || null,
          category: 'Membership Fee',
          description: `New Joiner: ${newCust.name} (${newCust.planType})${pendingBalance > 0 ? ` [₹${pendingBalance} Due]` : ''}${discountAmount > 0 ? ` [₹${discountAmount} Disc]` : ''}`,
          date: newCust.joinedDate,
          time: nowTime,
          customerId: newCust.id,
          customerName: newCust.name
        }
      });
    }

    return newCust;
  } catch (e) {
    const newCust = {
      id: `cust_${Date.now()}`,
      gymId: data.gymId,
      name: data.name,
      phone: data.phone,
      nfcCardId: data.nfcCardId,
      nfcCardId2: data.nfcCardId2 || null,
      fingerprintId: data.fingerprintId || null,
      planType: data.planType,
      feeAmount: data.feeAmount,
      pendingBalance: pendingBalance,
      balanceDueDate: data.balanceDueDate || null,
      lastPaymentDate: data.lastPaymentDate,
      nextDueDate: data.nextDueDate,
      status: 'active',
      waActive: false,
      joinedDate: getLocalTodayDateString()
    };
    store.customers.unshift(newCust);

    if (paidAmount > 0) {
      store.transactions.unshift({
        id: `tx_${Date.now()}`,
        gymId: newCust.gymId,
        type: 'INCOME',
        amount: paidAmount,
        paidAmount: paidAmount,
        discountAmount: discountAmount,
        paymentMethod: paymentMethod,
        splitDetails: splitDetails,
        category: 'Membership Fee',
        description: `New Joiner: ${newCust.name} (${newCust.planType})${pendingBalance > 0 ? ` [₹${pendingBalance} Due]` : ''}${discountAmount > 0 ? ` [₹${discountAmount} Disc]` : ''}`,
        date: newCust.joinedDate,
        customerId: newCust.id,
        customerName: newCust.name
      });
    }
    return newCust;
  }
}

export async function findCustomerByPhone(phone: string, gymId?: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  const customers = await getCustomers(gymId);
  return customers.find((c: any) => c.phone.replace(/\D/g, '').includes(cleanPhone));
}

export async function findCustomerByNFC(gymId: string, nfcId: string) {
  const cleanId = nfcId.trim().toLowerCase();
  const customers = await getCustomers(gymId);
  return customers.find((c: any) => 
    (c.nfcCardId && c.nfcCardId.toLowerCase() === cleanId) ||
    (c.nfcCardId2 && c.nfcCardId2.toLowerCase() === cleanId)
  );
}

export async function findCustomerByFingerprint(gymId: string, fingerprintId: string) {
  const customers = await getCustomers(gymId);
  return customers.find((c: any) => c.fingerprintId && c.fingerprintId.toLowerCase() === fingerprintId.toLowerCase());
}

export async function findStaffByNFC(gymId: string, nfcId: string) {
  const cleanId = nfcId.trim().toLowerCase();
  const staffs = await getStaffs(gymId);
  return staffs.find((s: any) => s.nfcCardId && s.nfcCardId.toLowerCase() === cleanId);
}

export async function findStaffByFingerprint(gymId: string, fingerprintId: string) {
  const staffs = await getStaffs(gymId);
  return staffs.find((s: any) => s.fingerprintId && s.fingerprintId.toLowerCase() === fingerprintId.toLowerCase());
}

export async function updateCustomer(id: string, data: any) {
  try {
    return await prisma.customer.update({
      where: { id },
      data
    });
  } catch (e) {
    const idx = store.customers.findIndex((c: any) => c.id === id);
    if (idx !== -1) {
      store.customers[idx] = { ...store.customers[idx], ...data };
      return store.customers[idx];
    }
    return null;
  }
}

export async function toggleCustomerWaStatus(id: string, waActive: boolean) {
  try {
    return await prisma.customer.update({
      where: { id },
      data: { waActive }
    });
  } catch (e) {
    const idx = store.customers.findIndex((c: any) => c.id === id);
    if (idx !== -1) {
      store.customers[idx].waActive = waActive;
      return store.customers[idx];
    }
    return null;
  }
}

export async function deleteCustomer(id: string) {
  try {
    await prisma.customer.delete({ where: { id } });
    return true;
  } catch {
    const idx = store.customers.findIndex((c: any) => c.id === id);
    if (idx !== -1) {
      store.customers.splice(idx, 1);
      return true;
    }
    return false;
  }
}

export async function renewMemberPayment(
  customerId: string,
  addedMonths: number = 1,
  totalAmount: number = 2500,
  paidAmount?: number,
  paymentMethod: string = 'CASH',
  splitDetails?: any,
  pendingBalance: number = 0,
  balanceDueDate?: string | null,
  discountAmount: number = 0
) {
  let c: any;
  try {
    c = await prisma.customer.findUnique({ where: { id: customerId } });
  } catch (e) {
    c = store.customers.find((cust: any) => cust.id === customerId);
  }
  if (!c) return undefined;

  const actualPaid = paidAmount !== undefined ? Number(paidAmount) : Number(totalAmount);
  const formattedSplit = splitDetails ? (typeof splitDetails === 'string' ? splitDetails : JSON.stringify(splitDetails)) : null;

  const today = getLocalTodayDateString();
  const baseDateStr = c.nextDueDate > today ? c.nextDueDate : today;
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const targetDate = new Date(y, (m - 1) + addedMonths, d);
  const newDueDate = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

  try {
    const updatedCust = await prisma.customer.update({
      where: { id: customerId },
      data: {
        lastPaymentDate: today,
        nextDueDate: newDueDate,
        pendingBalance: pendingBalance,
        balanceDueDate: balanceDueDate || null,
        status: 'active'
      }
    });

    if (actualPaid > 0) {
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      await prisma.transaction.create({
        data: {
          gymId: updatedCust.gymId,
          type: 'INCOME',
          amount: actualPaid,
          paidAmount: actualPaid,
          discountAmount: discountAmount,
          paymentMethod: paymentMethod,
          splitDetails: formattedSplit,
          upiId: (splitDetails as any)?.upiId || null,
          upiSenderName: (splitDetails as any)?.upiSenderName || null,
          category: 'Membership Fee Renewal',
          description: `Fee Renewal for ${updatedCust.name} (+${addedMonths} Mo)${pendingBalance > 0 ? ` [₹${pendingBalance} Due]` : ''}${discountAmount > 0 ? ` [₹${discountAmount} Disc]` : ''}`,
          date: today,
          time: nowTime,
          customerId: updatedCust.id,
          customerName: updatedCust.name
        }
      });
    }

    return updatedCust;
  } catch (e) {
    c.lastPaymentDate = today;
    c.nextDueDate = newDueDate;
    c.pendingBalance = pendingBalance;
    c.balanceDueDate = balanceDueDate || null;
    c.status = 'active';

    if (actualPaid > 0) {
      store.transactions.unshift({
        id: `tx_${Date.now()}`,
        gymId: c.gymId,
        type: 'INCOME',
        amount: actualPaid,
        paidAmount: actualPaid,
        discountAmount: discountAmount,
        paymentMethod: paymentMethod,
        splitDetails: formattedSplit,
        category: 'Membership Fee Renewal',
        description: `Fee Renewal for ${c.name} (+${addedMonths} Mo)${pendingBalance > 0 ? ` [₹${pendingBalance} Due]` : ''}${discountAmount > 0 ? ` [₹${discountAmount} Disc]` : ''}`,
        date: today,
        customerId: c.id,
        customerName: c.name
      });
    }
    return c;
  }
}

export async function collectPendingBalance(
  customerId: string,
  amountToCollect: number,
  paymentMethod: string = 'CASH',
  splitDetails?: any,
  discountAmount: number = 0
) {
  let c: any;
  try {
    c = await prisma.customer.findUnique({ where: { id: customerId } });
  } catch (e) {
    c = store.customers.find((cust: any) => cust.id === customerId);
  }
  if (!c) throw new Error('Customer not found');

  const newBalance = Math.max(0, (c.pendingBalance || 0) - amountToCollect - discountAmount);
  const today = getLocalTodayDateString();
  const formattedSplit = splitDetails ? (typeof splitDetails === 'string' ? splitDetails : JSON.stringify(splitDetails)) : null;

  try {
    const updatedCust = await prisma.customer.update({
      where: { id: customerId },
      data: {
        pendingBalance: newBalance,
        balanceDueDate: newBalance === 0 ? null : c.balanceDueDate
      }
    });

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    await prisma.transaction.create({
      data: {
        gymId: updatedCust.gymId,
        type: 'INCOME',
        amount: amountToCollect + discountAmount,
        paidAmount: amountToCollect,
        discountAmount: discountAmount,
        paymentMethod: paymentMethod,
        splitDetails: formattedSplit,
        upiId: (splitDetails as any)?.upiId || null,
        upiSenderName: (splitDetails as any)?.upiSenderName || null,
        category: 'Pending Balance Collection',
        description: `Balance Clearance for ${updatedCust.name} (${newBalance === 0 ? 'Fully Cleared' : `₹${newBalance} Still Remaining`})${discountAmount > 0 ? ` [₹${discountAmount} Discounted]` : ''}`,
        date: today,
        time: nowTime,
        customerId: updatedCust.id,
        customerName: updatedCust.name
      }
    });

    return updatedCust;
  } catch (e) {
    c.pendingBalance = newBalance;
    if (newBalance === 0) c.balanceDueDate = null;

    store.transactions.unshift({
      id: `tx_${Date.now()}`,
      gymId: c.gymId,
      type: 'INCOME',
      amount: amountToCollect + discountAmount,
      paidAmount: amountToCollect,
      discountAmount: discountAmount,
      paymentMethod: paymentMethod,
      splitDetails: formattedSplit,
      category: 'Pending Balance Collection',
      description: `Balance Clearance for ${c.name} (${newBalance === 0 ? 'Fully Cleared' : `₹${newBalance} Still Remaining`})${discountAmount > 0 ? ` [₹${discountAmount} Discounted]` : ''}`,
      date: today,
      customerId: c.id,
      customerName: c.name
    });
    return c;
  }
}

// --- ATTENDANCE ---
export async function getAttendance(gymId?: string) {
  try {
    if (gymId) {
      // Auto-expire orphan member sessions exceeding cutoff hours
      const gymSettings = await prisma.gymSettings.findUnique({ where: { gymId } });
      const cutoffHours = gymSettings?.memberCutoffHours || 4;
      const cutoffThreshold = new Date(Date.now() - (cutoffHours * 60 * 60 * 1000)).toISOString();
      
      const expired = await prisma.attendanceRecord.findMany({
        where: { gymId, checkOutTime: null, checkInTime: { lt: cutoffThreshold } }
      });
      
      for (const rec of expired) {
        const checkIn = new Date(rec.checkInTime);
        const autoOut = new Date(checkIn.getTime() + (cutoffHours * 60 * 60 * 1000)).toISOString();
        await prisma.attendanceRecord.update({
          where: { id: rec.id },
          data: { checkOutTime: autoOut, durationMinutes: cutoffHours * 60 }
        }).catch(() => {});
      }
    }

    if (!gymId) return await prisma.attendanceRecord.findMany({ orderBy: { checkInTime: 'desc' } });
    return await prisma.attendanceRecord.findMany({
      where: { gymId },
      orderBy: { checkInTime: 'desc' }
    });
  } catch (e) {
    if (!gymId) return store.attendance;
    return store.attendance.filter((a: any) => a.gymId === gymId);
  }
}

export async function toggleCheckIn(customerId: string, isManual: boolean = false) {
  let customer: any;
  try {
    customer = await prisma.customer.findUnique({ where: { id: customerId } });
  } catch (e) {
    customer = store.customers.find((c: any) => c.id === customerId);
  }
  if (!customer) throw new Error('Customer not found');

  const todayStr = getLocalTodayDateString();
  const nowIso = new Date().toISOString();

  try {
    // Get gym cutoff timer setting
    const gymSettings = await prisma.gymSettings.findUnique({ where: { gymId: customer.gymId } });

    // ── NFC/Fingerprint Enforcement ─────────────────────────────────────
    // If the gym has set a hardware-only attendance mode, block manual punches.
    if (isManual) {
      const mode = gymSettings?.attendanceMode ?? 'NFC';
      if (mode === 'NFC' || mode === 'FINGERPRINT' || mode === 'BOTH') {
        throw new Error(`Manual punch-in is disabled. Please use the ${mode === 'NFC' ? 'NFC card' : 'fingerprint'} terminal.`);
      }
    }
    const cutoffHours = gymSettings?.memberCutoffHours || 4;

    // Find latest active session without checkout time
    const activeSession = await prisma.attendanceRecord.findFirst({
      where: {
        customerId: customer.id,
        checkOutTime: null
      },
      orderBy: { checkInTime: 'desc' }
    });

    if (activeSession) {
      const checkInTime = new Date(activeSession.checkInTime);
      const checkOutTime = new Date(nowIso);
      const diffHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

      // If active session is within cutoffHours, treat as normal checkout
      if (diffHours <= cutoffHours) {
        const diffMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
        const updated = await prisma.attendanceRecord.update({
          where: { id: activeSession.id },
          data: {
            checkOutTime: nowIso,
            durationMinutes: diffMinutes > 0 ? diffMinutes : 1
          }
        });
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('attendance_updated'));
        return { record: updated, action: 'checkout' as const };
      } else {
        // Session exceeded cutoff timer (member forgot to checkout earlier)
        // Auto-close previous session and start fresh checkin
        const autoOut = new Date(checkInTime.getTime() + (cutoffHours * 60 * 60 * 1000)).toISOString();
        await prisma.attendanceRecord.update({
          where: { id: activeSession.id },
          data: {
            checkOutTime: autoOut,
            durationMinutes: cutoffHours * 60
          }
        }).catch(() => {});
      }
    }

    const newRecord = await prisma.attendanceRecord.create({
      data: {
        gymId: customer.gymId,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        checkInTime: nowIso,
        dateStr: todayStr
      }
    });
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('attendance_updated'));
    return { record: newRecord, action: 'checkin' as const };
  } catch (e) {
    const active = store.attendance.find((a: any) => a.customerId === customer.id && !a.checkOutTime && a.dateStr === todayStr);
    if (active) {
      active.checkOutTime = nowIso;
      active.durationMinutes = 60;
      return { record: active, action: 'checkout' as const };
    } else {
      const newAtt = {
        id: `att_${Date.now()}`,
        gymId: customer.gymId,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        checkInTime: nowIso,
        checkOutTime: null,
        durationMinutes: null,
        dateStr: todayStr
      };
      store.attendance.unshift(newAtt);
      return { record: newAtt, action: 'checkin' as const };
    }
  }
}

export async function getMemberMonthlyAvgHours(customerId: string) {
  try {
    const attendance = await prisma.attendanceRecord.findMany({
      where: {
        customerId,
        durationMinutes: { not: null }
      }
    });
    if (attendance.length === 0) return 1.2;
    const totalMinutes = attendance.reduce((acc, cur) => acc + (cur.durationMinutes || 0), 0);
    return parseFloat(((totalMinutes / 60) / Math.max(1, attendance.length)).toFixed(1));
  } catch (e) {
    return 1.4;
  }
}

// --- TRANSACTIONS ---
export async function getTransactions(gymId?: string) {
  try {
    if (!gymId) return await prisma.transaction.findMany({ orderBy: { date: 'desc' } });
    return await prisma.transaction.findMany({
      where: { gymId },
      orderBy: { date: 'desc' }
    });
  } catch (e) {
    if (!gymId) return store.transactions;
    return store.transactions.filter((t: any) => t.gymId === gymId);
  }
}

export async function addTransaction(tx: any) {
  const formattedSplit = tx.splitDetails ? (typeof tx.splitDetails === 'string' ? tx.splitDetails : JSON.stringify(tx.splitDetails)) : null;
  const nowTime = tx.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  try {
    return await prisma.transaction.create({
      data: {
        gymId: tx.gymId,
        type: tx.type,
        amount: Number(tx.amount),
        paidAmount: tx.paidAmount !== undefined ? Number(tx.paidAmount) : Number(tx.amount),
        discountAmount: tx.discountAmount ? Number(tx.discountAmount) : 0,
        paymentMethod: tx.paymentMethod || 'CASH',
        splitDetails: formattedSplit,
        upiId: tx.upiId || null,
        upiSenderName: tx.upiSenderName || null,
        category: tx.category,
        description: tx.description,
        date: tx.date,
        time: nowTime,
        customerId: tx.customerId || null,
        customerName: tx.customerName || null
      }
    });
  } catch (e) {
    const newTx = {
      id: `tx_${Date.now()}`,
      gymId: tx.gymId,
      type: tx.type,
      amount: Number(tx.amount),
      paidAmount: tx.paidAmount !== undefined ? Number(tx.paidAmount) : Number(tx.amount),
      discountAmount: tx.discountAmount ? Number(tx.discountAmount) : 0,
      paymentMethod: tx.paymentMethod || 'CASH',
      splitDetails: formattedSplit,
      upiId: tx.upiId || null,
      upiSenderName: tx.upiSenderName || null,
      category: tx.category,
      description: tx.description,
      date: tx.date,
      time: nowTime,
      customerId: tx.customerId || null,
      customerName: tx.customerName || null
    };
    store.transactions.unshift(newTx);
    return newTx;
  }
}

export async function updateTransaction(id: string, data: any) {
  try {
    const updateData: any = {};
    if (data.amount !== undefined) updateData.amount = Number(data.amount);
    if (data.paidAmount !== undefined) updateData.paidAmount = Number(data.paidAmount);
    if (data.category !== undefined) updateData.category = data.category;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.date !== undefined) updateData.date = data.date;
    if (data.time !== undefined) updateData.time = data.time;
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
    if (data.upiId !== undefined) updateData.upiId = data.upiId;
    if (data.upiSenderName !== undefined) updateData.upiSenderName = data.upiSenderName;
    if (data.splitDetails !== undefined) {
      updateData.splitDetails = typeof data.splitDetails === 'string' ? data.splitDetails : JSON.stringify(data.splitDetails);
    }

    return await prisma.transaction.update({
      where: { id },
      data: updateData
    });
  } catch (e) {
    const tx = store.transactions.find((t: any) => t.id === id);
    if (tx) {
      Object.assign(tx, data);
      return tx;
    }
    return null;
  }
}

export async function deleteTransaction(id: string) {
  try {
    await prisma.transaction.delete({ where: { id } });
    return true;
  } catch (e) {
    const idx = store.transactions.findIndex((t: any) => t.id === id);
    if (idx !== -1) {
      store.transactions.splice(idx, 1);
      return true;
    }
    return false;
  }
}

// --- SUBSCRIPTION PLANS ---
export async function getSubscriptionPlans(gymId?: string) {
  try {
    if (!gymId) return await prisma.subscriptionPlan.findMany();
    return await prisma.subscriptionPlan.findMany({ where: { gymId } });
  } catch (e) {
    if (!gymId) return store.plans;
    return store.plans.filter((p: any) => p.gymId === gymId);
  }
}

export async function addSubscriptionPlan(plan: any) {
  try {
    return await prisma.subscriptionPlan.create({
      data: {
        gymId: plan.gymId,
        name: plan.name,
        durationMonths: plan.durationMonths,
        price: plan.price
      }
    });
  } catch (e) {
    const newPlan = {
      id: `plan_${Date.now()}`,
      gymId: plan.gymId,
      name: plan.name,
      durationMonths: plan.durationMonths,
      price: plan.price
    };
    store.plans.push(newPlan);
    return newPlan;
  }
}

export async function updateSubscriptionPlan(id: string, data: any) {
  try {
    return await prisma.subscriptionPlan.update({
      where: { id },
      data
    });
  } catch (e) {
    const plan = store.plans.find((p: any) => p.id === id);
    if (plan) {
      Object.assign(plan, data);
      return plan;
    }
    return null;
  }
}

export async function deleteSubscriptionPlan(id: string) {
  try {
    await prisma.subscriptionPlan.delete({ where: { id } });
    return true;
  } catch {
    const idx = store.plans.findIndex((p: any) => p.id === id);
    if (idx !== -1) {
      store.plans.splice(idx, 1);
      return true;
    }
    return false;
  }
}

// --- PRODUCTS / POS ---
export async function getProducts(gymId: string) {
  try {
    return await prisma.product.findMany({
      where: { gymId, active: true },
      orderBy: { createdAt: 'desc' }
    });
  } catch (e) {
    return store.products.filter((p: any) => p.gymId === gymId && p.active !== false);
  }
}

export async function addProduct(data: any) {
  try {
    return await prisma.product.create({
      data: {
        gymId: data.gymId,
        name: data.name,
        category: data.category || 'Supplement',
        price: Number(data.price),
        stock: Number(data.stock) || 0,
        unit: data.unit || 'unit',
        active: true,
        createdAt: getLocalTodayDateString()
      }
    });
  } catch (e) {
    const newProduct = {
      id: `prod_${Date.now()}`,
      gymId: data.gymId,
      name: data.name,
      category: data.category || 'Supplement',
      price: Number(data.price),
      stock: Number(data.stock) || 0,
      unit: data.unit || 'unit',
      active: true,
      createdAt: getLocalTodayDateString()
    };
    store.products.push(newProduct);
    return newProduct;
  }
}

export async function updateProduct(id: string, data: any) {
  try {
    return await prisma.product.update({ where: { id }, data });
  } catch (e) {
    const p = store.products.find((p: any) => p.id === id);
    if (p) { Object.assign(p, data); return p; }
    return null;
  }
}

export async function deleteProduct(id: string) {
  try {
    await prisma.product.update({ where: { id }, data: { active: false } });
    return true;
  } catch {
    const idx = store.products.findIndex((p: any) => p.id === id);
    if (idx !== -1) { store.products[idx].active = false; return true; }
    return false;
  }
}

export async function recordProductSale(data: {
  gymId: string;
  items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number }>;
  totalAmount: number;
  paymentMethod: string;
  splitDetails?: any;
  customerId?: string | null;
  customerName?: string | null;
}) {
  const today = getLocalTodayDateString();
  const formattedSplit = data.splitDetails ? (typeof data.splitDetails === 'string' ? data.splitDetails : JSON.stringify(data.splitDetails)) : null;

  const itemNames = data.items.map(i => `${i.productName} x${i.quantity}`).join(', ');

  try {
    // Create the sale record
    const sale = await prisma.productSale.create({
      data: {
        gymId: data.gymId,
        customerId: data.customerId || null,
        customerName: data.customerName || null,
        totalAmount: data.totalAmount,
        paymentMethod: data.paymentMethod,
        splitDetails: formattedSplit,
        date: today,
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice
          }))
        }
      }
    });

    // Deduct stock for each product
    for (const item of data.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } }
      });
    }

    // Auto-create INCOME transaction in revenue ledger
    await prisma.transaction.create({
      data: {
        gymId: data.gymId,
        type: 'INCOME',
        amount: data.totalAmount,
        paidAmount: data.totalAmount,
        paymentMethod: data.paymentMethod,
        splitDetails: formattedSplit,
        category: 'Product Sale',
        description: `Store Sale: ${itemNames}${data.customerName ? ` — ${data.customerName}` : ''}`,
        date: today,
        customerId: data.customerId || null,
        customerName: data.customerName || null
      }
    });

    return sale;
  } catch (e) {
    // Fallback in-memory store
    const saleId = `sale_${Date.now()}`;
    const newSale = {
      id: saleId,
      gymId: data.gymId,
      customerId: data.customerId || null,
      customerName: data.customerName || null,
      totalAmount: data.totalAmount,
      paymentMethod: data.paymentMethod,
      splitDetails: formattedSplit,
      date: today,
      items: data.items
    };
    store.productSales.unshift(newSale);

    // Deduct stock in fallback store
    for (const item of data.items) {
      const prod = store.products.find((p: any) => p.id === item.productId);
      if (prod) prod.stock = Math.max(0, prod.stock - item.quantity);
    }

    // Auto-create INCOME transaction in fallback store
    store.transactions.unshift({
      id: `tx_${Date.now()}`,
      gymId: data.gymId,
      type: 'INCOME',
      amount: data.totalAmount,
      paidAmount: data.totalAmount,
      discountAmount: 0,
      paymentMethod: data.paymentMethod,
      splitDetails: formattedSplit,
      category: 'Product Sale',
      description: `Store Sale: ${itemNames}${data.customerName ? ` — ${data.customerName}` : ''}`,
      date: today,
      customerId: data.customerId || null,
      customerName: data.customerName || null
    });

    return newSale;
  }
}

export async function getProductSales(gymId: string) {
  try {
    return await prisma.productSale.findMany({
      where: { gymId },
      orderBy: { date: 'desc' },
      include: { items: true }
    });
  } catch (e) {
    return store.productSales.filter((s: any) => s.gymId === gymId);
  }
}

// --- SUPERADMIN ---
export async function getGlobalStats() {
  try {
    const totalGyms = await prisma.gym.count();
    const totalMembers = await prisma.customer.count({ where: { status: 'active' } });
    const activeCustomers = await prisma.customer.findMany({ where: { status: 'active' } });
    const globalGymRevenue = activeCustomers.reduce((sum, c) => sum + c.feeAmount, 0);
    const saasMRR = totalGyms * 1499;
    return { totalGyms, totalMembers, saasMRR, globalGymRevenue };
  } catch (e) {
    const totalGyms = store.gyms.length;
    const totalMembers = store.customers.filter((c: any) => c.status === 'active').length;
    const globalGymRevenue = store.customers.reduce((sum: number, c: any) => sum + (c.feeAmount || 0), 0);
    const saasMRR = totalGyms * 1499;
    return { totalGyms, totalMembers, saasMRR, globalGymRevenue };
  }
}

export async function updateGymStatus(gymId: string, status: string) {
  try {
    return await prisma.gym.update({
      where: { id: gymId },
      data: { status }
    });
  } catch (e) {
    const gym = store.gyms.find((g: any) => g.id === gymId);
    if (gym) { gym.status = status; return gym; }
    return null;
  }
}

// --- ANNOUNCEMENTS ---
export async function getAnnouncements() {
  try {
    return await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
  } catch (e) {
    return store.announcements;
  }
}

export async function getActiveAnnouncement() {
  try {
    return await prisma.announcement.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' }
    });
  } catch (e) {
    return store.announcements.find((a: any) => a.active) || null;
  }
}

export async function createAnnouncement(data: { title: string, message: string, type: string }) {
  try {
    await prisma.announcement.updateMany({ where: { active: true }, data: { active: false } });
    return await prisma.announcement.create({
      data: {
        title: data.title,
        message: data.message,
        type: data.type,
        createdAt: new Date().toISOString()
      }
    });
  } catch (e) {
    store.announcements.forEach((a: any) => a.active = false);
    const newAnn = {
      id: `ann_${Date.now()}`,
      title: data.title,
      message: data.message,
      type: data.type,
      active: true,
      createdAt: new Date().toISOString()
    };
    store.announcements.unshift(newAnn);
    return newAnn;
  }
}

export async function deleteAnnouncement(id: string) {
  try {
    return await prisma.announcement.delete({ where: { id } });
  } catch (e) {
    const idx = store.announcements.findIndex((a: any) => a.id === id);
    if (idx !== -1) { store.announcements.splice(idx, 1); return true; }
    return false;
  }
}

// --- SECURE AUTHENTICATION & RATE LIMITING ---

// In-memory store for rate limiting failed login attempts.
// Structure: { [userId]: { attempts: number, lockUntil: number } }
const loginAttempts = new Map<string, { attempts: number, lockUntil: number }>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(userId: string) {
  const record = loginAttempts.get(userId);
  if (!record) return { allowed: true };

  if (Date.now() < record.lockUntil) {
    const minutesLeft = Math.ceil((record.lockUntil - Date.now()) / 60000);
    return { allowed: false, message: `Too many failed attempts. Account locked for ${minutesLeft} minutes.` };
  }

  // Lock expired, reset
  if (Date.now() > record.lockUntil && record.attempts >= MAX_FAILED_ATTEMPTS) {
    loginAttempts.delete(userId);
  }
  return { allowed: true };
}

function recordFailedAttempt(userId: string) {
  const record = loginAttempts.get(userId) || { attempts: 0, lockUntil: 0 };
  record.attempts += 1;
  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    record.lockUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  loginAttempts.set(userId, record);
}

function resetFailedAttempts(userId: string) {
  loginAttempts.delete(userId);
}

export async function authenticateGym(userId: string, passwordHash: string) {
  try {
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) return { success: false, error: rateLimit.message };

    const gym = await prisma.gym.findUnique({
      where: { userId }
    });

    if (!gym || gym.passwordHash !== passwordHash) {
      const record = loginAttempts.get(userId) || { attempts: 0, lockUntil: 0 };
      record.attempts += 1;
      
      // Hard lock after 6 attempts
      if (gym && record.attempts >= 6 && gym.status !== 'locked') {
         await prisma.gym.update({ where: { id: gym.id }, data: { status: 'locked' }});
         const storeGym = store.gyms.find((g: any) => g.id === gym.id);
         if (storeGym) storeGym.status = 'locked';
         return { success: false, error: 'Account locked due to 6 failed login attempts. Please contact Master Admin.' };
      }

      if (record.attempts >= MAX_FAILED_ATTEMPTS) {
        record.lockUntil = Date.now() + LOCKOUT_DURATION_MS;
      }
      loginAttempts.set(userId, record);

      return { success: false, error: 'Invalid Gym User ID or Password.' };
    }

    if (gym.status === 'suspended') {
      return { success: false, error: 'Your account has been suspended. Please contact the Master Admin.' };
    }
    
    if (gym.status === 'locked') {
      return { success: false, error: 'Your account is locked due to too many failed attempts. Please contact the Master Admin.' };
    }

    resetFailedAttempts(userId);
    return { success: true, gym: { id: gym.id, userId: gym.userId } };
  } catch (e) {
    // Fallback to mock store
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) return { success: false, error: rateLimit.message };
    
    const gym = store.gyms.find((g: any) => g.userId === userId);
    
    if (!gym || gym.passwordHash !== passwordHash) {
      const record = loginAttempts.get(userId) || { attempts: 0, lockUntil: 0 };
      record.attempts += 1;
      
      if (gym && record.attempts >= 6 && gym.status !== 'locked') {
         gym.status = 'locked';
         return { success: false, error: 'Account locked due to 6 failed login attempts. Please contact Master Admin.' };
      }

      if (record.attempts >= MAX_FAILED_ATTEMPTS) {
        record.lockUntil = Date.now() + LOCKOUT_DURATION_MS;
      }
      loginAttempts.set(userId, record);
      
      return { success: false, error: 'Invalid Gym User ID or Password.' };
    }
    
    if (gym.status === 'suspended') {
      return { success: false, error: 'Your account has been suspended. Please contact the Master Admin.' };
    }
    if (gym.status === 'locked') {
      return { success: false, error: 'Your account is locked due to too many failed attempts. Please contact the Master Admin.' };
    }
    resetFailedAttempts(userId);
    return { success: true, gym: { id: gym.id, userId: gym.userId } };
  }
}

export async function authenticateSuperadmin(userId: string, passwordHash: string) {
  const rateLimit = checkRateLimit(`superadmin_${userId}`);
  if (!rateLimit.allowed) return { success: false, error: rateLimit.message };

  const isValid = 
    (userId === 'sree' && passwordHash === 'sree') ||
    (userId === 'sreeram' && passwordHash === 'Sreeram@007') ||
    (userId === 'admin' && passwordHash === 'admin');

  if (isValid) {
    resetFailedAttempts(`superadmin_${userId}`);
    return { success: true };
  }

  recordFailedAttempt(`superadmin_${userId}`);
  return { success: false, error: 'Invalid Master Admin credentials.' };
}

// --- STAFF MANAGEMENT ---
export async function getStaffs(gymId: string) {
  try {
    return await prisma.staff.findMany({ where: { gymId }, orderBy: { name: 'asc' } });
  } catch (e) {
    return [];
  }
}

export async function addStaff(data: any) {
  try {
    const today = getLocalTodayDateString();
    const gymId = data.gymId;
    const cleanPhone = String(data.phone || '').trim();
    const cleanName = String(data.name || '').trim();
    const cleanRole = String(data.role || 'Trainer').trim();
    const cleanNfc = data.nfcCardId && String(data.nfcCardId).trim() ? String(data.nfcCardId).trim() : null;
    const cleanFp = data.fingerprintId && String(data.fingerprintId).trim() ? String(data.fingerprintId).trim() : null;

    // 1. Check duplicate phone
    const existingPhone = await prisma.staff.findFirst({
      where: { gymId, phone: cleanPhone }
    });
    if (existingPhone) {
      throw new Error(`Phone number "${cleanPhone}" is already registered for staff: ${existingPhone.name} (${existingPhone.role}).`);
    }

    // 2. Check duplicate NFC Card
    if (cleanNfc) {
      const existingNfc = await prisma.staff.findFirst({
        where: { gymId, nfcCardId: cleanNfc }
      });
      if (existingNfc) {
        throw new Error(`NFC Card ID "${cleanNfc}" is already assigned to staff: ${existingNfc.name}.`);
      }
    }

    // 3. Check duplicate Fingerprint ID
    if (cleanFp) {
      const existingFp = await prisma.staff.findFirst({
        where: { gymId, fingerprintId: cleanFp }
      });
      if (existingFp) {
        throw new Error(`Fingerprint ID "${cleanFp}" is already assigned to staff: ${existingFp.name}.`);
      }
    }

    const cleanData = {
      gymId: data.gymId,
      name: cleanName,
      phone: cleanPhone,
      role: cleanRole,
      nfcCardId: cleanNfc,
      fingerprintId: cleanFp,
      status: data.status || 'active',
      joinedDate: data.joinedDate || today
    };
    return await prisma.staff.create({ data: cleanData });
  } catch (e: any) {
    console.error('Failed to add staff:', e);
    throw new Error(e?.message || 'Failed to add staff');
  }
}

export async function updateStaff(id: string, data: any) {
  try {
    const current = await prisma.staff.findUnique({ where: { id } });
    if (!current) throw new Error('Staff member not found');

    const cleanPhone = data.phone !== undefined ? String(data.phone).trim() : current.phone;
    const cleanNfc = data.nfcCardId !== undefined ? (data.nfcCardId ? String(data.nfcCardId).trim() : null) : current.nfcCardId;
    const cleanFp = data.fingerprintId !== undefined ? (data.fingerprintId ? String(data.fingerprintId).trim() : null) : current.fingerprintId;

    // Check duplicate phone for other staff
    if (cleanPhone !== current.phone) {
      const existingPhone = await prisma.staff.findFirst({
        where: { gymId: current.gymId, phone: cleanPhone, NOT: { id } }
      });
      if (existingPhone) {
        throw new Error(`Phone number "${cleanPhone}" is already registered for staff: ${existingPhone.name}.`);
      }
    }

    // Check duplicate NFC for other staff
    if (cleanNfc && cleanNfc !== current.nfcCardId) {
      const existingNfc = await prisma.staff.findFirst({
        where: { gymId: current.gymId, nfcCardId: cleanNfc, NOT: { id } }
      });
      if (existingNfc) {
        throw new Error(`NFC Card ID "${cleanNfc}" is already assigned to staff: ${existingNfc.name}.`);
      }
    }

    // Check duplicate Fingerprint for other staff
    if (cleanFp && cleanFp !== current.fingerprintId) {
      const existingFp = await prisma.staff.findFirst({
        where: { gymId: current.gymId, fingerprintId: cleanFp, NOT: { id } }
      });
      if (existingFp) {
        throw new Error(`Fingerprint ID "${cleanFp}" is already assigned to staff: ${existingFp.name}.`);
      }
    }

    const cleanData: any = {};
    if (data.name !== undefined) cleanData.name = String(data.name).trim();
    if (data.phone !== undefined) cleanData.phone = cleanPhone;
    if (data.role !== undefined) cleanData.role = String(data.role).trim();
    if (data.nfcCardId !== undefined) cleanData.nfcCardId = cleanNfc;
    if (data.fingerprintId !== undefined) cleanData.fingerprintId = cleanFp;
    if (data.status !== undefined) cleanData.status = data.status;
    if (data.joinedDate !== undefined) cleanData.joinedDate = data.joinedDate;

    return await prisma.staff.update({
      where: { id },
      data: cleanData
    });
  } catch (e: any) {
    console.error('Failed to update staff:', e);
    throw new Error(e?.message || 'Failed to update staff');
  }
}

export async function deleteStaff(id: string) {
  try {
    await prisma.staffAttendanceRecord.deleteMany({ where: { staffId: id } });
    return await prisma.staff.delete({ where: { id } });
  } catch (e) {
    throw new Error('Failed to delete staff');
  }
}

export async function getStaffAttendance(gymId: string) {
  try {
    // Auto-expire orphan staff shifts exceeding cutoff hours
    const gymSettings = await prisma.gymSettings.findUnique({ where: { gymId } });
    const cutoffHours = gymSettings?.staffCutoffHours || 12;
    const cutoffThreshold = new Date(Date.now() - (cutoffHours * 60 * 60 * 1000)).toISOString();
    
    const expired = await prisma.staffAttendanceRecord.findMany({
      where: { gymId, checkOutTime: null, checkInTime: { lt: cutoffThreshold } }
    });
    
    for (const rec of expired) {
      const checkIn = new Date(rec.checkInTime);
      const autoOut = new Date(checkIn.getTime() + (cutoffHours * 60 * 60 * 1000)).toISOString();
      await prisma.staffAttendanceRecord.update({
        where: { id: rec.id },
        data: { checkOutTime: autoOut, durationMinutes: cutoffHours * 60 }
      }).catch(() => {});
    }

    return await prisma.staffAttendanceRecord.findMany({
      where: { gymId },
      orderBy: { checkInTime: 'desc' }
    });
  } catch (e) {
    return [];
  }
}

export async function toggleStaffCheckIn(staffId: string, isManual: boolean = false) {
  try {
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new Error('Staff not found');

    const todayStr = getLocalTodayDateString();
    const nowIso = new Date().toISOString();
    
    // Get gym staff cutoff timer setting
    const gymSettings = await prisma.gymSettings.findUnique({ where: { gymId: staff.gymId } });
    const cutoffHours = gymSettings?.staffCutoffHours || 12;

    // ── NFC/Fingerprint Enforcement ─────────────────────────────────────
    if (isManual) {
      const mode = gymSettings?.attendanceMode ?? 'NFC';
      if (mode === 'NFC' || mode === 'FINGERPRINT' || mode === 'BOTH') {
        throw new Error(`Manual punch-in is disabled. Please use the ${mode === 'NFC' ? 'NFC card' : 'fingerprint'} terminal.`);
      }
    }

    const activeRecord = await prisma.staffAttendanceRecord.findFirst({
      where: {
        staffId: staffId,
        checkOutTime: null
      },
      orderBy: { checkInTime: 'desc' }
    });

    if (activeRecord) {
      const checkInDate = new Date(activeRecord.checkInTime);
      const now = new Date(nowIso);
      const diffHours = (now.getTime() - checkInDate.getTime()) / (1000 * 60 * 60);

      // If active shift was started within cutoffHours, treat as checkout
      if (diffHours <= cutoffHours) {
        let diffMins = Math.floor((now.getTime() - checkInDate.getTime()) / 60000);
        if (diffMins < 0) diffMins = 0;

        const updated = await prisma.staffAttendanceRecord.update({
          where: { id: activeRecord.id },
          data: {
            checkOutTime: nowIso,
            durationMinutes: diffMins
          }
        });
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('attendance_updated'));
        return { record: updated, action: 'checkout' };
      } else {
        // Shift exceeded cut-off threshold (staff forgot to punch out earlier)
        // Auto-close previous shift and start fresh punch-in
        const autoOut = new Date(checkInDate.getTime() + (cutoffHours * 60 * 60 * 1000)).toISOString();
        await prisma.staffAttendanceRecord.update({
          where: { id: activeRecord.id },
          data: {
            checkOutTime: autoOut,
            durationMinutes: cutoffHours * 60
          }
        }).catch(() => {});
      }
    }

    const newRec = await prisma.staffAttendanceRecord.create({
      data: {
        gymId: staff.gymId,
        staffId: staff.id,
        staffName: staff.name,
        staffPhone: staff.phone,
        dateStr: todayStr,
        checkInTime: nowIso
      }
    });
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('attendance_updated'));
    return { record: newRec, action: 'checkin' };
  } catch (e) {
    console.error(e);
    return null;
  }
}

// --- AUTOMATED WHATSAPP REMINDERS ENGINE ---
export async function processDailyAutomatedReminders(gymId: string) {
  try {
    const today = getLocalTodayDateString();
    const gym = await prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) return { success: false, reason: 'Gym not found' };

    const settings = await prisma.gymSettings.findUnique({ where: { gymId } });
    if (!settings) return { success: false, reason: 'Settings not found' };

    const waAutoMessages = settings.waAutoMessages ?? true;
    const absentTracking = settings.absentTrackingEnabled ?? false;
    const reminderWindowDays = settings.waReminderWindowDays ?? 3;
    const absentThresholdDays = settings.absentThresholdDays ?? 3;

    // Fetch all members of this gym who activated WhatsApp services (waActive === true)
    const activeWaMembers = await prisma.customer.findMany({
      where: { gymId, waActive: true },
      include: {
        attendance: {
          orderBy: { checkInTime: 'desc' },
          take: 1
        }
      }
    });

    let dueRemindersSent = 0;
    let absenteeRemindersSent = 0;

    const [todayY, todayM, todayD] = today.split('-').map(Number);
    const targetDateObj = new Date(todayY, todayM - 1, todayD + reminderWindowDays);
    const targetDateStr = `${targetDateObj.getFullYear()}-${String(targetDateObj.getMonth() + 1).padStart(2, '0')}-${String(targetDateObj.getDate()).padStart(2, '0')}`;

    for (const cust of activeWaMembers) {
      // 1. DUE / SUBSCRIPTION & OVERDUE REMINDER (Runs if waAutoMessages is enabled)
      if (waAutoMessages && cust.nextDueDate) {
        // If due within reminderWindowDays or overdue (nextDueDate <= targetDateStr)
        const isDueOrOverdue = cust.nextDueDate <= targetDateStr;
        const notSentToday = cust.lastReminderSentDate !== today;

        if (isDueOrOverdue && notSentToday) {
          const rawTemplate = getTemplate(settings, 'reminder');
          const waMessage = compileTemplate(rawTemplate, {
            name: cust.name,
            gymName: gym.name,
            phone: cust.phone,
            plan: cust.planType,
            amount: cust.feeAmount?.toString() || '0',
            dueDate: formatDateDDMMYYYY(cust.nextDueDate)
          });

          await WhatsAppManager.sendMessage(gymId, cust.phone, waMessage).catch(() => {});
          
          await prisma.customer.update({
            where: { id: cust.id },
            data: { lastReminderSentDate: today }
          }).catch(() => {});

          dueRemindersSent++;
        }
      }

      // 2. ABSENTEE REMINDER (Runs if absentTrackingEnabled is enabled)
      if (absentTracking) {
        const lastAtt = cust.attendance[0];
        let daysAbsent = 999;

        if (lastAtt && lastAtt.dateStr) {
          const [aY, aM, aD] = lastAtt.dateStr.split('-').map(Number);
          const attDate = new Date(aY, aM - 1, aD);
          const todayDate = new Date(todayY, todayM - 1, todayD);
          daysAbsent = Math.floor((todayDate.getTime() - attDate.getTime()) / (1000 * 60 * 60 * 24));
        } else if (cust.joinedDate) {
          const [jY, jM, jD] = cust.joinedDate.split('-').map(Number);
          const joinDate = new Date(jY, jM - 1, jD);
          const todayDate = new Date(todayY, todayM - 1, todayD);
          daysAbsent = Math.floor((todayDate.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
        }

        const isAbsentThresholdMet = daysAbsent >= absentThresholdDays;
        const notSentAbsentToday = cust.lastAbsenteeSentDate !== today;

        if (isAbsentThresholdMet && notSentAbsentToday) {
          const rawTemplate = getTemplate(settings, 'absentee');
          const waMessage = compileTemplate(rawTemplate, {
            name: cust.name,
            gymName: gym.name,
            days: daysAbsent.toString()
          });

          await WhatsAppManager.sendMessage(gymId, cust.phone, waMessage).catch(() => {});

          await prisma.customer.update({
            where: { id: cust.id },
            data: { lastAbsenteeSentDate: today }
          }).catch(() => {});

          absenteeRemindersSent++;
        }
      }
    }

    return {
      success: true,
      dueRemindersSent,
      absenteeRemindersSent
    };
  } catch (err: any) {
    console.error('Error processing automated reminders:', err);
    return { success: false, error: err?.message };
  }
}
