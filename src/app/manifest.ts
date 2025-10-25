import type { MetadataRoute } from 'next';
import { getTranslations } from 'next-intl/server';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations('manifest');
  return {
    name: t('name'),
    short_name: t('shortName'),
    description: t('description'),
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    screenshots: [
      {
        src: '/screenshots/p1.png',
        form_factor: 'wide',
        sizes: '2560x1600',
      },
      {
        src: '/screenshots/p2.png',
        form_factor: 'wide',
        sizes: '2560x1600',
      },
      {
        src: '/screenshots/p1_small.png',
        form_factor: 'narrow',
        sizes: '828x1792',
      },
      {
        src: '/screenshots/p2_small.png',
        form_factor: 'narrow',
        sizes: '828x1792',
      },
    ],
    icons: [
      {
        src: '/icon-50.png',
        sizes: '50x50',
        type: 'image/png' as const,
      },
      {
        src: '/icon-100.png',
        sizes: '100x100',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '440x440',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
