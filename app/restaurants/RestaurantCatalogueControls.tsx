'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export type RestaurantCatalogueItem = {
  id: string;
  name: string;
  description?: string;
  cuisine?: string;
  city?: string;
  image?: string;
  rating?: number;
  isOpen?: boolean;
};

export default function RestaurantCatalogueControls({ restaurants }: { restaurants: RestaurantCatalogueItem[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'name' | 'rating'>('name');
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return restaurants.filter((restaurant) => !q ||
      restaurant.name.toLocaleLowerCase().includes(q) ||
      (restaurant.cuisine || '').toLocaleLowerCase().includes(q) ||
      (restaurant.city || '').toLocaleLowerCase().includes(q) ||
      (restaurant.description || '').toLocaleLowerCase().includes(q)
    ).slice().sort((a, b) => sort === 'rating'
      ? (b.rating || 0) - (a.rating || 0)
      : a.name.localeCompare(b.name));
  }, [restaurants, query, sort]);

  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="sr-only">Search restaurants</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search restaurant, cuisine or city…" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#0D4F3C] focus:ring-2 focus:ring-[#0D4F3C]/20" />
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <span>Sort by</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as 'name' | 'rating')} className="bg-transparent py-3 font-semibold outline-none">
            <option value="name">Name</option>
            <option value="rating">Rating</option>
          </select>
        </label>
      </div>
      <p className="mb-4 text-sm text-slate-500" aria-live="polite">{visible.length} {visible.length === 1 ? 'restaurant' : 'restaurants'} found</p>
      {visible.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold">No matching restaurants</h2>
          <p className="mt-1 text-sm text-slate-600">Try another restaurant name, cuisine or city.</p>
          <button type="button" onClick={() => setQuery('')} className="mt-4 rounded-lg bg-[#0D4F3C] px-4 py-2 font-semibold text-white">Clear search</button>
        </section>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((restaurant) => (
            <li key={restaurant.id}>
              <article className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-md">
                <Link href={`/restaurants/${encodeURIComponent(restaurant.id)}`} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4F3C]">
                  {restaurant.image ? <img src={restaurant.image} alt="" loading="lazy" className="h-48 w-full bg-slate-100 object-cover" /> : <div aria-hidden="true" className="flex h-48 items-center justify-center bg-slate-100 text-slate-500">Restaurant</div>}
                  <div className="p-5">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className={restaurant.isOpen ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800' : 'rounded-full bg-slate-100 px-2.5 py-1 text-slate-600'}>{restaurant.isOpen ? 'Open now' : 'Hours unavailable'}</span>
                      {restaurant.rating !== undefined ? <span className="text-slate-600">★ {restaurant.rating.toFixed(1)}</span> : null}
                    </div>
                    <h2 className="text-xl font-bold">{restaurant.name}</h2>
                    {restaurant.cuisine ? <p className="mt-1 text-sm text-slate-600">{restaurant.cuisine}</p> : null}
                    {restaurant.city ? <p className="mt-1 text-sm text-slate-500">{restaurant.city}</p> : null}
                    {restaurant.description ? <p className="mt-3 line-clamp-3 text-sm text-slate-600">{restaurant.description}</p> : null}
                    <span className="mt-5 inline-flex font-semibold text-[#0D4F3C]">View menu <span aria-hidden="true" className="ml-1">→</span></span>
                  </div>
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
