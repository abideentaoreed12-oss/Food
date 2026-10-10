import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { d1 } from '../../../lib/d1';

export const revalidate = 300;

type RestaurantData = {
  id: string;
  name?: string;
  description?: string;
  tagline?: string;
  cuisine?: string;
  image?: string;
  imageUrl?: string;
  image_url?: string;
  logo?: string;
  logoUrl?: string;
  logo_r2_url?: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  city?: string;
  deliveryFee?: number;
  minimumOrder?: number;
  minOrder?: number;
  isOpen?: boolean;
  categories?: Array<{ name?: string; items?: Array<{ id?: string; name?: string; description?: string; price?: number; image?: string; imageUrl?: string; isAvailable?: boolean; dietary?: string[] }> }>;
};

async function getRestaurant(id: string): Promise<RestaurantData | null> {
  if (!id || id.length > 160 || /[/?#]/.test(id)) return null;
  try {
    const result = await d1.query('SELECT id, raw_json FROM restaurants WHERE id = ? LIMIT 1', [id]);
    const row = result?.results?.[0];
    if (!result?.success || !row) return null;
    let stored: any = row;
    try { stored = row.raw_json ? JSON.parse(row.raw_json) : row; } catch { stored = row; }
    if (!stored || typeof stored !== 'object') return null;

    // Public SEO output is deliberately constructed from an allowlist; never serialize raw D1 data.
    const categories = (Array.isArray(stored.categories) ? stored.categories : []).map((category: any) => ({
      name: typeof category?.name === 'string' ? category.name : 'Menu',
      items: (Array.isArray(category?.items) ? category.items : []).map((item: any) => ({
        id: String(item?.id || ''),
        name: String(item?.name || ''),
        description: typeof item?.description === 'string' ? item.description : '',
        price: Number.isFinite(Number(item?.price)) ? Number(item.price) : undefined,
        image: typeof (item?.imageUrl || item?.image) === 'string' ? (item.imageUrl || item.image) : undefined,
        isAvailable: item?.isAvailable !== false,
        dietary: Array.isArray(item?.dietary) ? item.dietary.filter((tag: any) => typeof tag === 'string').slice(0, 12) : []
      })).filter((item: any) => item.name)
    }));
    return {
      id: String(row.id || id),
      name: typeof stored.name === 'string' ? stored.name : 'Restaurant',
      description: typeof stored.description === 'string' ? stored.description : '',
      tagline: typeof stored.tagline === 'string' ? stored.tagline : '',
      cuisine: typeof stored.cuisine === 'string' ? stored.cuisine : '',
      image: typeof (stored.imageUrl || stored.image_url || stored.image) === 'string' ? (stored.imageUrl || stored.image_url || stored.image) : undefined,
      logo: typeof (stored.logoUrl || stored.logo_r2_url || stored.logo) === 'string' ? (stored.logoUrl || stored.logo_r2_url || stored.logo) : undefined,
      rating: Number.isFinite(Number(stored.rating)) ? Number(stored.rating) : undefined,
      reviewCount: Number.isFinite(Number(stored.reviewCount)) ? Number(stored.reviewCount) : undefined,
      address: typeof stored.address === 'string' ? stored.address : '',
      city: typeof stored.city === 'string' ? stored.city : '',
      deliveryFee: Number.isFinite(Number(stored.deliveryFee)) ? Number(stored.deliveryFee) : undefined,
      minimumOrder: Number.isFinite(Number(stored.minimumOrder ?? stored.minOrder)) ? Number(stored.minimumOrder ?? stored.minOrder) : undefined,
      isOpen: stored.isOpen === true,
      categories
    };
  } catch (err) {
    console.warn('Failed to load restaurant from D1:', err);
    try {
      const { siteDataManager } = await import('../../../lib/siteDataSnapshot');
      const snap = siteDataManager.getRestaurants().find((r: any) => r.id === id);
      if (snap) {
        return {
          id: String(snap.id),
          name: typeof snap.name === 'string' ? snap.name : 'Restaurant',
          description: typeof snap.description === 'string' ? snap.description : '',
          tagline: typeof snap.tagline === 'string' ? snap.tagline : '',
          cuisine: typeof snap.cuisine === 'string' ? snap.cuisine : '',
          image: snap.imageUrl || snap.bannerUrl || snap.image,
          rating: snap.rating,
          reviewCount: snap.reviewCount,
          address: snap.address || '',
          deliveryFee: snap.deliveryFee,
          minimumOrder: snap.minOrder,
          isOpen: snap.isOpen === true,
          categories: snap.categories || []
        };
      }
    } catch {}
    return null;
  }
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const restaurant = await getRestaurant(id);
  if (!restaurant) return { title: 'Restaurant not found | Veyrang', robots: { index: false, follow: false } };
  const title = restaurant.name || 'Restaurant';
  const description = (restaurant.description || restaurant.tagline || `Explore the menu and order from ${title} on Veyrang.`).slice(0, 155);
  return {
    title,
    description,
    alternates: { canonical: `/restaurants/${encodeURIComponent(restaurant.id)}` },
    openGraph: { title: `${title} | Veyrang`, description, url: `https://www.veyrang.com/restaurants/${encodeURIComponent(restaurant.id)}`, siteName: 'Veyrang', type: 'website', images: restaurant.image ? [{ url: restaurant.image, alt: title }] : [] },
    twitter: { card: 'summary_large_image', title: `${title} | Veyrang`, description, images: restaurant.image ? [restaurant.image] : [] }
  };
}

export default async function RestaurantSeoPage({ params }: Props) {
  const { id } = await params;
  const restaurant = await getRestaurant(id);
  if (!restaurant) notFound();

  const url = `https://www.veyrang.com/restaurants/${encodeURIComponent(restaurant.id)}`;
  const menuItems = (restaurant.categories || []).flatMap((category) => (category.items || []).map((item) => ({ ...item, categoryName: category.name || 'Menu' })));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': url,
    name: restaurant.name,
    url,
    description: restaurant.description || restaurant.tagline || undefined,
    image: restaurant.image || undefined,
    servesCuisine: restaurant.cuisine ? restaurant.cuisine.split(',').map((v) => v.trim()).filter(Boolean) : undefined,
    address: restaurant.address || restaurant.city ? {
      '@type': 'PostalAddress',
      streetAddress: restaurant.address || undefined,
      addressLocality: restaurant.city || undefined,
      addressCountry: 'NG'
    } : undefined,
    aggregateRating: restaurant.rating && restaurant.reviewCount ? {
      '@type': 'AggregateRating',
      ratingValue: restaurant.rating,
      reviewCount: restaurant.reviewCount
    } : undefined,
    hasMenu: {
      '@type': 'Menu',
      hasMenuSection: (restaurant.categories || []).map((category) => ({
        '@type': 'MenuSection',
        name: category.name || 'Menu',
        hasMenuItem: (category.items || []).map((item) => ({
          '@type': 'MenuItem',
          name: item.name,
          description: item.description || undefined,
          offers: item.price !== undefined ? { '@type': 'Offer', price: item.price, priceCurrency: 'NGN', availability: item.isAvailable === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock' } : undefined
        }))
      }))
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-slate-500">
        <a href="/" className="underline">Veyrang</a> <span aria-hidden="true">/</span> <a href="/#restaurants" className="underline">Restaurants</a> <span aria-hidden="true">/</span> <span>{restaurant.name}</span>
      </nav>
      <header className="overflow-hidden rounded-2xl bg-slate-50">
        {restaurant.image ? <img src={restaurant.image} alt={restaurant.name || 'Restaurant'} className="h-56 w-full object-cover sm:h-80" /> : null}
        <div className="p-6 sm:p-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-orange-600">{restaurant.cuisine || 'Restaurant'}</p>
          <h1 className="text-3xl font-bold sm:text-4xl">{restaurant.name}</h1>
          {restaurant.description || restaurant.tagline ? <p className="mt-3 max-w-3xl text-slate-600">{restaurant.description || restaurant.tagline}</p> : null}
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
            {restaurant.rating !== undefined ? <span>Rating: {restaurant.rating}{restaurant.reviewCount ? ` (${restaurant.reviewCount} reviews)` : ''}</span> : null}
            {restaurant.city ? <span>{restaurant.city}</span> : null}
            {restaurant.address ? <span>{restaurant.address}</span> : null}
            {restaurant.deliveryFee !== undefined ? <span>Delivery fee: ₦{restaurant.deliveryFee.toLocaleString('en-NG')}</span> : null}
          </div>
          <a href={`/?restaurant=${encodeURIComponent(restaurant.id)}`} className="mt-6 inline-flex rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white">Order from this restaurant</a>
        </div>
      </header>
      <section className="mt-10" aria-labelledby="menu-heading">
        <h2 id="menu-heading" className="text-2xl font-bold">Menu</h2>
        {menuItems.length === 0 ? <p className="mt-4 text-slate-600">Menu details are currently unavailable. Please visit Veyrang to browse current offerings.</p> : (
          <div className="mt-5 space-y-8">
            {(restaurant.categories || []).map((category, index) => (
              <section key={category.name || index}>
                <h3 className="mb-3 text-xl font-semibold">{category.name}</h3>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {(category.items || []).map((item) => (
                    <li key={item.id || item.name} className="rounded-xl border border-slate-200 p-4">
                      <h4 className="font-semibold">{item.name}</h4>
                      {item.description ? <p className="mt-1 text-sm text-slate-600">{item.description}</p> : null}
                      <div className="mt-3 flex items-center justify-between gap-3">
                        {item.price !== undefined ? <span className="font-bold">₦{item.price.toLocaleString('en-NG')}</span> : <span />}
                        <span className={item.isAvailable === false ? 'text-sm text-slate-500' : 'text-sm text-green-700'}>{item.isAvailable === false ? 'Unavailable' : 'Available'}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
