# Preview Rendering & Application Health Fix Plan

An audit and fix plan to ensure the Veyrang application renders flawlessly in the preview container without runtime errors or blank screens.

## User Intent
The user reported that the application preview is "Not fixed". We will audit the entire client entry point, Next.js page router bridge, and API route handlers to ensure full preview compatibility.

## Key Changes Needed

### 1. Client App Mounting & SSR Hydration Guard (`app/page.tsx`)
- Audit `app/page.tsx` to ensure client component hydration occurs cleanly without SSR mismatch or standard Next.js 15 App Router boundary issues.
- Ensure all browser-only web APIs (window, localStorage, navigator) are guarded behind `useEffect` or dynamic client imports.

### 2. Next.js Routing & Global Layout Audit (`app/layout.tsx` & `app/globals.css`)
- Verify `app/layout.tsx` structure complies strictly with Next.js 15 App Router specifications.
- Check Tailwind v4 CSS imports and global styles to eliminate any layout rendering bottlenecks.

### 3. API Route Handler Validation (`app/api/[[...route]]/route.ts`)
- Ensure all API endpoints (`/api/auth/*`, `/api/restaurants/*`, `/api/routing/*`, `/api/orders/*`) handle requests gracefully and return valid JSON even when database collections are fresh or unpopulated.

### 4. Build & Dev Server State Verification
- Perform a complete clean build and linting audit (`compile_applet` and `lint_applet`) to guarantee build stability.

## Verification Plan

### Automated Tests & Compilations
1. Run `compile_applet` to confirm zero compilation errors.
2. Run `lint_applet` to verify TypeScript type safety across all files.

### Manual Verification
1. Inspect the live dev server logs and ensure clean server startup on port 3000.
2. Verify home page, restaurant listings, checkout, driver view, and order tracking render seamlessly in preview.
