-- ============================================
-- ReTurnos - Migración: tabla de ventas
-- Fecha: 2026-11-02
-- Ejecutar en: Supabase SQL Editor
--
-- Ventas simples del comercio: se guardan los
-- productos vendidos, cantidades y total.
-- ============================================

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sales_business ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view sales" ON sales;
CREATE POLICY "Members can view sales" ON sales
  FOR SELECT USING (is_business_member(business_id));

DROP POLICY IF EXISTS "Members can manage sales" ON sales;
CREATE POLICY "Members can manage sales" ON sales
  FOR ALL USING (is_business_member(business_id));

-- sale_items no tiene business_id: se controla por la venta a la que pertenece
DROP POLICY IF EXISTS "Members can view sale_items" ON sale_items;
CREATE POLICY "Members can view sale_items" ON sale_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_id AND is_business_member(s.business_id)
    )
  );

DROP POLICY IF EXISTS "Members can manage sale_items" ON sale_items;
CREATE POLICY "Members can manage sale_items" ON sale_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_id AND is_business_member(s.business_id)
    )
  );

DROP TRIGGER IF EXISTS set_sales_updated_at ON sales;
CREATE TRIGGER set_sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
