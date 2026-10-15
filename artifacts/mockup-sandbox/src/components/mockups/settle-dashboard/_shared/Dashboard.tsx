import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, Banknote, Bell, Check, ChevronRight,
  CircleHelp, Coffee, CreditCard, Ellipsis, Home as HomeIcon, House, Layers3, Moon,
  Plus, ReceiptText, Search, Sun, Users, Utensils, Wallet,
} from 'lucide-react';
import { balances, expenses, groups, type Expense, type Group, type Person } from './data';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
});
const currency = (value: number) => inr.format(value);

function Avatar({ person, size = 'md' }: { person: Person; size?: 'sm' | 'md' }) {
  return (
    <span className={`avatar avatar-${person.tone} ${size === 'sm' ? 'avatar-sm' : ''}`}
      title={person.name} aria-label={person.name} data-testid={`avatar-${person.initials.toLowerCase()}`}>
      {person.initials}
    </span>
  );
}

function Brand() {
  return <div className="brand-lockup" data-testid="brand-settle">
    <span className="brand-mark"><span /><span /><span /></span>
    <span className="font-display brand-name">settle<span className="brand-period">.</span></span>
  </div>;
}

function Sidebar() {
  const navigation = [
    { label: 'Dashboard', icon: HomeIcon, active: true },
    { label: 'Groups', icon: Users, active: false },
    { label: 'Expenses', icon: ReceiptText, active: false },
    { label: 'Settlements', icon: Banknote, active: false },
  ];
  return <aside className="sidebar desktop-sidebar" aria-label="Main navigation">
    <Brand />
    <div className="workspace-switch">
      <div className="workspace-glyph">A</div>
      <div className="workspace-copy"><span className="workspace-title">Aarav's space</span><span className="workspace-sub">Personal account</span></div>
      <Ellipsis size={17} className="muted-text" />
    </div>
    <div className="nav-caption">YOUR SPACE</div>
    <nav className="nav-stack">
      {navigation.map(({ label, icon: Icon, active }) => (
        <button type="button" key={label} disabled={!active} aria-current={active ? 'page' : undefined}
          className={`nav-item ${active ? 'nav-active' : 'nav-inactive'}`} data-testid={`nav-${label.toLowerCase()}`}>
          <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
          {label === 'Groups' && <span className="nav-count">3</span>}
        </button>
      ))}
    </nav>
    <div className="sidebar-bottom">
      <div className="sidebar-note">
        <div className="note-icon"><CircleHelp size={17} /></div>
        <div><strong>Money, made easy.</strong><p>Shared costs, minus the awkward.</p></div>
        <ChevronRight size={15} className="muted-text" />
      </div>
      <div className="sidebar-profile">
        <Avatar person={{ name: 'Aarav Mehta', initials: 'AM', tone: 'sage' }} />
        <div className="profile-copy"><strong>Aarav Mehta</strong><span>Personal</span></div>
        <Ellipsis size={18} className="muted-text" />
      </div>
    </div>
  </aside>;
}

function MobileNav() {
  return <nav className="mobile-nav" aria-label="Mobile navigation">
    <button className="mobile-nav-active" type="button" data-testid="mobile-nav-dashboard"><HomeIcon size={19} /><span>Home</span></button>
    <button disabled type="button" data-testid="mobile-nav-groups"><Users size={19} /><span>Groups</span></button>
    <button disabled type="button" data-testid="mobile-nav-expenses"><ReceiptText size={19} /><span>Expenses</span></button>
    <button disabled type="button" data-testid="mobile-nav-settlements"><Banknote size={19} /><span>Settlements</span></button>
  </nav>;
}

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return <button className="theme-toggle" type="button" onClick={onToggle}
    aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} data-testid="button-theme-toggle">
    {dark ? <Sun size={17} /> : <Moon size={17} />}
  </button>;
}

