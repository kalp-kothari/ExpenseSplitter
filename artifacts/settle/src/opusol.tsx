import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, Banknote, Check, ChevronRight, CircleHelp,
  Coffee, House, LogOut, Moon, Plus, ReceiptText, RefreshCw, Sun, UserPlus, Users, Wallet, X,
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
  type ExpenseItem,
  type SettlementItem,
  type SettlementSuggestion,
  type MemberBalance,
} from './lib/api';

const money = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);

type Store = {
  groups: Group[];
  expenses: Expense[];
  balances: { total: number; owe: number; owed: number };
  settlements: SettlementItem[];
};

function loadDemoStore(): Store {
  try {
    const saved = localStorage.getItem('opusol-demo-data');
    if (saved) return JSON.parse(saved) as Store;
  } catch {
    // Reset to bundled seed data on error
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

  const initials = user
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'AM';

  const displayName = user ? user.name : 'Aarav Mehta';
  const displayEmail = user ? user.email : 'Demo workspace';

  return (
    <div className="op-shell">
      <aside className="op-sidebar">
        <Brand />
        <div className="op-workspace">
          <span>{initials[0] || 'A'}</span>
          <div>
            <b>{displayName}’s space</b>
            <small>{isLive ? 'Personal account' : 'Demo workspace'}</small>
          </div>
        </div>
        <small className="op-label">YOUR SPACE</small>
        <nav>
          {links.map(([name, href, Icon]) => (
            <Link
              key={href}
              href={href}
              className={`op-nav ${active === name ? 'selected' : ''}`}
            >
              <Icon size={18} />
              {name}
            </Link>
          ))}
        </nav>
        <div className="op-sidebar-bottom">
          <div className="op-help">
            <CircleHelp size={18} />
            <span>
              <b>Money, made easy.</b>
              <small>Shared costs, minus the awkward.</small>
            </span>
          </div>
          <div className="op-account">
            <span className="op-avatar">{initials}</span>
            <span>
              <b>{displayName}</b>
              <small title={displayEmail}>{isLive ? 'Signed in' : 'Demo profile'}</small>
            </span>
            <button
              aria-label={isLive ? 'Sign out' : 'Sign in'}
              onClick={onLogout}
              title={isLive ? 'Sign out' : 'Sign in'}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="op-main">
        <header className="op-top">
          <div className="op-mobile-brand">
            <Brand />
          </div>
          <div className="op-crumb">
            My space <i>/</i> <b>{active}</b>
          </div>
          <div className="op-top-actions">
            {isLive ? (
              <span
                className="demo-pill"
                style={{
                  background: 'hsl(145 42% 92%)',
                  color: 'hsl(145 55% 28%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i style={{ background: 'hsl(145 57% 40%)' }} /> LIVE BACKEND
              </span>
            ) : (
              <span className="demo-pill">
                <i /> DEMO MODE
              </span>
            )}
            {isLive && (
              <button
                className="op-theme"
                onClick={onRefresh}
                aria-label="Refresh data"
                title="Refresh from API"
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            )}
            <button className="op-theme" onClick={toggle} aria-label="Toggle theme">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        {children}
      </main>
      <nav className="op-mobile-nav">
        {links.map(([name, href, Icon]) => (
          <Link
            key={href}
            href={href}
            className={active === name ? 'selected' : ''}
          >
            <Icon size={19} />
            <span>{name}</span>
          </Link>
        ))}
      </nav>
    </div>
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
        if (!name.trim()) throw new Error('Please enter your full name');
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
      const message =
        err instanceof Error ? err.message : 'Authentication failed';
      setNotice(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="op-auth">
      <div className="op-auth-brand">
        <Brand />
      </div>
      <div className="op-auth-card">
        <span className="op-kicker">SHARED EXPENSES, SIMPLIFIED</span>
        <h1>{register ? 'Create your account' : 'Welcome back'}</h1>
        <p>
          {register
            ? 'Start sharing expenses without the awkwardness.'
            : 'Sign in to pick up where you left off.'}
        </p>
        <form onSubmit={submit}>
          {register && (
            <label>
              Name
              <input
                required
                autoComplete="name"
                placeholder="Your name"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              autoComplete={register ? 'new-password' : 'current-password'}
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="op-primary" type="submit" disabled={loading}>
            {loading ? (
              'Processing...'
            ) : register ? (
              <>
                Create account <ChevronRight size={16} />
              </>
            ) : (
              <>
                Sign in <ChevronRight size={16} />
              </>
            )}
          </button>
        </form>
        {notice && (
          <p className="op-error" role="alert">
            {notice}
          </p>
        )}
        <p className="op-auth-switch">
          {register ? 'Already have an account?' : 'New to OPUSOL?'}{' '}
          <Link href={register ? '/login' : '/register'}>
            {register ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
        <Link className="op-demo-link" href="/dashboard">
          Explore demo mode without signing in <ChevronRight size={15} />
        </Link>
      </div>
      <small className="op-auth-foot">OPUSOL · All amounts in INR</small>
    </main>
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
    <div
      className="op-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section className="op-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button onClick={close} aria-label="Close">
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
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
      <b>{value}</b>
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
                {x.group} · {x.date} · Paid by {x.payer.name}
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
                <X size={14} />
              </button>
            )}
          </div>
        ))
      ) : (
        <p className="op-empty">No expenses yet. Add one to get started.</p>
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
  onCreateExpense: (
    groupId: string,
    description: string,
    amount: number,
  ) => Promise<void>;
}) {
  const [modal, setModal] = useState<'group' | 'expense' | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [groupId, setGroupId] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const groupOptions = store.groups;

  const handleGroupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setFormError('');
    try {
      await onCreateGroup(name.trim(), 'Created via OPUSOL');
      setName('');
      setModal(null);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setBusy(false);
    }
  };

  const handleExpenseSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const val = Number(amount);
    if (!description.trim() || !Number.isFinite(val) || val <= 0 || !groupId) return;
    setBusy(true);
    setFormError('');
    try {
      await onCreateExpense(groupId, description.trim(), val);
      setDescription('');
      setAmount('');
      setGroupId('');
      setModal(null);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create expense');
    } finally {
      setBusy(false);
    }
  };

  const displayName = user ? user.name.split(' ')[0] : 'Aarav';

  return (
    <div className="op-content">
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

      <div className="op-section-title">
        <div>
          <h2>The big picture</h2>
          <p>
            {isLive
              ? 'Authoritative balances calculated from the backend.'
              : 'Balances shown are sample data in demo mode.'}
          </p>
        </div>
      </div>

      <section className="op-balance-grid">
        <Balance
          icon={Wallet}
          title="Your net balance"
          value={store.balances.total}
          detail="Across all groups"
          accent
        />
        <Balance
          icon={ArrowUpRight}
          title="You owe"
          value={store.balances.owe}
          detail="Pending debt to others"
        />
        <Balance
          icon={ArrowDownLeft}
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
            className="op-secondary op-small"
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
        <Modal title="Add an expense" close={() => setModal(null)}>
          <form className="op-form" onSubmit={handleExpenseSubmit}>
            <label>
              Description
              <input
                autoFocus
                required
                maxLength={100}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What was it for?"
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
            <label>
              Group
              <select
                required
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                <option value="">Choose a group</option>
                {groupOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            {formError && <p className="op-error">{formError}</p>}
            <p className="op-form-note">
              {isLive
                ? 'Expense is split equally among active group members in paise with full transaction safety.'
                : 'Demo expenses are attributed to you and saved in this browser only.'}
            </p>
            <button
              className="op-primary"
              type="submit"
              disabled={busy || !groupOptions.length}
            >
              {busy ? 'Adding...' : 'Add expense'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function GroupsPage({ store }: { store: Store }) {
  return (
    <div className="op-content">
      <div className="op-page-title">
        <span className="op-kicker">YOUR SHARED SPACES</span>
        <h1>Groups</h1>
        <p>Choose a group to see its activity, members, and balances.</p>
      </div>
      <div className="op-groups">
        {store.groups.length ? (
          store.groups.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`} className="op-group">
              <span className={`op-group-icon ${g.tone}`}>
                <Users size={20} />
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
          <p className="op-empty">No groups found.</p>
        )}
      </div>
    </div>
  );
}

function GroupDetail({
  store,
  id,
  isLive,
  onRefresh,
}: {
  store: Store;
  id: string;
  isLive: boolean;
  onRefresh: () => void;
}) {
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

  // Group balances & suggestions from API
  const [groupBalances, setGroupBalances] = useState<MemberBalance[]>([]);
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([]);

  const group = store.groups.find((g) => g.id === id);

  useEffect(() => {
    if (isLive && id) {
      balancesApi
        .get(id)
        .then((res) => {
          if (res?.balances) setGroupBalances(res.balances);
        })
        .catch(() => {});

      balancesApi
        .suggestions(id)
        .then((res) => {
          if (res?.suggestions) setSuggestions(res.suggestions);
        })
        .catch(() => {});
    }
  }, [id, isLive]);

  if (!group) {
    return (
      <div className="op-content">
        <Link href="/groups" className="op-back">
          <ArrowLeft size={16} /> All groups
        </Link>
        <h1>Group not found</h1>
      </div>
    );
  }

  const rows = store.expenses.filter((e) => e.group === group.name);

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
        onRefresh();
      } else {
        group.members.push({
          name: memberEmail.split('@')[0],
          initials: memberEmail.slice(0, 2).toUpperCase(),
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
            'Your leave request was auto-approved because your balance is ₹0.00. You have left the group.',
          );
        } else {
          setLeaveStatusMsg(
            `Leave request submitted for creator approval. Balance snapshot recorded: ${money((res.balance_snapshot || 0) / 100)}.`,
          );
        }
        onRefresh();
      } else {
        setLeaveStatusMsg(
          'Demo mode: In live mode, requests with zero balance are auto-approved, while debts require creator redistribution.',
        );
      }
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to submit leave request',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSettlement = async (e: FormEvent) => {
    e.preventDefault();
    const val = Number(settleAmount);
    if (!settlePayer || !settleReceiver || !Number.isFinite(val) || val <= 0) return;
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
        onRefresh();
      }
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to record settlement',
      );
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
        <h1>{group.name}</h1>
        <p>{group.context}</p>
      </div>

      <div className="op-detail-cards">
        <Balance
          icon={Wallet}
          title="Group total"
          value={group.total}
          detail="Total group expenses"
          accent
        />
        <Metric
          icon={Users}
          title="Active Members"
          value={group.memberCount}
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="op-primary op-small"
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

        <div className="op-groups">
          {group.members.map((member) => (
            <div className="op-member" key={member.name}>
              <span className="op-avatar">{member.initials}</span>
              <span>
                <b>{member.name}</b>
                <small>Group member</small>
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
                      Paid: {money(b.totalPaid / 100)} · Owed:{' '}
                      {money(b.totalOwed / 100)}
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
                        ? 'Owed to member'
                        : net < 0
                        ? 'Member owes'
                        : 'Balance is zero'}
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
              <p>Optimized transactions to clear outstanding debts.</p>
            </div>
            <button
              className="op-primary op-small"
              onClick={() => {
                if (suggestions[0]) {
                  setSettlePayer(suggestions[0].fromUserId);
                  setSettleReceiver(suggestions[0].toUserId);
                  setSettleAmount((suggestions[0].amount / 100).toString());
                }
                setSettleModal(true);
              }}
            >
              <Banknote size={16} /> Settle Up
            </button>
          </div>
          <div className="op-groups">
            {suggestions.map((s, idx) => (
              <div className="op-group" key={idx} style={{ cursor: 'default' }}>
                <span className="op-group-icon mint">
                  <Banknote size={18} />
                </span>
                <span className="op-group-info">
                  <b>
                    {s.fromName} owes {s.toName}
                  </b>
                  <small>Optimized greedy debt clearing suggestion</small>
                </span>
                <span className="op-group-total">{money(s.amount / 100)}</span>
              </div>
            ))}
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
        </div>
        <ExpenseTable items={rows} />
      </section>

      {/* Modals */}
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

      {settleModal && (
        <Modal title="Record a Settlement" close={() => setSettleModal(false)}>
          <form className="op-form" onSubmit={handleCreateSettlement}>
            <label>
              Payer (Member who is paying)
              <select
                required
                value={settlePayer}
                onChange={(e) => setSettlePayer(e.target.value)}
              >
                <option value="">Select payer</option>
                {groupBalances
                  .filter((b) => b.netBalance < 0)
                  .map((b) => (
                    <option key={b.userId} value={b.userId}>
                      {b.name} (Owes {money(Math.abs(b.netBalance / 100))})
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Receiver (Member receiving payment)
              <select
                required
                value={settleReceiver}
                onChange={(e) => setSettleReceiver(e.target.value)}
              >
                <option value="">Select receiver</option>
                {groupBalances
                  .filter((b) => b.netBalance > 0)
                  .map((b) => (
                    <option key={b.userId} value={b.userId}>
                      {b.name} (Owed {money(b.netBalance / 100)})
                    </option>
                  ))}
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
            </label>
            {actionError && <p className="op-error">{actionError}</p>}
            <p className="op-form-note">
              Records a pending settlement in the database. When confirmed by the
              recipient, debts are marked as completed.
            </p>
            <button className="op-primary" type="submit" disabled={busy}>
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
        <span className="op-kicker">ACTIVITY</span>
        <h1>Expenses</h1>
        <p>Recorded expenses across all your groups.</p>
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
  onUpdateStatus?: (id: string, status: 'completed' | 'cancelled') => Promise<void>;
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
    balances: { total: 0, owe: 0, owed: 0 },
    settlements: [],
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const [dark, setDark] = useState(
    () => localStorage.getItem('opusol-theme') === 'dark',
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

  // Load real store data from API
  const fetchRealData = async () => {
    if (!getToken()) return;
    setLoading(true);
    try {
      const groupsList: GroupItem[] = await groupsApi.list();
      const allExpenses: Expense[] = [];
      const allSettlements: SettlementItem[] = [];
      let totalBalance = 0;
      let totalOwe = 0;
      let totalOwed = 0;

      const tones = ['mint', 'coral', 'butter', 'lilac', 'blue'];

      const mappedGroups: Group[] = await Promise.all(
        groupsList.map(async (g, i) => {
          let memberCount = g.member_count || 1;
          let members: Person[] = [];
          let groupTotal = 0;

          try {
            const detail = await groupsApi.get(g.id);
            if (detail?.members) {
              memberCount = detail.members.length;
              members = detail.members.map((m) => ({
                name: m.name,
                initials: m.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2),
                tone: tones[Math.floor(Math.random() * tones.length)],
              }));
            }
          } catch {
            // Keep defaults
          }

          try {
            const expList: ExpenseItem[] = await expensesApi.list(g.id);
            if (Array.isArray(expList)) {
              for (const e of expList) {
                const amountRs = e.total_amount / 100;
                groupTotal += amountRs;
                allExpenses.push({
                  id: e.id,
                  title: e.title,
                  group: g.name,
                  payer: {
                    name: e.creator_name || 'Member',
                    initials: (e.creator_name || 'M')
                      .slice(0, 2)
                      .toUpperCase(),
                    tone: 'sage',
                  },
                  date: new Date(e.created_at).toLocaleDateString(),
                  amount: amountRs,
                  share: amountRs,
                  status:
                    e.created_by === currentUser?.id ? 'You paid' : 'Owed to you',
                  icon: 'bag',
                  tone: 'mint',
                });
              }
            }
          } catch {
            // Ignore
          }

          try {
            const setList: SettlementItem[] = await settlementsApi.list(g.id);
            if (Array.isArray(setList)) {
              allSettlements.push(...setList);
            }
          } catch {
            // Ignore
          }

          try {
            const balRes = await balancesApi.get(g.id);
            if (balRes?.balances && currentUser) {
              const myBal = balRes.balances.find((b) => b.userId === currentUser.id);
              if (myBal) {
                const netRs = myBal.netBalance / 100;
                totalBalance += netRs;
                if (netRs < 0) totalOwe += Math.abs(netRs);
                if (netRs > 0) totalOwed += netRs;
              }
            }
          } catch {
            // Ignore
          }

          return {
            id: g.id,
            name: g.name,
            context: g.description || 'Active group',
            members: members.length
              ? members
              : [{ name: g.creator_name || 'Creator', initials: 'CR', tone: 'sage' }],
            memberCount,
            total: groupTotal,
            tone: tones[i % tones.length],
            icon: i % 2 === 0 ? 'home' : 'cup',
          };
        }),
      );

      setRealStore({
        groups: mappedGroups,
        expenses: allExpenses.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
        balances: {
          total: totalBalance,
          owe: totalOwe,
          owed: totalOwed,
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
    const token = getToken();
    if (token) {
      authApi
        .me()
        .then((res) => {
          if (res?.user) {
            setCurrentUser(res.user);
            setIsLiveMode(true);
          }
        })
        .catch(() => {
          clearToken();
          setIsLiveMode(false);
          setCurrentUser(null);
        });
    }
  }, []);

  // Fetch real data when user or live mode is set
  useEffect(() => {
    if (isLiveMode && currentUser) {
      fetchRealData();
    }
  }, [isLiveMode, currentUser]);

  const handleLogout = () => {
    clearToken();
    setCurrentUser(null);
    setIsLiveMode(false);
    setLoc('/login');
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setIsLiveMode(true);
  };

  const handleCreateGroup = async (name: string, description: string) => {
    if (isLiveMode && currentUser) {
      await groupsApi.create({ name, description });
      await fetchRealData();
    } else {
      setDemoStore((prev) => ({
        ...prev,
        groups: [
          {
            id: crypto.randomUUID(),
            name,
            context: 'Created in demo mode',
            members: [{ name: 'Aarav Mehta', initials: 'AM', tone: 'sage' }],
            memberCount: 1,
            total: 0,
            tone: 'mint',
            icon: 'home',
          },
          ...prev.groups,
        ],
      }));
    }
  };

  const handleCreateExpense = async (
    groupId: string,
    title: string,
    amountRs: number,
  ) => {
    if (isLiveMode && currentUser) {
      const groupData = await groupsApi.get(groupId);
      const members = groupData.members || [];
      const splitMembers =
        members.length > 0 ? members : [{ user_id: currentUser.id }];

      const totalPaise = Math.round(amountRs * 100);

      await expensesApi.create(groupId, {
        title,
        totalAmount: totalPaise,
        splitType: 'equal',
        payers: [{ userId: currentUser.id, amount: totalPaise }],
        splits: splitMembers.map((m) => ({ userId: m.user_id })),
      });
      await fetchRealData();
    } else {
      const group = demoStore.groups.find((g) => g.id === groupId);
      if (!group) return;
      setDemoStore((prev) => ({
        ...prev,
        expenses: [
          {
            id: crypto.randomUUID(),
            title,
            group: group.name,
            payer: { name: 'You', initials: 'AM', tone: 'sage' },
            date: 'Just now',
            amount: amountRs,
            share: amountRs,
            status: 'You paid',
            icon: 'bag',
            tone: 'mint',
          },
          ...prev.expenses,
        ],
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, total: g.total + amountRs } : g,
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
    status: 'completed' | 'cancelled',
  ) => {
    if (isLiveMode) {
      await settlementsApi.update(settlementId, status);
      await fetchRealData();
    }
  };

  const activeStore = isLiveMode && currentUser ? realStore : demoStore;

  const routeView = useMemo(() => {
    if (loc === '/groups') return <GroupsPage store={activeStore} />;
    if (loc === '/expenses')
      return (
        <ExpensesPage
          store={activeStore}
          onDeleteExpense={isLiveMode ? handleDeleteExpense : undefined}
        />
      );
    if (loc === '/settlements')
      return (
        <SettlementsPage
          store={activeStore}
          isLive={isLiveMode}
          onUpdateStatus={isLiveMode ? handleUpdateSettlementStatus : undefined}
        />
      );
    if (/^\/groups\/[^/]+$/.test(loc))
      return (
        <GroupDetail
          store={activeStore}
          id={decodeURIComponent(loc.split('/')[2] || '')}
          isLive={isLiveMode}
          onRefresh={fetchRealData}
        />
      );
    if (loc === '/' || loc === '/dashboard')
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
  }, [loc, activeStore, isLiveMode, currentUser, loading]);

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
            loc.startsWith('/groups/') || loc === '/groups'
              ? 'Groups'
              : loc === '/expenses'
              ? 'Expenses'
              : loc === '/settlements'
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
