import type { Metadata } from 'next';
import Link from 'next/link';
import RestaurantCatalogueControls from './RestaurantCatalogueControls';
import { d1 } from '../../lib/d1';
import { buildPublicRestaurant } from '../../lib/restaurantMenu';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Restaurants',
  description: 'Explore restaurants on Veyrang, browse menus and find your next meal.',
  alternates: { canonical: '/restaurants' },
  openGraph: {
    title: 'Restaurants | Veyrang',
    description: 'Explore restaurants on Veyrang, browse menus and find your next meal.',
    url: 'https://www.veyrang.com/restaurants',
    siteName: 'Veyrang',
    type: 'website'
  },
  twitter: {
    card: 'summary',
    title: 'Restaurants | Veyrang',
    description: 'Explore restaurants on Veyrang, browse menus and find your next meal.'
  }
};

type RestaurantCard = {
  id: string;
  name: string;
  description?: string;
  cuisine?: string;
  city?: string;
  image?: string;
  rating?: number;
  isOpen?: boolean;
  deliveryTimeMin?: number;
  deliveryFee?: number;
};

async function getRestaurants(): Promise<RestaurantCard[]> {
  try {
    const result = await d1.query('SELECT * FROM restaurants ORDER BY name ASC', [], { cache: false });
    if (!result?.success || !Array.isArray(result.results)) return [];
    const cards: RestaurantCard[] = [];
    for (const row of result.results as any[]) {
      try {
        const item = await buildPublicRestaurant(row, { includeMenu: false });
        const id = String(item?.id || row?.id || '');
        const name = String(item?.name || row?.name || '').trim();
        if (!id || !name) continue;
        const image = item?.imageUrl || item?.bannerUrl || item?.image || item?.logoUrl || item?.logo;
        const rating = Number(item?.rating);
        cards.push({
          id,
          name,
          description: typeof item?.description === 'string' ? item.description : (typeof item?.tagline === 'string' ? item.tagline : undefined),
          cuisine: typeof item?.cuisine === 'string' ? item.cuisine : undefined,
          city: typeof item?.city === 'string' ? item.city : undefined,
          image: typeof image === 'string' ? image : undefined,
          rating: Number.isFinite(rating) && rating > 0 ? rating : undefined,
          isOpen: item?.isOpen === true,
          deliveryTimeMin: Number.isFinite(Number(item?.deliveryTimeMin)) && Number(item?.deliveryTimeMin) > 0 ? Number(item.deliveryTimeMin) : undefined,
          deliveryFee: Number.isFinite(Number(item?.calculatedDeliveryFee ?? item?.deliveryFee)) && Number(item?.calculatedDeliveryFee ?? item?.deliveryFee) >= 0 ? Number(item?.calculatedDeliveryFee ?? item?.deliveryFee) : undefined
        });
      } catch {
        // skip invalid rows
      }
    }
    return cards;
  } catch (error) {
    console.error('Failed to load restaurant listing:', error);
    return [];
  }
}

export default async function RestaurantsIndexPage() {
  const restaurants = await getRestaurants();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 text-slate-900">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-slate-500">
        <Link href="/" className="underline">Veyrang</Link><span aria-hidden="true"> / </span><span>Restaurants</span>
      </nav>
      <header className="mb-8">
        <h1 className="text-3xl font-bold sm:text-4xl">Restaurants</h1>
        <p className="mt-3 max-w-2xl text-slate-600">Explore restaurants, discover cuisines and browse menus before choosing where to order.</p>
      </header>
      {restaurants.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-live="polite">
          <h2 className="text-lg font-semibold">Restaurants are temporarily unavailable</h2>
          <p className="mt-2 text-slate-600">We couldn’t load the restaurant catalogue right now. Please try again shortly.</p>
          <Link href="/" className="mt-4 inline-flex rounded-xl bg-[#0D4F3C] px-4 py-2.5 font-semibold text-white">Return home</Link>
        </section>
      ) : (
        <RestaurantCatalogueControls restaurants={restaurants} />
      )}
    </main>
  );
}
