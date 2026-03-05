-- Seed script for Chicco feed
-- Run this in your Neon database to add Chicco to the Community Library

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
  'Chicco Romania',
  'chicco-romania',
  'https://chicco.ro',
  'https://imagedelivery.net/_5n0fwWtfADeBloyg1VyCw/976b4793-35ef-45a3-7026-618693acff00/public',
  'Suntem alaturi de tine, cel care ai grija de copii in fiecare zi. Faci totul cu entuziasm dar ai temeri si intrebari. Vrem sa iti purtam de grija tie si celor dragi, cu noi solutii captivante concepute pentru satisfacerea tuturor necesitatilor.',
  'https://chicco.websales.ro',
  NULL,
  'active',
  jsonb_build_object(
    'brandNames', ARRAY['Chicco'],
    'categories', ARRAY['Baby', 'Nursery', 'Strollers', 'Car Seats', 'Toys', 'Cosmetics'],
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
-- Replace 'csp_xxx' with the actual ID returned from the above INSERT
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
  'xml',
  'https://www.chicco.ro/feed_new.xml', -- Replace with actual feed URL
  false, -- Public feed, no auth required
  'daily',
  jsonb_build_object(
    'rootPath', 'products.products_details',
    'fields', jsonb_build_object(
      'sku', 'code',
      'name', 'title',
      'price', 'price',
      'description', 'commercial',
      'brand', 'brand',
      'productType', 'categories',
      'tags', 'categories',
      'barcode', 'barcode',
      'currency', 'currency',
      'quantity', 'stock_no',
      'stockStatus', 'stock',
      'images', 'image'
    ),
    'transforms', jsonb_build_array(
      -- Trim whitespace from SKU (CDATA often has extra spaces)
      jsonb_build_object(
        'field', 'sku',
        'type', 'trim'
      ),
      -- Trim name
      jsonb_build_object(
        'field', 'name',
        'type', 'trim'
      ),
      -- Strip HTML from description
      jsonb_build_object(
        'field', 'description',
        'type', 'strip_html'
      ),
      -- Decode HTML entities in description
      jsonb_build_object(
        'field', 'description',
        'type', 'decode_entities'
      ),
      -- Trim brand
      jsonb_build_object(
        'field', 'brand',
        'type', 'trim'
      ),
      -- Trim currency
      jsonb_build_object(
        'field', 'currency',
        'type', 'trim'
      ),
      -- Trim stock status
      jsonb_build_object(
        'field', 'stockStatus',
        'type', 'trim'
      )
    ),
    'options', jsonb_build_object(
      'imagesAreArray', true,
      'tagDelimiter', ';',
      'productTypeDelimiter', ';',
      'stockStatusMapping', jsonb_build_object(
        'in stoc', 100,
        'disponibil', 100,
        'indisponibil', 0,
        'stoc limitat', 10
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
WHERE cs.slug = 'chicco-romania'
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
WHERE cs.slug = 'chicco-romania';
