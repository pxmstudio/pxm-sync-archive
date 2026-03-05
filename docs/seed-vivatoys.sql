-- Seed script for VivaToys feed
-- Run this in your Neon database to add VivaToys to the Community Library

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
  'VivaToys',
  'vivatoys',
  'https://www.partenerviva.ro',
  NULL, -- Add logo URL when available
  'VIVA TOYS este o companie care activeaza pe piata din Romania de aproape un deceniu si care se specializeaza in importul si distributia la nivel national de jucarii, jocuri, dar si de articole pentru bebelusi si copii precum carucioare, scaune auto, scaune de masa, seturi pentru hranire si multe altele. Viva Toys deține și cea mai mare platforma de dropshipping de jucarii din Romania, avand peste 5 mii de produse active.',
  'https://www.partenerviva.ro',
  NULL,
  'active',
  jsonb_build_object(
    'brandNames', ARRAY['Silverlit', 'Disney', 'AS', 'VivaToys'],
    'categories', ARRAY['Toys', 'RC Cars', 'Plush', 'Games', 'Kids'],
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
  'https://www.partenerviva.ro/feed?stoc=1&format=csv&token=35b32ad21c23c401155ca338326e0e', -- Replace with actual feed URL
  false,
  'daily',
  jsonb_build_object(
    'fields', jsonb_build_object(
      'sku', 'SKU',
      'name', 'NUME PRODUS',
      'brand', 'BRAND',
      'productType', 'CATEGORIE',
      'description', 'DESCRIERE',
      'price', 'PRET RECOMANDAT DE VANZARE CU TVA',
      'costPrice', 'PRET DE ACHIZITIE CU TVA',
      'quantity', 'STOC',
      'images', 'POZE',
      'barcode', 'EAN'
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
      'priceDecimalSeparator', '.',
      'defaultCurrency', 'RON',
      'defaultQuantity', 0
    )
  ),
  true,
  NOW(),
  NOW()
FROM feeds cs
WHERE cs.slug = 'vivatoys'
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
WHERE cs.slug = 'vivatoys';
