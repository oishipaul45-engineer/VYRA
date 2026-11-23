import { useEffect, useState } from 'react';
import { CheckCircle2, LockKeyhole, ShieldCheck, Store, Wallet } from 'lucide-react';
import './PaymentsSandbox.css';

type Capabilities = {
  merchant: { provider: string; mode: string; configured: boolean; catalog: Array<{ sku: string; label: string; amount_paise: number }> };
  p2p_upi: { status: string; transfers_enabled: boolean; reason: string };
  live_payments_enabled: boolean;
};
type TestOrder = { id: string; provider_order_id: string | null; amount_paise: number; status: string; mode: string };
const API = import.meta.env.VITE_VYRA_API || (import.meta.env.PROD ? '' : 'http://127.0.0.1:8001');
const bearer = () => ({ Authorization: `Bearer ${sessionStorage.getItem('vyra-auth-session') || ''}` });

export default function PaymentsSandbox() {
  const [config, setConfig] = useState<Capabilities | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<TestOrder | null>(null);
  const [choice, setChoice] = useState('demo_pass');
  useEffect(() => {
    let live = true;
    fetch(`${API}/payments/capabilities`, { headers: bearer(), cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('Payment foundation is not running. Restart backend port 8001.'); return response.json() as Promise<Capabilities>; })
      .then(result => { if (live) setConfig(result); })
      .catch(err => { if (live) setError(err instanceof Error ? err.message : 'Connection unavailable'); });
    return () => { live = false; };
  }, []);
  async function createTestOrder() {
    if (!config?.merchant.configured) return;
    setBusy(true); setError(''); setOrder(null);
    try {
      const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const response = await fetch(`${API}/payments/merchant/orders`, {
        method: 'POST', headers: { ...bearer(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: choice, idempotency_key: idempotencyKey }),
      });
      const result = await response.json() as TestOrder & { detail?: string };
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Test order creation failed');
      setOrder(result);
    } catch (err) { setError(err instanceof Error ? err.message : 'Test order unavailable'); }
    finally { setBusy(false); }
  }
  return (
    <section className="vyra-payment-lab" aria-label="Payment integration foundation">
      <div className="vyra-payment-lab-head">
        <div><div className="vyra-payment-lab-kicker">VYRA / PAYMENT INFRASTRUCTURE</div><h2>Payment rails. <em>Built safely.</em></h2><p>Two independent tracks. Test merchant orders only; person-to-person UPI transfers remain disabled until partner approval.</p></div>
        <span className="vyra-payment-lab-mode"><ShieldCheck size={15} /> TEST ENVIRONMENT</span>
      </div>
      <div className="vyra-payment-lab-grid">
        <article className="vyra-payment-lab-card">
          <div className="vyra-payment-lab-icon"><Store size={22} /></div>
          <h3>Merchant collection</h3><p>Razorpay test-mode Orders API. Amounts come from a fixed backend catalogâ€”not from editable browser totals.</p>
          <div className="vyra-payment-lab-state">{config?.merchant.configured ? <><CheckCircle2 size={16}/> Test credentials configured</> : <><LockKeyhole size={16}/> Awaiting Razorpay test credentials</>}</div>
          {config?.merchant.catalog && <label className="vyra-payment-lab-label">Test item<select value={choice} onChange={e => setChoice(e.target.value)}>{config.merchant.catalog.map(item => <option value={item.sku} key={item.sku}>{item.label} â€” â‚¹{(item.amount_paise / 100).toFixed(2)}</option>)}</select></label>}
          <button type="button" disabled={!config?.merchant.configured || busy} onClick={() => void createTestOrder()}>{busy ? 'CREATING TEST ORDER...' : 'CREATE TEST ORDER'}</button>
          {order && <div className="vyra-payment-lab-result" role="status"><strong>Test order created â€” NOT PAID</strong><span>Internal ID: {order.id}</span><span>Provider ID: {order.provider_order_id}</span><span>Amount: â‚¹{(order.amount_paise/100).toFixed(2)}</span><span>Status: {order.status}</span></div>}
        </article>
        <article className="vyra-payment-lab-card vyra-payment-lab-card-secondary">
          <div className="vyra-payment-lab-icon"><Wallet size={22}/></div>
          <h3>Person-to-person UPI</h3><p>Bank-account transfers need an authorized PSP-bank relationship and applicable NPCI approvals.</p>
          <div className="vyra-payment-lab-state"><LockKeyhole size={16}/> PARTNERSHIP REQUIRED</div>
          <button type="button" disabled>UPI TRANSFERS NOT ENABLED</button>
          <small>Existing VYRA demo transfers stay separate from real bank payments.</small>
        </article>
      </div>
      {error && <p className="vyra-payment-lab-error" role="alert">{error}</p>}
      <div className="vyra-payment-lab-footer"><ShieldCheck size={17}/><span>No live payment keys, real payouts, bank links or production transfers are enabled by this feature.</span></div>
    </section>
  );
}