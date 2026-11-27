-- PROPOSAL ONLY: NOT APPLIED; do not execute automatically.
-- Scope: authenticated active admins, product-images/main single ASCII key only.
-- No grants, helper functions, other folders/buckets or reseller/anon access.
-- Requires existing admin SELECT policies/grants on storage.objects, products
-- and product_images. Never manipulate Storage metadata through SQL.
--
-- Deliberately conservative: supported public object/render aliases, querystrings
-- and fragments match the same key. Origin is ignored to PRESERVE same-path URLs
-- from another origin. Any nonempty unsupported reference (percent-encoded path,
-- external CDN/custom mapping, relative URL, unfamiliar folder/key) denies ALL
-- cleanup until reviewed manually. This overpreservation can be too restrictive
-- for a mixed/external-image catalog; this is NOT recommended for automatic
-- application without an agreed reference-URL contract and deployment review.
--
-- A snapshot orphan check cannot synchronize a concurrent reference assignment.
-- No claim of cross-request atomicity or complete alias/redirect resolution.
-- Leave unapplied while the frontend is not deployed; its cleanup warning must
-- accurately report a refusal by current permissions.
--
-- Before considering application, inspect every existing DELETE/ALL policy:
-- permissive policies OR together; another broad DELETE policy defeats this guard.
-- Existing unrelated retail-assets DELETE policy is intentionally untouched.

create policy "Admins can remove conservative orphan main images"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'product-images'
  and name ~ '^main/[A-Za-z0-9][A-Za-z0-9._-]*$'
  and (select public.is_admin())
  and not exists (
    select 1
    from (
      select p.main_image_url as url from public.products p
      union all
      select i.image_url as url from public.product_images i
    ) refs
    where refs.url is not null and btrim(refs.url) <> ''
      and (
        refs.url !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?/storage/v1/(object/public|render/image/public)/product-images/(main|gallery|products)/[A-Za-z0-9][A-Za-z0-9._-]*([?][^#]*)?([#].*)?$'
        or split_part(split_part(
          regexp_replace(refs.url, '^https://[A-Za-z0-9.-]+(:[0-9]+)?/storage/v1/(object/public|render/image/public)/product-images/', ''),
          '?', 1), '#', 1) = storage.objects.name
      )
  )
);

