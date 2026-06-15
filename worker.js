function sanitize(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#x27;');
}

const ipv4Regex = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const ipv6Regex = /^[a-fA-F0-9:]+$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    if (url.pathname === '/recent') {
      const data = await env.IP_SEARCHES.get('recent', 'json') || [];
      return Response.json(data, { headers });
    }

    if (url.pathname === '/popular') {
      const data = await env.IP_SEARCHES.get('popular', 'json') || {};
      const sorted = Object.entries(data)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([ip, val]) => ({ ip, count: val.count, score: val.score ?? null }));
      return Response.json(sorted, { headers });
    }

    if (url.pathname === '/search' && request.method === 'POST') {
      const { ip } = await request.json();

      if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
        return Response.json({ error: 'invalid IP' }, { status: 400, headers });
      }

      const abuseRes = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90&verbose`, {
        headers: {
          'Key': env.ABUSEIPDB_TOKEN,
          'Accept': 'application/json'
        }
      });
      const abuseData = await abuseRes.json();

      if (!abuseData.data) {
        return Response.json(abuseData, { headers });
      }

      const score = abuseData.data.abuseConfidenceScore;

      let recent = await env.IP_SEARCHES.get('recent', 'json') || [];
      recent = [ip, ...recent.filter(i => i !== ip)].slice(0, 20);
      await env.IP_SEARCHES.put('recent', JSON.stringify(recent));

      let popular = await env.IP_SEARCHES.get('popular', 'json') || {};
      const prev = popular[ip] || { count: 0, score: null };
      popular[ip] = { count: prev.count + 1, score };
      await env.IP_SEARCHES.put('popular', JSON.stringify(popular));

      return Response.json(abuseData, { headers });
    }

    if (url.pathname === '/comments') {
      const ip = url.searchParams.get('ip');
      const data = await env.IP_SEARCHES.get(`comments:${ip}`, 'json') || [];
      return Response.json(data, { headers });
    }

    if (url.pathname === '/comment' && request.method === 'POST') {
      const { ip, username, comment } = await request.json();
      if (!ip || !username || !comment) {
        return Response.json({ error: 'missing fields' }, { status: 400, headers });
      }
      const clean = {
        username: sanitize(username.slice(0, 32)),
        comment: sanitize(comment.slice(0, 500)),
        date: new Date().toISOString()
      };
      const key = `comments:${ip}`;
      let comments = await env.IP_SEARCHES.get(key, 'json') || [];
      comments = [clean, ...comments].slice(0, 50);
      await env.IP_SEARCHES.put(key, JSON.stringify(comments));
      return Response.json({ ok: true }, { headers });
    }

    return new Response('not found', { status: 404 });
  }
};
