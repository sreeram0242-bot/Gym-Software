import useSWR from 'swr';
import { 
  getGyms, 
  getCustomers, 
  getAttendance, 
  getTransactions, 
  getStaffs, 
  getProducts,
  getGymSettings
} from '@/lib/actions';

// Default SWR config to ensure fast cache hits and background revalidation on focus
const SWR_CONFIG = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
};

// 1. Overview Page Data
const fetchOverview = async (gymId: string) => {
  const [gyms, custs, atts, txs] = await Promise.all([
    getGyms(),
    getCustomers(gymId),
    getAttendance(gymId),
    getTransactions(gymId)
  ]);
  return { gyms, custs, atts, txs };
};

export function useOverviewData(gymId: string) {
  return useSWR(gymId ? ['overview', gymId] : null, () => fetchOverview(gymId), SWR_CONFIG);
}

// 2. Members Page Data
const fetchMembers = async (gymId: string) => {
  const [gyms, custs, atts, ps, txs, gymSettings, nextId] = await Promise.all([
    getGyms(),
    getCustomers(gymId),
    getAttendance(gymId),
    import('@/lib/actions').then(m => m.getSubscriptionPlans(gymId)),
    getTransactions(gymId),
    import('@/lib/actions').then(m => m.getGymSettings(gymId)),
    import('@/lib/actions').then(m => m.getNextAvailableZkTecoId(gymId))
  ]);
  return { gyms, custs, atts, ps, txs, gymSettings, nextId };
};

export function useMembersData(gymId: string) {
  return useSWR(gymId ? ['members', gymId] : null, () => fetchMembers(gymId), SWR_CONFIG);
}

// 3. Staffs Page Data
const fetchStaffs = async (gymId: string) => {
  const [gyms, staffsList, atts, gymSettings, nextId] = await Promise.all([
    getGyms(),
    getStaffs(gymId),
    import('@/lib/actions').then(m => m.getStaffAttendance(gymId)),
    import('@/lib/actions').then(m => m.getGymSettings(gymId)),
    import('@/lib/actions').then(m => m.getNextAvailableZkTecoId(gymId))
  ]);
  return { gyms, staffs: staffsList, atts, gymSettings, nextId };
};

export function useStaffsData(gymId: string) {
  return useSWR(gymId ? ['staffs', gymId] : null, () => fetchStaffs(gymId), SWR_CONFIG);
}

// 4. Checkin Terminal Data
const fetchCheckin = async (gymId: string) => {
  const [gyms, custs, staffsList, atts] = await Promise.all([
    getGyms(),
    getCustomers(gymId),
    getStaffs(gymId),
    getAttendance(gymId)
  ]);
  return { gyms, custs, staffs: staffsList, atts };
};

export function useCheckinData(gymId: string) {
  return useSWR(gymId ? ['checkin', gymId] : null, () => fetchCheckin(gymId), SWR_CONFIG);
}

// 5. Revenue Page Data
const fetchRevenue = async (gymId: string) => {
  const [gyms, txs] = await Promise.all([
    getGyms(),
    getTransactions(gymId)
  ]);
  return { gyms, txs };
};

export function useRevenueData(gymId: string) {
  return useSWR(gymId ? ['revenue', gymId] : null, () => fetchRevenue(gymId), SWR_CONFIG);
}
