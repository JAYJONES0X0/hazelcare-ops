// One-off: push RESEND_API_KEY into the Vercel careops project env.
// Usage: VERCEL_TOKEN=... node set-env.js   (reads RESEND_API_KEY from C:\Users\brook\.exa\keys.env)
const https = require('https');
const fs = require('fs');

const envFile = fs.readFileSync('C:/Users/brook/.exa/keys.env', 'utf8');
const keys = {};
envFile.split(/\r?\n/).forEach(l => {
  const m = l.match(/^([A-Z0-9_]+)=(.+)$/);
  if (m) keys[m[1]] = m[2].trim();
});

const resendKey = keys.RESEND_API_KEY;
const vercelToken = process.env.VERCEL_TOKEN || keys.VERCEL_TOKEN;
if (!resendKey || !vercelToken) {
  console.error('FAILED: need RESEND_API_KEY in keys.env and VERCEL_TOKEN (env or keys.env)');
  process.exit(1);
}

const data = JSON.stringify({
  type: 'encrypted',
  value: resendKey,
  target: ['production'],
  key: 'RESEND_API_KEY'
});

const req = https.request({
  hostname: 'api.vercel.com',
  path: '/v10/projects/careops/env',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${vercelToken}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log(res.statusCode, body.slice(0, 200));
    console.log(res.statusCode === 200 || res.statusCode === 201 ? 'ENV SET SUCCESSFULLY' : 'FAILED');
  });
});
req.on('error', e => console.error(e));
req.write(data);
req.end();
