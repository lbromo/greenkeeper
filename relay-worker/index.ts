export interface Env {
  KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'POST') {
      return handlePost(request, env);
    }
    if (request.method === 'GET') {
      return handleGet(request, env);
    }
    return new Response('Method not allowed', { status: 405 });
  }
};

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
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return new Response(JSON.stringify({ error: 'Missing key parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const value = await env.KV.get(key);

  if (!value) {
    return new Response(JSON.stringify({ error: 'Key not found or expired' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(value, {
    headers: { 'Content-Type': 'application/json' }
  });
}
