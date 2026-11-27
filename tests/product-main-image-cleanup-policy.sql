-- Pure read-only VALUES regression for the UNAPPLIED policy proposal.
-- Uses synthetic URLs/actors, no real identities, table writes, schema changes
-- or Storage objects. This checks expression semantics, NOT deployed RLS/API.
-- refs combines products.main_image_url and product_images.image_url inputs.
begin read only;
with cases(label, actor, bucket, name, refs, expected) as (
  values
    ('admin_orphan','admin','product-images','main/a.png',array[]::text[],true),
    ('main_ref','admin','product-images','main/a.png',array['https://example.invalid/storage/v1/object/public/product-images/main/a.png'],false),
    ('gallery_ref_to_main','admin','product-images','main/a.png',array['https://example.invalid/storage/v1/object/public/product-images/main/a.png'],false),
    ('render_query_ref','admin','product-images','main/a.png',array['https://example.invalid/storage/v1/render/image/public/product-images/main/a.png?width=16'],false),
    ('object_fragment_ref','admin','product-images','main/a.png',array['https://example.invalid/storage/v1/object/public/product-images/main/a.png#preview'],false),
    ('external_origin_same_path','admin','product-images','main/a.png',array['https://other.invalid/storage/v1/object/public/product-images/main/a.png'],false),
    ('encoded_folder_fail_closed','admin','product-images','main/a.png',array['https://example.invalid/storage/v1/object/public/product-images/%6dain/a.png'],false),
    ('encoded_key_fail_closed','admin','product-images','main/a.png',array['https://example.invalid/storage/v1/object/public/product-images/main/%61.png'],false),
    ('external_cdn_fail_closed','admin','product-images','main/a.png',array['https://cdn.invalid/any-image.png'],false),
    ('relative_ref_fail_closed','admin','product-images','main/a.png',array['/storage/v1/object/public/product-images/main/a.png'],false),
    ('unrelated_gallery','admin','product-images','main/a.png',array['https://example.invalid/storage/v1/object/public/product-images/gallery/b.png?download=%61'],true),
    ('null_empty_refs','admin','product-images','main/a.png',array[null,'','   '],true),
    ('different_key','admin','product-images','main/a.png',array['https://example.invalid/storage/v1/object/public/product-images/main/b.png'],true),
    ('mixed_refs_keep_match','admin','product-images','main/a.png',array['https://example.invalid/storage/v1/object/public/product-images/main/b.png','https://example.invalid/storage/v1/render/image/public/product-images/main/a.png?width=10'],false),
    ('gallery_candidate_denied','admin','product-images','gallery/a.png',array[]::text[],false),
    ('other_bucket_denied','admin','retail-assets','main/a.png',array[]::text[],false),
    ('reseller_denied','reseller','product-images','main/a.png',array[]::text[],false),
    ('anonymous_denied','anonymous','product-images','main/a.png',array[]::text[],false),
    ('nested_candidate_denied','admin','product-images','main/nested/a.png',array[]::text[],false),
    ('encoded_candidate_denied','admin','product-images','main/%61.png',array[]::text[],false)
), evaluated as (
  select c.*,
    c.bucket = 'product-images'
    and c.name ~ '^main/[A-Za-z0-9][A-Za-z0-9._-]*$'
    and c.actor = 'admin'
    and not exists (
      select 1 from unnest(c.refs) as refs(url)
      where refs.url is not null and btrim(refs.url) <> ''
        and (
          refs.url !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?/storage/v1/(object/public|render/image/public)/product-images/(main|gallery|products)/[A-Za-z0-9][A-Za-z0-9._-]*([?][^#]*)?([#].*)?$'
          or split_part(split_part(
            regexp_replace(refs.url, '^https://[A-Za-z0-9.-]+(:[0-9]+)?/storage/v1/(object/public|render/image/public)/product-images/', ''),
            '?', 1), '#', 1) = c.name
        )
    ) as obtained
  from cases c
)
select count(*) as total,
  count(*) filter (where obtained = expected) as passed,
  coalesce(jsonb_agg(jsonb_build_object('test',label,'expected',expected,'obtained',obtained))
    filter (where obtained is distinct from expected),'[]'::jsonb) as failures
from evaluated;
rollback;

