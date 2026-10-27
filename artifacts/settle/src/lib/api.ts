// API Client for the OPUSOL / Expense Splitter Backend

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly errors?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const getToken = (): string | null => {
  try {
    return localStorage.getItem('opusol-token');
  } catch {
    return null;
  }
};

export const setToken = (token: string | null): void => {
  try {
    if (token) {
      localStorage.setItem('opusol-token', token);
    } else {
      localStorage.removeItem('opusol-token');
    }
  } catch {
    // Ignore localStorage errors
  }
};

export const clearToken = (): void => {
  setToken(null);
};

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
}

/**
 * Shared HTTP request function for the OPUSOL API
 */
export async function apiRequest<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith('http')
    ? path
    : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const token = getToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: 'include',
      headers,
    });
  } catch (err) {
    throw new ApiError(
      'Could not reach the OPUSOL API backend. Please ensure the backend server is running.',
    );
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok) {
    const errorMsg =
      json?.message ||
      (json?.errors && json.errors.length > 0 ? json.errors.join(', ') : null) ||
      `The API returned HTTP ${response.status}.`;
    throw new ApiError(errorMsg, response.status, json?.errors);
  }

  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T;
  }

  return json as unknown as T;
}

export const apiConfig = { baseUrl: API_BASE_URL };

// ---------------------------------------------------------------------------
// Typed API Endpoints
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  name: string;
  email: string;
  created_at?: string;
}

export interface AuthResult {
  user: User;
  token: string;
}

export interface GroupMemberItem {
  id: string;
  group_id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'creator' | 'admin' | 'member';
  status: 'active' | 'inactive' | 'left';
  joined_at: string;
}

export interface GroupItem {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  creator_name?: string;
  creator_email?: string;
  role?: string;
  member_count?: number;
  members?: GroupMemberItem[];
  user_balance?: number;
  created_at: string;
  updated_at: string;
}

export interface PayerItem {
  userId: string;
  userName?: string;
  userEmail?: string;
  amount: number;
}

export interface SplitItem {
  userId: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  percentage?: number;
}

export interface ExpenseItem {
  id: string;
  group_id: string;
  title: string;
  description?: string;
  total_amount: number;
  split_type: 'equal' | 'exact' | 'percentage';
  created_by: string;
  creator_name?: string;
  creator_email?: string;
  payers?: PayerItem[];
  splits?: SplitItem[];
  created_at: string;
  updated_at: string;
}

export interface MemberBalance {
  userId: string;
  name: string;
  email: string;
  totalPaid: number;
  totalOwed: number;
  settledPaid: number;
  settledReceived: number;
  netBalance: number;
}

export interface BalanceSummary {
  totalExpenses: number;
  membersOwed: MemberBalance[];
  membersOwing: MemberBalance[];
}

export interface GroupBalancesResponse {
  balances: MemberBalance[];
  summary: BalanceSummary;
}

export interface SettlementSuggestion {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
}

export interface SettlementItem {
  id: string;
  group_id: string;
  payer_id: string;
  payer_name?: string;
  payer_email?: string;
  receiver_id: string;
  receiver_name?: string;
  receiver_email?: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequestItem {
  id: string;
  group_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  admin_note?: string;
  balance_snapshot: number;
  created_at: string;
  updated_at: string;
}

// Auth API
export const authApi = {
  register: (payload: { name: string; email: string; password: string }) =>
    apiRequest<AuthResult>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    apiRequest<AuthResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: () => apiRequest<{ user: User }>('/api/auth/me'),
};

// Groups API
export const groupsApi = {
  list: () => apiRequest<GroupItem[]>('/api/groups'),
  get: (groupId: string) => apiRequest<GroupItem>(`/api/groups/${groupId}`),
  create: (payload: { name: string; description?: string }) =>
    apiRequest<GroupItem>('/api/groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMembers: (groupId: string) =>
    apiRequest<GroupMemberItem[]>(`/api/groups/${groupId}/members`),
  addMember: (groupId: string, email: string) =>
    apiRequest<GroupMemberItem>(`/api/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  removeMember: (groupId: string, memberId: string) =>
    apiRequest<void>(`/api/groups/${groupId}/members/${memberId}`, {
      method: 'DELETE',
    }),
};

// Expenses API
export const expensesApi = {
  list: (groupId: string) =>
    apiRequest<ExpenseItem[]>(`/api/groups/${groupId}/expenses`),
  get: (expenseId: string) => apiRequest<ExpenseItem>(`/api/expenses/${expenseId}`),
  create: (
    groupId: string,
    payload: {
      title: string;
      description?: string;
      totalAmount: number; // in paise
      splitType: 'equal' | 'exact' | 'percentage';
      payers: { userId: string; amount: number }[];
      splits: { userId: string; amount?: number; percentage?: number }[];
    },
  ) =>
    apiRequest<ExpenseItem>(`/api/groups/${groupId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (
    expenseId: string,
    payload: Partial<{
      title: string;
      description: string;
      totalAmount: number;
      splitType: string;
      payers: { userId: string; amount: number }[];
      splits: { userId: string; amount?: number; percentage?: number }[];
    }>,
  ) =>
    apiRequest<ExpenseItem>(`/api/expenses/${expenseId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  delete: (expenseId: string) =>
    apiRequest<void>(`/api/expenses/${expenseId}`, {
      method: 'DELETE',
    }),
};

// Balances API
export const balancesApi = {
  get: (groupId: string) =>
    apiRequest<GroupBalancesResponse>(`/api/groups/${groupId}/balances`),
  suggestions: (groupId: string) =>
    apiRequest<{ suggestions: SettlementSuggestion[] }>(
      `/api/groups/${groupId}/settlements/suggestions`,
    ),
};

// Settlements API
export const settlementsApi = {
  list: (groupId: string) =>
    apiRequest<SettlementItem[]>(`/api/groups/${groupId}/settlements`),
  create: (
    groupId: string,
    payload: { payerId: string; receiverId: string; amount: number },
  ) =>
    apiRequest<SettlementItem>(`/api/groups/${groupId}/settlements`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (settlementId: string, status: 'completed' | 'cancelled') =>
    apiRequest<SettlementItem>(`/api/settlements/${settlementId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

// Leave Requests API
export const leaveRequestsApi = {
  list: (groupId: string) =>
    apiRequest<LeaveRequestItem[]>(`/api/groups/${groupId}/leave-requests`),
  create: (groupId: string, payload: { reason?: string }) =>
    apiRequest<LeaveRequestItem>(`/api/groups/${groupId}/leave-requests`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (
    requestId: string,
    payload: { action: 'approve' | 'reject'; adminNote?: string },
  ) =>
    apiRequest<LeaveRequestItem>(`/api/leave-requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};
