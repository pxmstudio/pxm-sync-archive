-- Seed script for BabyNeeds feed
-- Run this in your Neon database to add BabyNeeds to the Community Library

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
  'BabyNeeds',
  'babyneeds',
  'https://www.babyneeds.ro',
  'https://imagedelivery.net/_5n0fwWtfADeBloyg1VyCw/7d4838da-395b-4c48-fd3d-7cc3128ec200/public', -- Add logo URL when available
  'BabyNeeds - magazin online cu articole pentru copii si bebelusi.',
  'https://b2b.babyneeds.ro',
  NULL,
  'active',
  jsonb_build_object(
    'brandNames', ARRAY['BabyNeeds', 'YappyKids', 'Qmini', 'Miminu'],
    'categories', ARRAY['Baby', 'Nursery', 'Cribs', 'Bedding', 'Furniture'],
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
  'https://b2b.babyneeds.ro/feeds/pentru-colaboratori-14-12-2023.csv', -- Replace with actual feed URL
  false,
  'daily',
  jsonb_build_object(
    'fields', jsonb_build_object(
      'sku', 'Cod produs',
      'name', 'Produs',
      'brand', 'Brand',
      'productType', 'Categorie',
      'description', 'Descriere',
      'price', 'Pret',
      'compareAtPrice', 'Pret',
      'salePrice', 'Pret promo',
      'currency', 'Valuta',
      'stockStatus', 'Stoc',
      'images', 'Imagine',
      'additionalImages', 'Toate imaginile',
      'barcode', 'Barcode',
      'url', 'URL'
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
      jsonb_build_object('field', 'brand', 'type', 'trim'),
      -- ProductType transforms
      jsonb_build_object('field', 'productType', 'type', 'strip_html'),
      jsonb_build_object('field', 'productType', 'type', 'decode_entities'),
      jsonb_build_object('field', 'productType', 'type', 'trim')
    ),
    'options', jsonb_build_object(
      'delimiter', ',',
      'hasHeader', true,
      'imageDelimiter', '; ',
      'stockStatusMapping', jsonb_build_object(
        'in stoc', 100,
        'disponibil', 100,
        'stoc limitat', 10,
        'fără stoc', 0,
        'indisponibil', 0
      ),
      'priceDecimalSeparator', '.',
      'defaultCurrency', 'RON',
      'defaultQuantity', 0
    )
  ),
  true,
  NOW(),
  NOW()
FROM feeds cs
WHERE cs.slug = 'babyneeds'
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
WHERE cs.slug = 'babyneeds';
