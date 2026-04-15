import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

window.addEventListener('error', (e) => {
  const root = document.getElementById('root');
  if (root && !root.dataset.crashed) {
    root.dataset.crashed = '1';
    root.innerHTML = `<div style="padding:40px;font-family:monospace;color:#f87171;background:#0a0e16;min-height:100vh">
      <h2 style="color:#fff;margin-bottom:16px">Crash Report</h2>
      <pre style="white-space:pre-wrap;font-size:13px;line-height:1.6;color:#fca5a5">${e.message}\n\n${e.error?.stack || 'No stack'}</pre>
      <button onclick="location.reload()" style="margin-top:20px;padding:8px 24px;background:#14b8a6;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold">Reload</button>
    </div>`;
  }
});

const rootEl = document.getElementById('root')!;
rootEl.textContent = '';
createRoot(rootEl).render(<App />)
