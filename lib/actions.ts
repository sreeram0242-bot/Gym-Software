'use server';

import prisma from './db';
import { Prisma } from '../generated/prisma/client';

// Global in-memory fallback store for offline development and testing
const globalAny: any = global;

if (!globalAny.mockStore) {
  const today = new Date().toISOString().split('T')[0];
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
        waAutoReply: true
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
    ]
  };
}

const store = globalAny.mockStore;

// --- SETTINGS ---
export async function getGymSettings(gymId: string) {
  try {
    let settings = await prisma.gymSettings.findUnique({ where: { gymId } });
    if (!settings) {
      settings = await prisma.gymSettings.create({ data: { gymId } });
    }
    return settings;
  } catch (e) {
    if (!store.settings[gymId]) {
      store.settings[gymId] = {
        gymId,
        gymName: 'Iron Pulse Fitness',
        ownerPhone: '9876543210',
        upiId: 'ironpulse@upi',
        waConnected: false,
        waAutoMessages: true,
        waAutoReply: true
      };
    }
    return store.settings[gymId];
  }
}

export async function updateGymSettings(gymId: string, data: any) {
  try {
    return await prisma.gymSettings.upsert({
      where: { gymId },
      update: data,
      create: { gymId, ...data }
    });
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
        createdAt: new Date().toISOString().split('T')[0],
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
      createdAt: new Date().toISOString().split('T')[0],
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

  try {
    const newCust = await prisma.customer.create({
      data: {
        gymId: data.gymId,
        name: data.name,
        phone: data.phone,
        nfcCardId: data.nfcCardId,
        planType: data.planType,
        feeAmount: data.feeAmount,
        pendingBalance: pendingBalance,
        balanceDueDate: data.balanceDueDate || null,
        lastPaymentDate: data.lastPaymentDate,
        nextDueDate: data.nextDueDate,
        status: 'active',
        joinedDate: new Date().toISOString().split('T')[0]
      }
    });

    if (paidAmount > 0) {
      await prisma.transaction.create({
        data: {
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
      planType: data.planType,
      feeAmount: data.feeAmount,
      pendingBalance: pendingBalance,
      balanceDueDate: data.balanceDueDate || null,
      lastPaymentDate: data.lastPaymentDate,
      nextDueDate: data.nextDueDate,
      status: 'active',
      joinedDate: new Date().toISOString().split('T')[0]
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
  const customers = await getCustomers(gymId);
  return customers.find((c: any) => c.nfcCardId.toLowerCase() === nfcId.toLowerCase());
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
  addedMonths: number, 
  totalAmount: number,
  paidAmount?: number,
  paymentMethod: string = 'CASH',
  splitDetails?: any,
  pendingBalance: number = 0,
  balanceDueDate?: string | null,
  discountAmount: number = 0
) {
  const customers = await getCustomers();
  const c = customers.find((cust: any) => cust.id === customerId);
  if (!c) return undefined;

  const actualPaid = paidAmount !== undefined ? Number(paidAmount) : Number(totalAmount);
  const formattedSplit = splitDetails ? (typeof splitDetails === 'string' ? splitDetails : JSON.stringify(splitDetails)) : null;

  const today = new Date().toISOString().split('T')[0];
  const currentDue = new Date(c.nextDueDate > today ? c.nextDueDate : today);
  currentDue.setMonth(currentDue.getMonth() + addedMonths);
  const newDueDate = currentDue.toISOString().split('T')[0];

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
      await prisma.transaction.create({
        data: {
          gymId: updatedCust.gymId,
          type: 'INCOME',
          amount: actualPaid,
          paidAmount: actualPaid,
          discountAmount: discountAmount,
          paymentMethod: paymentMethod,
          splitDetails: formattedSplit,
          category: 'Membership Fee Renewal',
          description: `Fee Renewal for ${updatedCust.name} (+${addedMonths} Mo)${pendingBalance > 0 ? ` [₹${pendingBalance} Due]` : ''}${discountAmount > 0 ? ` [₹${discountAmount} Disc]` : ''}`,
          date: today,
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
  splitDetails?: any
) {
  const customers = await getCustomers();
  const c = customers.find((cust: any) => cust.id === customerId);
  if (!c) throw new Error('Customer not found');

  const newBalance = Math.max(0, (c.pendingBalance || 0) - amountToCollect);
  const today = new Date().toISOString().split('T')[0];
  const formattedSplit = splitDetails ? (typeof splitDetails === 'string' ? splitDetails : JSON.stringify(splitDetails)) : null;

  try {
    const updatedCust = await prisma.customer.update({
      where: { id: customerId },
      data: {
        pendingBalance: newBalance,
        balanceDueDate: newBalance === 0 ? null : c.balanceDueDate
      }
    });

    await prisma.transaction.create({
      data: {
        gymId: updatedCust.gymId,
        type: 'INCOME',
        amount: amountToCollect,
        paidAmount: amountToCollect,
        paymentMethod: paymentMethod,
        splitDetails: formattedSplit,
        category: 'Pending Balance Collection',
        description: `Balance Clearance for ${updatedCust.name} (${newBalance === 0 ? 'Fully Cleared' : `₹${newBalance} Still Remaining`})`,
        date: today,
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
      amount: amountToCollect,
      paidAmount: amountToCollect,
      paymentMethod: paymentMethod,
      splitDetails: formattedSplit,
      category: 'Pending Balance Collection',
      description: `Balance Clearance for ${c.name} (${newBalance === 0 ? 'Fully Cleared' : `₹${newBalance} Still Remaining`})`,
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

export async function toggleCheckIn(customerId: string) {
  const customers = await getCustomers();
  const customer = customers.find((c: any) => c.id === customerId);
  if (!customer) throw new Error('Customer not found');

  const todayStr = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  try {
    const activeSession = await prisma.attendanceRecord.findFirst({
      where: {
        customerId: customer.id,
        checkOutTime: null,
        dateStr: todayStr
      }
    });

    if (activeSession) {
      const checkInTime = new Date(activeSession.checkInTime);
      const checkOutTime = new Date(nowIso);
      const diffMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));

      const updated = await prisma.attendanceRecord.update({
        where: { id: activeSession.id },
        data: {
          checkOutTime: nowIso,
          durationMinutes: diffMinutes > 0 ? diffMinutes : 1
        }
      });
      return { record: updated, action: 'checkout' as const };
    } else {
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
      return { record: newRecord, action: 'checkin' as const };
    }
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
        category: tx.category,
        description: tx.description,
        date: tx.date,
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
      category: tx.category,
      description: tx.description,
      date: tx.date,
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
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
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

// --- SUPERADMIN SAAS FEATURES ---

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
    if (gym) {
      gym.status = status;
      return gym;
    }
    return null;
  }
}

// Announcements
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
    await prisma.announcement.updateMany({
      where: { active: true },
      data: { active: false }
    });

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
    if (idx !== -1) {
      store.announcements.splice(idx, 1);
      return true;
    }
    return false;
  }
}
