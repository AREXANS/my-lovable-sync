import { createFileRoute } from '@tanstack/react-router';
import { proxyEdgeFunction } from '@/lib/edge-proxy.server';

export const Route = createFileRoute('/api/get-script')({
  server: {
    handlers: {
      GET: ({ request }) => proxyEdgeFunction('get-script', request),
      POST: ({ request }) => proxyEdgeFunction('get-script', request),
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
