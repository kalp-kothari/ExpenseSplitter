import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, Banknote, Calendar, Check, ChevronRight, CircleHelp,
  Coffee, House, LogIn, LogOut, Moon, Plus, ReceiptText, RefreshCw, Sun, UserPlus, Users, Wallet, X,
} from 'lucide-react';
import {
  balances as seedBalances,
  expenses as seedExpenses,
  groups as seedGroups,
  type Expense,
  type Group,
  type Person,
} from './data';
import {
  authApi,
  groupsApi,
  expensesApi,
  balancesApi,
  settlementsApi,
  leaveRequestsApi,
  getToken,
  setToken,
  clearToken,
  type User,
  type GroupItem,
  type GroupMemberItem,
  type ExpenseItem,
  type SettlementItem,
  type SettlementSuggestion,
  type MemberBalance,
} from './lib/api';

export const money = (n: number | string | null | undefined): string => {
  if (n === null || n === undefined || n === '') return '₹0.00';
  const num = typeof n === 'number' ? n : parseFloat(String(n).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export const getInitials = (name?: string | null): string => {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const TONES = ['mint', 'coral', 'butter', 'lilac', 'blue', 'sage'] as const;
export const getToneForString = (str?: string | null): string => {
  if (!str) return 'mint';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
};

export const formatExpenseDate = (val?: string | number | Date | null): string => {
  if (!val) return 'Today';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return 'Today';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Today';
  }
};

type Store = {
  groups: Group[];
  expenses: Expense[];
  balances: { total: number; owe: number; owed: number; monthlySpend?: number };
  settlements: SettlementItem[];
};

function loadDemoStore(): Store {
  try {
    const saved = localStorage.getItem('opusol-demo-data');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return {
          groups: Array.isArray(parsed.groups) ? parsed.groups : seedGroups,
          expenses: Array.isArray(parsed.expenses) ? parsed.expenses : seedExpenses,
          balances:
            parsed.balances && typeof parsed.balances === 'object'
              ? {
                  total: Number(parsed.balances.total) || 0,
                  owe: Number(parsed.balances.owe) || 0,
                  owed: Number(parsed.balances.owed) || 0,
                  monthlySpend: Number(parsed.balances.monthlySpend) || 4800,
                }
              : seedBalances,
          settlements: Array.isArray(parsed.settlements) ? parsed.settlements : [],
        };
      }
    }
  } catch {
    // Reset to bundled seed data on parse error
  }
  return {
    groups: seedGroups,
    expenses: seedExpenses,
    balances: seedBalances,
    settlements: [],
  };
}

function Brand() {
  return (
    <Link href="/dashboard" className="op-brand" aria-label="OPUSOL dashboard">
      <span className="op-mark">
        <i />
        <i />
        <i />
      </span>
      <b>opusol</b>
    </Link>
  );
}

