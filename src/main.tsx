import VyraCursor from './components/VyraCursor';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AuthGate from './components/AuthGate';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><><VyraCursor /><AuthGate>{(user, onLogout) => <App user={user} onLogout={onLogout} />}</AuthGate></></React.StrictMode>);

import './components/experimental.css';
