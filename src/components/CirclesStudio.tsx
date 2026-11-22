import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { motion } from 'motion/react';
import { ArrowRight, Check, Plus, Users, Wallet, Sparkles } from 'lucide-react';
import * as THREE from 'three';
import type { Circle, CircleExpense } from '../data/demo';
import './CirclesStudio.css';

type Props = {
  circles: Circle[];
  onChange: (circles: Circle[]) => void;
  formatMoney: (amount: number) => string;
  reducedMotion: boolean;
};

const colors = ['#45E6D0', '#FF633E', '#FF78B9', '#B9A4E8', '#FFCF76', '#8EA6FF', '#A6F0BE', '#F9A77C'];
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const cents = (n: number) => Math.round(n * 100);
const moneyFromCents = (n: number) => n / 100;

function calculateBalances(roster: string[], ledger: CircleExpense[]): Record<string, number> {
  const balances = Object.fromEntries(roster.map(name => [name, 0])) as Record<string, number>;
  for (const item of ledger) {
    if (!(item.paidBy in balances) || !item.splitWith.length) continue;
    const participants = item.splitWith.filter(name => name in balances);
    if (participants.length === 0) continue;
    const total = cents(item.amount);
    const base = Math.floor(total / participants.length);
    const remainder = total - base * participants.length;
    balances[item.paidBy] += total;
    participants.forEach((name, index) => {
      balances[name] -= base + (index < remainder ? 1 : 0);
    });
  }
  return balances;
}

function settlements(balances: Record<string, number>) {
  const creditors = Object.entries(balances).filter(([, amount]) => amount > 0).map(([name, amount]) => ({ name, amount }));
  const debtors = Object.entries(balances).filter(([, amount]) => amount < 0).map(([name, amount]) => ({ name, amount: -amount }));
  const result: { from: string; to: string; amount: number }[] = [];
  let i = 0; let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].amount, creditors[j].amount);
    if (transfer > 0) result.push({ from: debtors[i].name, to: creditors[j].name, amount: moneyFromCents(transfer) });
    debtors[i].amount -= transfer;
    creditors[j].amount -= transfer;
    if (!debtors[i].amount) i++;
    if (!creditors[j].amount) j++;
  }
  return result;
}

function OrbitingPeople({ names, selected, onSelect, reducedMotion }: {
  names: string[];
  selected: string;
  onSelect: (name: string) => void;
  reducedMotion: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  const radius = names.length < 4 ? 1.35 : 1.66;
  useFrame(({ clock, pointer }, dt) => {
    if (!root.current || reducedMotion) return;
    root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, pointer.x * 0.25 + Math.sin(clock.elapsedTime * 0.23) * 0.16, 1.4, dt);
    root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, -0.22 - pointer.y * 0.12, 1.4, dt);
  });
  return <group ref={root} rotation={[-0.22, 0, 0]}>
    <mesh><icosahedronGeometry args={[0.48, 3]}/><meshPhysicalMaterial color="#FF633E" metalness={0.72} roughness={0.19} clearcoat={1} emissive="#FF633E" emissiveIntensity={0.18}/></mesh>
    <mesh rotation={[Math.PI / 2.65, 0, 0]}><torusGeometry args={[0.67, 0.022, 9, 96]}/><meshBasicMaterial color="#45E6D0"/></mesh>
    {[1.1, radius, 2.08].map((r, i) => <mesh key={i} rotation={[1.1, i * 0.2, 0]}><torusGeometry args={[r, 0.007, 6, 120]}/><meshBasicMaterial color={colors[i]} transparent opacity={0.3}/></mesh>)}
    {names.slice(0, 14).map((name, index) => {
      const angle = (index / names.length) * Math.PI * 2 + 0.4;
      const position: [number, number, number] = [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.62, Math.sin(angle * 1.4) * 0.36];
      const active = name === selected;
      return <group key={name} position={position}>
        <mesh onClick={event => { event.stopPropagation(); onSelect(name); }}>
          <icosahedronGeometry args={[active ? 0.34 : 0.26, 2]}/>
          <meshPhysicalMaterial color={colors[index % colors.length]} metalness={0.62} roughness={0.2} clearcoat={1} emissive={colors[index % colors.length]} emissiveIntensity={active ? 0.7 : 0.14}/>
        </mesh>
        {active && <mesh rotation={[1.0, 0.2, 0]}><torusGeometry args={[0.48, 0.026, 8, 64]}/><meshBasicMaterial color="#F6EDFF"/></mesh>}
      </group>;
    })}
    <pointLight position={[0, 0, 1]} color="#45E6D0" intensity={15} distance={6}/>
  </group>;
}

