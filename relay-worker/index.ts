export interface Env {
  KV: KVNamespace;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (url.pathname === '/intent' && request.method === 'POST') {
      return handleIntentPost(request, env);
    }
    if (url.pathname === '/intents' && request.method === 'GET') {
      return handleIntentsGet(request, env);
    }

    if (request.method === 'POST') {
      return handlePost(request, env);
    }
    if (request.method === 'GET') {
      return handleGet(request, env);
    }
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }
};

async function handleIntentPost(request: Request, env: Env): Promise<Response> {
  try {
    const payload = await request.json();
    const key = `in:${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    await env.KV.put(key, JSON.stringify(payload), {
      expirationTtl: 1200
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleIntentsGet(request: Request, env: Env): Promise<Response> {
  try {
    const list = await env.KV.list({ prefix: 'in:' });
    const intents = [];

    for (const keyObj of list.keys) {
      const value = await env.KV.get(keyObj.name);
      if (value) {
        intents.push(JSON.parse(value));
        await env.KV.delete(keyObj.name);
      }
    }

    return new Response(JSON.stringify({ intents }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch intents' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handlePost(request: Request, env: Env): Promise<Response> {
  try {
    const payload = await request.json() as {
      iv: string;
      authTag: string;
      ciphertext: string;
      timestamp: string;
    };

    const key = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    await env.KV.put(key, JSON.stringify(payload), {
      expirationTtl: 1200
    });

    return new Response(JSON.stringify({ success: true, key }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return new Response(JSON.stringify({ error: 'Missing key parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const value = await env.KV.get(key);

  if (!value) {
    return new Response(JSON.stringify({ error: 'Key not found or expired' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  await env.KV.delete(key);

  return new Response(value, {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}
