-- ============================================
-- El sistema que NO se eligió al registrarse
-- nace BLOQUEADO: el período gratis no corre
-- hasta que el usuario lo habilite.
--
--   * Habilitar → gratis hasta fin del mes en curso
--   * Después de ese mes → hay que pagar
--     ($15.000 ARS / US$10 PayPal)
-- ============================================

-- 1) Negocios existentes: el sistema secundario que todavía
--    no se pagó queda bloqueado y deja de contar el gratis
UPDATE mode_subscriptions
SET status = 'locked',
    trial_started_at = NULL,
    trial_ends_at = NULL,
    updated_at = now()
WHERE is_primary = false
  AND status = 'trial'
  AND subscription_started_at IS NULL;

-- 2) Trigger: el sistema que no se eligió nace bloqueado
CREATE OR REPLACE FUNCTION handle_new_business_mode_subs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text;
  v_other text;
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

  v_other := CASE WHEN v_mode = 'sports' THEN 'general' ELSE 'sports' END;

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

  -- El otro sistema: BLOQUEADO hasta que el usuario lo habilite
  INSERT INTO mode_subscriptions (
    business_id, mode, is_primary, status
  )
  VALUES (
    NEW.id, v_other, false, 'locked'
  )
  ON CONFLICT (business_id, mode) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3) Habilitar desde la app: gratis hasta fin del mes en curso
CREATE OR REPLACE FUNCTION public.enable_mode(p_mode text)
RETURNS SETOF mode_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub mode_subscriptions;
BEGIN
  IF p_mode NOT IN ('general', 'sports') THEN
    RAISE EXCEPTION 'Modo inválido';
  END IF;

  SELECT * INTO v_sub
    FROM mode_subscriptions m
   WHERE m.mode = p_mode
     AND (
       is_business_member(m.business_id)
       OR m.business_id IN (
            SELECT id FROM businesses WHERE owner_id = auth.uid()
          )
     )
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Solo se habilita una vez y gratis: hasta el último
  -- segundo del mes en curso. Si ya se usó y venció,
  -- queda así y hay que pagar.
  IF v_sub.status = 'locked' THEN
    UPDATE mode_subscriptions
       SET status = 'trial',
           trial_started_at = now(),
           trial_ends_at = date_trunc('month', now())
                           + interval '1 month'
                           - interval '1 second',
           updated_at = now()
     WHERE id = v_sub.id
    RETURNING * INTO v_sub;
  END IF;

  RETURN NEXT v_sub;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enable_mode(text) TO authenticated;
