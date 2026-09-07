import useSWR, { preload } from 'swr';
import { 
  getGymById,
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
  dedupingInterval: 2000, // 2s prevents double-render spam while allowing fast mutation revalidation
  keepPreviousData: true,
};

// Safe promise wrapper so intermittent network or action hiccups never crash whole page data
const safe = <T>(promise: Promise<T>, fallback: T): Promise<T> =>
  promise.catch(err => {
    console.warn('[SWR Data Fetch Warning]', err?.message || err);
    return fallback;
  });

// 1. Overview Page Data
const fetchOverview = async (gymId: string) => {
  const [gym, custs, atts, txs] = await Promise.all([
    safe(getGymById(gymId), null),
    safe(getCustomers(gymId), []),
    safe(getAttendance(gymId), []),
    safe(getTransactions(gymId), [])
  ]);
  return { gyms: gym ? [gym] : [], custs, atts, txs };
};
export const preloadOverview = (gymId: string) => preload(gymId ? ['overview', gymId] : null, () => fetchOverview(gymId));
export function useOverviewData(gymId: string) {
  return useSWR(gymId ? ['overview', gymId] : null, () => fetchOverview(gymId), SWR_CONFIG);
}

// 2. Members Page Data
const fetchMembers = async (gymId: string) => {
  const [gym, custs, atts, ps, txs, gymSettings, nextId, staffsList] = await Promise.all([
    safe(getGymById(gymId), null),
    safe(getCustomers(gymId), []),
    safe(getAttendance(gymId), []),
    safe(getSubscriptionPlans(gymId), []),
    safe(getTransactions(gymId), []),
    safe(getGymSettings(gymId), null),
    safe(getNextAvailableZkTecoId(gymId), '001'),
    safe(getStaffs(gymId), [])
  ]);
  return { gyms: gym ? [gym] : [], custs, atts, ps, txs, gymSettings, nextId, staffs: staffsList };
};
export const preloadMembers = (gymId: string) => preload(gymId ? ['members', gymId] : null, () => fetchMembers(gymId));
export function useMembersData(gymId: string) {
  return useSWR(gymId ? ['members', gymId] : null, () => fetchMembers(gymId), SWR_CONFIG);
}

// 3. Staffs Page Data
const fetchStaffs = async (gymId: string) => {
  const [gym, staffsList, atts, gymSettings, nextId, custs] = await Promise.all([
    safe(getGymById(gymId), null),
    safe(getStaffs(gymId), []),
    safe(getStaffAttendance(gymId), []),
    safe(getGymSettings(gymId), null),
    safe(getNextAvailableZkTecoId(gymId), '001'),
    safe(getCustomers(gymId), [])
  ]);
  return { gyms: gym ? [gym] : [], staffs: staffsList, atts, gymSettings, nextId, custs };
};
export const preloadStaffs = (gymId: string) => preload(gymId ? ['staffs', gymId] : null, () => fetchStaffs(gymId));
export function useStaffsData(gymId: string) {
  return useSWR(gymId ? ['staffs', gymId] : null, () => fetchStaffs(gymId), { ...SWR_CONFIG, refreshInterval: 8000 });
}

// 4. Checkin Terminal Data
const fetchCheckin = async (gymId: string) => {
  const [gym, custs, staffsList, atts, stfAtts, gymSettings] = await Promise.all([
    safe(getGymById(gymId), null),
    safe(getCustomers(gymId), []),
    safe(getStaffs(gymId), []),
    safe(getAttendance(gymId), []),
    safe(getStaffAttendance(gymId), []),
    safe(getGymSettings(gymId), null)
  ]);
  return { gyms: gym ? [gym] : [], custs, staffs: staffsList, atts, stfAtts, gymSettings };
};
export const preloadCheckin = (gymId: string) => preload(gymId ? ['checkin', gymId] : null, () => fetchCheckin(gymId));
export function useCheckinData(gymId: string) {
  return useSWR(gymId ? ['checkin', gymId] : null, () => fetchCheckin(gymId), { ...SWR_CONFIG, refreshInterval: 6000 });
}

// 5. Revenue Page Data
const fetchRevenue = async (gymId: string) => {
  const [gym, txs, ps, custs, settings] = await Promise.all([
    safe(getGymById(gymId), null),
    safe(getTransactions(gymId), []),
    safe(getSubscriptionPlans(gymId), []),
    safe(getCustomers(gymId), []),
    safe(getGymSettings(gymId), null)
  ]);
  return { gyms: gym ? [gym] : [], txs, ps, custs, settings };
};
export const preloadRevenue = (gymId: string) => preload(gymId ? ['revenue', gymId] : null, () => fetchRevenue(gymId));
export function useRevenueData(gymId: string) {
  return useSWR(gymId ? ['revenue', gymId] : null, () => fetchRevenue(gymId), SWR_CONFIG);
}

// 6. Products Page Data
const fetchProducts = async (gymId: string) => {
  const [gym, prods, sales, custs, settings] = await Promise.all([
    safe(getGymById(gymId), null),
    safe(getProducts(gymId), []),
    safe(getProductSales(gymId), []),
    safe(getCustomers(gymId), []),
    safe(getGymSettings(gymId), null)
  ]);
  return { gyms: gym ? [gym] : [], prods, sales, custs, settings };
};
export const preloadProducts = (gymId: string) => preload(gymId ? ['products', gymId] : null, () => fetchProducts(gymId));
export function useProductsData(gymId: string) {
  return useSWR(gymId ? ['products', gymId] : null, () => fetchProducts(gymId), SWR_CONFIG);
}

// 7. Reminders Page Data
const fetchReminders = async (gymId: string) => {
  const [gym, custs, settings] = await Promise.all([
    safe(getGymById(gymId), null),
    safe(getCustomers(gymId), []),
    safe(getGymSettings(gymId), null)
  ]);
  return { gyms: gym ? [gym] : [], custs, settings };
};
export const preloadReminders = (gymId: string) => preload(gymId ? ['reminders', gymId] : null, () => fetchReminders(gymId));
export function useRemindersData(gymId: string) {
  return useSWR(gymId ? ['reminders', gymId] : null, () => fetchReminders(gymId), SWR_CONFIG);
}

// 8. Broadcast Page Data
const fetchBroadcast = async (gymId: string) => {
  if (!gymId) return { gyms: [], custs: [] };
  const [gym, custs] = await Promise.all([
    safe(getGymById(gymId), null),
    safe(getCustomers(gymId), [])
  ]);
  return { gyms: gym ? [gym] : [], custs: custs || [] };
};
export const preloadBroadcast = (gymId: string) => preload(gymId ? ['broadcast', gymId] : null, () => fetchBroadcast(gymId));
export function useBroadcastData(gymId: string) {
  return useSWR(gymId ? ['broadcast', gymId] : null, () => fetchBroadcast(gymId), {
    ...SWR_CONFIG,
    revalidateOnFocus: true
  });
}
