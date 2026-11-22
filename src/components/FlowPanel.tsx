import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, ArrowLeftRight, TrendingDown, Wallet, Waves } from 'lucide-react';
import type { Transaction } from '../data/demo';
import './FlowPanel.css';

type Props = {
  transactions: Transaction[];
  formatMoney: (value: number) => string;
  reducedMotion: boolean;
};
const palette = ['#d5ff3f', '#12bda8', '#ff9b3d', '#f7db75', '#ff5533', '#00cfb9'];

export default function FlowPanel({ transactions, formatMoney, reducedMotion }: Props) {
  const [selection, setSelection] = useState<string>('All');
  const expenses = useMemo(() => transactions.filter(item => item.amount < 0), [transactions]);
  const groups = useMemo(() => Object.entries(expenses.reduce<Record<string, number>>((result, item) => {
    result[item.category] = (result[item.category] ?? 0) + Math.abs(item.amount);
    return result;
  }, {})).sort((a, b) => b[1] - a[1]), [expenses]);
  const spent = groups.reduce((sum, [, value]) => sum + value, 0);
  const income = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const visible = selection === 'All' ? expenses : expenses.filter(t => t.category === selection);
  const focusAmount = selection === 'All' ? spent : (groups.find(([name]) => name === selection)?.[1] ?? 0);
  const max = Math.max(1, ...groups.map(([, total]) => total));
  const select = (category: string) => setSelection(old => old === category ? 'All' : category);

  return <div className="flow-page">
    <div className="page-heading"><div><div className="eyebrow">FINANCIAL MOTION / REAL DATA</div><h1>Follow the <em>flow.</em></h1><p>Trace where your money goes. No planets, just clarity in motion.</p></div><span className="flow-page-symbol"><Waves size={32}/></span></div>
    <section className="flow-overview" aria-label="Demo money flow overview">
      <div className="flow-hero-copy"><span className="eyebrow">OUTGOING / ALL RECORDED DEMO DATA</span><div className="flow-hero-total">{formatMoney(spent)}</div><p>Every stream represents a spending category. Select any stream to inspect its transactions.</p><div className="flow-hero-metrics"><div><ArrowDownRight size={17}/><span>Outflow</span><b>{formatMoney(spent)}</b></div><div><ArrowUpRight size={17}/><span>Credits</span><b>{formatMoney(income)}</b></div><div><ArrowLeftRight size={17}/><span>Net recorded</span><b>{formatMoney(income - spent)}</b></div></div></div>
      <div className="flow-art" aria-label="Abstract flowing lines representing the distribution of demo spending">
        <div className="flow-art-glow"/>
        <svg viewBox="0 0 620 330" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Layered colorful money flows">
          <defs>{palette.map((color,i) => <linearGradient id={`flow-gradient-${i}`} key={i} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".10"/><stop offset="50%" stopColor={color} stopOpacity=".94"/><stop offset="100%" stopColor={color} stopOpacity=".20"/></linearGradient>)}</defs>
          {Array.from({length: 12}, (_,i) => {
            const y = 80 + i * 15;
            const d = `M -15 ${y + 70} C 150 ${y-110}, 285 ${y+140}, 630 ${y-65}`;
            return <motion.path key={i} d={d} fill="none" stroke={`url(#flow-gradient-${i%palette.length})`} strokeWidth={i%3===0 ? 8 : 3} strokeLinecap="round" initial={reducedMotion ? false : {pathLength:0,opacity:0}} animate={{pathLength:1,opacity:1}} transition={{duration:1.1,delay:i*.055}}/>;
          })}
          <circle cx="282" cy="152" r="56" fill="#d5ff3f" opacity=".08"/>
          <circle cx="282" cy="152" r="21" fill="#d5ff3f" opacity=".32"/>
          <circle cx="282" cy="152" r="7" fill="#f6f3ff"/>
        </svg>
        <span className="flow-art-caption">VYRA / MONEY IN MOTION</span>
      </div>
    </section>
    <div className="flow-content-grid">
      <section className="panel flow-breakdown"><div className="panel-heading"><div><span className="eyebrow">WHERE IT GOES</span><h2>Spending streams</h2></div><span className="flow-minitag">{groups.length} categories</span></div>
        <div className="flow-rail" aria-label="Spending distribution">{groups.map(([name,total],i)=><button key={name} type="button" title={`${name}: ${formatMoney(total)}`} onClick={()=>select(name)} className={selection===name?'active':''} style={{width:`${spent?total/spent*100:0}%`,background:palette[i%palette.length]}} aria-label={`Filter ${name}`}/>)}</div>
        <div className="flow-stream-list">{groups.map(([name,total],i)=><button className={`flow-stream ${selection===name?'active':''}`} key={name} onClick={()=>select(name)} aria-pressed={selection===name}><span className="flow-stream-dot" style={{background:palette[i%palette.length]}}/><span className="flow-stream-name">{name}<small>{spent ? Math.round(total/spent*100) : 0}% of outflow</small></span><span className="flow-stream-track"><span style={{width:`${total/max*100}%`,background:palette[i%palette.length]}}/></span><strong>{formatMoney(total)}</strong></button>)}</div>
        {groups.length===0 && <p className="muted-small">No spending recorded yet. Make a demo transfer to populate this view.</p>}
        <button className="flow-reset" onClick={()=>setSelection('All')} disabled={selection==='All'}>Show all categories</button>
      </section>
      <section className="panel flow-details"><div className="panel-heading"><div><span className="eyebrow">LIVE FILTER / DEMO DATA</span><h2>{selection==='All'?'All outflows':selection}</h2></div><TrendingDown size={20}/></div><div className="flow-focus-amount">{formatMoney(focusAmount)}</div><p className="muted-small">{visible.length} recorded {visible.length===1?'transaction':'transactions'} Â· Select a spending stream to filter</p>
        <div className="transactions">{visible.map(t=><div className="transaction" key={t.id}><div className="transaction-icon"><Wallet size={17}/></div><div className="transaction-info"><strong>{t.name}</strong><small>{t.category} Â· {t.date}</small></div><b>{formatMoney(t.amount)}</b></div>)}</div>
        {visible.length===0&&<p className="muted-small">No transactions match this filter.</p>}
      </section>
    </div>
    <p className="flow-disclaimer">Demo records only. Figures represent all locally saved transactions, not a bank account or a calendar-month forecast.</p>
  </div>;
}
