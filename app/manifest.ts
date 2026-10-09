import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Veyrang Food Delivery',
    short_name: 'Veyrang',
    description: 'Discover restaurants and order food with Veyrang.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8F9FA',
    theme_color: '#FF5500',
    icons: []
  };
}
