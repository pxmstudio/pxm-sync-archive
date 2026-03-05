-- Seed script for Hubners feed
-- Run this in your Neon database to add Hubners to the Community Library

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
  'Hubners',
  'hubners',
  'https://www.hubners.ro',
  'https://imagedelivery.net/_5n0fwWtfADeBloyg1VyCw/c0decfd6-d9a5-4b3a-787d-9701ac7e5d00/public', -- Add logo URL when available
  'Suntem un colectiv, si totodata o echipa formata din tineri dinamici si responsabili in tot ceea ce facem. Firma a fost infiintata in anul 2012, cu multe idei de realizat, in special sustinerea si promovarea brand-ului pe care il reprezentam official in Romania - Brand-ul Chipolino.',
  'https://www.hubners.ro',
  NULL,
  'active',
  jsonb_build_object(
    'brandNames', ARRAY['Chipolino', 'Hubners'],
    'categories', ARRAY['Baby', 'Nursery', 'Strollers', 'Car Seats', 'Toys', 'Kids Room'],
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

-- 2. Insert the feed configuration (use the ID from above)
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
  'https://www.hubners.ro/index.php/datafeed/index/index/id/5cf784b2e93d5', -- Replace with actual feed URL when available
  false, -- Public feed, no auth required
  'daily',
  jsonb_build_object(
    'fields', jsonb_build_object(
      'sku', 'sku',
      'name', 'name',
      'brand', 'brand',
      'productType', 'category',
      'tags', 'subcategory',
      'description', 'description',
      'price', 'price',
      'compareAtPrice', 'price',
      'salePrice', 'special-price',
      'currency', NULL,
      'quantity', 'stock',
      'stockStatus', 'availability',
      'images', 'first-image',
      'additionalImages', 'image-gallery',
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
      jsonb_build_object('field', 'brand', 'type', 'trim'),
      -- ProductType transforms
      jsonb_build_object('field', 'productType', 'type', 'strip_html'),
      jsonb_build_object('field', 'productType', 'type', 'decode_entities'),
      jsonb_build_object('field', 'productType', 'type', 'trim'),
      -- Tags transforms
      jsonb_build_object('field', 'tags', 'type', 'strip_html'),
      jsonb_build_object('field', 'tags', 'type', 'decode_entities'),
      jsonb_build_object('field', 'tags', 'type', 'trim')
    ),
    'options', jsonb_build_object(
      'delimiter', ';',
      'hasHeader', true,
      'imageGalleryDelimiter', ',',
      'stockStatusMapping', jsonb_build_object(
        '1', 100,
        '0', 0
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
WHERE cs.slug = 'hubners'
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
WHERE cs.slug = 'hubners';