function Header({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return <header className="topbar">
    <div className="mobile-brand"><Brand /></div>
    <div className="breadcrumb"><span>My space</span><span className="breadcrumb-slash">/</span><strong>Dashboard</strong></div>
    <div className="topbar-actions">
      <button className="icon-button search-button" aria-label="Search (preview only)" type="button" disabled data-testid="button-search"><Search size={18} /></button>
      <button className="icon-button notification-button" aria-label="Notifications (preview only)" type="button" disabled data-testid="button-notifications"><Bell size={18} /><i /></button>
      <span className="topbar-divider" />
      <ThemeToggle dark={dark} onToggle={onToggle} />
      <Avatar person={{ name: 'Aarav Mehta', initials: 'AM', tone: 'sage' }} size="sm" />
    </div>
  </header>;
}

function SectionHeading({ eyebrow, title, note, children }: { eyebrow?: string; title: string; note?: string; children?: ReactNode }) {
  return <div className="section-heading">
    <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2 className="font-display">{title}</h2>{note && <p>{note}</p>}</div>
    {children}
  </div>;
}

function BalanceCard({ label, amount, detail, variant, icon: Icon, testId }: {
  label: string; amount: number; detail: string; variant: string; icon: typeof Wallet; testId: string;
}) {
  return <article className={`balance-card balance-${variant}`} data-testid={testId}>
    <div className="balance-top"><span className="balance-label">{label}</span><span className="balance-icon"><Icon size={17} strokeWidth={1.9} /></span></div>
    <div className="balance-amount font-display">{currency(amount)}</div>
    <div className="balance-bottom"><span>{detail}</span><span className="balance-spark" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span></div>
  </article>;
}

function BalanceOverview() {
  return <section aria-label="Balance overview" className="balance-grid">
    <BalanceCard label="Your net balance" amount={balances.total} detail="Across all your groups" variant="total" icon={Wallet} testId="balance-total" />
    <BalanceCard label="You owe" amount={balances.owe} detail="Across 2 groups" variant="owe" icon={ArrowUpRight} testId="balance-owe" />
    <BalanceCard label="Owed to you" amount={balances.owed} detail="Across 3 people" variant="owed" icon={ArrowDownLeft} testId="balance-owed" />
  </section>;
}

function GroupGlyph({ group }: { group: Group }) {
  const Icon = group.icon === 'home' ? House : group.icon === 'sun' ? Sun : Coffee;
  return <div className={`group-glyph glyph-${group.tone}`}><Icon size={20} strokeWidth={1.8} /></div>;
}

function GroupCard({ group }: { group: Group }) {
  return <article className="group-card" data-testid={`card-group-${group.id}`}>
    <div className="group-card-top"><GroupGlyph group={group} /><button className="more-button" type="button" disabled aria-label={`${group.name} options unavailable`} data-testid={`button-group-options-${group.id}`}><Ellipsis size={18} /></button></div>
    <h3 className="font-display">{group.name}</h3>
    <p className="group-context">{group.context}</p>
    <div className="group-card-bottom">
      <div className="member-stack" aria-label={`${group.memberCount} group members`}>
        {group.members.slice(0, 3).map((person) => <Avatar key={person.initials} person={person} size="sm" />)}
        {group.memberCount > 3 && <span className="avatar avatar-extra">+{group.memberCount - 3}</span>}
      </div>
      <span className="member-count">{group.memberCount} members</span>
      <span className="group-total">{currency(group.total)}</span>
    </div>
  </article>;
}

function DisabledAction({ kind }: { kind: 'group' | 'expense' }) {
  const isGroup = kind === 'group';
  const Icon = isGroup ? Users : Plus;
  return <button type="button" disabled className={`action-button ${isGroup ? 'button-primary' : 'button-secondary'}`}
    title="Available in a future version" aria-label={`${isGroup ? 'Create group' : 'Add expense'} — preview only`}
    data-testid={`button-${isGroup ? 'create-group' : 'add-expense'}`}>
    <Icon size={16} strokeWidth={2.2} />{isGroup ? 'Create group' : 'Add expense'}
    <span className="preview-mark">Preview</span>
  </button>;
}

function GroupsSection() {
  return <section className="content-section" aria-label="Your groups">
    <SectionHeading eyebrow="THE PEOPLE YOU SHARE WITH" title="Your groups" note="A little snapshot of what everyone’s spending together.">
      <DisabledAction kind="group" />
    </SectionHeading>
    <div className="group-grid">{groups.map((group) => <GroupCard key={group.id} group={group} />)}</div>
  </section>;
}

function ExpenseIcon({ expense }: { expense: Expense }) {
  const Icon = expense.icon === 'food' ? Utensils : expense.icon === 'cab' ? CreditCard : expense.icon === 'coffee' ? Coffee : Layers3;
  return <span className={`expense-glyph glyph-${expense.tone}`}><Icon size={17} strokeWidth={1.8} /></span>;
}

function statusClass(status: Expense['status']) {
  if (status === 'You owe') return 'status-owe';
  if (status === 'Owed to you') return 'status-owed';
  return 'status-paid';
}

function ExpenseRow({ expense }: { expense: Expense }) {
  return <div className="expense-row" data-testid={`row-expense-${expense.id}`}>
    <ExpenseIcon expense={expense} />
    <div className="expense-name"><strong>{expense.title}</strong><span>{expense.group}<i>·</i>{expense.date}</span></div>
    <div className="expense-payer"><Avatar person={expense.payer} size="sm" /><span>{expense.payer.name === 'You' ? 'You paid' : expense.payer.name}</span></div>
    <div className="expense-total"><strong>{currency(expense.amount)}</strong><span>Total</span></div>
    <div className="expense-share"><strong>{currency(expense.share)}</strong><span className={`expense-status ${statusClass(expense.status)}`}><i />{expense.status}</span></div>
  </div>;
}

function RecentExpenses() {
  return <section className="content-section recent-section" aria-label="Recent expenses">
    <SectionHeading eyebrow="THE LATEST" title="Recent expenses" note="Everything out in the open, no awkward follow-ups.">
      <DisabledAction kind="expense" />
    </SectionHeading>
    <div className="expense-panel surface">
      <div className="expense-table-head"><span>EXPENSE</span><span>PAID BY</span><span>GROUP TOTAL</span><span>YOUR SHARE</span></div>
      <div className="expense-list">{expenses.map((expense) => <ExpenseRow key={expense.id} expense={expense} />)}</div>
      <div className="expense-footer"><span><Check size={14} /> You’re all caught up</span><span>Showing 4 of 12 expenses</span></div>
    </div>
  </section>;
}

export function Dashboard({ polished = false }: { polished?: boolean }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem('settle-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDark = stored ? stored === 'dark' : prefersDark;
    setDark(initialDark);
    document.documentElement.classList.toggle('dark', initialDark);
  }, []);
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('settle-theme', next ? 'dark' : 'light');
  };
  return <div className={polished ? "app-shell polished" : "app-shell current"}>
    <Sidebar />
    <main className="dashboard-main">
      <Header dark={dark} onToggle={toggleTheme} />
      <div className="dashboard-content">
        <div className="welcome-row page-enter">
          <div><div className="welcome-kicker"><span className="online-dot" /> MONDAY, JUNE 17</div><h1 className="font-display" data-testid="heading-dashboard">Good to see you, Aarav<span>.</span></h1><p>Your shared life, all in one place.</p></div>
          <div className="week-pill"><span className="week-dot" /> All groups looking good</div>
        </div>
        <div className="balance-label-row"><div><h2 className="font-display">The big picture</h2><p>Here’s where you stand right now.</p></div><span className="updated-label"><span /> Updated just now</span></div>
        <div className="page-enter stagger-1"><BalanceOverview /></div>
        <div className="page-enter stagger-2"><GroupsSection /></div>
        <div className="page-enter stagger-3"><RecentExpenses /></div>
        <footer className="dashboard-footer"><span>Made for sharing the load.</span><span>Sample dashboard <b>·</b> All amounts in INR</span></footer>
      </div>
    </main>
    <MobileNav />
  </div>;
}
