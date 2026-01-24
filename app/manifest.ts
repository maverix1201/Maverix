import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MaveriX',
    short_name: 'MaveriX',
    description: 'Modern HR Management System',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#6366f1',
    icons: [
      {
        src: '/assets/maverixicon.png',
        sizes: 'any',
        type: 'image/png',
        // Web App Manifest spec supports array, but Next.js types are restrictive
        purpose: ['any', 'maskable'] as any,
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: ['any', 'maskable'] as any,
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: ['any', 'maskable'] as any,
      },
    ],
  };
}

