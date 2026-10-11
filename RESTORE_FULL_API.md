# Restore full API catch-all (orders, payments, kitchen, admin)

The GitHub integration used here cannot reliably push the ~170KB catch-all in one request.
Restore it from the last good commit on your machine, then push.

```bash
git clone https://github.com/abideentaoreed12-oss/Food.git
cd Food
git fetch origin

# Restore the complete catch-all from the last known-good commit
git checkout f0e3a2dd30722fcd76e2c9c851f63d8ed36e384e -- "app/api/[[...route]]/route.ts"

# Optional: download CDN copy if needed
# curl -sL "https://cdn.jsdelivr.net/gh/abideentaoreed12-oss/Food@f0e3a2dd30722fcd76e2c9c851f63d8ed36e384e/app/api/%5B%5B...route%5D%5D/route.ts" -o "app/api/[[...route]]/route.ts"

git add "app/api/[[...route]]/route.ts"
git commit -m "restore: full API catch-all (orders, payments, kitchen, admin)"
git push origin main
```

After that deploy is green, re-apply security hardening (admin-only health/storage, server-side menu prices, GPS auth, forgot-password non-enumeration, staff password required) in a follow-up PR.

Do **not** replace the file with a path string or placeholder.
