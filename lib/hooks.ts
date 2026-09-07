import useSWR, { preload } from 'swr';
import { 
  getGyms, 
  getCustomers, 
  getAttendance, 
  getTransactions, 
  getStaffs, 
  getProducts,
  getGymSettings,
  getSubscriptionPlans,
  getNextAvailableZkTecoId,
  getStaffAttendance,
  getProductSales
} from '@/lib/actions';

// Default SWR config to ensure fast cache hits without background lag
const SWR_CONFIG = {
  revalidateOnFocus: false, // Prevents freezing when returning to tab
  revalidateOnReconnect: false,
  dedupingInterval: 60000, // Increased to 60s to prevent spamming
  keepPreviousData: true,
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
export const preloadOverview = (gymId: string) => preload(gymId ? ['overview', gymId] : null, () => fetchOverview(gymId));
export function useOverviewData(gymId: string) {
  return useSWR(gymId ? ['overview', gymId] : null, () => fetchOverview(gymId), {
    ...SWR_CONFIG,
    refreshInterval: 5000,
    dedupingInterval: 2000,
    revalidateOnFocus: true
  });
}

// 2. Members Page Data
const fetchMembers = async (gymId: string) => {
  const [gyms, custs, atts, ps, txs, gymSettings, nextId, staffsList] = await Promise.all([
    getGyms(),
    getCustomers(gymId),
    getAttendance(gymId),
    getSubscriptionPlans(gymId),
    getTransactions(gymId),
    getGymSettings(gymId),
    getNextAvailableZkTecoId(gymId),
    getStaffs(gymId)
  ]);
  return { gyms, custs, atts, ps, txs, gymSettings, nextId, staffs: staffsList };
};
export const preloadMembers = (gymId: string) => preload(gymId ? ['members', gymId] : null, () => fetchMembers(gymId));
export function useMembersData(gymId: string) {
  return useSWR(gymId ? ['members', gymId] : null, () => fetchMembers(gymId), SWR_CONFIG);
}

// 3. Staffs Page Data
const fetchStaffs = async (gymId: string) => {
  const [gyms, staffsList, atts, gymSettings, nextId, custs] = await Promise.all([
    getGyms(),
    getStaffs(gymId),
    getStaffAttendance(gymId),
    getGymSettings(gymId),
    getNextAvailableZkTecoId(gymId),
    getCustomers(gymId)
  ]);
  return { gyms, staffs: staffsList, atts, gymSettings, nextId, custs };
};
export const preloadStaffs = (gymId: string) => preload(gymId ? ['staffs', gymId] : null, () => fetchStaffs(gymId));
export function useStaffsData(gymId: string) {
  return useSWR(gymId ? ['staffs', gymId] : null, () => fetchStaffs(gymId), SWR_CONFIG);
}

// 4. Checkin Terminal Data
const fetchCheckin = async (gymId: string) => {
  const [gyms, custs, staffsList, atts, stfAtts, gymSettings] = await Promise.all([
    getGyms(),
    getCustomers(gymId),
    getStaffs(gymId),
    getAttendance(gymId),
    getStaffAttendance(gymId),
    getGymSettings(gymId)
  ]);
  return { gyms, custs, staffs: staffsList, atts, stfAtts, gymSettings };
};
export const preloadCheckin = (gymId: string) => preload(gymId ? ['checkin', gymId] : null, () => fetchCheckin(gymId));
export function useCheckinData(gymId: string) {
  return useSWR(gymId ? ['checkin', gymId] : null, () => fetchCheckin(gymId), {
    ...SWR_CONFIG,
    refreshInterval: 3000,
    dedupingInterval: 1000,
    revalidateOnFocus: true
  });
}

// 5. Revenue Page Data
const fetchRevenue = async (gymId: string) => {
  const [gyms, txs, ps, custs, settings] = await Promise.all([
    getGyms(),
    getTransactions(gymId),
    getSubscriptionPlans(gymId),
    getCustomers(gymId),
    getGymSettings(gymId)
  ]);
  return { gyms, txs, ps, custs, settings };
};
export const preloadRevenue = (gymId: string) => preload(gymId ? ['revenue', gymId] : null, () => fetchRevenue(gymId));
export function useRevenueData(gymId: string) {
  return useSWR(gymId ? ['revenue', gymId] : null, () => fetchRevenue(gymId), SWR_CONFIG);
}

// 6. Products Page Data
const fetchProducts = async (gymId: string) => {
  const [gyms, prods, sales, custs, settings] = await Promise.all([
    getGyms(),
    getProducts(gymId),
    getProductSales(gymId),
    getCustomers(gymId),
    getGymSettings(gymId)
  ]);
  return { gyms, prods, sales, custs, settings };
};
export const preloadProducts = (gymId: string) => preload(gymId ? ['products', gymId] : null, () => fetchProducts(gymId));
export function useProductsData(gymId: string) {
  return useSWR(gymId ? ['products', gymId] : null, () => fetchProducts(gymId), SWR_CONFIG);
}

// 7. Reminders Page Data
const fetchReminders = async (gymId: string) => {
  const [gyms, custs, settings] = await Promise.all([
    getGyms(),
    getCustomers(gymId),
    getGymSettings(gymId)
  ]);
  return { gyms, custs, settings };
};
export const preloadReminders = (gymId: string) => preload(gymId ? ['reminders', gymId] : null, () => fetchReminders(gymId));
export function useRemindersData(gymId: string) {
  return useSWR(gymId ? ['reminders', gymId] : null, () => fetchReminders(gymId), SWR_CONFIG);
}

// 8. Broadcast Page Data
const fetchBroadcast = async (gymId: string) => {
  const [gyms, custs] = await Promise.all([
    getGyms(),
    getCustomers(gymId)
  ]);
  return { gyms, custs };
};
export const preloadBroadcast = (gymId: string) => preload(gymId ? ['broadcast', gymId] : null, () => fetchBroadcast(gymId));
export function useBroadcastData(gymId: string) {
  return useSWR(gymId ? ['broadcast', gymId] : null, () => fetchBroadcast(gymId), SWR_CONFIG);
}
