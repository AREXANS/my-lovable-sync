import { createFileRoute } from '@tanstack/react-router';
import { proxyEdgeFunction } from '@/lib/edge-proxy.server';

export const Route = createFileRoute('/api/get-loader')({
  server: {
    handlers: {
      GET: ({ request }) => proxyEdgeFunction('get-loader', request),
      POST: ({ request }) => proxyEdgeFunction('get-loader', request),
      OPTIONS: () =>
        new Response('ok', {
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-headers': '*',
            'access-control-allow-methods': 'GET, POST, OPTIONS',
          },
        }),
    },
  },
});
