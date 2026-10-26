import { initialiseBrowserRecords } from './lib/browser-records';
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { escapeHtml } from './lib/html-escape'

window.addEventListener('error', (e) => {
  const root = document.getElementById('root');
  if (root && !root.dataset.crashed) {
    root.dataset.crashed = '1';
    root.innerHTML = `<div style="padding:40px;font-family:monospace;color:#f87171;background:#0a0e16;min-height:100vh">
      <h2 style="color:#fff;margin-bottom:16px">Crash Report</h2>
      <pre style="white-space:pre-wrap;font-size:13px;line-height:1.6;color:#fca5a5">${escapeHtml(`${e.message}\n\n${e.error?.stack || 'No stack'}`)}</pre>
      <button onclick="location.reload()" style="margin-top:20px;padding:8px 24px;background:#14b8a6;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold">Reload</button>
    </div>`;
  }
});

const rootEl = document.getElementById('root')!;
rootEl.textContent = '';
rootEl.textContent = 'Loading saved records…';
initialiseBrowserRecords(window.localStorage).then(() => {
  rootEl.textContent = '';
  createRoot(rootEl).render(<App />);
}).catch(() => {
  rootEl.textContent = 'Record storage could not be opened. Your existing browser data has not been cleared. Close older OS tabs, allow site storage, and reload. Do not clear browser data.';
});
