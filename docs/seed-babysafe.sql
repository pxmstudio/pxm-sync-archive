-- Seed script for BabySafe feed
-- Run this in your Neon database to add BabySafe to the Community Library

-- 1. Insert the feed
INSERT INTO feeds (
  id,
  name,
  slug,
  website,
  logo_url,
  description,
  ordering_url,
  ordering_email,
  status,
  metadata,
  created_at,
  updated_at
) VALUES (
  'feed_' || gen_random_uuid()::text,
  'BabySafe',
  'babysafe',
  'https://www.babysafe.ro',
  'https://imagedelivery.net/_5n0fwWtfADeBloyg1VyCw/940a4758-6af7-4476-a134-cb3b033e8a00/public', -- Add logo URL when available
  'BabySafe este o companie tanara, plina de entuziasm si pasiune, care isi doreste sa aduca produse si servicii innovative, calitative si sigure parintilor si bebelusilor din Romania.

Nisa produselor pentru bebelusi este una speciala pentru noi, deoarece nu doar designul sau pretul unui produs este important, ci in primul rand, siguranta oferita de acestea. Tocmai de aceea, primul pas in alegerea brandurilor pe care le reprezentam este sa ne asiguram ca produsele sunt de o calitate ireprosabila si pot oferi bebelusilor siguranta de care au nevoie.

Ne dorim sa ne construim un portofoliu de branduri de calitate si sa legam parteneriate durabile, pentru ca acesta este singura cale spre succes, tocmai de aceea am inceput colaborarea cu branduri de incredere cu istorie si rezultate excelente.',
  'https://www.babysafe.ro',
  NULL,
  'active',
  jsonb_build_object(
    'brandNames', ARRAY['Carter''s', 'OshKosh', 'BabySafe'],
    'categories', ARRAY['Baby', 'Kids', 'Clothing', 'Apparel'],
    'region', 'Romania'
  ),
  NOW(),
  NOW()
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  website = EXCLUDED.website,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = NOW()
RETURNING id;

-- 2. Insert the feed configuration
INSERT INTO feed_sources (
  id,
  feed_id,
  feed_type,
  feed_url,
  requires_auth,
  schedule,
  mapping,
  is_active,
  created_at,
  updated_at
)
SELECT
  'feedSource_' || gen_random_uuid()::text,
  cs.id,
  'csv',
  'http://babysafe.ro/media/fullfeed/feed_produse_v1.csv', -- Replace with actual feed URL
  false,
  'daily',
  jsonb_build_object(
    'fields', jsonb_build_object(
      'sku', 'id',
      'name', 'title',
      'brand', 'brand',
      'description', 'description',
      'price', 'price',
      'salePrice', 'sale_price',
      'stockStatus', 'availability',
      'images', 'image_link',
      'additionalImages', 'additional_image_link',
      'url', 'link'
    ),
    'transforms', jsonb_build_array(
      -- SKU transforms
      jsonb_build_object('field', 'sku', 'type', 'trim'),
      -- Name transforms
      jsonb_build_object('field', 'name', 'type', 'strip_html'),
      jsonb_build_object('field', 'name', 'type', 'decode_entities'),
      jsonb_build_object('field', 'name', 'type', 'trim'),
      -- Description transforms
      jsonb_build_object('field', 'description', 'type', 'strip_html'),
      jsonb_build_object('field', 'description', 'type', 'decode_entities'),
      -- Brand transforms
      jsonb_build_object('field', 'brand', 'type', 'strip_html'),
      jsonb_build_object('field', 'brand', 'type', 'decode_entities'),
      jsonb_build_object('field', 'brand', 'type', 'trim')
    ),
    'options', jsonb_build_object(
      'delimiter', ',',
      'hasHeader', true,
      'imageDelimiter', ',',
      'priceDecimalSeparator', '.',
      'defaultCurrency', 'RON',
      'defaultQuantity', 0,
      'stockStatusMapping', jsonb_build_object(
        '1', 100,
        '0', 0
      )
    )
  ),
  true,
  NOW(),
  NOW()
FROM feeds cs
WHERE cs.slug = 'babysafe'
ON CONFLICT DO NOTHING;

-- Verify the insert
SELECT
  cs.id as feed_id,
  cs.name,
  cs.slug,
  cs.status,
  csf.id as feed_id,
  csf.feed_type,
  csf.schedule,
  csf.is_active
FROM feeds cs
LEFT JOIN feed_sources csf ON csf.feed_id = cs.id
WHERE cs.slug = 'babysafe';
