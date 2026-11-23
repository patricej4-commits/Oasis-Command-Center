import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Oasis Command Center',
    short_name: 'Oasis',
    description: 'Private workspace for AJ and Patrice at Oasis Fresh Market',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1E5B3A',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
