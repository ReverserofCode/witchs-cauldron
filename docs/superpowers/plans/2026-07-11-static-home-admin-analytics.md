# Static Home and Admin Analytics Implementation Plan

1. Add failing tests for the clip catalog cache and KST dashboard presets.
2. Implement the shared clip catalog, cache, ETag, and public catalog API.
3. Convert the home page to five-minute ISR and hydrate clip updates through a client catalog component.
4. Replace repeated live-status hooks with one provider and apply short upstream revalidation.
5. Make Shorts poster-first, remove wheel interception, enlarge controls, and compress empty embedded schedule rows.
6. Enable Next image optimization and remove the malformed route icon asset.
7. Update analytics date presets to shared KST helpers and correct the verified desktop/mobile layout defects.
8. Extend browser smoke coverage for the new architecture and responsive behavior.
9. Run tests, typecheck, lint, production build, API checks, and matching desktop/mobile browser captures.
10. Review the diff for behavior, cache invalidation, accessibility, and unrelated changes before completing the branch.
