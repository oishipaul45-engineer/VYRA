import VyraCursor from './components/VyraCursor';
import React from 'react';
import ReactDOM from 'react-dom/client';
// VYRA PERFORMANCE / LAZY APP
const App = React.lazy(() => import('./App'));
import AuthGate from './components/AuthGate';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><><VyraCursor /><AuthGate>{(user, onLogout) => <React.Suspense fallback={<div className="vyra-page-loading">OPENING YOUR VYRA SPACE...</div>}><App user={user} onLogout={onLogout} /></React.Suspense>}</AuthGate></></React.StrictMode>);

import './components/experimental.css';

import './components/performance-mobile.css';
