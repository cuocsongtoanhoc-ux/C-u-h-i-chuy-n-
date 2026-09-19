import type { IncomingMessage, ServerResponse } from 'http';

function splitTextForTTS(text: string, maxLen = 120): string[] {
  const clean = text.replace(/\s+/g, ' ').replace(/[\r\n]+/g, '. ').trim();
  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];

  const regex = /([.?!:;,]+|\n)/;
  const rawParts = clean.split(regex);
  const chunks: string[] = [];
  let current = '';

  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i].trim();
    if (!part) continue;

    if ((current + ' ' + part).trim().length <= maxLen) {
      current = (current + ' ' + part).trim();
    } else {
      if (current) chunks.push(current);
      if (part.length <= maxLen) {
        current = part;
      } else {
        const words = part.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).trim().length <= maxLen) {
            sub = (sub + ' ' + w).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        current = sub;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(c => c.length > 0);
}

async function fetchGoogleTTSChunk(chunk: string): Promise<Buffer> {
  const encoded = encodeURIComponent(chunk);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encoded}`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Referer': 'https://translate.google.com/',
    },
  });
  if (!resp.ok) throw new Error(`Google TTS HTTP ${resp.status}`);
  const arrayBuffer = await resp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export default async function handler(req: IncomingMessage & { query?: Record<string, string> }, res: ServerResponse) {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const text = (url.searchParams.get('text') || '').trim();

    if (!text) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Text query parameter is required' }));
      return;
    }

    const chunks = splitTextForTTS(text);
    const audioBuffers: Buffer[] = [];
    for (const chunk of chunks) {
      const buf = await fetchGoogleTTSChunk(chunk);
      audioBuffers.push(buf);
    }

    if (audioBuffers.length === 0) {
      res.statusCode = 500;
      res.end('Failed to synthesize audio');
      return;
    }

    const combined = Buffer.concat(audioBuffers);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Length', combined.length.toString());
    res.end(combined);
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err?.message || 'TTS generation error' }));
  }
}