function AppShell({
  children,
  active,
  dark,
  toggle,
  onLogout,
  user,
  isLive,
  onRefresh,
  loading,
}: {
  children: ReactNode;
  active: string;
  dark: boolean;
  toggle: () => void;
  onLogout: () => void;
  user: User | null;
  isLive: boolean;
  onRefresh: () => void;
  loading: boolean;
}) {
  const links = [
    ['Dashboard', '/dashboard', Wallet],
    ['Groups', '/groups', Users],
    ['Expenses', '/expenses', ReceiptText],
    ['Settlements', '/settlements', Banknote],
  ] as const;

  const mobileLinks = user
    ? links
    : ([
        ['Dashboard', '/dashboard', Wallet],
        ['Groups', '/groups', Users],
        ['Expenses', '/expenses', ReceiptText],
        ['Sign In', '/login', LogIn],
      ] as const);

  return (
    <div className="op-app">
      <aside className="op-sidebar">
        <Brand />
        <div className="op-workspace">
          <span>O</span>
          <div>
            <small>WORKSPACE</small>
            <b>The Opusol Team</b>
          </div>
        </div>
        <nav>
          <span className="op-label">Navigation</span>
          {links.map(([label, href, Icon]) => (
            <Link
              key={label}
              href={href}
              className={`op-nav ${active === label ? 'selected' : ''}`}
            >
              <Icon size={17} />
              <span>{label}</span>
              {active === label && <em>·</em>}
            </Link>
          ))}
        </nav>

        <div className="op-sidebar-bottom">
          <div className="op-help">
            <CircleHelp size={16} />
            <span>
              <b>Live Sync active</b>
              <small style={{ display: 'block', fontSize: '9px', color: 'hsl(var(--muted-foreground))' }}>
                {isLive ? 'PostgreSQL backend' : 'Demo Mode (Offline)'}
              </small>
            </span>
          </div>

          <div className="op-account">
            {user ? (
              <>
                <span className="op-avatar">{getInitials(user.name)}</span>
                <span>
                  <b>{user.name}</b>
                  <small style={{ display: 'block', fontSize: '10px', color: 'hsl(var(--muted-foreground))' }}>
                    {user.email}
                  </small>
                </span>
                <button
                  onClick={onLogout}
                  className="op-theme"
                  title="Log out"
                  style={{ width: '32px', height: '32px' }}
                >
                  <LogOut size={14} />
                </button>
              </>
            ) : (
              <>
                <span className="op-avatar">?</span>
                <span>
                  <b>Guest Mode</b>
                  <small style={{ display: 'block', fontSize: '10px', color: 'hsl(var(--muted-foreground))' }}>
                    Not signed in
                  </small>
                </span>
                <Link
                  href="/login"
                  className="op-primary op-small"
                  style={{ textDecoration: 'none', marginLeft: 'auto', padding: '0 10px', fontSize: '11px', height: '30px' }}
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </aside>

      <main className="op-main">
        <header className="op-top">
          <div className="op-crumb">
            <span>The Opusol</span>
            <i>/</i>
            <b>{active}</b>
          </div>
          <div className="op-mobile-brand">
            <Brand />
          </div>
          <div className="op-top-actions">
            {isLive ? (
              <span className="demo-pill" style={{ background: '#e6f7ec', color: '#1f7a37' }}>
                <i style={{ background: '#1f7a37' }} /> LIVE
              </span>
            ) : (
              <span className="demo-pill">
                <i /> DEMO
              </span>
            )}
            <button
              onClick={onRefresh}
              className="op-theme"
              title="Refresh data"
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={toggle} className="op-theme" title="Toggle theme">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  className="op-avatar"
                  title={`${user.name} (${user.email})`}
                  style={{ width: '32px', height: '32px', fontSize: '11px' }}
                >
                  {getInitials(user.name)}
                </span>
                <button
                  onClick={onLogout}
                  className="op-theme"
                  title="Log out"
                  style={{ width: '32px', height: '32px' }}
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="op-primary op-small"
                style={{
                  textDecoration: 'none',
                  height: '32px',
                  padding: '0 12px',
                  fontSize: '11px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <LogIn size={13} /> Sign in
              </Link>
            )}
          </div>
        </header>

        {children}

        <nav className="op-mobile-nav">
          {mobileLinks.map(([label, href, Icon]) => (
            <Link
              key={label}
              href={href}
              className={active === label ? 'selected' : ''}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}

function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <div className="op-overlay" onClick={close}>
      <div className="op-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button onClick={close} aria-label="Close modal">
            <X size={17} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export interface ExpensePayload {
  groupId: string;
  title: string;
  description?: string;
  totalAmountPaise: number;
  splitType: 'equal' | 'exact' | 'percentage';
  payers: { userId: string; amount: number }[];
  splits: { userId: string; amount?: number; percentage?: number }[];
}

interface MemberOption {
  id: string;
  name: string;
  email?: string;
}

function AddExpenseModal({
  isOpen,
  onClose,
  initialGroupId,
  store,
  isLive,
  user,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialGroupId?: string;
  store: Store;
  isLive: boolean;
  user: User | null;
  onSubmit: (payload: ExpensePayload) => Promise<void>;
}) {
  const [groupId, setGroupId] = useState(initialGroupId || store.groups[0]?.id || '');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage'>('equal');
  const [payerId, setPayerId] = useState('');
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  // Load members when groupId changes
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;

    if (isLive) {
      groupsApi
        .getMembers(groupId)
        .then((mList) => {
          if (cancelled) return;
          if (Array.isArray(mList) && mList.length > 0) {
            const mapped = mList.map((m: any) => ({
              id: m.userId || m.user_id,
              name: m.name,
              email: m.email,
            }));
            setMembers(mapped);
            // Default select all
            const sel: Record<string, boolean> = {};
            mapped.forEach((m) => (sel[m.id] = true));
            setSelected(sel);
            // Default payer
            if (user?.id && mapped.some((m) => m.id === user.id)) {
              setPayerId(user.id);
            } else if (mapped[0]) {
              setPayerId(mapped[0].id);
            }
          } else {
            fallbackMembers();
          }
        })
        .catch(() => {
          if (!cancelled) fallbackMembers();
        });
    } else {
      fallbackMembers();
    }

    function fallbackMembers() {
      const grp = store.groups.find((g) => g.id === groupId);
      if (grp?.members?.length) {
        const mapped = grp.members.map((m) => ({
          id: m.name,
          name: m.name,
        }));
        setMembers(mapped);
        const sel: Record<string, boolean> = {};
        mapped.forEach((m) => (sel[m.id] = true));
        setSelected(sel);
        setPayerId(mapped[0]?.id || '');
      } else {
        setMembers([{ id: user?.id || 'you', name: user?.name || 'You' }]);
        setSelected({ [user?.id || 'you']: true });
        setPayerId(user?.id || 'you');
      }
    }

    return () => {
      cancelled = true;
    };
  }, [groupId, isLive, store.groups, user?.id, user?.name]);

  const activeMembers = useMemo(
    () => members.filter((m) => selected[m.id]),
    [members, selected]
  );

  const cleanFloat = (val: string | number) => {
    const n = typeof val === 'number' ? val : parseFloat(val);
    return Number.isFinite(n) ? n : 0;
  };

  const numAmount = cleanFloat(amount);

  // When splitType changes, auto-populate exact and percentage shares evenly
  const handleSplitTypeChange = (type: 'equal' | 'exact' | 'percentage') => {
    setSplitType(type);
    setFormError('');
    const count = activeMembers.length;
    if (count === 0) return;

    if (type === 'exact') {
      const totalPaise = Math.round(numAmount * 100);
      const basePaise = Math.floor(totalPaise / count);
      const remainder = totalPaise % count;
      const exacts: Record<string, string> = {};
      activeMembers.forEach((m, idx) => {
        // Allocate remaining paise to payer (or first participant)
        const isTarget = m.id === payerId || (idx === 0 && !activeMembers.some((x) => x.id === payerId));
        const paise = basePaise + (isTarget ? remainder : 0);
        exacts[m.id] = (paise / 100).toFixed(2);
      });
      setExactAmounts(exacts);
    } else if (type === 'percentage') {
      const basePct = Number((100 / count).toFixed(2));
      const diffPct = Number((100 - basePct * count).toFixed(2));
      const pcts: Record<string, string> = {};
      activeMembers.forEach((m, idx) => {
        const isTarget = m.id === payerId || (idx === 0 && !activeMembers.some((x) => x.id === payerId));
        pcts[m.id] = (basePct + (isTarget ? diffPct : 0)).toFixed(2);
      });
      setPercentages(pcts);
    }
  };

  // Calculations for Exact split
  const allocatedExact = useMemo(() => {
    return activeMembers.reduce((sum, m) => sum + cleanFloat(exactAmounts[m.id]), 0);
  }, [activeMembers, exactAmounts]);

  const remainingExact = Number((numAmount - allocatedExact).toFixed(2));

  // Calculations for Percentage split
  const allocatedPct = useMemo(() => {
    return activeMembers.reduce((sum, m) => sum + cleanFloat(percentages[m.id]), 0);
  }, [activeMembers, percentages]);

  const remainingPct = Number((100 - allocatedPct).toFixed(2));

  const toggleMember = (memberId: string) => {
    setSelected((prev) => {
      const next = { ...prev, [memberId]: !prev[memberId] };
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please enter an expense description.');
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid positive amount.');
      return;
    }
    if (!groupId) {
      setFormError('Please choose a group.');
      return;
    }
    if (!payerId) {
      setFormError('Please select who paid.');
      return;
    }
    if (activeMembers.length === 0) {
      setFormError('Please select at least one member to share this expense.');
      return;
    }

    // Safely round total to integer paise
    const totalPaise = Math.round(cleanFloat(numAmount) * 100);

    let splitsPayload: { userId: string; amount?: number; percentage?: number }[] = [];

    if (splitType === 'equal') {
      splitsPayload = activeMembers.map((m) => ({ userId: m.id }));
    } else if (splitType === 'exact') {
      const paiseShares = activeMembers.map((m) => Math.round(cleanFloat(exactAmounts[m.id]) * 100));
      const sumPaise = paiseShares.reduce((a, b) => a + b, 0);
      const diffPaise = totalPaise - sumPaise;

      // Reconcile small decimal rounding differences (within 5 paise) to the payer
      if (Math.abs(diffPaise) <= 5) {
        const payerIdx = activeMembers.findIndex((m) => m.id === payerId);
        const targetIdx = payerIdx >= 0 ? payerIdx : 0;
        paiseShares[targetIdx] += diffPaise;
      } else {
        setFormError(
          `Exact shares must sum to ${money(numAmount)}. Currently: ${money(sumPaise / 100)} (${money(Math.abs(diffPaise) / 100)} ${diffPaise > 0 ? 'remaining' : 'over'}).`
        );
        return;
      }
      splitsPayload = activeMembers.map((m, idx) => ({
        userId: m.id,
        amount: paiseShares[idx],
      }));
    } else if (splitType === 'percentage') {
      const parsedPcts = activeMembers.map((m) => cleanFloat(percentages[m.id]));
      const sumPcts = parsedPcts.reduce((a, b) => a + b, 0);
      const diffPct = Number((100 - sumPcts).toFixed(2));

      // Reconcile small decimal rounding differences (within 0.1%) to the payer
      if (Math.abs(diffPct) <= 0.1) {
        const payerIdx = activeMembers.findIndex((m) => m.id === payerId);
        const targetIdx = payerIdx >= 0 ? payerIdx : 0;
        parsedPcts[targetIdx] = Number((parsedPcts[targetIdx] + diffPct).toFixed(2));
      } else {
        setFormError(
          `Percentages must sum to exactly 100%. Currently: ${sumPcts.toFixed(1)}% (${diffPct.toFixed(1)}% remaining).`
        );
        return;
      }
      splitsPayload = activeMembers.map((m, idx) => ({
        userId: m.id,
        percentage: parsedPcts[idx],
      }));
    }

    setBusy(true);
    setFormError('');
    try {
      await onSubmit({
        groupId,
        title: title.trim(),
        totalAmountPaise: totalPaise,
        splitType,
        payers: [{ userId: payerId, amount: totalPaise }],
        splits: splitsPayload,
      });
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create expense');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal title="Add an expense" close={onClose}>
      <form className="op-form" onSubmit={handleSubmit}>
        <label>
          Description
          <input
            autoFocus
            required
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Dinner, Groceries, WiFi bill"
          />
        </label>

        <label>
          Total amount (₹)
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </label>

        {!initialGroupId && (
          <label>
            Group
            <select
              required
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              <option value="">Choose a group</option>
              {store.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          Paid by
          <select
            required
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.id === user?.id ? '(You)' : ''}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>
            Split Type
          </span>
          <div className="op-split-tabs">
            <button
              type="button"
              className={`op-split-tab ${splitType === 'equal' ? 'active' : ''}`}
              onClick={() => handleSplitTypeChange('equal')}
            >
              = Equally
            </button>
            <button
              type="button"
              className={`op-split-tab ${splitType === 'exact' ? 'active' : ''}`}
              onClick={() => handleSplitTypeChange('exact')}
            >
              ₹ Exact Amounts
            </button>
            <button
              type="button"
              className={`op-split-tab ${splitType === 'percentage' ? 'active' : ''}`}
              onClick={() => handleSplitTypeChange('percentage')}
            >
              % Percentage
            </button>
          </div>
        </div>

        {/* Split Participants Details */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600 }}>Participants ({activeMembers.length})</span>
            {splitType === 'equal' && numAmount > 0 && activeMembers.length > 0 && (
              <span className="op-split-badge ok">
                {money(numAmount / activeMembers.length)} each
              </span>
            )}
            {splitType === 'exact' && (
              <span
                className={`op-split-badge ${Math.abs(remainingExact) < 0.005 ? 'ok' : remainingExact > 0 ? 'warn' : 'error'}`}
              >
                {Math.abs(remainingExact) < 0.005
                  ? 'Exact match'
                  : remainingExact > 0
                  ? `${money(remainingExact)} remaining`
                  : `${money(Math.abs(remainingExact))} over`}
              </span>
            )}
            {splitType === 'percentage' && (
              <span
                className={`op-split-badge ${Math.abs(remainingPct) < 0.05 ? 'ok' : remainingPct > 0 ? 'warn' : 'error'}`}
              >
                {Math.abs(remainingPct) < 0.05
                  ? '100% Allocated'
                  : remainingPct > 0
                  ? `${remainingPct.toFixed(1)}% remaining`
                  : `${Math.abs(remainingPct).toFixed(1)}% over`}
              </span>
            )}
          </div>

          <div className="op-split-list">
            {members.map((m) => {
              const isChecked = !!selected[m.id];
              return (
                <div className="op-split-item" key={m.id}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '9px',
                      cursor: 'pointer',
                      flex: 1,
                      margin: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleMember(m.id)}
                      style={{ width: '16px', height: '16px', margin: 0 }}
                    />
                    <span className="op-avatar" style={{ width: '26px', height: '26px', fontSize: '9px' }}>
                      {getInitials(m.name)}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600 }}>
                      {m.name} {m.id === user?.id ? '(You)' : ''}
                    </span>
                  </label>

                  {/* Input for Exact Split */}
                  {splitType === 'exact' && isChecked && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={exactAmounts[m.id] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setExactAmounts((prev) => ({ ...prev, [m.id]: val }));
                        }}
                        style={{ width: '85px', height: '32px', textAlign: 'right', padding: '0 6px', fontSize: '11px' }}
                        placeholder="0.00"
                      />
                    </div>
                  )}

                  {/* Input for Percentage Split */}
                  {splitType === 'percentage' && isChecked && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={percentages[m.id] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPercentages((prev) => ({ ...prev, [m.id]: val }));
                        }}
                        style={{ width: '65px', height: '32px', textAlign: 'right', padding: '0 6px', fontSize: '11px' }}
                        placeholder="0"
                      />
                      <span style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>%</span>
                      <small style={{ fontSize: '10px', color: 'hsl(var(--muted-foreground))', minWidth: '55px', textAlign: 'right' }}>
                        {money((numAmount * (parseFloat(percentages[m.id]) || 0)) / 100)}
                      </small>
                    </div>
                  )}

                  {/* Equal split share */}
                  {splitType === 'equal' && isChecked && (
                    <span style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>
                      {money(activeMembers.length > 0 && numAmount > 0 ? numAmount / activeMembers.length : 0)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {formError && <p className="op-error">{formError}</p>}

        <button className="op-primary" type="submit" disabled={busy || activeMembers.length === 0}>
          {busy ? 'Adding...' : 'Add expense'}
        </button>
      </form>
    </Modal>
  );
}

function Auth({
  register,
  onAuthSuccess,
}: {
  register: boolean;
  onAuthSuccess: (user: User) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice('');
    setLoading(true);

    try {
      if (register) {
        const res = await authApi.register({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        setToken(res.token);
        onAuthSuccess(res.user);
        setLocation('/dashboard');
      } else {
        const res = await authApi.login({
          email: email.trim(),
          password,
        });
        setToken(res.token);
        onAuthSuccess(res.user);
        setLocation('/dashboard');
      }
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="op-auth">
      <div className="op-auth-brand">
        <Brand />
      </div>

      <div className="op-auth-card">
        <span className="op-kicker">
          {register ? 'GET STARTED' : 'WELCOME BACK'}
        </span>
        <h1>{register ? 'Create your account' : 'Sign in to OPUSOL'}</h1>
        <p>
          {register
            ? 'Start sharing and splitting expenses with your roommates, friends, and family.'
            : 'Continue where you left off. View your balances and settlements.'}
        </p>

        <form onSubmit={submit}>
          {register && (
            <label>
              Full name
              <input
                required
                type="text"
                autoComplete="name"
                placeholder="Aarav Mehta"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}

          <label>
            Email address
            <input
              required
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label>
            Password
            <input
              required
              type="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {notice && <p className="op-error">{notice}</p>}

          <button className="op-primary" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : register ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="op-auth-switch">
          {register ? (
            <>
              Already have an account? <Link href="/login">Sign in</Link>
            </>
          ) : (
            <>
              Don’t have an account yet?{' '}
              <Link href="/register">Create one free</Link>
            </>
          )}
        </p>

        <button
          type="button"
          onClick={() => {
            localStorage.setItem('opusol-explore-demo', 'true');
            setLocation('/dashboard');
          }}
          className="op-demo-link"
          style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}
        >
          Or explore sample data in offline Demo Mode →
        </button>
      </div>

      <footer className="op-auth-foot">
        Secure SHA-256 JWT Authentication · The Opusol Team
      </footer>
    </div>
  );
}

function Balance({
  icon: Icon,
  title,
  value,
  detail,
  accent = false,
}: {
  icon: typeof Wallet;
  title: string;
  value: number;
  detail: string;
  accent?: boolean;
}) {
  return (
    <article className={`op-balance ${accent ? 'accent' : ''}`}>
      <span>
        <small>{title}</small>
        <i>
          <Icon size={17} />
        </i>
      </span>
      <b>{money(value)}</b>
      <small>{detail}</small>
    </article>
  );
}

function Metric({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: typeof Wallet;
  title: string;
  value: number | string;
  detail: string;
}) {
  return (
    <article className="op-balance">
      <span>
        <small>{title}</small>
        <i>
          <Icon size={17} />
        </i>
      </span>
      <b>{typeof value === 'number' ? value : value}</b>
      <small>{detail}</small>
    </article>
  );
}

function ExpenseTable({
  items,
  onDelete,
}: {
  items: Expense[];
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="op-expenses">
      {items.length ? (
        items.map((x) => (
          <div className="op-expense" key={x.id}>
            <span className="op-expense-icon">
              <ReceiptText size={17} />
            </span>
            <span className="op-expense-info">
              <b>{x.title}</b>
              <small>
                {x.group} · {formatExpenseDate(x.date)} · Paid by {x.payer.name || 'You'}
              </small>
            </span>
            <span className="op-expense-amount">
              <b>{money(x.amount)}</b>
              <small>{x.status}</small>
            </span>
            {onDelete && (
              <button
                className="op-theme"
                style={{ width: '28px', height: '28px', marginLeft: '6px' }}
                onClick={() => onDelete(x.id)}
                title="Delete expense"
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))
      ) : (
        <p className="op-empty">No expenses recorded yet.</p>
      )}
    </div>
  );
}

function Dashboard({
  store,
  isLive,
  user,
  onCreateGroup,
  onCreateExpense,
}: {
  store: Store;
  isLive: boolean;
  user: User | null;
  onCreateGroup: (name: string, description: string) => Promise<void>;
  onCreateExpense: (payload: ExpensePayload) => Promise<void>;
}) {
  const [modal, setModal] = useState<'group' | 'expense' | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const groupOptions = store.groups;

  const handleGroupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setFormError('');
    try {
      const creatorDesc = user ? `Created by ${user.name}` : 'Created by member';
      await onCreateGroup(name.trim(), creatorDesc);
      setName('');
      setModal(null);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setBusy(false);
    }
  };

  const displayName = user ? user.name.split(' ')[0] : 'Aarav';

  return (
    <div className="op-content">
      {!isLive && (
        <div
          className="op-note"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '20px',
            background: 'hsl(var(--accent)/.4)',
            borderColor: 'hsl(var(--primary)/.35)',
            flexWrap: 'wrap',
          }}
        >
          <span>
            💡 <b>Offline Demo Mode:</b> You are viewing sample data. Sign in to view your real groups and expenses.
          </span>
          <Link
            href="/login"
            className="op-primary op-small"
            style={{ textDecoration: 'none', height: '28px', fontSize: '11px', padding: '0 10px' }}
          >
            Sign In to Live App →
          </Link>
        </div>
      )}
      <div className="op-welcome">
        <div>
          <span className="op-kicker">
            <i /> YOUR SHARED LIFE, IN ONE PLACE
          </span>
          <h1>
            Good to see you, {displayName}
            <span>.</span>
          </h1>
          <p>Everything you share, settled simply.</p>
        </div>
        <span className="op-note">
          {isLive ? 'Connected to Opusol API' : 'Demo Mode (Offline samples)'}
        </span>
      </div>

      <section className="op-balance-grid">
        <Balance
          icon={Wallet}
          title="Total balance"
          value={store.balances.total}
          detail="Net balance across all groups"
          accent
        />
        <Balance
          icon={Calendar}
          title="Spent this month"
          value={store.balances.monthlySpend ?? 0}
          detail="Your personal contribution across all groups"
        />
        <Balance
          icon={ArrowDownLeft}
          title="You owe"
          value={store.balances.owe}
          detail="Total amount to pay back"
        />
        <Balance
          icon={ArrowUpRight}
          title="Owed to you"
          value={store.balances.owed}
          detail="Owed by other members"
        />
      </section>

      <section className="op-section">
        <div className="op-section-title">
          <div>
            <span className="op-kicker">THE PEOPLE YOU SHARE WITH</span>
            <h2>Your groups</h2>
            <p>Shared spaces for the costs of everyday life.</p>
          </div>
          <button className="op-primary op-small" onClick={() => setModal('group')}>
            <Plus size={16} /> Create group
          </button>
        </div>
        <div className="op-groups">
          {store.groups.length ? (
            store.groups.map((g) => (
              <Link key={g.id} href={`/groups/${g.id}`} className="op-group">
                <span className={`op-group-icon ${g.tone}`}>
                  {g.icon === 'home' ? (
                    <House size={20} />
                  ) : g.icon === 'cup' ? (
                    <Coffee size={20} />
                  ) : (
                    <Users size={20} />
                  )}
                </span>
                <span className="op-group-info">
                  <b>{g.name}</b>
                  <small>{g.context}</small>
                </span>
                <span className="op-group-total">
                  {money(g.total)}
                  <small>{g.memberCount} members</small>
                </span>
                <ChevronRight size={17} />
              </Link>
            ))
          ) : (
            <p className="op-empty">
              No groups yet. Click &quot;Create group&quot; to start sharing.
            </p>
          )}
        </div>
      </section>

      <section className="op-section">
        <div className="op-section-title">
          <div>
            <span className="op-kicker">THE LATEST</span>
            <h2>Recent expenses</h2>
            <p>Recent activity across your groups.</p>
          </div>
          <button
            className="op-primary op-small"
            onClick={() => setModal('expense')}
            disabled={!groupOptions.length}
          >
            <Plus size={16} /> Add expense
          </button>
        </div>
        <ExpenseTable items={store.expenses.slice(0, 6)} />
      </section>

      <footer className="op-footer">
        <span>Made for sharing the load.</span>
        <span>{isLive ? 'Live API data · ' : 'Demo data · '}All amounts in INR</span>
      </footer>

      {modal === 'group' && (
        <Modal title="Create a group" close={() => setModal(null)}>
          <form className="op-form" onSubmit={handleGroupSubmit}>
            <label>
              Group name
              <input
                autoFocus
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Flat 14 or Goa Trip"
              />
            </label>
            {formError && <p className="op-error">{formError}</p>}
            <p className="op-form-note">
              {isLive
                ? 'Creates a group in the PostgreSQL database with you as creator.'
                : 'This group is saved only in this browser’s demo data.'}
            </p>
            <button className="op-primary" type="submit" disabled={busy}>
              {busy ? 'Creating...' : 'Create group'}
            </button>
          </form>
        </Modal>
      )}

      {modal === 'expense' && (
        <AddExpenseModal
          isOpen={modal === 'expense'}
          onClose={() => setModal(null)}
          store={store}
          isLive={isLive}
          user={user}
          onSubmit={onCreateExpense}
        />
      )}
    </div>
  );
}

function GroupsPage({
  store,
  onCreateGroup,
  user,
}: {
  store: Store;
  onCreateGroup?: (name: string, description: string) => Promise<void>;
  user?: User | null;
}) {
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !onCreateGroup) return;
    setBusy(true);
    setErr('');
    try {
      const creatorDesc = user ? `Created by ${user.name}` : 'Created by member';
      await onCreateGroup(name.trim(), creatorDesc);
      setName('');
      setModal(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to create group');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="op-content">
      <div className="op-page-title">
        <span className="op-kicker">COLLABORATIVE SPACES</span>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Groups</h1>
            <p>Every corner of life where money moves together.</p>
          </div>
          {onCreateGroup && (
            <button className="op-primary op-small" onClick={() => setModal(true)}>
              <Plus size={16} /> Create group
            </button>
          )}
        </div>
      </div>

      <div className="op-groups">
        {store.groups.map((g) => (
          <Link key={g.id} href={`/groups/${g.id}`} className="op-group">
            <span className={`op-group-icon ${g.tone}`}>
              <Users size={18} />
            </span>
            <span className="op-group-info">
              <b>{g.name}</b>
              <small>{g.context}</small>
            </span>
            <span className="op-group-total">
              {money(g.total)}
              <small>{g.memberCount} members</small>
            </span>
            <ChevronRight size={17} />
          </Link>
        ))}
      </div>

      {modal && (
        <Modal title="Create a group" close={() => setModal(false)}>
          <form className="op-form" onSubmit={submit}>
            <label>
              Group name
              <input
                autoFocus
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Goa Trip"
              />
            </label>
            {err && <p className="op-error">{err}</p>}
            <button className="op-primary" type="submit" disabled={busy}>
              {busy ? 'Creating...' : 'Create group'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function GroupDetail({
  store,
  id,
  isLive,
  user,
  onRefresh,
  loading,
  onCreateExpense,
}: {
  store: Store;
  id: string;
  isLive: boolean;
  user: User | null;
  onRefresh: () => void;
  loading: boolean;
  onCreateExpense: (payload: ExpensePayload) => Promise<void>;
}) {
  const [expenseModal, setExpenseModal] = useState(false);
  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveStatusMsg, setLeaveStatusMsg] = useState('');
  const [addMemberModal, setAddMemberModal] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [settleModal, setSettleModal] = useState(false);
  const [settlePayer, setSettlePayer] = useState('');
  const [settleReceiver, setSettleReceiver] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  // Group balances, suggestions, members, expenses, and settlements from API
  const [groupBalances, setGroupBalances] = useState<MemberBalance[]>([]);
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMemberItem[]>([]);
  const [groupExpenses, setGroupExpenses] = useState<any[]>([]);
  const [groupSettlements, setGroupSettlements] = useState<SettlementItem[]>([]);

  const group = store.groups.find((g) => g.id === id);

  // Synchronously reload all live data for this specific group
  const reloadGroupData = async () => {
    if (!isLive || !id) return;
    try {
      const [balRes, suggRes, memRes, expRes, settRes] = await Promise.allSettled([
        balancesApi.get(id),
        balancesApi.suggestions(id),
        groupsApi.getMembers(id),
        expensesApi.list(id),
        settlementsApi.list(id),
      ]);
      if (balRes.status === 'fulfilled' && balRes.value?.balances && Array.isArray(balRes.value.balances)) {
        setGroupBalances(balRes.value.balances);
      }
      if (suggRes.status === 'fulfilled' && suggRes.value?.suggestions && Array.isArray(suggRes.value.suggestions)) {
        setSuggestions(suggRes.value.suggestions);
      }
      if (memRes.status === 'fulfilled' && Array.isArray(memRes.value)) {
        setGroupMembers(memRes.value);
      }
      if (expRes.status === 'fulfilled' && Array.isArray(expRes.value)) {
        setGroupExpenses(expRes.value);
      }
      if (settRes.status === 'fulfilled' && Array.isArray(settRes.value)) {
        setGroupSettlements(settRes.value);
      }
    } catch (err) {
      console.error('Failed to reload group data', err);
    }
  };

  useEffect(() => {
    reloadGroupData();
  }, [id, isLive]);

  if (!group) {
    if (loading) {
      return (
        <div className="op-content">
          <Link href="/groups" className="op-back">
            <ArrowLeft size={16} /> All groups
          </Link>
          <div className="op-page-title">
            <span className="op-kicker">LOADING GROUP</span>
            <h1>Loading details...</h1>
            <p>Fetching latest balances and expenses from backend.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="op-content">
        <Link href="/groups" className="op-back">
          <ArrowLeft size={16} /> All groups
        </Link>
        <h1>Group not found</h1>
        <p className="op-form-note">This group does not exist or you are not a member.</p>
      </div>
    );
  }

  // Convert live group expenses to Expense objects for this group
  const liveExpenses: Expense[] =
    isLive && groupExpenses.length > 0
      ? groupExpenses.map((e) => {
          const amountRs = (e.total_amount || 0) / 100;
          return {
            id: e.id,
            title: e.title,
            group: group.name,
            payer: {
              name: e.creator_name || 'Member',
              initials: getInitials(e.creator_name || 'M'),
              tone: getToneForString(e.creator_name || 'M'),
            },
            date: new Date(e.created_at).toLocaleDateString(),
            amount: amountRs,
            share: amountRs,
            status: (e.created_by === user?.id ? 'You paid' : 'Owed to you') as 'You paid' | 'Owed to you',
            icon: 'bag',
            tone: 'mint',
          };
        })
      : store.expenses.filter((e) => e.group === group.name);

  // Combine members from live API or group model
  const displayMembers: { id: string; name: string; role?: string }[] =
    isLive && groupMembers.length > 0
      ? groupMembers.map((m: any) => ({
          id: m.userId || m.user_id,
          name: m.name,
          role: m.role,
        }))
      : group.members.map((m) => ({
          id: m.name,
          name: m.name,
          role: 'member',
        }));

  // User's personal contribution in this specific group only
  const userGroupContribution = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    let totalPaise = 0;
    let monthlyPaise = 0;

    if (isLive && user) {
      for (const e of groupExpenses) {
        let mySplitAmount = 0;
        if (Array.isArray(e.splits) && e.splits.length > 0) {
          const mySplit = e.splits.find((s: any) => (s.userId || s.user_id) === user.id);
          if (mySplit && typeof mySplit.amount === 'number') {
            mySplitAmount = mySplit.amount;
          }
        } else if (e.created_by === user.id || (e as any).createdBy === user.id) {
          const count = displayMembers.length || 1;
          mySplitAmount = Math.round((e.total_amount || (e as any).totalAmount || 0) / count);
        }

        totalPaise += mySplitAmount;
        const expDate = new Date(e.created_at || (e as any).createdAt);
        if (!isNaN(expDate.getTime()) && expDate.getFullYear() === curYear && expDate.getMonth() === curMonth) {
          monthlyPaise += mySplitAmount;
        }
      }
    } else {
      for (const e of liveExpenses) {
        const share = e.share || e.amount / 3;
        totalPaise += Math.round(share * 100);
        monthlyPaise += Math.round(share * 100);
      }
    }

    return {
      total: Number((totalPaise / 100).toFixed(2)),
      monthly: Number((monthlyPaise / 100).toFixed(2)),
    };
  }, [isLive, user, groupExpenses, liveExpenses, displayMembers]);

  // Calculate group totals directly by summing e.total_amount / 100 from the group's live expenses query
  const liveTotal = isLive
    ? groupExpenses.length > 0
      ? groupExpenses.reduce((sum, e) => sum + (e.total_amount || 0) / 100, 0)
      : group.total || 0
    : liveExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    setBusy(true);
    setActionError('');
    try {
      if (isLive) {
        await groupsApi.addMember(id, memberEmail.trim());
        setMemberEmail('');
        setAddMemberModal(false);
        await reloadGroupData();
        onRefresh();
      } else {
        group.members.push({
          name: memberEmail.split('@')[0],
          initials: getInitials(memberEmail),
          tone: 'lilac',
        });
        group.memberCount += 1;
        setMemberEmail('');
        setAddMemberModal(false);
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setBusy(false);
    }
  };

  const handleLeaveGroup = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setActionError('');
    try {
      if (isLive) {
        const res = await leaveRequestsApi.create(id, {
          reason: leaveReason.trim() || undefined,
        });
        if (res.status === 'approved') {
          setLeaveStatusMsg(
            'Your leave request was auto-approved because your balance is ₹0.00. You have left the group.'
          );
        } else {
          setLeaveStatusMsg(
            `Leave request submitted for creator approval. Balance snapshot recorded: ${money((res.balance_snapshot || 0) / 100)}.`
          );
        }
        await reloadGroupData();
        onRefresh();
      } else {
        setLeaveStatusMsg(
          'Demo mode: In live mode, requests with zero balance are auto-approved, while debts require creator redistribution.'
        );
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to submit leave request');
    } finally {
      setBusy(false);
    }
  };

  // Helper to get live pairwise debt from payer to receiver in paise
  const getPairwiseDebt = (pId: string, rId: string): number => {
    if (!pId || !rId || pId === rId) return 0;
    const match = suggestions.find((s: any) => {
      const fromId = s.from?.userId || s.fromUserId;
      const toId = s.to?.userId || s.toUserId;
      return fromId === pId && toId === rId;
    });
    return match ? match.amount : 0;
  };

  const currentPairwiseDebt = getPairwiseDebt(settlePayer, settleReceiver);

  const handleCreateSettlement = async (e: FormEvent) => {
    e.preventDefault();
    const val = parseFloat(settleAmount);
    if (!settlePayer || !settleReceiver || !Number.isFinite(val) || val <= 0) return;
    if (user && settlePayer !== user.id && settleReceiver !== user.id) {
      setActionError('You can only create settlements where you are the payer or receiver.');
      return;
    }
    const maxAllowedDebt = getPairwiseDebt(settlePayer, settleReceiver);
    if (maxAllowedDebt <= 0) {
      const pName = displayMembers.find((m) => m.id === settlePayer)?.name || 'Payer';
      const rName = displayMembers.find((m) => m.id === settleReceiver)?.name || 'Receiver';
      setActionError(`${pName} owes ₹0.00 to ${rName}. Cannot create settlement request.`);
      return;
    }
    if (val > maxAllowedDebt / 100) {
      setActionError(`Amount cannot exceed the current debt of ${money(maxAllowedDebt / 100)}.`);
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      if (isLive) {
        await settlementsApi.create(id, {
          payerId: settlePayer,
          receiverId: settleReceiver,
          amount: Math.round(val * 100),
        });
        setSettleModal(false);
        setSettleAmount('');
        await reloadGroupData();
        onRefresh();
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to record settlement');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateSettlement = async (settlementId: string, status: 'completed' | 'cancelled') => {
    setBusy(true);
    setActionError('');
    try {
      await settlementsApi.update(settlementId, status);
      await reloadGroupData();
      onRefresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update settlement');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="op-content">
      <Link href="/groups" className="op-back">
        <ArrowLeft size={16} /> All groups
      </Link>
      <div className="op-page-title">
        <span className="op-kicker">GROUP DETAILS · {group.memberCount} MEMBERS</span>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1>{group.name}</h1>
            <p>{group.context}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="op-primary op-small"
              onClick={() => setExpenseModal(true)}
            >
              <Plus size={16} /> Add Expense
            </button>
            <button
              className="op-secondary op-small"
              onClick={() => setAddMemberModal(true)}
            >
              <UserPlus size={16} /> Add Member
            </button>
            <button
              className="op-secondary op-small"
              onClick={() => setLeaveModal(true)}
            >
              Leave group
            </button>
          </div>
        </div>
      </div>

      <div className="op-detail-cards">
        <Balance
          icon={Wallet}
          title="Group total"
          value={Number(liveTotal.toFixed(2))}
          detail="Total group expenses"
          accent
        />
        <Balance
          icon={Calendar}
          title="Spent in this group"
          value={userGroupContribution.monthly}
          detail={
            userGroupContribution.total !== userGroupContribution.monthly
              ? `Your share this month (${money(userGroupContribution.total)} total in group)`
              : 'Your personal contribution in this group'
          }
        />
        <Metric
          icon={Users}
          title="Active Members"
          value={displayMembers.length || group.memberCount}
          detail="Members sharing costs"
        />
      </div>

      {/* Member List */}
      <section className="op-section">
        <div className="op-section-title">
          <div>
            <h2>Members</h2>
            <p>Active participants in this group.</p>
          </div>
        </div>

        <div className="op-groups">
          {displayMembers.map((member) => (
            <div className="op-member" key={member.id || member.name}>
              <span className="op-avatar">{getInitials(member.name)}</span>
              <span>
                <b>{member.name}</b>
                <small>{member.role ? member.role.toUpperCase() : 'Group member'}</small>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Group Balances */}
      {isLive && groupBalances.length > 0 && (
        <section className="op-section">
          <div className="op-section-title">
            <div>
              <h2>Current Balances</h2>
              <p>Net position of each member in this group.</p>
            </div>
          </div>
          <div className="op-groups">
            {groupBalances.map((b) => {
              const net = b.netBalance / 100;
              return (
                <div className="op-group" key={b.userId} style={{ cursor: 'default' }}>
                  <span
                    className={`op-group-icon ${net > 0 ? 'mint' : net < 0 ? 'coral' : 'butter'}`}
                  >
                    <Wallet size={18} />
                  </span>
                  <span className="op-group-info">
                    <b>{b.name}</b>
                    <small>
                      Paid: {money(b.totalPaid / 100)} · Owed: {money(b.totalOwed / 100)}
                    </small>
                  </span>
                  <span
                    className="op-group-total"
                    style={{
                      color:
                        net > 0
                          ? 'hsl(145 57% 40%)'
                          : net < 0
                          ? '#c25437'
                          : 'inherit',
                    }}
                  >
                    {net > 0
                      ? `+${money(net)}`
                      : net < 0
                      ? `-${money(Math.abs(net))}`
                      : 'Settled'}
                    <small>
                      {net > 0
                        ? 'Gets back'
                        : net < 0
                        ? 'Owes'
                        : 'Settled up'}
                    </small>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Suggested Settlements */}
      {isLive && suggestions.length > 0 && (
        <section className="op-section">
          <div className="op-section-title">
            <div>
              <h2>Suggested Settlements</h2>
              <p>Optimized debt clearing transactions.</p>
            </div>
          </div>
          <div className="op-groups">
            {suggestions.map((s: any, idx) => {
              const fromName = s.from?.name || s.fromName || 'Member';
              const toName = s.to?.name || s.toName || 'Member';
              const fromId = s.from?.userId || s.fromUserId || '';
              const toId = s.to?.userId || s.toUserId || '';
              const amtRs = (s.amount || 0) / 100;

              return (
                <div className="op-group" key={idx} style={{ cursor: 'default' }}>
                  <span className="op-group-icon mint">
                    <Banknote size={18} />
                  </span>
                  <span className="op-group-info">
                    <b>
                      {fromName} owes {toName}
                    </b>
                    <small>Optimized debt clearing suggestion</small>
                  </span>
                  <span className="op-group-total">
                    {money(amtRs)}
                    {(!user || user.id === fromId || user.id === toId) ? (
                      <button
                        className="op-primary op-small"
                        style={{ marginTop: '6px', fontSize: '10px' }}
                        onClick={() => {
                          setSettlePayer(fromId);
                          setSettleReceiver(toId);
                          setSettleAmount(amtRs.toFixed(2));
                          setActionError('');
                          setSettleModal(true);
                        }}
                      >
                        Settle Up
                      </button>
                    ) : (
                      <small style={{ marginTop: '6px', fontSize: '9px', color: 'hsl(var(--muted-foreground))' }}>
                        Only {fromName} or {toName} can settle
                      </small>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Group Settlements */}
      {isLive && groupSettlements.length > 0 && (
        <section className="op-section">
          <div className="op-section-title">
            <div>
              <h2>Settlements</h2>
              <p>Payment requests and status for this group.</p>
            </div>
            <button
              className="op-secondary op-small"
              onClick={() => setSettleModal(true)}
            >
              <Banknote size={16} /> Record Settlement
            </button>
          </div>
          <div className="op-groups">
            {groupSettlements.map((s) => {
              const isPending = s.status === 'pending';
              const isCompleted = s.status === 'completed';
              const pId = s.payer_id || (s as any).payerId;
              const rId = s.receiver_id || (s as any).receiverId;
              const pName = s.payer_name || (s as any).payerName || (s as any).payer?.name || 'Member';
              const rName = s.receiver_name || (s as any).receiverName || (s as any).receiver?.name || 'Member';
              const isReceiver = user && rId === user.id;
              const isPayer = user && pId === user.id;
              const isGroupCreator = user && (group as any)?.createdBy === user.id;

              // Only the receiving member can confirm and accept the settlement
              const canConfirm = isPending && isReceiver;
              // Payer, receiver, or group creator can cancel
              const canCancel = isPending && (isPayer || isReceiver || isGroupCreator);

              return (
                <div className="op-group" key={s.id} style={{ cursor: 'default' }}>
                  <span
                    className={`op-group-icon ${
                      isCompleted ? 'mint' : isPending ? 'butter' : 'coral'
                    }`}
                  >
                    <Banknote size={18} />
                  </span>
                  <span className="op-group-info">
                    <b>
                      {pName} → {rName}
                    </b>
                    <small>
                      {formatExpenseDate(s.created_at || (s as any).createdAt)} · Status:{' '}
                      <b style={{ textTransform: 'capitalize' }}>{s.status}</b>
                      {isPending && isPayer && ' (Awaiting receiver confirmation)'}
                      {isPending && isReceiver && ' (Action required)'}
                    </small>
                  </span>
                  <span className="op-group-total">
                    {money(s.amount / 100)}
                    {isPending && (
                      <span style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        {canConfirm && (
                          <button
                            className="op-primary op-small"
                            style={{ padding: '0 8px', minHeight: '24px', fontSize: '10px' }}
                            onClick={() => handleUpdateSettlement(s.id, 'completed')}
                            disabled={busy}
                            title="Confirm you have received the payment"
                          >
                            <Check size={12} /> Accept
                          </button>
                        )}
                        {canCancel && (
                          <button
                            className="op-secondary op-small"
                            style={{ padding: '0 8px', minHeight: '24px', fontSize: '10px' }}
                            onClick={() => handleUpdateSettlement(s.id, 'cancelled')}
                            disabled={busy}
                            title="Cancel settlement request"
                          >
                            <X size={12} /> Cancel
                          </button>
                        )}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Expenses */}
      <section className="op-section">
        <div className="op-section-title">
          <div>
            <h2>Expenses</h2>
            <p>Recorded expenses for this group.</p>
          </div>
          <button
            className="op-primary op-small"
            onClick={() => setExpenseModal(true)}
          >
            <Plus size={16} /> Add Expense
          </button>
        </div>
        <ExpenseTable items={liveExpenses} />
      </section>

      {/* Add Expense Modal */}
      {expenseModal && (
        <AddExpenseModal
          isOpen={expenseModal}
          onClose={() => setExpenseModal(false)}
          initialGroupId={id}
          store={store}
          isLive={isLive}
          user={user}
          onSubmit={async (payload) => {
            await onCreateExpense(payload);
            await reloadGroupData();
            onRefresh();
          }}
        />
      )}

      {/* Add Member Modal */}
      {addMemberModal && (
        <Modal title="Add Member to Group" close={() => setAddMemberModal(false)}>
          <form className="op-form" onSubmit={handleAddMember}>
            <label>
              Registered User Email
              <input
                type="email"
                required
                placeholder="user@example.com"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
              />
            </label>
            {actionError && <p className="op-error">{actionError}</p>}
            <p className="op-form-note">
              Enter the email address of a registered user to add them to this group.
            </p>
            <button className="op-primary" type="submit" disabled={busy}>
              {busy ? 'Adding...' : 'Add Member'}
            </button>
          </form>
        </Modal>
      )}

      {/* Leave Modal */}
      {leaveModal && (
        <Modal title="Leave this group" close={() => setLeaveModal(false)}>
          <form className="op-form" onSubmit={handleLeaveGroup}>
            {leaveStatusMsg ? (
              <>
                <p className="op-form-note">{leaveStatusMsg}</p>
                <button
                  className="op-primary"
                  type="button"
                  onClick={() => setLeaveModal(false)}
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <label>
                  Reason for leaving (optional)
                  <input
                    placeholder="e.g. Moved out, trip ended"
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                  />
                </label>
                {actionError && <p className="op-error">{actionError}</p>}
                <p className="op-form-note">
                  Members with ₹0.00 balance are auto-approved. Members with outstanding
                  balances submit a request to the group creator for debt redistribution.
                </p>
                <button className="op-primary" type="submit" disabled={busy}>
                  {busy ? 'Submitting...' : 'Request to Leave'}
                </button>
              </>
            )}
          </form>
        </Modal>
      )}

      {/* Settle Modal */}
      {settleModal && (
        <Modal title="Record a Settlement" close={() => setSettleModal(false)}>
          <form className="op-form" onSubmit={handleCreateSettlement}>
            <label>
              Payer (Member who is paying)
              <select
                required
                value={settlePayer}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettlePayer(val);
                  let rId = settleReceiver;
                  if (user && val !== user.id && val !== '') {
                    rId = user.id;
                    setSettleReceiver(user.id);
                  }
                  if (val && rId && val !== rId) {
                    const debt = getPairwiseDebt(val, rId);
                    if (debt > 0) setSettleAmount((debt / 100).toFixed(2));
                  }
                }}
              >
                <option value="">Select payer</option>
                {displayMembers.map((m) => {
                  if (settleReceiver && m.id === settleReceiver) return null;
                  let note = '';
                  let isDisabled = false;
                  if (settleReceiver) {
                    const debt = getPairwiseDebt(m.id, settleReceiver);
                    if (debt > 0) {
                      note = ` (Owes ${money(debt / 100)})`;
                    } else {
                      note = ' (Owes ₹0.00 · No debt)';
                      isDisabled = true;
                    }
                  } else {
                    const totalOwedByM = suggestions
                      .filter((s: any) => (s.from?.userId || s.fromUserId) === m.id)
                      .reduce((sum: number, s: any) => sum + s.amount, 0);
                    if (totalOwedByM > 0) {
                      note = ` (Total debt ${money(totalOwedByM / 100)})`;
                    } else {
                      note = ' (No debt · Settled)';
                      isDisabled = true;
                    }
                  }
                  return (
                    <option key={m.id} value={m.id} disabled={isDisabled}>
                      {m.name}{note}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              Receiver (Member receiving payment)
              <select
                required
                value={settleReceiver}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettleReceiver(val);
                  let pId = settlePayer;
                  if (user && val !== user.id && val !== '') {
                    pId = user.id;
                    setSettlePayer(user.id);
                  }
                  if (pId && val && pId !== val) {
                    const debt = getPairwiseDebt(pId, val);
                    if (debt > 0) setSettleAmount((debt / 100).toFixed(2));
                  }
                }}
              >
                <option value="">Select receiver</option>
                {displayMembers.map((m) => {
                  if (settlePayer && m.id === settlePayer) return null;
                  let note = '';
                  let isDisabled = false;
                  if (settlePayer) {
                    const debt = getPairwiseDebt(settlePayer, m.id);
                    if (debt > 0) {
                      note = ` (Owes ${money(debt / 100)})`;
                    } else {
                      note = ' (Owes ₹0.00 · No debt)';
                      isDisabled = true;
                    }
                  } else {
                    const totalOwedToM = suggestions
                      .filter((s: any) => (s.to?.userId || s.toUserId) === m.id)
                      .reduce((sum: number, s: any) => sum + s.amount, 0);
                    if (totalOwedToM > 0) {
                      note = ` (Owed ${money(totalOwedToM / 100)})`;
                    } else {
                      note = ' (Owed ₹0.00)';
                      isDisabled = true;
                    }
                  }
                  return (
                    <option key={m.id} value={m.id} disabled={isDisabled}>
                      {m.name}{note}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              Settlement Amount (₹)
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                placeholder="0.00"
              />
              {settlePayer && settleReceiver && (
                currentPairwiseDebt > 0 ? (
                  <small style={{ color: 'hsl(var(--primary))', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                    Live debt: {displayMembers.find((m) => m.id === settlePayer)?.name || 'Payer'} owes {displayMembers.find((m) => m.id === settleReceiver)?.name || 'Receiver'} {money(currentPairwiseDebt / 100)}
                  </small>
                ) : (
                  <small style={{ color: '#c25437', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                    {displayMembers.find((m) => m.id === settlePayer)?.name || 'Payer'} owes ₹0.00 to {displayMembers.find((m) => m.id === settleReceiver)?.name || 'Receiver'}. Cannot create settlement request.
                  </small>
                )
              )}
            </label>
            {actionError && <p className="op-error">{actionError}</p>}
            <p className="op-form-note">
              Records a pending settlement in the database. When confirmed by the
              recipient, debts are marked as completed.
            </p>
            <button
              className="op-primary"
              type="submit"
              disabled={busy || (settlePayer && settleReceiver ? currentPairwiseDebt <= 0 : false)}
            >
              {busy ? 'Recording...' : 'Record Settlement'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ExpensesPage({
  store,
  onDeleteExpense,
}: {
  store: Store;
  onDeleteExpense?: (id: string) => void;
}) {
  return (
    <div className="op-content">
      <div className="op-page-title">
        <span className="op-kicker">HISTORY</span>
        <h1>All Expenses</h1>
        <p>Complete ledger of shared expenses across all groups.</p>
      </div>

      <ExpenseTable items={store.expenses} onDelete={onDeleteExpense} />
    </div>
  );
}

function SettlementsPage({
  store,
  isLive,
  onUpdateStatus,
}: {
  store: Store;
  isLive: boolean;
  onUpdateStatus?: (settlementId: string, status: 'completed' | 'cancelled') => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const handleStatus = async (id: string, status: 'completed' | 'cancelled') => {
    if (!onUpdateStatus) return;
    setBusy(true);
    try {
      await onUpdateStatus(id, status);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update settlement');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="op-content">
      <div className="op-page-title">
        <span className="op-kicker">CLOSE THE LOOP</span>
        <h1>Settlements</h1>
        <p>Track payments, debt completions, and settlement history.</p>
      </div>

      {isLive && store.settlements.length > 0 ? (
        <div className="op-groups">
          {store.settlements.map((s) => (
            <div className="op-group" key={s.id} style={{ cursor: 'default' }}>
              <span
                className={`op-group-icon ${
                  s.status === 'completed'
                    ? 'mint'
                    : s.status === 'pending'
                    ? 'butter'
                    : 'coral'
                }`}
              >
                <Banknote size={18} />
              </span>
              <span className="op-group-info">
                <b>
                  {s.payer_name || 'Member'} paid {s.receiver_name || 'Member'}
                </b>
                <small>
                  Status: <b>{s.status.toUpperCase()}</b> · Date:{' '}
                  {new Date(s.created_at).toLocaleDateString()}
                </small>
              </span>
              <span className="op-group-total">
                {money(s.amount / 100)}
                {s.status === 'pending' && onUpdateStatus && (
                  <span style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button
                      className="op-primary op-small"
                      style={{ padding: '0 8px', minHeight: '26px', fontSize: '9px' }}
                      onClick={() => handleStatus(s.id, 'completed')}
                      disabled={busy}
                    >
                      <Check size={12} /> Confirm
                    </button>
                    <button
                      className="op-secondary op-small"
                      style={{ padding: '0 8px', minHeight: '26px', fontSize: '9px' }}
                      onClick={() => handleStatus(s.id, 'cancelled')}
                      disabled={busy}
                    >
                      <X size={12} /> Cancel
                    </button>
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="op-callout">
          <Banknote size={21} />
          <span>
            <b>
              {isLive
                ? 'No settlements recorded yet.'
                : 'Settlement suggestions and tracking connect to the API.'}
            </b>
            <small>
              {isLive
                ? 'When members record payments, they will appear here with confirmation controls.'
                : 'Sign in to access real group settlement tracking and transaction minimization.'}
            </small>
          </span>
        </div>
      )}
    </div>
  );
}

function NotFound() {
  return (
    <div className="op-content">
      <div className="op-page-title">
        <span className="op-kicker">404</span>
        <h1>Page not found</h1>
        <p>That OPUSOL page doesn’t exist.</p>
        <Link className="op-primary op-inline" href="/dashboard">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}

export function OpusolApp() {
  const [demoStore, setDemoStore] = useState<Store>(loadDemoStore);
  const [realStore, setRealStore] = useState<Store>({
    groups: [],
    expenses: [],
    balances: { total: 0, owe: 0, owed: 0, monthlySpend: 0 },
    settlements: [],
  });
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('opusol-user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLiveMode, setIsLiveMode] = useState<boolean>(() => {
    return Boolean(getToken() || localStorage.getItem('opusol-user'));
  });
  const [loading, setLoading] = useState<boolean>(false);

  const activeStore = isLiveMode ? realStore : demoStore;

  const [dark, setDark] = useState<boolean>(
    () => localStorage.getItem('opusol-theme') === 'dark'
  );
  const [loc, setLoc] = useLocation();

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('opusol-theme', next ? 'dark' : 'light');
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.title = 'OPUSOL — Shared expenses, simplified';
  }, [dark]);

  // Load real store data from API with parallel fetching
  const fetchRealData = async () => {
    if (!getToken()) return;
    setLoading(true);
    try {
      const groupsList = await groupsApi.list();
      if (!Array.isArray(groupsList)) {
        setLoading(false);
        return;
      }

      // Concurrently fetch expenses, balances, settlements, and members for all groups
      const groupResults = await Promise.all(
        groupsList.map(async (g) => {
          const [expensesRes, balancesRes, settlementsRes, membersRes] = await Promise.allSettled([
            expensesApi.list(g.id),
            balancesApi.get(g.id),
            settlementsApi.list(g.id),
            groupsApi.getMembers(g.id),
          ]);

          const expenses =
            expensesRes.status === 'fulfilled' && Array.isArray(expensesRes.value)
              ? expensesRes.value
              : [];
          const balances =
            balancesRes.status === 'fulfilled' && balancesRes.value ? balancesRes.value : null;
          const settlements =
            settlementsRes.status === 'fulfilled' && Array.isArray(settlementsRes.value)
              ? settlementsRes.value
              : [];
          const membersList =
            membersRes.status === 'fulfilled' && Array.isArray(membersRes.value)
              ? membersRes.value
              : [];

          const totalRs = expenses.reduce((sum, e) => sum + e.total_amount / 100, 0);

          return {
            group: g,
            expenses,
            balances,
            settlements,
            membersList,
            totalRs,
          };
        })
      );

      const allExpenses: Expense[] = [];
      const allSettlements: SettlementItem[] = [];
      let totalOwe = 0;
      let totalOwed = 0;

      const mappedGroups: Group[] = groupResults.map(
        ({ group: g, expenses, balances, membersList, totalRs }) => {
          for (const e of expenses) {
            const amountPaise = e.total_amount ?? (e as any).totalAmount ?? 0;
            const amountRs = amountPaise / 100;

            const primaryPayer = (e.payers && e.payers[0]) || null;
            const payerUserId = primaryPayer?.userId || (e as any).user_id || e.created_by || (e as any).createdBy;
            const isMe = currentUser && (payerUserId === currentUser.id || e.created_by === currentUser.id);

            const payerName =
              primaryPayer?.name ||
              (e as any).payer_name ||
              (e as any).payerName ||
              e.creator_name ||
              (e as any).creatorName ||
              e.creator?.name ||
              (isMe ? currentUser?.name || 'You' : 'Member');

            const formattedDate = formatExpenseDate(e.created_at || (e as any).createdAt);

            allExpenses.push({
              id: e.id,
              title: e.title,
              group: g.name,
              payer: {
                name: payerName,
                initials: getInitials(payerName),
                tone: getToneForString(payerName),
              },
              date: formattedDate,
              amount: amountRs,
              share: amountRs,
              status: isMe ? 'You paid' : 'Owed to you',
              icon: 'bag',
              tone: 'mint',
            });
          }

          if (balances?.balances && currentUser) {
            const myBal = balances.balances.find((b: any) => b.userId === currentUser.id);
            if (myBal) {
              const netRs = myBal.netBalance / 100;
              if (netRs > 0) totalOwed += netRs;
              else if (netRs < 0) totalOwe += Math.abs(netRs);
            }
          }

          const members: Person[] = membersList.map((m: any) => ({
            name: m.name,
            initials: getInitials(m.name),
            tone: getToneForString(m.name),
          }));

          const count =
            membersList.length ||
            (g as any).memberCount ||
            (g as any).member_count ||
            1;

          const creator =
            (g as any).creatorName ||
            (g as any).creator_name ||
            ((g.createdBy || g.created_by) === currentUser?.id ? currentUser?.name : null);

          const groupContext = creator
            ? `Created by ${creator}`
            : g.description && !g.description.includes('Created via OPUSOL')
            ? g.description
            : `${count} members sharing costs`;

          return {
            id: g.id,
            name: g.name,
            context: groupContext,
            members,
            memberCount: count,
            total: Number(totalRs.toFixed(2)),
            tone: getToneForString(g.name),
            icon: 'home',
            createdBy: g.createdBy || (g as any).created_by,
            creatorName: creator || undefined,
          };
        }
      );

      for (const res of groupResults) {
        allSettlements.push(...res.settlements);
      }

      // Calculate personal contribution across all groups in current month
      const now = new Date();
      const curYear = now.getFullYear();
      const curMonth = now.getMonth();
      let totalMonthlySpendPaise = 0;

      for (const res of groupResults) {
        for (const e of res.expenses) {
          const expDate = new Date(e.created_at || (e as any).createdAt);
          if (!isNaN(expDate.getTime()) && expDate.getFullYear() === curYear && expDate.getMonth() === curMonth) {
            if (currentUser && Array.isArray(e.splits)) {
              const mySplit = e.splits.find((s: any) => (s.userId || s.user_id) === currentUser.id);
              if (mySplit && typeof mySplit.amount === 'number') {
                totalMonthlySpendPaise += mySplit.amount;
              }
            } else if (currentUser && (e.created_by === currentUser.id || (e as any).createdBy === currentUser.id)) {
              const count = res.membersList.length || 1;
              totalMonthlySpendPaise += Math.round((e.total_amount || (e as any).totalAmount || 0) / count);
            }
          }
        }
      }
      const monthlySpendRs = Number((totalMonthlySpendPaise / 100).toFixed(2));

      setRealStore({
        groups: mappedGroups,
        expenses: allExpenses.sort((a, b) => (a.date < b.date ? 1 : -1)),
        balances: {
          total: Number((totalOwed - totalOwe).toFixed(2)),
          owe: Number(totalOwe.toFixed(2)),
          owed: Number(totalOwed.toFixed(2)),
          monthlySpend: monthlySpendRs,
        },
        settlements: allSettlements,
      });
    } catch (err) {
      console.error('Failed to load real data from backend:', err);
    } finally {
      setLoading(false);
    }
  };

  // Check auth session on startup
  useEffect(() => {
    // If we have either token in localStorage or cookie sent with credentials: 'include'
    authApi
      .me()
      .then((res) => {
        if (res?.user) {
          setCurrentUser(res.user);
          try {
            localStorage.setItem('opusol-user', JSON.stringify(res.user));
          } catch {}
          setIsLiveMode(true);
        } else {
          if (!getToken() && localStorage.getItem('opusol-explore-demo') !== 'true') {
            setLoc('/login');
          }
        }
      })
      .catch((err: any) => {
        // Only clear token if server explicitly returned 401 Unauthorized
        if (err?.status === 401) {
          clearToken();
          try {
            localStorage.removeItem('opusol-user');
          } catch {}
          setIsLiveMode(false);
          setCurrentUser(null);
        }
        if (!getToken() && localStorage.getItem('opusol-explore-demo') !== 'true') {
          setLoc('/login');
        }
      });
  }, []);

  // Fetch real data when user or live mode is set
  useEffect(() => {
    if (isLiveMode && currentUser) {
      fetchRealData();
    }
  }, [isLiveMode, currentUser]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    clearToken();
    try {
      localStorage.removeItem('opusol-user');
      localStorage.removeItem('opusol-explore-demo');
    } catch {}
    setCurrentUser(null);
    setIsLiveMode(false);
    setLoc('/login');
  };

  const handleAuthSuccess = (user: User) => {
    try {
      localStorage.setItem('opusol-user', JSON.stringify(user));
    } catch {}
    setCurrentUser(user);
    setIsLiveMode(true);
  };

  const handleCreateGroup = async (name: string, description: string) => {
    if (isLiveMode) {
      const creatorDesc = currentUser ? `Created by ${currentUser.name}` : description;
      await groupsApi.create({ name, description: creatorDesc });
      await fetchRealData();
    } else {
      const creator = currentUser?.name || 'You';
      const newGroup: Group = {
        id: `group-${Date.now()}`,
        name,
        context: `Created by ${creator}`,
        members: [{ name: creator, initials: getInitials(creator), tone: 'mint' }],
        memberCount: 1,
        total: 0,
        tone: 'mint',
        icon: 'home',
        creatorName: creator,
      };
      setDemoStore((prev) => ({
        ...prev,
        groups: [newGroup, ...prev.groups],
      }));
    }
  };

  const handleCreateExpense = async (payload: ExpensePayload) => {
    if (isLiveMode && currentUser) {
      await expensesApi.create(payload.groupId, {
        title: payload.title,
        description: payload.description,
        totalAmount: payload.totalAmountPaise,
        splitType: payload.splitType,
        payers: payload.payers,
        splits: payload.splits,
      });
      await fetchRealData();
    } else {
      const group = demoStore.groups.find((g) => g.id === payload.groupId);
      if (!group) return;
      const amountRs = payload.totalAmountPaise / 100;
      const newExp: Expense = {
        id: crypto.randomUUID(),
        title: payload.title,
        group: group.name,
        payer: { name: 'You', initials: 'AM', tone: 'sage' },
        date: 'Just now',
        amount: amountRs,
        share: amountRs,
        status: 'You paid',
        icon: 'bag',
        tone: 'mint',
      };
      setDemoStore((prev) => ({
        ...prev,
        expenses: [newExp, ...prev.expenses],
        groups: prev.groups.map((g) =>
          g.id === payload.groupId
            ? { ...g, total: Number((g.total + amountRs).toFixed(2)) }
            : g
        ),
      }));
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (isLiveMode) {
      try {
        await expensesApi.delete(expenseId);
        await fetchRealData();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete expense');
      }
    } else {
      setDemoStore((prev) => ({
        ...prev,
        expenses: prev.expenses.filter((e) => e.id !== expenseId),
      }));
    }
  };

  const handleUpdateSettlementStatus = async (
    settlementId: string,
    status: 'completed' | 'cancelled'
  ) => {
    if (isLiveMode) {
      await settlementsApi.update(settlementId, status);
      await fetchRealData();
    }
  };

  // Safe normalized location path (strips query params and trailing slashes)
  const cleanLoc = loc.split('?')[0].replace(/\/+$/, '') || '/';
  const groupMatch = cleanLoc.match(/^\/groups\/([^/]+)$/);

  const routeView = useMemo(() => {
    if (cleanLoc === '/groups')
      return <GroupsPage store={activeStore} onCreateGroup={handleCreateGroup} user={currentUser} />;
    if (cleanLoc === '/expenses')
      return (
        <ExpensesPage
          store={activeStore}
          onDeleteExpense={isLiveMode ? handleDeleteExpense : undefined}
        />
      );
    if (cleanLoc === '/settlements')
      return (
        <SettlementsPage
          store={activeStore}
          isLive={isLiveMode}
          onUpdateStatus={isLiveMode ? handleUpdateSettlementStatus : undefined}
        />
      );
    if (groupMatch) {
      const groupId = decodeURIComponent(groupMatch[1]);
      return (
        <GroupDetail
          store={activeStore}
          id={groupId}
          isLive={isLiveMode}
          user={currentUser}
          onRefresh={fetchRealData}
          loading={loading}
          onCreateExpense={handleCreateExpense}
        />
      );
    }
    if (cleanLoc === '/' || cleanLoc === '/dashboard')
      return (
        <Dashboard
          store={activeStore}
          isLive={isLiveMode}
          user={currentUser}
          onCreateGroup={handleCreateGroup}
          onCreateExpense={handleCreateExpense}
        />
      );
    return <NotFound />;
  }, [cleanLoc, activeStore, isLiveMode, currentUser, loading, groupMatch]);

  return (
    <Switch>
      <Route path="/login">
        <Auth register={false} onAuthSuccess={handleAuthSuccess} />
      </Route>
      <Route path="/register">
        <Auth register onAuthSuccess={handleAuthSuccess} />
      </Route>
      <Route>
        <AppShell
          active={
            cleanLoc.startsWith('/groups')
              ? 'Groups'
              : cleanLoc === '/expenses'
              ? 'Expenses'
              : cleanLoc === '/settlements'
              ? 'Settlements'
              : 'Dashboard'
          }
          dark={dark}
          toggle={toggle}
          onLogout={handleLogout}
          user={currentUser}
          isLive={isLiveMode}
          onRefresh={fetchRealData}
          loading={loading}
        >
          {routeView}
        </AppShell>
      </Route>
    </Switch>
  );
}
