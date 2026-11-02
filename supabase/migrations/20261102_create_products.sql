-- ============================================
-- ReTurnos - Migración: tabla de productos
-- Fecha: 2026-11-02
-- Ejecutar en: Supabase SQL Editor
--
-- Productos que vende el comercio: nombre, costo,
-- precio y código de barras (lecturable con lector
-- o con la cámara del celular).
-- ============================================

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  cost numeric(12,2) DEFAULT 0,
  price numeric(12,2) DEFAULT 0,
  barcode text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(business_id, name);

-- Un mismo código de barras no se repite dentro del negocio
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_business_barcode
  ON products(business_id, barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view products" ON products;
CREATE POLICY "Members can view products" ON products
  FOR SELECT USING (is_business_member(business_id));

DROP POLICY IF EXISTS "Members can manage products" ON products;
CREATE POLICY "Members can manage products" ON products
  FOR ALL USING (is_business_member(business_id));

DROP TRIGGER IF EXISTS set_products_updated_at ON products;
CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
