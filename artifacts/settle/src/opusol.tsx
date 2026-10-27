import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, Banknote, Check, ChevronRight, CircleHelp,
  Coffee, House, LogOut, Moon, Plus, ReceiptText, Sun, Users, Wallet, X,
} from 'lucide-react';
import { balances as seedBalances, expenses as seedExpenses, groups as seedGroups, type Expense, type Group, type Person } from './data';

const demoMode = import.meta.env.VITE_DEMO_MODE !== 'false';
const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
const me: Person = { name: 'Aarav Mehta', initials: 'AM', tone: 'sage' };
type Store = { groups: Group[]; expenses: Expense[] };

function loadStore(): Store {
  if (!demoMode) return { groups: [], expenses: [] };
  try {
    const saved = localStorage.getItem('opusol-demo-data');
    if (saved) return JSON.parse(saved) as Store;
  } catch { /* reset malformed demo data to the bundled sample */ }
  return { groups: seedGroups, expenses: seedExpenses };
}

function Brand() {
  return <Link href="/dashboard" className="op-brand" aria-label="OPUSOL dashboard"><span className="op-mark"><i /><i /><i /></span><b>opusol</b></Link>;
}

function AppShell({ children, active, dark, toggle, onLogout }: { children: ReactNode; active: string; dark: boolean; toggle: () => void; onLogout: () => void }) {
  const links = [['Dashboard', '/dashboard', Wallet], ['Groups', '/groups', Users], ['Expenses', '/expenses', ReceiptText], ['Settlements', '/settlements', Banknote]] as const;
  return <div className="op-shell"><aside className="op-sidebar"><Brand/><div className="op-workspace"><span>A</span><div><b>Aarav’s space</b><small>{demoMode ? 'Demo workspace' : 'Personal account'}</small></div></div><small className="op-label">YOUR SPACE</small><nav>{links.map(([name, href, Icon]) => <Link key={href} href={href} className={`op-nav ${active === name ? 'selected' : ''}`}><Icon size={18}/>{name}{name === 'Groups' && <em>3</em>}</Link>)}</nav><div className="op-sidebar-bottom"><div className="op-help"><CircleHelp size={18}/><span><b>Money, made easy.</b><small>Shared costs, minus the awkward.</small></span></div><div className="op-account"><span className="op-avatar">AM</span><span><b>Aarav Mehta</b><small>{demoMode ? 'Demo profile' : 'Account'}</small></span><button aria-label="Sign out" onClick={onLogout}><LogOut size={16}/></button></div></div></aside><main className="op-main"><header className="op-top"><div className="op-mobile-brand"><Brand/></div><div className="op-crumb">My space <i>/</i> <b>{active}</b></div><div className="op-top-actions">{demoMode && <span className="demo-pill"><i/> DEMO MODE</span>}<button className="op-theme" onClick={toggle} aria-label="Toggle theme">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button></div></header>{children}</main><nav className="op-mobile-nav">{links.map(([name, href, Icon])=><Link key={href} href={href} className={active===name?'selected':''}><Icon size={19}/><span>{name}</span></Link>)}</nav></div>;
}

function Auth({ register }: { register: boolean }) {
  const [notice, setNotice] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); setNotice('Sign-in is not connected yet. Connect the OPUSOL API to create an account or sign in. No credentials were saved.'); };
  return <main className="op-auth"><div className="op-auth-brand"><Brand/></div><div className="op-auth-card"><span className="op-kicker">SHARED EXPENSES, SIMPLIFIED</span><h1>{register ? 'Create your account' : 'Welcome back'}</h1><p>{register ? 'Start sharing expenses without the awkwardness.' : 'Sign in to pick up where you left off.'}</p><form onSubmit={submit}>{register&&<label>Name<input required autoComplete="name" placeholder="Your name" maxLength={80}/></label>}<label>Email<input type="email" required autoComplete="email" placeholder="you@example.com"/></label><label>Password<input type="password" required minLength={8} autoComplete={register?'new-password':'current-password'} placeholder="At least 8 characters"/></label><button className="op-primary" type="submit">{register?'Create account':'Sign in'} <ChevronRight size={16}/></button></form>{notice && <p className="op-error" role="alert">{notice}</p>}<p className="op-auth-switch">{register?'Already have an account?':'New to OPUSOL?'} <Link href={register?'/login':'/register'}>{register?'Sign in':'Create an account'}</Link></p>{demoMode&&<Link className="op-demo-link" href="/dashboard">Explore the demo instead <ChevronRight size={15}/></Link>}</div><small className="op-auth-foot">OPUSOL · All amounts in INR</small></main>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="op-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="op-modal" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button onClick={close} aria-label="Close"><X size={19}/></button></header>{children}</section></div>;
}

