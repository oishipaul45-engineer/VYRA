import { useCallback, useEffect, useRef, useState } from 'react';
import { starter, type State } from '../data/demo';

type User = { id: number; name: string; email: string };
type Status = 'loading' | 'synced' | 'saving' | 'offline' | 'conflict';
const API = import.meta.env.VITE_VYRA_API || 'http://127.0.0.1:8000';
const TOKEN_KEY = 'vyra-auth-session';
const keyFor = (id: number) => `vyra-demo-v1-user-${id}`;

function localWorkspace(user: User): State {
  try {
    const raw = localStorage.getItem(keyFor(user.id));
    if (raw) {
      const stored = JSON.parse(raw) as Partial<State>;
      return {
        ...starter,
        ...stored,
        name: user.name,
        transactions: Array.isArray(stored.transactions) ? stored.transactions : starter.transactions,
        vaults: Array.isArray(stored.vaults) ? stored.vaults : starter.vaults,
        circles: Array.isArray(stored.circles) ? stored.circles : starter.circles,
      };
    }
  } catch { /* ignore corrupt local cache */ }
  return { ...starter, name: user.name };
}

async function authRequest(path: string, method: 'GET' | 'PUT' | 'POST', body?: unknown) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error('Session missing. Sign in again.');
  const response = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const reason = await response.json().catch(() => ({})) as { detail?: string };
    const error = new Error(reason.detail || `Server returned ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<unknown>;
}

export function useWorkspace(user: User) {
  const [state, setState] = useState<State>(() => localWorkspace(user));
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<Status>('loading');
  const version = useRef(1);
  const live = useRef<State>(state);
  const pending = useRef<State | null>(null);
  const initialized = useRef(false);
  const writing = useRef(false);
  const stopped = useRef(false);
  const conflict = useRef(false);

  const flush = useCallback(async () => {
    if (!initialized.current || writing.current || stopped.current || conflict.current) return;
    writing.current = true;
    try {
      while (pending.current && !stopped.current && !conflict.current) {
        const next = pending.current;
        pending.current = null;
        setSyncStatus('saving');
        try {
          const result = await authRequest('/workspace/me', 'PUT', {
            version: version.current, state: next,
          }) as { version: number };
          version.current = result.version;
        } catch (error) {
          pending.current = pending.current ?? next;
          if ((error as { status?: number }).status === 409) {
            conflict.current = true;
            setSyncStatus('conflict');
          } else {
            setSyncStatus('offline');
          }
          return;
        }
      }
      if (!stopped.current && !conflict.current) setSyncStatus('synced');
    } finally { writing.current = false; }
  }, []);

  useEffect(() => {
    stopped.current = false;
    let active = true;
    const initial = localWorkspace(user);
    void (async () => {
      try {
        const result = await authRequest('/workspace/me/initialize', 'POST', initial) as { state: State; version: number };
        if (!active) return;
        version.current = result.version;
        live.current = result.state;
        localStorage.setItem(keyFor(user.id), JSON.stringify(result.state));
        initialized.current = true;
        setState(result.state);
        setSyncStatus('synced');
      } catch {
        if (!active) return;
        // Do not accept edits against an uninitialized or unreachable server.
        setSyncStatus('offline');
      } finally { if (active) setReady(true); }
    })();
    return () => { active = false; stopped.current = true; };
  }, [user.id]);

  useEffect(() => {
    live.current = state;
    if (!ready || !initialized.current) return;
    localStorage.setItem(keyFor(user.id), JSON.stringify(state));
    pending.current = state;
    void flush();
  }, [state, ready, user.id, flush]);

  const retrySync = useCallback(() => {
    if (!initialized.current) { window.location.reload(); return; }
    if (conflict.current) return;
    pending.current = live.current;
    void flush();
  }, [flush]);

  const loadLatest = useCallback(async () => {
    try {
      const result = await authRequest('/workspace/me', 'GET') as { state: State; version: number };
      version.current = result.version;
      conflict.current = false;
      pending.current = null;
      live.current = result.state;
      setState(result.state);
      setSyncStatus('synced');
    } catch { setSyncStatus('offline'); }
  }, []);

  return { state, setState, ready, connected: initialized.current, syncStatus, retrySync, loadLatest };
}