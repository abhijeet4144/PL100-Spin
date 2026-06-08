const { getStore } = require('@netlify/blobs');

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const MAX_ENTRIES = 100;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  let store;
  try {
    const siteID = process.env.NETLIFY_SITE_ID;
    const token  = process.env.NETLIFY_AUTH_TOKEN;
    if (!siteID || !token) {
      throw new Error('NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN env vars must be set');
    }
    store = getStore({ name: 'leaderboard', siteID, token });
  } catch (e) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Store init failed: ' + e.message }) };
  }

  // GET: return top scores
  if (event.httpMethod === 'GET') {
    try {
      const data = await store.get('entries', { type: 'json' });
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(data || []) };
    } catch (_) {
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify([]) };
    }
  }

  // POST: add a new entry
  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch (_) { body = {}; }

    const name = (body.name || '').trim().slice(0, 24);
    if (!name) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Name is required' }) };
    }
    if (typeof body.points !== 'number' || body.points < 0 || body.points > 114) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid score' }) };
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

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true, rank }) };
  }

  return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
