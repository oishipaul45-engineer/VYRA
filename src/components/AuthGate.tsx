import { lazy, Suspense, useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
const MoneyCore = lazy(() => import('./MoneyCore'));
import './vyra-auth.css';

type User = { id: number; name: string; email: string };
type LoginResult = { access_token: string; token_type: string; user: User };
const API = import.meta.env.VITE_VYRA_API || 'http://127.0.0.1:8000';
const TOKEN_KEY = 'vyra-auth-session';

export default function AuthGate({ children }: { children: (user: User, onLogout: () => void) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) { setReady(true); return; }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => { if (!r.ok) throw new Error(); return r.json() as Promise<User>; })
      .then(setUser)
      .catch(() => sessionStorage.removeItem(TOKEN_KEY))
      .finally(() => setReady(true));
  }, []);
  const logout = () => { sessionStorage.removeItem(TOKEN_KEY); setUser(null); setMode('login'); setPassword(''); };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const url = mode === 'signup' ? '/auth/signup' : '/auth/login';
      const response = await fetch(API + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mode === 'signup' ? { name: name.trim(), email: email.trim(), password } : { email: email.trim(), password }) });
      const data = await response.json();
      if (!response.ok) {
        const detail = data.detail;
        throw new Error(typeof detail === 'string' ? detail : 'Please check your details and try again.');
      }
      const result = data as LoginResult;
      sessionStorage.setItem(TOKEN_KEY, result.access_token);
      setUser(result.user); setPassword('');
    } catch (err) { setError(err instanceof TypeError ? 'Cannot reach the VYRA backend. Start it on port 8000.' : err instanceof Error ? err.message : 'Authentication failed.'); }
    finally { setBusy(false); }
  }
  if (!ready) return <div className="vyra-auth-loading">VYRA / OPENING YOUR SPACE</div>;
  if (user) return <>{children(user, logout)}</>;
  return <main className="vyra-auth">
    <header className="vyra-auth-head"><span>VYRA<span className="vyra-auth-dot">.</span></span><small>EDITION / 02 &nbsp; — &nbsp; PRIVATE ACCESS</small></header>
    <div className="vyra-auth-layout">
      <section className="vyra-auth-art"><div className="vyra-auth-grid"/><div className="vyra-auth-card"><Suspense fallback={<div className="vyra-scene-loading">V / MONEY IN MOTION</div>}><MoneyCore tone="#ff7040" reducedMotion={false}/></Suspense></div><div className="vyra-auth-art-label">MONEY<br/>IN MOTION<span> / 001</span></div><div className="vyra-auth-art-footer">A DIFFERENT KIND OF FINANCIAL SPACE.</div></section>
      <section className="vyra-auth-copy"><div className="vyra-auth-eyebrow"><Sparkles size={15}/> THE FUTURE FEELS PERSONAL</div><h1>{mode === 'signup' ? <>MAKE IT<br/><em>YOURS.</em></> : <>WELCOME<br/><em>BACK.</em></>}</h1><p>{mode === 'signup' ? 'Your space. Your goals. Your money story — currently in demo mode.' : 'Sign in to your VYRA space and keep exploring.'}</p>
        <div className="vyra-auth-switch"><button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); }}>Create account</button><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>Sign in</button></div>
        <form onSubmit={submit} className="vyra-auth-form">{mode === 'signup' && <label>Your name<input autoComplete="name" minLength={2} maxLength={60} placeholder="What should we call you?" value={name} onChange={e => setName(e.target.value)} required/></label>}<label>Email address<input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 10 : undefined} placeholder={mode === 'signup' ? 'At least 10 characters' : 'Your password'} value={password} onChange={e => setPassword(e.target.value)} required/></label>{error && <div className="vyra-auth-error" role="alert">{error}</div>}<button type="submit" disabled={busy}>{busy ? 'WORKING...' : mode === 'signup' ? 'CREATE YOUR SPACE' : 'ENTER VYRA'} <ArrowRight size={18}/></button></form>
        <div className="vyra-auth-note"><ShieldCheck size={17}/> Real accounts for sign-in; simulated money only. No bank integration.</div>
      </section>
    </div><footer className="vyra-auth-bottom"><span>DESIGNED TO MOVE YOU.</span><span>VYRA / EXPERIMENTAL</span></footer>
  </main>;
}
