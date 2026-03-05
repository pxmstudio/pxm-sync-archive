-- Seed script for Aleo feed
-- Run this in your Neon database to add Aleo to the Community Library

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
  'Aleo',
  'aleo',
  'https://aleo.ro',
  'https://imagedelivery.net/_5n0fwWtfADeBloyg1VyCw/ff74b80a-0f46-4cfe-ca9d-9a814d69cf00/public',
  'Cu o experienta de peste 15 ani de activitate in domeniu, TOPTOOLS este numarul 1 in Romania in importul si distribuia de sisteme de bare transversale, cutii portbagaj, suporturi pentru biciclete, suporturi pentru schiuri si alte accesorii pentru transport. Ideea de la care s-a pornit in 2005, a fost aceea de a-i ajuta si pe alti pasionati de schi din Cluj sa-si transporte echipamentele.',
  'https://aleo.ro',
  NULL,
  'active',
  jsonb_build_object(
    'brandNames', ARRAY['Aleo', 'Thule', 'Aragon', 'Towbox'],
    'categories', ARRAY['Auto', 'Roof Boxes', 'Bike Carriers', 'Outdoor', 'Travel'],
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

-- 2. Insert the feed source configuration
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
  f.id,
  'csv',
  'https://aleo.ro/feeds/b2bgeneral.csv',
  false,
  'daily',
  jsonb_build_object(
    'fields', jsonb_build_object(
      'sku', 'Cod produs',
      'name', 'Denumire',
      'brand', 'Producator',
      'productType', 'Categorie',
      'description', 'Descriere',
      'price', 'Pret',
      'compareAtPrice', 'Pret',
      'salePrice', 'Pret la oferta',
      'quantity', 'Stoc',
      'images', 'Imagine principala',
      'additionalImages', 'Galerie imagini',
      'url', 'URL produs'
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
      'delimiter', ';',
      'hasHeader', true,
      'imageDelimiter', ',',
      'priceDecimalSeparator', '.',
      'defaultCurrency', 'RON',
      'defaultQuantity', 0
    )
  ),
  true,
  NOW(),
  NOW()
FROM feeds f
WHERE f.slug = 'aleo'
ON CONFLICT DO NOTHING;

-- Verify the insert
SELECT
  f.id as feed_id,
  f.name,
  f.slug,
  f.status,
  fs.id as source_id,
  fs.feed_type,
  fs.schedule,
  fs.is_active
FROM feeds f
LEFT JOIN feed_sources fs ON fs.feed_id = f.id
WHERE f.slug = 'aleo';