function CircleUniverse({ names, selected, setSelected, reducedMotion }: {
  names: string[]; selected: string; setSelected: (name: string) => void; reducedMotion: boolean;
}) {
  return <div className="vyra-circle-universe">
    <div className="vyra-circle-glow"/>
    <Canvas camera={{ position: [0, 0, 6.8], fov: 43 }} dpr={[1, 1.5]} frameloop={reducedMotion ? 'demand' : 'always'} gl={{ alpha: true, antialias: true }} fallback={<div className="vyra-circle-fallback">V / CONNECTED</div>}>
      <ambientLight intensity={1.55}/><hemisphereLight args={[0xDDFFFA, 0x2D1E42, 1.8]}/>
      <directionalLight position={[3, 4, 5]} intensity={2.6} color="#FFF1E4"/>
      <OrbitingPeople names={names} selected={selected} onSelect={setSelected} reducedMotion={reducedMotion}/>
    </Canvas>
    <span className="vyra-circle-art-caption">V / CONNECTED MONEY</span>
    <span className="vyra-circle-art-count">{names.length} NODES</span>
  </div>;
}

export default function CirclesStudio({ circles, onChange, formatMoney, reducedMotion }: Props) {
  const [selectedId, setSelectedId] = useState('');
  const [newCircle, setNewCircle] = useState('');
  const [newPerson, setNewPerson] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [selectedPerson, setSelectedPerson] = useState('');
  const [message, setMessage] = useState('');
  const active = circles.find(c => c.id === selectedId) ?? circles[0];
  const roster = useMemo(() => active?.roster?.length ? active.roster : ['You'], [active]);
  const ledger = useMemo(() => active?.ledger ?? [], [active]);
  const balances = useMemo(() => calculateBalances(roster, ledger), [roster, ledger]);
  const transfers = useMemo(() => settlements(balances), [balances]);
  const focusedPerson = roster.includes(selectedPerson) ? selectedPerson : roster[0];
  const currentPayer = roster.includes(payer) ? payer : roster[0];
  const chosen = participants.filter(p => roster.includes(p));
  const chosenParticipants = chosen.length ? chosen : roster;
  const totalLogged = ledger.reduce((sum, item) => sum + item.amount, 0);

  function updateCircle(next: Circle) { onChange(circles.map(c => c.id === next.id ? next : c)); }
  function chooseCircle(id: string) { setSelectedId(id); setNewPerson(''); setTitle(''); setAmount(''); setPayer(''); setParticipants([]); setSelectedPerson(''); setMessage(''); }
  function createCircle(event: FormEvent) {
    event.preventDefault();
    const name = newCircle.trim();
    if (!name || name.length > 60) { setMessage('Enter a group name of up to 60 characters.'); return; }
    const next: Circle = { id: makeId(), name, members: 1, expenses: 0, balance: 0, roster: ['You'], ledger: [] };
    onChange([...circles, next]); chooseCircle(next.id); setNewCircle(''); setMessage('Group created. Add your members to begin splitting.');
  }
  function addPerson(event: FormEvent) {
    event.preventDefault();
    if (!active) return;
    const name = newPerson.trim();
    if (name.length < 1 || name.length > 40 || roster.some(r => r.toLowerCase() === name.toLowerCase())) { setMessage('Use a unique member name (up to 40 characters).'); return; }
    if (roster.length >= 14) { setMessage('This demo supports up to 14 named members in one group.'); return; }
    const nextRoster = [...roster, name];
    updateCircle({ ...active, roster: nextRoster, members: nextRoster.length });
    setNewPerson(''); setMessage(`${name} added to this demo group.`);
  }
  function recordExpense(event: FormEvent) {
    event.preventDefault();
    if (!active) return;
    const value = Number(amount);
    if (!title.trim() || title.trim().length > 100 || !Number.isFinite(value) || value <= 0 || value > 1000000 || cents(value) <= 0) {
      setMessage('Enter a description and an amount from 0.01 to 1,000,000.'); return;
    }
    const item: CircleExpense = { id: makeId(), title: title.trim(), amount: moneyFromCents(cents(value)), paidBy: currentPayer, splitWith: [...chosenParticipants], date: new Date().toISOString().slice(0, 10) };
    updateCircle({ ...active, roster: [...roster], members: roster.length, ledger: [item, ...ledger] });
    setTitle(''); setAmount(''); setMessage('Shared demo expense saved. No real money moved.');
  }
  return <div className="vyra-circles-page">
    <header className="vyra-circles-heading"><div><span className="eyebrow">CIRCLES / SHARED MONEY</span><h1>Better <em>together.</em></h1><p>Make group spending clearer. Visualize connections, split bills, and see who owes whom.</p></div><div className="vyra-circle-head-mark"><Users size={24}/></div></header>
    <section className="vyra-circle-header-panel">
      <div><span className="eyebrow">YOUR SHARED SPACES</span><h2>Pick your circle.</h2><div className="vyra-circle-selectors">{circles.map(c => <button key={c.id} className={c.id === active?.id ? 'active' : ''} type="button" onClick={() => chooseCircle(c.id)}>{c.name} <ArrowRight size={14}/></button>)}</div></div>
      <form onSubmit={createCircle} className="vyra-circle-create"><label htmlFor="new-vyra-circle">START A NEW CIRCLE</label><div><input id="new-vyra-circle" placeholder="e.g. Road trip crew" value={newCircle} maxLength={60} onChange={e => setNewCircle(e.target.value)} required/><button type="submit" aria-label="Create circle"><Plus size={20}/></button></div></form>
    </section>
    {active && <>
      <div className="vyra-circle-layout">
        <section className="vyra-circle-visual-panel"><div className="vyra-circle-topline"><span>GROUP / {active.name.toUpperCase()}</span><span>INTERACTIVE 3D</span></div><CircleUniverse names={roster} selected={focusedPerson} setSelected={setSelectedPerson} reducedMotion={reducedMotion}/><div className="vyra-circle-member-chips">{roster.map((name, i) => <button type="button" key={name} className={focusedPerson === name ? 'active' : ''} onClick={() => setSelectedPerson(name)}><i style={{ background: colors[i % colors.length] }}/>{name}</button>)}</div></section>
        <section className="vyra-circle-detail-panel"><div className="eyebrow">LIVE SPLIT ENGINE</div><h2>{active.name}</h2><p className="vyra-circle-muted">Balances are calculated from new expenses recorded below.</p><div className="vyra-circle-stats"><div><small>TRACKED EXPENSES</small><b>{formatMoney(totalLogged)}</b></div><div><small>MEMBERS ADDED</small><b>{roster.length}</b></div></div><div className="vyra-circle-focus"><span>SELECTED MEMBER</span><strong>{focusedPerson}</strong><b className={balances[focusedPerson] >= 0 ? 'positive' : 'negative'}>{balances[focusedPerson] > 0 ? `Gets back ${formatMoney(moneyFromCents(balances[focusedPerson]))}` : balances[focusedPerson] < 0 ? `Owes ${formatMoney(moneyFromCents(-balances[focusedPerson]))}` : 'All settled'}</b></div>
          <form className="vyra-circle-add-person" onSubmit={addPerson}><label htmlFor="vyra-person">ADD A GROUP MEMBER</label><div><input id="vyra-person" placeholder="Member name" value={newPerson} maxLength={40} onChange={e => setNewPerson(e.target.value)} required/><button type="submit"><Plus size={16}/> Add</button></div></form>
          {!active.roster && <p className="vyra-circle-legacy">Existing group summary: {active.members} people, {formatMoney(active.expenses)} previously shown as expenses. Member names and historical splits weren't recorded, so these old totals are not included in the new balance engine.</p>}
        </section>
      </div>
      <div className="vyra-circle-bottom-grid">
        <section className="vyra-circle-panel"><div className="vyra-circle-section-title"><div className="eyebrow">RECORD A SHARED EXPENSE</div><h2>Split it beautifully.</h2></div><form className="vyra-circle-expense-form" onSubmit={recordExpense}>
          <label>WHAT WAS IT FOR?<input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="Dinner, cab, groceries..." required/></label>
          <div className="vyra-circle-two-inputs"><label>AMOUNT (INR)<input type="number" min="0.01" max="1000000" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required/></label><label>PAID BY<select value={currentPayer} onChange={e => setPayer(e.target.value)}>{roster.map(name => <option key={name} value={name}>{name}</option>)}</select></label></div>
          <div className="vyra-circle-split"><span>SPLIT BETWEEN</span><p>Leave everyone selected to split equally, or choose specific members.</p><div>{roster.map(name => { const allSelected = chosen.length === 0; return <label key={name}><input type="checkbox" checked={allSelected || chosen.includes(name)} onChange={() => { const from = allSelected ? [...roster] : chosen; const next = from.includes(name) ? from.filter(x => x !== name) : [...from, name]; if (next.length) setParticipants(next); }}/>{name}</label>; })}</div><button type="button" className="vyra-circle-reset-split" onClick={() => setParticipants([])}>Split equally across everyone</button></div>
          <button className="vyra-circle-save" type="submit">Record demo expense <Plus size={17}/></button><p className="vyra-circle-muted">A group ledger only — no bank charge, payment, or settlement is made.</p>
        </form></section>
        <section className="vyra-circle-panel"><div className="vyra-circle-section-title"><div className="eyebrow">WHO OWES WHOM</div><h2>Settle the math.</h2></div>{transfers.length ? <div className="vyra-circle-transfers">{transfers.map((t, i) => <motion.div key={`${t.from}-${t.to}-${i}`} initial={reducedMotion ? false : { opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} className="vyra-circle-transfer"><div className="vyra-circle-transfer-icon"><Wallet size={18}/></div><div><strong>{t.from} <ArrowRight size={13}/> {t.to}</strong><small>Suggested demo settlement</small></div><b>{formatMoney(t.amount)}</b></motion.div>)}</div> : <div className="vyra-circle-empty"><Check size={25}/><strong>All square.</strong><span>Record an expense to calculate individual balances.</span></div>}
        <div className="vyra-circle-section-title vyra-circle-history-title"><div className="eyebrow">GROUP LEDGER</div><h2>What happened.</h2></div><div className="vyra-circle-ledger">{ledger.map(item => <div className="vyra-circle-ledger-row" key={item.id}><span className="vyra-circle-ledger-dot"><Sparkles size={17}/></span><div><strong>{item.title}</strong><small>{item.paidBy} paid · {item.splitWith.length} splitting · {item.date}</small></div><b>{formatMoney(item.amount)}</b></div>)}{ledger.length === 0 && <p className="vyra-circle-muted">Nothing recorded yet. Add your first shared expense.</p>}</div></section>
      </div>
      {message && <p className="vyra-circle-feedback" role="status">{message}</p>}
    </>}
    <p className="vyra-circle-disclaimer">Circles are private simulations within your VYRA account. Members are labels, not invited users. Nothing here transfers or settles real money.</p>
  </div>;
}
