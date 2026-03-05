-- Seed script for BebeBrands feed
-- Run this in your Neon database to add BebeBrands to the Community Library

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
  'BebeBrands',
  'bebebrands',
  'https://bebebrands.ro',
  'https://imagedelivery.net/_5n0fwWtfADeBloyg1VyCw/cd3d037d-71ae-40f1-0525-4e4289f16500/public', -- Add logo URL when available
  'In anul 2006 am pornit pe acest drum frumos, infiintand o companie romaneasca cu focusul pe calitatea produselor pentru parinti, bebelusi si copii. Inca de la inceput am stiut ca urmeaza o calatorie lunga plina de evenimente frumoase si ne bucuram ca nu ne-am inselat. In toti acesti ani am ajuns sa reprezentam cu incredere mai multe branduri internationale de bebelusi, foarte bine pozitionate atat in Europa, cat si in SUA, pentru a putea satisface dorintele fiecarui parinte si ale fiecarui bebelus.',
  'https://bebebrands.ro',
  NULL,
  'active',
  jsonb_build_object(
    'brandNames', ARRAY['BabyGo', 'Nuna', 'BebeBrands'],
    'categories', ARRAY['Baby', 'Nursery', 'Strollers', 'Toys', 'Teething'],
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
  'http://bebebrands.ro/media/fullfeed/bebebrands_feed_csv.csv', -- Replace with actual feed URL
  false,
  'daily',
  jsonb_build_object(
    'fields', jsonb_build_object(
      'sku', 'sku',
      'name', 'name',
      'brand', 'manufacturer',
      'productType', 'category',
      'description', 'description',
      'price', 'price',
      'salePrice', 'special_price',
      'stockStatus', 'is_in_stock',
      'images', 'image',
      'additionalImages', 'media_gallery',
      'barcode', 'cod_ean'
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
      'imageDelimiter', ',',
      'priceDecimalSeparator', '.',
      'defaultCurrency', 'RON',
      'defaultQuantity', 0,
      'productTypeDelimiter', ';;',
      'productTypePathSeparator', '/',
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
WHERE cs.slug = 'bebebrands'
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
WHERE cs.slug = 'bebebrands';
