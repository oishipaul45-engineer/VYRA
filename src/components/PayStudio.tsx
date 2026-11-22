import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Check, Copy, Download, FileText, Filter, Search, ShieldCheck, X } from 'lucide-react';
import type { Transaction } from '../data/demo';
import './PayStudio.css';

type ViewFilter = 'all' | 'outgoing' | 'incoming' | 'savings';
type Props = {
  transactions: Transaction[];
  formatMoney: (value: number) => string;
  onChooseRecipient: (name: string) => void;
  hideAmounts: boolean;
};

export default function PayStudio({ transactions, formatMoney, onChooseRecipient, hideAmounts }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ViewFilter>('all');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const contacts = useMemo(() => {
    const unique = new Map<string, { name: string; count: number }>();
    for (const item of transactions) {
      if (item.amount >= 0 || item.category === 'Savings' || item.name.startsWith('Goal:')) continue;
      const name = item.name.trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase();
      const found = unique.get(key);
      if (found) found.count += 1;
      else unique.set(key, { name, count: 1 });
    }
    return [...unique.values()].slice(0, 6);
  }, [transactions]);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return transactions.filter(item => {
      const matchesFilter = filter === 'all'
        || (filter === 'outgoing' && item.amount < 0 && item.category !== 'Savings')
        || (filter === 'incoming' && item.amount > 0)
        || (filter === 'savings' && item.category === 'Savings');
      const matchesSearch = !term || [item.name, item.category, item.id, item.note ?? '', item.date]
        .some(value => value.toLocaleLowerCase().includes(term));
      return matchesFilter && matchesSearch;
    });
  }, [transactions, filter, search]);

  const active = transactions.find(item => item.id === activeId) ?? null;

  useEffect(() => {
    if (!active) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveId(null);
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [active]);

  async function copyReference(reference: string) {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  // VYRA_PAY_EXPORT_V1: download only explicitly requested demo records.
  function downloadText(filename: string, contents: string, mime: string) {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    try { link.click(); }
    finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }

  function csvCell(value: string | number) {
    const raw = String(value);
    // Protect spreadsheet users from CSV formula injection, including leading whitespace.
    const safe = /^[\s]*[=+@-]/.test(raw) && typeof value === 'string' ? "'" + raw : raw;
    return '"' + safe.replaceAll('"', '""') + '"';
  }

  function exportFiltered() {
    if (hideAmounts || visible.length === 0) return;
    const rows = [
      ['Reference', 'Date', 'Name', 'Category', 'Direction', 'Amount INR', 'Note'],
      ...visible.map(item => [item.id, item.date, item.name, item.category,
        item.category === 'Savings' ? 'Savings' : item.amount < 0 ? 'Debit' : 'Credit',
        item.amount, item.note ?? '']),
    ];
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    downloadText('vyra-demo-transactions-' + new Date().toISOString().slice(0, 10) + '.csv',
      csv, 'text/csv;charset=utf-8');
  }

  function downloadReceipt(item: Transaction) {
    const contents = [
      'VYRA / DEMO TRANSACTION RECORD',
      '================================',
      'SIMULATED ONLY - NOT A BANK RECEIPT OR PROOF OF PAYMENT',
      '',
      'Reference: ' + item.id,
      'Date: ' + item.date,
      'Name: ' + item.name,
      'Category: ' + item.category,
      'Direction: ' + (item.category === 'Savings' ? 'Savings contribution' : item.amount < 0 ? 'Demo debit' : 'Demo credit'),
      'Amount: ' + formatMoney(item.amount),
      'Note: ' + (item.note ?? ''),
      '',
      'No real funds were transferred. VYRA is a payment simulator.',
    ].join('\r\n');
    downloadText('vyra-demo-record-' + item.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) + '.txt',
      contents, 'text/plain;charset=utf-8');
  }

  return (
    <section className="vyra-pay-extras" aria-label="Demo payment activity">
      <div className="vyra-pay-heading">
        <div>
          <span className="vyra-pay-eyebrow">V / PAY STUDIO 02</span>
          <h2>Every move has a story<span>.</span></h2>
          <p>Explore your saved demo records, revisit recipients, and inspect transaction details.</p>
        </div>
        <div className="vyra-pay-count">{transactions.length.toString().padStart(2, '0')}<small>RECORDS</small></div>
      </div>

      {contacts.length > 0 && (
        <div className="vyra-pay-recipient-wrap">
          <div className="vyra-pay-minihead"><span>QUICK PICK / PAST OUTGOING NAMES</span><span>SELECT TO PREFILL</span></div>
          <div className="vyra-pay-recipients">
            {contacts.map((contact, index) => (
              <button key={contact.name.toLocaleLowerCase()} type="button" className="vyra-pay-contact" onClick={() => onChooseRecipient(contact.name)} title={`Fill recipient: ${contact.name}`}>
                <span className="vyra-pay-avatar" style={{ '--pay-hue': ['#45E6D0', '#FF78B9', '#FF633E', '#B9A4E8'][index % 4] } as CSSProperties}>
                  {contact.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="vyra-pay-person"><strong>{contact.name}</strong><small>{contact.count} record{contact.count === 1 ? '' : 's'}</small></span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="vyra-pay-history" id="vyra-pay-history">
        <div className="vyra-pay-minihead"><span>YOUR ACCOUNT / DEMO RECORDS</span><span>{visible.length} MATCHES</span></div>
        <div className="vyra-pay-toolbar">
          <label className="vyra-pay-search"><Search size={18} aria-hidden="true"/><span className="sr-only">Search transactions</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search names, category, date, reference..."/></label>
          <div className="vyra-pay-filters" role="group" aria-label="Filter transaction history">
            <Filter size={15} aria-hidden="true" />
            {([
              ['all', 'All'],
              ['outgoing', 'Sent'],
              ['incoming', 'Credits'],
              ['savings', 'Vaults'],
            ] as const).map(([key, label]) => (
              <button type="button" key={key} className={filter === key ? 'active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="vyra-pay-export-row">
          <span>{visible.length} matching demo records</span>
          <button type="button" onClick={exportFiltered} disabled={hideAmounts || visible.length === 0}
            title={hideAmounts ? 'Turn off Hide money amounts in Settings before exporting' : 'Export filtered demo records as CSV'}>
            <Download size={16} /> EXPORT FILTERED CSV
          </button>
        </div>
        <div className="vyra-pay-list">
          {visible.map(item => (
            <button className="vyra-pay-record" type="button" key={item.id} onClick={() => { setCopied(false); setActiveId(item.id); }}>
              <span className={`vyra-pay-direction ${item.amount >= 0 ? 'incoming' : ''}`}>
                {item.amount >= 0 ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
              </span>
              <span className="vyra-pay-record-name"><strong>{item.name}</strong><small>{item.category} / {item.date}</small></span>
              <span className="vyra-pay-record-amount">{formatMoney(item.amount)}<small>VIEW DETAILS <ArrowRight size={12}/></small></span>
            </button>
          ))}
          {visible.length === 0 && <div className="vyra-pay-empty">No matching records. Try a different search or filter.</div>}
        </div>
      </div>

      {active && (
        <div className="vyra-pay-modal-backdrop" onClick={() => setActiveId(null)}>
          <section className="vyra-pay-receipt" role="dialog" aria-modal="true" aria-label="Demo transaction details" onClick={event => event.stopPropagation()}>
            <div className="vyra-pay-receipt-top"><span>VYRA / RECORD DETAILS</span><button type="button" aria-label="Close receipt" onClick={() => setActiveId(null)}><X size={20}/></button></div>
            <div className="vyra-pay-receipt-mark"><ShieldCheck size={30}/></div>
            <span className="vyra-pay-receipt-sub">SIMULATED TRANSACTION</span>
            <h2>{formatMoney(active.amount)}</h2>
            <p className="vyra-pay-receipt-name">{active.name}</p>
            <div className="vyra-pay-receipt-lines">
              <div><span>Direction</span><strong>{active.category === 'Savings' ? 'Savings contribution' : active.amount >= 0 ? 'Demo credit / request' : 'Demo debit'}</strong></div>
              <div><span>Category</span><strong>{active.category}</strong></div>
              <div><span>Date recorded</span><strong>{active.date}</strong></div>
              {active.note && <div><span>Note</span><strong>{active.note}</strong></div>}
              <div className="vyra-pay-reference"><span>Reference</span><strong>{active.id}</strong></div>
            </div>
            <button className="vyra-pay-copy" type="button" onClick={() => void copyReference(active.id)}>{copied ? <Check size={17}/> : <Copy size={17}/>} {copied ? 'REFERENCE COPIED' : 'COPY REFERENCE'}</button>
            <button className="vyra-pay-download" type="button" onClick={() => downloadReceipt(active)}>
              <FileText size={17}/> DOWNLOAD DEMO RECORD
            </button>
            <div className="vyra-pay-receipt-warning"><ShieldCheck size={16}/><span>DEMO RECORD ONLY. Not a bank receipt, payment confirmation, or proof of transfer. No real funds were transferred.</span></div>
          </section>
        </div>
      )}
    </section>
  );
}