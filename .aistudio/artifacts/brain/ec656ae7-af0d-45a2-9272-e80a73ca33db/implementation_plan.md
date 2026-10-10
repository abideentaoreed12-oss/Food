# QuickBite — Professional Nigerian Food Delivery Platform

QuickBite is a mobile-first food delivery platform engineered for the Nigerian market, featuring authentic Naira (₦) currency formatting, local payment settlement (Card, Bank Transfer, Pay on Delivery), local address zoning (Lekki Phase 1, Victoria Island, Ikoyi, Ikeja GRA), and an exact replica of the clean orange-accent mobile design system with a right-sliding navigation drawer that routes to every storefront and platform page.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following parameters govern the implementation to match your uploaded design reference and requirements:

- **Confirmed: Exact QuickBite Design System & Palette**: Warm vibrant brand orange (`#FF5500` / `#EA580C`), pristine neutral background canvas (`#F8F9FA` with white cards), soft warm orange active pill backgrounds (`#FFF1E8`), rounded category buttons, and large 44px+ mobile touch targets.
- **Confirmed: Right-Sliding Navigation Drawer**: The top-right hamburger menu (`☰`) opens a right drawer over a dimmed backdrop containing all 12 platform links with active page highlighting. Clicking any drawer item closes the drawer and displays the full page.
- **Confirmed: Nigerian Localization & Currency (₦)**: Prices formatted with the Naira sign (e.g., `₦3,500`, `₦500 delivery fee`), Nigerian phone validation (`+234...`), real local delivery fees, and dual payment rails (Paystack Card, Instant Bank Transfer, Pay on Delivery).
- **Confirmed: Honest Order Lifecycle & Architecture**: Real backend status progression (`Placed` → `Confirmed` → `Preparing` → `Ready for pickup` → `On the way` → `Delivered`) without fake GPS maps. Clean domain separation for future Rider auto-dispatch, tracking, and multi-city modules.

---

### 1. Overview & Core Concept

QuickBite connects customers in Nigerian metropolitan zones with local restaurants and kitchens through a polished mobile-first web experience.

1. **Customer Storefront**:
   - **Header & Address Selector**: Sticky top header with orange QuickBite brand mark, shopping cart with real-time item badge, and hamburger menu (`☰`). Quick address bar with zone selector (`Lekki Phase 1`, `Victoria Island`, `Ikoyi`, `Ikeja GRA`, `Yaba`).
   - **Category & Discovery**: Horizontal scrolling category chips (`All`, `Burgers`, `Pizza`, `Asian / Rice`, `Healthy`, `Naija Specials`) with category-based live restaurant filtering.
   - **Restaurant Cards**: Left-aligned food thumbnail, bold restaurant name, rating stars with review counts (`★ 4.6 (320)`), estimated delivery time (`25–35 min`), delivery fee badge (`₦500 delivery fee`), and open/closed/busy status.
   - **Menu & Dish Detail**: Cover photo, restaurant information, category anchor tabs, search within menu, dish items with prices, and customisation modal (sizes, extras, spice level, special cooking instructions).
   - **Sticky Cart & Checkout**: Floating bottom cart bar on menu (`View cart · 2 items · ₦7,700`), itemized cart drawer with quantity edits and promo code engine, and checkout with saved addresses, delivery notes, and payment method selection.
   - **Order Confirmation & Honest Tracking**: Order reference `#QB-1042`, itemized receipt, support contact, and realistic multi-stage order progress timeline driven by the backend.

2. **Complete Navigation Drawer Pages**:
   - **Home**: Main storefront feed with category chips, top rated, and nearby restaurants.
   - **Restaurants**: Comprehensive directory with open now, rating, delivery time, and cuisine filters.
   - **Search**: Dedicated search experience with dish and restaurant discovery.
   - **Offers**: Curated promo codes (`WELCOME500`, `LEKKI20`, `FREEDROP`) with copyable codes and discount details.
   - **My Orders**: Past and active orders with live status tracking, order details, and 1-tap reorder.
   - **Favourites**: Saved restaurants and favorite dishes for quick ordering.
   - **Account**: User profile, saved delivery addresses in Lagos/Abuja, and wallet balances in ₦.
   - **Help & Support**: Interactive FAQ (delivery times, payment failures, cancellations, refunds) and live support contact.
   - **Partner with us**: Restaurant vendor onboarding application form.
   - **Terms & Privacy**: Transparent terms of service, customer privacy, and refund policies.
   - **Contact**: Direct WhatsApp link, customer care phone line (`0800-QUICKBITE`), and support email.

3. **Vendor KDS & Operations Portal**:
   - Authenticated merchant portal with order ticket board (*Incoming*, *Preparing*, *Ready*).
   - Menu management (categories, items, prices in ₦, availability toggles, 86-list).
   - Kitchen busy mode toggle to pause new orders when overwhelmed.

4. **Admin Operations Console**:
   - Overview metrics: Daily GMV in ₦, total orders, active restaurants, and users.
   - Restaurant approval and suspension workflow.
   - Order audit and refund processing tool with logged reason codes.
   - Delivery fee rules, commission percentages, and feature flag management.

---

### 2. User Experience & Visual Design

#### Visual Design Tokens (from Reference Image)
- **Primary Brand Color**: `#FF5500` / `#EA580C` (Warm vibrant orange used for logo, primary CTAs, active categories, and cart badges)
- **Active Pill Background**: `#FFF1E8` / `#FFF3EC` (Soft warm peach-orange for active drawer link and focused states)
- **Neutral Canvas**: `#F8F9FA` background with pure `#FFFFFF` elevated cards
- **Border & Hairlines**: `#E5E7EB` / `#F3F4F6` (Delicate clean borders)
- **Typography Scale**: Display font `Outfit` (bold, friendly, modern), Body font `Plus Jakarta Sans` (ultra-readable mobile prose), Numerals in tabular format (`font-mono tabular-nums`)
- **Spacing & Touch Targets**: 8px grid system, minimum 44px hitboxes on all interactive buttons, sticky 56px top header within the 15% mobile sticky cap.

