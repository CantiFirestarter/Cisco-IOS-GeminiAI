/**
 * Cisco IOS AI - Cloudflare Worker Entry Point
 * Handles asset serving, SPA routing, and security headers.
 */

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    
    // Attempt to fetch the static asset
    let response = await env.ASSETS.fetch(request);

    // If asset not found, serve index.html for SPA routing
    if (response.status === 404 && !url.pathname.includes('.')) {
      response = await env.ASSETS.fetch(new URL('/index.html', request.url));
    }

    // Clone response to add security headers (headers are immutable on fetch response)
    const newHeaders = new Headers(response.headers);
    
    // Security Headers (Mirroring vercel.json)
    newHeaders.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
    newHeaders.set('X-Content-Type-Options', 'nosniff');
    newHeaders.set('X-Frame-Options', 'DENY');
    newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Cache Control for assets
    if (url.pathname.startsWith('/assets/')) {
      newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (url.pathname === '/manifest.json') {
      newHeaders.set('Content-Type', 'application/manifest+json');
      newHeaders.set('Cache-Control', 'public, max-age=0, must-revalidate');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};