function Dashboard({ store, setStore }: { store: Store; setStore: (s: Store)=>void }) {
  const [modal,setModal]=useState<'group'|'expense'|null>(null);
  const [name,setName]=useState(''); const [description,setDescription]=useState(''); const [amount,setAmount]=useState(''); const [groupId,setGroupId]=useState('');
  const groupOptions=store.groups;
  const submitGroup=(e:FormEvent)=>{e.preventDefault();if(!name.trim())return;setStore({...store,groups:[{id:crypto.randomUUID(),name:name.trim(),context:'Created in demo mode',members:[me],memberCount:1,total:0,tone:'mint',icon:'home'}]});setName('');setModal(null);};
  const submitExpense=(e:FormEvent)=>{e.preventDefault();const value=Math.round(Number(amount)*100)/100;const group=store.groups.find(g=>g.id===groupId);if(!description.trim()||!Number.isFinite(value)||value<=0||!group)return;setStore({...store,expenses:[{id:crypto.randomUUID(),title:description.trim(),group:group.name,payer:{...me,name:'You'},date:'Just now',amount:value,share:value,status:'You paid',icon:'bag',tone:'mint'},...store.expenses],groups:store.groups.map(g=>g.id===group.id?{...g,total:g.total+value}:g)});setDescription('');setAmount('');setModal(null);};
  return <div className="op-content"><div className="op-welcome"><div><span className="op-kicker"><i/> YOUR SHARED LIFE, IN ONE PLACE</span><h1>Good to see you, Aarav<span>.</span></h1><p>Everything you share, settled simply.</p></div><span className="op-note">All groups looking good</span></div><div className="op-section-title"><div><h2>The big picture</h2><p>Balances shown are sample data in demo mode.</p></div></div><section className="op-balance-grid"><Balance icon={Wallet} title="Your net balance" value={demoMode?seedBalances.total:0} detail="Across all groups" accent/><Balance icon={ArrowUpRight} title="You owe" value={demoMode?seedBalances.owe:0} detail="Across 2 groups"/><Balance icon={ArrowDownLeft} title="Owed to you" value={demoMode?seedBalances.owed:0} detail="Across 3 people"/></section><section className="op-section"><div className="op-section-title"><div><span className="op-kicker">THE PEOPLE YOU SHARE WITH</span><h2>Your groups</h2><p>Shared spaces for the costs of everyday life.</p></div><button className="op-primary op-small" onClick={()=>setModal('group')}><Plus size={16}/> Create group</button></div><div className="op-groups">{store.groups.map(g=><Link key={g.id} href={`/groups/${g.id}`} className="op-group"><span className={`op-group-icon ${g.tone}`}>{g.icon==='home'?<House size={20}/>:g.icon==='cup'?<Coffee size={20}/>:<Users size={20}/>}</span><span className="op-group-info"><b>{g.name}</b><small>{g.context}</small></span><span className="op-group-total">{money(g.total)}<small>{g.memberCount} members</small></span><ChevronRight size={17}/></Link>)}</div></section><section className="op-section"><div className="op-section-title"><div><span className="op-kicker">THE LATEST</span><h2>Recent expenses</h2><p>Recent activity across your groups.</p></div><button className="op-secondary op-small" onClick={()=>setModal('expense')}><Plus size={16}/> Add expense</button></div><ExpenseTable items={store.expenses.slice(0,5)}/></section><footer className="op-footer"><span>Made for sharing the load.</span><span>{demoMode?'Demo data · ':' '}All amounts in INR</span></footer>
    {modal==='group'&&<Modal title="Create a group" close={()=>setModal(null)}><form className="op-form" onSubmit={submitGroup}><label>Group name<input autoFocus required maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Flat 14"/></label><p className="op-form-note">This group is saved only in this browser’s demo data.</p><button className="op-primary" type="submit">Create demo group</button></form></Modal>}
    {modal==='expense'&&<Modal title="Add an expense" close={()=>setModal(null)}><form className="op-form" onSubmit={submitExpense}><label>Description<input autoFocus required maxLength={100} value={description} onChange={e=>setDescription(e.target.value)} placeholder="What was it for?"/></label><label>Total amount (₹)<input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></label><label>Group<select required value={groupId} onChange={e=>setGroupId(e.target.value)}><option value="">Choose a group</option>{groupOptions.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><p className="op-form-note">Demo expenses are attributed to you and saved in this browser only.</p><button className="op-primary" type="submit" disabled={!groupOptions.length}>Add demo expense</button></form></Modal>}
  </div>;
}

function Balance({icon:Icon,title,value,detail,accent=false}:{icon:typeof Wallet;title:string;value:number;detail:string;accent?:boolean}){return <article className={`op-balance ${accent?'accent':''}`}><span><small>{title}</small><i><Icon size={17}/></i></span><b>{money(value)}</b><small>{detail}</small></article>}
function Metric({icon:Icon,title,value,detail}:{icon:typeof Wallet;title:string;value:number;detail:string}){return <article className="op-balance"><span><small>{title}</small><i><Icon size={17}/></i></span><b>{value}</b><small>{detail}</small></article>}
function ExpenseTable({items}:{items:Expense[]}){return <div className="op-expenses">{items.length?items.map(x=><div className="op-expense" key={x.id}><span className="op-expense-icon"><ReceiptText size={17}/></span><span className="op-expense-info"><b>{x.title}</b><small>{x.group} · {x.date}</small></span><span className="op-expense-amount"><b>{money(x.amount)}</b><small>{x.status}</small></span></div>):<p className="op-empty">No expenses yet. Add one to get started.</p>}</div>}

function GroupsPage({store}:{store:Store}){return <div className="op-content"><div className="op-page-title"><span className="op-kicker">YOUR SHARED SPACES</span><h1>Groups</h1><p>Choose a group to see its activity.</p></div><div className="op-groups">{store.groups.map(g=><Link key={g.id} href={`/groups/${g.id}`} className="op-group"><span className={`op-group-icon ${g.tone}`}><Users size={20}/></span><span className="op-group-info"><b>{g.name}</b><small>{g.context}</small></span><span className="op-group-total">{money(g.total)}<small>{g.memberCount} members</small></span><ChevronRight size={17}/></Link>)}</div></div>}
function GroupDetail({store,id}:{store:Store;id:string}) {
  const [leaveInfo,setLeaveInfo]=useState(false);
  const group=store.groups.find(g=>g.id===id);
  if(!group)return <div className="op-content"><Link href="/groups" className="op-back"><ArrowLeft size={16}/> All groups</Link><h1>Group not found</h1></div>;
  const rows=store.expenses.filter(e=>e.group===group.name);
  return <div className="op-content">
    <Link href="/groups" className="op-back"><ArrowLeft size={16}/> All groups</Link>
    <div className="op-page-title"><span className="op-kicker">GROUP DETAILS · {group.memberCount} MEMBERS</span><h1>{group.name}</h1><p>{group.context}</p></div>
    <div className="op-detail-cards"><Balance icon={Wallet} title="Group total" value={group.total} detail="Recorded demo expenses" accent/><Metric icon={Users} title="Members" value={group.memberCount} detail="Member management unavailable in demo"/></div>
    <section className="op-section"><div className="op-section-title"><div><h2>Members</h2><p>Showing {group.members.length} demo profiles of {group.memberCount}. Permissions come from the backend.</p></div><button className="op-secondary op-small" onClick={()=>setLeaveInfo(true)}>Leave group</button></div>
      <div className="op-groups">{group.members.map(member=><div className="op-member" key={member.name}><span className="op-avatar">{member.initials}</span><span><b>{member.name}</b><small>{member.name==='Aarav Mehta'?'You':'Group member'}</small></span></div>)}</div>
    </section>
    <section className="op-section"><div className="op-section-title"><div><h2>Expenses</h2><p>Group activity</p></div></div><ExpenseTable items={rows}/></section>
    <div className="op-callout">Balances and settlement suggestions require the connected backend. No split or settlement has been calculated.</div>
    {leaveInfo&&<Modal title="Leave this group" close={()=>setLeaveInfo(false)}><div className="op-form"><p className="op-form-note">Leaving a group or requesting approval requires the connected backend. Nothing has changed.</p><button className="op-primary" onClick={()=>setLeaveInfo(false)}>Got it</button></div></Modal>}
  </div>;
}
function ExpensesPage({store}:{store:Store}){return <div className="op-content"><div className="op-page-title"><span className="op-kicker">ACTIVITY</span><h1>Expenses</h1><p>Recorded expenses across your groups.</p></div><ExpenseTable items={store.expenses}/></div>}
function Settlements(){return <div className="op-content"><div className="op-page-title"><span className="op-kicker">CLOSE THE LOOP</span><h1>Settlements</h1><p>Settlement amounts must come from the connected API.</p></div><div className="op-callout"><Banknote size={21}/><span><b>No settlement calculations are shown in demo mode.</b><small>Connect the backend to load authoritative balances and settlement suggestions.</small></span></div></div>}
function NotFound(){return <div className="op-content"><div className="op-page-title"><span className="op-kicker">404</span><h1>Page not found</h1><p>That OPUSOL page doesn’t exist.</p><Link className="op-primary op-inline" href="/dashboard">Go to dashboard</Link></div></div>}

export function OpusolApp(){
  const [store,setStoreState]=useState<Store>(loadStore);const [dark,setDark]=useState(()=>localStorage.getItem('opusol-theme')==='dark');const [loc,setLoc]=useLocation();
  const saveStore=(s:Store)=>{setStoreState(s);if(demoMode)localStorage.setItem('opusol-demo-data',JSON.stringify(s));};
  useEffect(()=>{document.documentElement.classList.toggle('dark',dark);document.title='OPUSOL — Shared expenses, simplified';},[dark]);
  const toggle=()=>{const next=!dark;setDark(next);localStorage.setItem('opusol-theme',next?'dark':'light');};
  const logout=()=>setLoc('/login');
  const routeView=useMemo(()=>{if(loc==='/groups')return <GroupsPage store={store}/>;if(loc==='/expenses')return <ExpensesPage store={store}/>;if(loc==='/settlements')return <Settlements/>;if(/^\/groups\/[^/]+$/.test(loc))return <GroupDetail store={store} id={decodeURIComponent(loc.split('/')[2]||'')}/>;if(loc==='/'||loc==='/dashboard')return <Dashboard store={store} setStore={saveStore}/>;return <NotFound/>;},[loc,store]);
  return <Switch><Route path="/login"><Auth register={false}/></Route><Route path="/register"><Auth register/></Route><Route><AppShell active={loc.startsWith('/groups/')||loc==='/groups'?'Groups':loc==='/expenses'?'Expenses':loc==='/settlements'?'Settlements':'Dashboard'} dark={dark} toggle={toggle} onLogout={logout}>{routeView}</AppShell></Route></Switch>;
}
