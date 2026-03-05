-- Seed script for Smart Baby feed
-- Run this in your Neon database to add Smart Baby to the Community Library

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
  'Smart Baby',
  'smart-baby',
  'https://smart-baby.ro',
  'https://imagedelivery.net/_5n0fwWtfADeBloyg1VyCw/2f4ac768-3bb6-468d-403b-b5dc27594000/public', -- Add logo URL when available
  'Smart Baby este un magazin online special creat pentru a oferi produse de calitate care ajuta la dezvoltarea fizica si intelectuala a bebelusului dumneavoastra. Magazinul nostru ofera combinatia perfecta intre produse inovative de calitate si preturi pentru toate buzunarele. Scopul nostru, aici la Smart Baby, este sa simplificam viata parintilor asigurand in acelasi timp sanatatea, siguranta si fericirea bebelusilor. Tanara si binevoitoare, echipa Smart Baby lucreaza constant pentru ca site-ul nostru sa fie populat doar de produse de calitate, atent selectate care raman totusi la un pret acceptabil.',
  'https://parteneri.smart-baby.ro',
  NULL,
  'active',
  jsonb_build_object(
    'brandNames', ARRAY['gb', 'Cybex', 'Smart Baby'],
    'categories', ARRAY['Baby', 'Strollers', 'Car Seats', 'Nursery'],
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
  'https://parteneri.smart-baby.ro/userfiles/c91bf494-563e-46d4-8954-fecedafba3de/feeds/ba90f1e4-f102-4ded-89ef-af725172ed48.csv', -- Replace with actual feed URL
  false,
  'daily',
  jsonb_build_object(
    'fields', jsonb_build_object(
      'sku', 'Product Code',
      'name', 'Product Name',
      'brand', 'BrandName',
      'productType', 'Category',
      'description', 'Description',
      'price', 'pret RRP (retail) lei cu TVA',
      'compareAtPrice', 'pret RRP referinta lei cu TVA',
      'quantity', 'Stock',
      'images', 'imagine principala',
      'additionalImages', 'Gallery Images',
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
      'imageDelimiter', '#',
      'priceDecimalSeparator', '.',
      'defaultCurrency', 'RON',
      'defaultQuantity', 0
    )
  ),
  true,
  NOW(),
  NOW()
FROM feeds cs
WHERE cs.slug = 'smart-baby'
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
WHERE cs.slug = 'smart-baby';