#### Right Drawer Navigation Flow
```
[ Top Header ] ──▶ Tap ☰ (Top Right)
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ [Dimmed Backdrop]  │ [Right Drawer (Slides in from Right)]  │
│ (Tap to dismiss)   │ • QuickBite Logo                 [ ✕ ] │
│                    │ • 📍 Deliver to: Lekki Phase 1       ▾ │
│                    ├────────────────────────────────────────┤
│                    │ ▸ 🏠 Home (Active Pill #FFF1E8)        │
│                    │   🏪 Restaurants                       │
│                    │   🔍 Search                            │
│                    │   🏷️ Offers                            │
│                    │   🛍️ My Orders                         │
│                    │   ❤️ Favourites                        │
│                    │   👤 Account                           │
│                    │   ❓ Help & Support                    │
│                    │ ────────────────────────────────────── │
│                    │   📋 Partner with us                   │
│                    │   📄 Terms                             │
│                    │   🔒 Privacy                           │
│                    │   📞 Contact                           │
│                    │ ────────────────────────────────────── │
│                    │   🚪 Log out / Log in (Red Accent)     │
└────────────────────┴────────────────────────────────────────┘
                         │
                         ▼
        Tap any link ──▶ Drawer closes & Active View updates
```

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Native NGN (₦) Currency & Nigerian Pricing Engine**
  - *Chosen Approach*: All prices, delivery fees, service fees, discounts, and wallets stored and displayed natively in Naira (₦) with standard Nigerian formatting (e.g. `₦3,500`, `₦500 delivery fee`).
  - *Why*: Directly aligns with the primary market requirement and eliminates confusing foreign conversions.
- **Decision 2: Right-Sliding Drawer Routing Engine**
  - *Chosen Approach*: Clean view-state router managed in React state that controls the active page, syncs with drawer clicks, and maintains scroll position.
  - *Why*: Delivers an ultra-responsive native-app feel on mobile browsers without page reloads or blank flashes.
- **Decision 3: Honest Timeline Tracking Over Fake GPS**
  - *Chosen Approach*: Visual step progress timeline driven by real backend status (`placed` → `confirmed` → `preparing` → `ready_for_pickup` → `in_transit` → `delivered`) with estimated preparation and delivery countdowns.
  - *Why*: Follows the strict non-negotiable requirement of no fake simulated GPS maps while keeping the architecture ready for real driver GPS integration in V2.
- **Decision 4: Single Restaurant Cart Policy**
  - *Chosen Approach*: Enforce one restaurant per cart with a friendly confirmation prompt if switching restaurants.
  - *Why*: Industry standard for food delivery logistics and kitchen fulfillment.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        QuickBite Mobile Shell                          │
│   [ QuickBite ] ── [ Cart Badge (2) ] ── [ ☰ Drawer Trigger (Right) ]  │
│   [ 📍 Deliver to: Lekki Phase 1 ▾ ]                                    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ Public Storefront│      │ Navigation Drawer│      │ Portals (Role)   │
├──────────────────┤      ├──────────────────┤      ├──────────────────┤
│ • Home Feed      │      │ • All 12 Links   │      │ • Merchant KDS   │
│ • Category Chips │      │ • Active Pill    │      │ • Admin Console  │
│ • Menu PDP & Mod │      │ • Smooth Slide   │      │ • Rider (Stub)   │
│ • Cart & Checkout│      │ • Backdrop Click │      │                  │
│ • Order Tracking │      │                  │      │                  │
└────────┬─────────┘      └────────┬─────────┘      └────────┬─────────┘
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│              Server-Side REST APIs (/api/*) & Security                 │
│  /api/restaurants  /api/orders  /api/payments  /api/admin  /api/auth   │
├────────────────────────────────────────────────────────────────────────┤
│ • Server-Side Price Verification  • Zod Validation   • Idempotency     │
│ • Role-Based Access Control       • Audit Logging    • Rate Limiting   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Persistent Database (.data/feastfleet_db.json)           │
│   Users · Restaurants · Categories · MenuItems · Orders · AuditLogs   │
└────────────────────────────────────────────────────────────────────────┘
```

#### Core Data Entities
1. **Restaurant**: `id`, `name`, `tagline`, `cuisine`, `rating`, `reviewCount`, `deliveryTimeMin`, `deliveryTimeMax`, `deliveryFee` (e.g. 500), `minOrder` (e.g. 1500), `address` (Lekki, VI, etc.), `zone`, `categories`, `isOpen`, `isBusyPaused`.
2. **MenuItem**: `id`, `restaurantId`, `name`, `description`, `price` (in ₦), `category`, `dietary`, `isAvailable`, `customizations` (Sizes, Extras, Instructions).
3. **Order**: `id`, `shortId` (e.g. `#QB-1042`), `customerId`, `customerName`, `customerPhone`, `deliveryAddress`, `zone`, `items`, `subtotal`, `deliveryFee`, `serviceFee`, `discountAmount`, `total`, `currency` (`NGN`), `paymentMethod` (`card` | `transfer` | `cod`), `status`, `statusHistory`, `createdAt`.
4. **PromoCode**: `code` (`WELCOME500`, `LEKKI20`, `FREEDROP`), `discountAmount`, `minOrder`, `isActive`.
