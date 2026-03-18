export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `You are a professional care note writer for a UK supported living service (Hazel Care Ltd). Your job is to take rough notes, casual language, or notes written in ANY language, and rewrite them as professional, clear, third-person care notes suitable for a Nourish care management system.

RULES:
- Write in third person ("The client" / "Client presented" / "Staff supported")
- Use professional UK supported-living terminology
- Keep factual accuracy — do not add information not given
- Structure naturally: what happened → staff response → outcome/follow-up
- UK English spelling throughout (behaviour, medication, authorised, centre)
- Output ONLY the care note — no preamble, no title, no explanation, no quotation marks
- Be concise but complete — every key fact included
- If input is in another language, translate accurately and reformat professionally`;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const { text, noteType, clientName } = body;
  if (!text?.trim()) return new Response('No text provided', { status: 400 });

  const userPrompt = [
    noteType ? `Note type: ${noteType}` : '',
    clientName ? `Client/subject: ${clientName}` : '',
    '',
    'Convert this to a professional care note:',
    '',
    text.trim(),
  ].filter(l => l !== null).join('\n');

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      max_tokens: 600,
      temperature: 0.25,
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text();
    return new Response(`Groq error: ${err}`, { status: 502 });
  }

  // Parse SSE stream from Groq → stream plain text to client
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = groqRes.body.getReader();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const chunk = parsed.choices?.[0]?.delta?.content;
              if (chunk) controller.enqueue(encoder.encode(chunk));
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    },
  });
}
