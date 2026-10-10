#!/usr/bin/env python3
from pathlib import Path
import re
page = Path("app/restaurants/[id]/page.tsx")
text = page.read_text()
if "buildPublicRestaurant" in text:
    print("page already wired")
    raise SystemExit(0)
if "import { d1 } from '../../../lib/d1';" in text and "restaurantMenu" not in text:
    text = text.replace(
        "import { d1 } from '../../../lib/d1';",
        "import { d1 } from '../../../lib/d1';\nimport { buildPublicRestaurant } from '../../../lib/restaurantMenu';",
    )
pat = r"async function getRestaurant\(id: string\): Promise<RestaurantData \| null> \{.*?\n\}"
new_fn = r'''async function getRestaurant(id: string): Promise<RestaurantData | null> {
  if (!id || id.length > 160 || /[/?#]/.test(id)) return null;
  try {
    const result = await d1.query('SELECT * FROM restaurants WHERE id = ? LIMIT 1', [id], { cache: false });
    const row = result?.results?.[0];
    if (!result?.success || !row) return null;
    const built = await buildPublicRestaurant(row, { includeMenu: true });
    return {
      id: String(built.id),
      name: typeof built.name === 'string' ? built.name : undefined,
      description: typeof built.description === 'string' ? built.description : undefined,
      tagline: typeof built.tagline === 'string' ? built.tagline : undefined,
      cuisine: typeof built.cuisine === 'string' ? built.cuisine : undefined,
      image: typeof (built.imageUrl || built.bannerUrl || built.image) === 'string' ? (built.imageUrl || built.bannerUrl || built.image) : undefined,
      logo: typeof (built.logoUrl || built.logo) === 'string' ? (built.logoUrl || built.logo) : undefined,
      rating: Number.isFinite(Number(built.rating)) ? Number(built.rating) : undefined,
      reviewCount: Number.isFinite(Number(built.reviewCount)) ? Number(built.reviewCount) : undefined,
      address: typeof built.address === 'string' ? built.address : undefined,
      city: typeof built.city === 'string' ? built.city : undefined,
      deliveryFee: Number.isFinite(Number(built.deliveryFee)) ? Number(built.deliveryFee) : undefined,
      minimumOrder: Number.isFinite(Number(built.minOrder ?? built.minimumOrder)) ? Number(built.minOrder ?? built.minimumOrder) : undefined,
      isOpen: built.isOpen === true,
      categories: (built.categories || []).map((category: any) => ({
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
      }))
    };
  } catch (err) {
    console.warn('Failed to load restaurant from authoritative D1:', err);
    return null;
  }
}'''
new_text, n = re.subn(pat, new_fn, text, count=1, flags=re.S)
if n != 1:
    raise SystemExit(f"getRestaurant replace failed count={n}")
page.write_text(new_text)
print("page updated")
