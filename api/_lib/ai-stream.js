// Wait for usable model text, not merely HTTP headers or SSE keepalives.
async function readBefore(reader, ms) {
  let timer;
  try {
    return await Promise.race([
      reader.read(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('AI stream stalled')), ms); }),
    ]);
  } finally { clearTimeout(timer); }
}
export async function prepareTextStream(result, firstTokenMs = 8000, idleMs = 10000) {
  const reader = result.res.body?.getReader();
  if (!reader) throw new Error('AI returned no stream');
  const decoder = new TextDecoder();
  let buffer = '';
  const deadline = Date.now() + firstTokenMs;
  async function* chunks() {
    let started = false;
    try {
      while (true) {
        const wait = started ? idleMs : Math.max(1, deadline - Date.now());
        const { done, value } = await readBefore(reader, wait);
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = done ? '' : lines.pop() ?? '';
        for (const line of lines) {
          const data = line.trim();
          if (!data.startsWith('data:')) continue;
          const payload = data.slice(5).trim();
          if (payload === '[DONE]') continue;
          let parsed;
          try { parsed = JSON.parse(payload); } catch { continue; }
          if (parsed.error) throw new Error('AI provider returned a stream error');
          const text = result.provider === 'gemini'
            ? (parsed.candidates?.[0]?.content?.parts ?? []).filter(p => !p.thought).map(p => p.text || '').join('')
            : parsed.choices?.[0]?.delta?.content || '';
          if (text) { started = true; yield text; }
        }
        if (done) return;
        if (!started && Date.now() >= deadline) throw new Error('AI first token timed out');
      }
    } finally { void reader.cancel().catch(() => {}); }
  }
  const iterator = chunks();
  const first = await iterator.next();
  if (first.done) throw new Error('AI returned no generated text');
  return { async *[Symbol.asyncIterator]() { try { yield first.value; yield* iterator; } finally { await iterator.return(); } } };
}
