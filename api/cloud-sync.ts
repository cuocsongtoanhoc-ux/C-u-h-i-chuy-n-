import type { IncomingMessage, ServerResponse } from 'http';

// In-memory cloud sync store for serverless/Vercel execution
interface StoredSync {
  syncKey: string;
  sessions: any[];
  activeSession: any;
  updatedAt: number;
}

const memoryStore = new Map<string, StoredSync>();
let latestStored: StoredSync | null = null;

export default async function handler(req: IncomingMessage & { body?: any; query?: any }, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = req.url || '';

  // 1. POST /api/cloud-sync/save
  if (req.method === 'POST' && (url.includes('/save') || url.endsWith('/cloud-sync'))) {
    try {
      let bodyData = req.body;
      if (!bodyData) {
        const buffers: Buffer[] = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        const text = Buffer.concat(buffers).toString('utf-8');
        bodyData = JSON.parse(text || '{}');
      }

      const syncKey = (bodyData.syncKey || 'thptvothisau').trim().toLowerCase();
      const sessions = Array.isArray(bodyData.sessions) ? bodyData.sessions : [];
      const activeSession = bodyData.activeSession || null;

      const record: StoredSync = {
        syncKey,
        sessions,
        activeSession,
        updatedAt: Date.now(),
      };

      memoryStore.set(syncKey, record);
      latestStored = record;

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        count: sessions.length,
        syncKey,
        message: `Đã lưu ${sessions.length} chuyên đề vào máy chủ đám mây.`
      }));
      return;
    } catch (err: any) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Lỗi lưu trữ đám mây' }));
      return;
    }
  }

  // 2. GET /api/cloud-sync/load/:syncKey or latest
  if (req.method === 'GET') {
    let key = '';
    const match = url.match(/\/load\/([^\/\?]+)/);
    if (match) {
      key = decodeURIComponent(match[1]).trim().toLowerCase();
    } else if (url.includes('/latest')) {
      key = 'latest';
    }

    if (key === 'latest' && latestStored) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(latestStored));
      return;
    }

    if (key && memoryStore.has(key)) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(memoryStore.get(key)));
      return;
    }

    if (latestStored) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(latestStored));
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Chưa có dữ liệu đồng bộ trên máy chủ.' }));
    return;
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
}
