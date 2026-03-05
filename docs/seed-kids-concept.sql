-- Seed script for Kids Concept feed
-- Run this in your Neon database to add Kids Concept to the Community Library

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
  'Kids Concept',
  'kids-concept',
  'https://kidsconcept.ro',
  'https://imagedelivery.net/_5n0fwWtfADeBloyg1VyCw/ce2bf121-76cd-4559-9a9e-4ed3c9eaa000/public', -- Add logo URL when available
  'Suntem parinti si ne pasa de copiii nostri! Pentru ca noi, parintii, am intampinat de-atatea ori dificultati in a gasi produse de calitate pentru copiii nostri, am ales ca din portofoliul nostru sa faca parte numai produse excelente din punct de vedere calitativ, prietenoase cu mediul inconjurator, sustenabile si avand preturi decente.',
  'https://kidsconcept.ro',
  NULL,
  'active',
  jsonb_build_object(
    'brandNames', ARRAY['Cubika', 'Kids Concept'],
    'categories', ARRAY['Toys', 'Educational', 'Puzzles', 'Kids'],
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
  'https://kidsconcept.ro/amfeed/feed/download?id=38&file=amasty/feed/pilulka-feed.csv', -- Replace with actual feed URL
  false,
  'daily',
  jsonb_build_object(
    'fields', jsonb_build_object(
      'sku', 'cod_produs',
      'name', 'denumire',
      'brand', 'brand',
      'productType', 'categorii',
      'description', 'descriere',
      'price', 'pret',
      'compareAtPrice', 'pret',
      'salePrice', 'pret_redus',
      'quantity', 'cantitate',
      'images', 'imagine_principala',
      'barcode', 'ean'
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
      'defaultQuantity', 0,
      'productTypeDelimiter', ',',
      'productTypePathSeparator', '/',
      'additionalImageFields', ARRAY['imagine_1', 'imagine_2', 'imagine_3', 'imagine_4', 'imagine_5']
    )
  ),
  true,
  NOW(),
  NOW()
FROM feeds cs
WHERE cs.slug = 'kids-concept'
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
WHERE cs.slug = 'kids-concept';
