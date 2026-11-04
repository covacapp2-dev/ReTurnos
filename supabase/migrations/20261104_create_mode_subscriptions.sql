-- ============================================
-- Suscripciones independientes por sistema
--
--   * El sistema elegido al registrarse → 3 meses gratis
--   (fila "primaria", hereda los datos de businesses)
--
--   * El otro sistema → gratis hasta fin del mes en curso
--     y después se bloquea (hay que pagar otra suscripción)
--
-- Cada fila se paga por separado: si el usuario usa los dos,
-- paga dos suscripciones.
-- ============================================

CREATE TABLE IF NOT EXISTS mode_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('general', 'sports')),
  is_primary boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'locked'
    CHECK (status IN ('locked', 'trial', 'active', 'past_due', 'cancelled', 'expired')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  subscription_started_at timestamptz,
  subscription_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, mode)
);

CREATE INDEX IF NOT EXISTS idx_mode_subscriptions_business
  ON mode_subscriptions(business_id);

ALTER TABLE mode_subscriptions ENABLE ROW LEVEL SECURITY;

-- Los socios del negocio pueden VER sus suscripciones.
-- Nadie puede escribir desde el navegador: se cambian solo
-- desde las Edge Functions (service role).
DROP POLICY IF EXISTS "Members can view mode subscriptions" ON mode_subscriptions;
CREATE POLICY "Members can view mode subscriptions" ON mode_subscriptions
  FOR SELECT USING (is_business_member(business_id));

-- ============================================
-- Al crear un negocio se generan las dos filas
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_business_mode_subs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text;
  v_other text;
  v_free_until timestamptz;
BEGIN
  -- Modo elegido al registrarse (si no, general)
  SELECT CASE
           WHEN u.raw_user_meta_data->>'booking_mode' IN ('general', 'sports')
             THEN u.raw_user_meta_data->>'booking_mode'
           ELSE 'general'
         END
    INTO v_mode
    FROM auth.users u
   WHERE u.id = NEW.owner_id;

  IF v_mode IS NULL THEN
    v_mode := 'general';
  END IF;

  v_other      := CASE WHEN v_mode = 'sports' THEN 'general' ELSE 'sports' END;
  v_free_until := date_trunc('month', now()) + interval '1 month' - interval '1 second';

  -- Sistema elegido: hereda la prueba de 3 meses
  INSERT INTO mode_subscriptions (
    business_id, mode, is_primary, status,
    trial_started_at, trial_ends_at,
    subscription_started_at, subscription_ends_at
  )
  VALUES (
    NEW.id, v_mode, true, NEW.subscription_status,
    NEW.trial_started_at, NEW.trial_ends_at,
    NEW.subscription_started_at, NEW.subscription_ends_at
  )
  ON CONFLICT (business_id, mode) DO NOTHING;

  -- El otro sistema: gratis hasta fin del mes en curso
  INSERT INTO mode_subscriptions (
    business_id, mode, is_primary, status, trial_started_at, trial_ends_at
  )
  VALUES (
    NEW.id, v_other, false, 'trial', now(), v_free_until
  )
  ON CONFLICT (business_id, mode) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_business_mode_subs ON businesses;
CREATE TRIGGER trg_new_business_mode_subs
  AFTER INSERT ON businesses
  FOR EACH ROW EXECUTE FUNCTION handle_new_business_mode_subs();

-- ============================================
-- Completar los negocios que ya existen
-- ============================================

-- 1) Sistema elegido al registrarse (hereda lo que ya tenía)
INSERT INTO mode_subscriptions (
  business_id, mode, is_primary, status,
  trial_started_at, trial_ends_at,
  subscription_started_at, subscription_ends_at
)
SELECT
  b.id,
  CASE WHEN u.raw_user_meta_data->>'booking_mode' IN ('general', 'sports')
       THEN u.raw_user_meta_data->>'booking_mode'
       ELSE 'general' END,
  true,
  b.subscription_status,
  b.trial_started_at,
  b.trial_ends_at,
  b.subscription_started_at,
  b.subscription_ends_at
FROM businesses b
JOIN auth.users u ON u.id = b.owner_id
ON CONFLICT (business_id, mode) DO NOTHING;

-- 2) El otro sistema: gratis hasta fin del mes en curso
INSERT INTO mode_subscriptions (
  business_id, mode, is_primary, status, trial_started_at, trial_ends_at
)
SELECT
  b.id,
  CASE WHEN CASE WHEN u.raw_user_meta_data->>'booking_mode' IN ('general', 'sports')
                 THEN u.raw_user_meta_data->>'booking_mode'
                 ELSE 'general' END = 'sports'
       THEN 'general' ELSE 'sports' END,
  false,
  'trial',
  now(),
  date_trunc('month', now()) + interval '1 month' - interval '1 second'
FROM businesses b
JOIN auth.users u ON u.id = b.owner_id
ON CONFLICT (business_id, mode) DO NOTHING;
