import { getStore } from '@netlify/blobs';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const MAX_ENTRIES = 100;

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: HEADERS });
  }

  const store = getStore('leaderboard');

  // ── GET: return top scores ──────────────────────────────────
  if (req.method === 'GET') {
    try {
      const data = await store.get('entries', { type: 'json' });
      return Response.json(data || [], { headers: HEADERS });
    } catch (_) {
      return Response.json([], { headers: HEADERS });
    }
  }

  // ── POST: add a new entry ───────────────────────────────────
  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch (_) { body = {}; }

    const name = (body.name || '').trim().slice(0, 24);
    if (!name) {
      return Response.json({ error: 'Name is required' }, { status: 400, headers: HEADERS });
    }
    if (typeof body.points !== 'number' || body.points < 0 || body.points > 114) {
      return Response.json({ error: 'Invalid score' }, { status: 400, headers: HEADERS });
    }

    let entries = [];
    try { entries = await store.get('entries', { type: 'json' }) || []; } catch (_) {}

    const today = new Date().toISOString().split('T')[0];
    entries.push({
      name,
      points:    body.points,
      wins:      body.wins    || 0,
      draws:     body.draws   || 0,
      losses:    body.losses  || 0,
      formation: body.formation || '',
      date:      today,
    });

    entries.sort((a, b) => b.points - a.points);
    entries = entries.slice(0, MAX_ENTRIES);

    await store.set('entries', JSON.stringify(entries));

    const rank = entries.findIndex(
      e => e.name === name && e.points === body.points && e.date === today
    ) + 1;

    return Response.json({ ok: true, rank }, { headers: HEADERS });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405, headers: HEADERS });
};

export const config = { path: '/api/leaderboard' };
