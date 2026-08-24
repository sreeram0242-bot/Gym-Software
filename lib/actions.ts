'use server';

import prisma from './db';
import { Prisma } from '../generated/prisma/client';

// --- SETTINGS ---
export async function getGymSettings(gymId: string) {
  let settings = await prisma.gymSettings.findUnique({ where: { gymId } });
  if (!settings) {
    settings = await prisma.gymSettings.create({
      data: { gymId }
    });
  }
  return settings;
}

export async function updateGymSettings(gymId: string, data: any) {
  return await prisma.gymSettings.upsert({
    where: { gymId },
    update: data,
    create: { gymId, ...data }
  });
}

// --- GYMS ---
export async function getGyms() {
  return await prisma.gym.findMany({
    orderBy: { createdAt: 'desc' }
  });
}

export async function addGym(gym: any) {
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
}

export async function toggleGymStatus(gymId: string) {
  const gym = await prisma.gym.findUnique({ where: { id: gymId } });
  if (!gym) return null;
  return await prisma.gym.update({
    where: { id: gymId },
    data: { status: gym.status === 'active' ? 'suspended' : 'active' }
  });
}

// --- CUSTOMERS ---
export async function getCustomers(gymId?: string) {
  if (!gymId) return await prisma.customer.findMany({ orderBy: { joinedDate: 'desc' } });
  return await prisma.customer.findMany({
    where: { gymId },
    orderBy: { joinedDate: 'desc' }
  });
}

export async function addCustomer(data: any) {
  const newCust = await prisma.customer.create({
    data: {
      gymId: data.gymId,
      name: data.name,
      phone: data.phone,
      nfcCardId: data.nfcCardId,
      planType: data.planType,
      feeAmount: data.feeAmount,
      lastPaymentDate: data.lastPaymentDate,
      nextDueDate: data.nextDueDate,
      status: 'active',
      joinedDate: new Date().toISOString().split('T')[0]
    }
  });

  await prisma.transaction.create({
    data: {
      gymId: newCust.gymId,
      type: 'INCOME',
      amount: newCust.feeAmount,
      category: 'Membership Fee',
      description: `New Joiner: ${newCust.name} (${newCust.planType})`,
      date: newCust.joinedDate,
      customerId: newCust.id,
      customerName: newCust.name
    }
  });

  return newCust;
}

export async function findCustomerByPhone(phone: string, gymId?: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  const customers = await getCustomers(gymId);
  return customers.find(c => c.phone.replace(/\D/g, '').includes(cleanPhone));
}

export async function findCustomerByNFC(gymId: string, nfcId: string) {
  const customers = await getCustomers(gymId);
  return customers.find(c => c.nfcCardId.toLowerCase() === nfcId.toLowerCase());
}

export async function updateCustomer(id: string, data: any) {
  return await prisma.customer.update({
    where: { id },
    data
  });
}

export async function deleteCustomer(id: string) {
  try {
    await prisma.customer.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function renewMemberPayment(customerId: string, addedMonths: number, amount: number) {
  const c = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!c) return undefined;

  const today = new Date().toISOString().split('T')[0];
  const currentDue = new Date(c.nextDueDate > today ? c.nextDueDate : today);
  currentDue.setMonth(currentDue.getMonth() + addedMonths);
  const newDueDate = currentDue.toISOString().split('T')[0];

  const updatedCust = await prisma.customer.update({
    where: { id: customerId },
    data: {
      lastPaymentDate: today,
      nextDueDate: newDueDate,
      status: 'active'
    }
  });

  await prisma.transaction.create({
    data: {
      gymId: updatedCust.gymId,
      type: 'INCOME',
      amount,
      category: 'Membership Fee Renewal',
      description: `Fee Renewal for ${updatedCust.name} (+${addedMonths} Month/s)`,
      date: today,
      customerId: updatedCust.id,
      customerName: updatedCust.name
    }
  });

  return updatedCust;
}

// --- ATTENDANCE ---
export async function getAttendance(gymId?: string) {
  if (!gymId) return await prisma.attendanceRecord.findMany({ orderBy: { checkInTime: 'desc' } });
  return await prisma.attendanceRecord.findMany({
    where: { gymId },
    orderBy: { checkInTime: 'desc' }
  });
}

export async function toggleCheckIn(customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new Error('Customer not found');

  const todayStr = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

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
}

export async function getMemberMonthlyAvgHours(customerId: string) {
  const attendance = await prisma.attendanceRecord.findMany({
    where: {
      customerId,
      durationMinutes: { not: null }
    }
  });
  if (attendance.length === 0) return 1.2;

  const totalMinutes = attendance.reduce((acc, cur) => acc + (cur.durationMinutes || 0), 0);
  const totalHours = totalMinutes / 60;
  const avg = totalHours / Math.max(1, attendance.length);
  return parseFloat(avg.toFixed(1));
}

// --- TRANSACTIONS ---
export async function getTransactions(gymId?: string) {
  if (!gymId) return await prisma.transaction.findMany({ orderBy: { date: 'desc' } });
  return await prisma.transaction.findMany({
    where: { gymId },
    orderBy: { date: 'desc' }
  });
}

export async function addTransaction(tx: any) {
  return await prisma.transaction.create({
    data: {
      gymId: tx.gymId,
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      description: tx.description,
      date: tx.date,
      customerId: tx.customerId || null,
      customerName: tx.customerName || null
    }
  });
}

// --- SUBSCRIPTION PLANS ---
export async function getSubscriptionPlans(gymId?: string) {
  if (!gymId) return await prisma.subscriptionPlan.findMany();
  return await prisma.subscriptionPlan.findMany({ where: { gymId } });
}

export async function addSubscriptionPlan(plan: any) {
  return await prisma.subscriptionPlan.create({
    data: {
      gymId: plan.gymId,
      name: plan.name,
      durationMonths: plan.durationMonths,
      price: plan.price
    }
  });
}

export async function updateSubscriptionPlan(id: string, data: any) {
  return await prisma.subscriptionPlan.update({
    where: { id },
    data
  });
}

export async function deleteSubscriptionPlan(id: string) {
  try {
    await prisma.subscriptionPlan.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
