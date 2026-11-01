-- ============================================
-- ReTurnos - Migración: alinear esquema DB con la app
-- Fecha: 2026-11-01
-- Ejecutar en: Supabase SQL Editor
--
-- Motivo: la app envía columnas que no existen en la BD
-- (full_name, payment_amount, type, bio, etc.) por lo que
-- todos los INSERT fallaban y el error se tragaba en silencio.
--
-- NOTA: todas las tablas afectadas están vacías (0 filas),
-- por eso se pueden dropear/recrear columnas sin migrar datos.
-- ============================================

-- ============================================
-- 1) CUSTOMERS: app usa full_name + estadísticas
-- ============================================
ALTER TABLE customers RENAME COLUMN first_name TO full_name;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_appointments int NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_appointment_at timestamp;

-- ============================================
-- 2) PROFESSIONALS: app usa full_name, email, phone, bio
-- ============================================
ALTER TABLE professionals RENAME COLUMN name TO full_name;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS bio text;

-- ============================================
-- 3) SERVICES: columnas del formulario de servicios
-- ============================================
ALTER TABLE services ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS allows_online_booking boolean NOT NULL DEFAULT true;
ALTER TABLE services ADD COLUMN IF NOT EXISTS max_advance_days int;
ALTER TABLE services ADD COLUMN IF NOT EXISTS min_advance_minutes int;

-- ============================================
-- 4) BRANCHES: email
-- ============================================
ALTER TABLE branches ADD COLUMN IF NOT EXISTS email text;

-- ============================================
-- 5) RESOURCES: app usa "type" con valores room/equipment/...
-- ============================================
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.resources'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%resource_type%'
  LOOP
    EXECUTE format('ALTER TABLE resources DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE resources RENAME COLUMN resource_type TO type;
ALTER TABLE resources ALTER COLUMN type SET DEFAULT 'other';
ALTER TABLE resources ADD CONSTRAINT resources_type_check
  CHECK (type IN ('room', 'equipment', 'vehicle', 'table', 'other'));

-- ============================================
-- 6) PROFESSIONAL_SERVICES: id, precios personalizados
-- ============================================
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.professional_services'::regclass
      AND contype IN ('p', 'u')
  LOOP
    EXECUTE format('ALTER TABLE professional_services DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE professional_services ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE professional_services ADD PRIMARY KEY (id);
ALTER TABLE professional_services ADD COLUMN IF NOT EXISTS custom_price numeric;
ALTER TABLE professional_services ADD COLUMN IF NOT EXISTS custom_duration_minutes int;
ALTER TABLE professional_services ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE professional_services ADD CONSTRAINT uq_professional_service UNIQUE (professional_id, service_id);

-- ============================================
-- 7) AVAILABILITY: updated_at + business_id automático
-- ============================================
ALTER TABLE availability ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ============================================
-- 8) BLOCKED_DATES: timestamps completos + recurrencia
--    (tabla vacía: se dropean y recrean las columnas)
-- ============================================
DROP INDEX IF EXISTS idx_blocked_dates_date;
ALTER TABLE blocked_dates DROP COLUMN IF EXISTS block_date;
ALTER TABLE blocked_dates DROP COLUMN IF EXISTS start_time;
ALTER TABLE blocked_dates DROP COLUMN IF EXISTS end_time;
ALTER TABLE blocked_dates ADD COLUMN start_time timestamp;
ALTER TABLE blocked_dates ADD COLUMN end_time timestamp;
ALTER TABLE blocked_dates ADD COLUMN block_date date
  GENERATED ALWAYS AS (start_time::date) STORED;
ALTER TABLE blocked_dates ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false;
ALTER TABLE blocked_dates ADD COLUMN IF NOT EXISTS recurrence_rule text;
CREATE INDEX IF NOT EXISTS idx_blocked_dates_date ON blocked_dates(block_date);

-- ============================================
-- 9) APPOINTMENTS: start/end como timestamp completo,
--    payment_amount y estados de la app
--    (tabla vacía: se dropean y recrean las columnas)
-- ============================================
DROP INDEX IF EXISTS uq_appointments_no_double_book;
DROP INDEX IF EXISTS idx_appointments_date;
DROP INDEX IF EXISTS idx_appointments_date_professional;

ALTER TABLE appointments DROP COLUMN IF EXISTS appointment_date;
ALTER TABLE appointments DROP COLUMN IF EXISTS duration_minutes;
ALTER TABLE appointments DROP COLUMN IF EXISTS start_time;
ALTER TABLE appointments DROP COLUMN IF EXISTS end_time;
ALTER TABLE appointments ADD COLUMN start_time timestamp;
ALTER TABLE appointments ADD COLUMN end_time timestamp;
ALTER TABLE appointments ADD COLUMN duration_minutes int;
ALTER TABLE appointments ADD COLUMN appointment_date date
  GENERATED ALWAYS AS (start_time::date) STORED;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_amount numeric;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_provider text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS internal_notes text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at timestamp;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at timestamp;

-- Reemplaza los CHECK de status (nombres dinámicos por si difieren)
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND contype = 'c'
      AND (conname ILIKE '%status%')
  LOOP
    EXECUTE format('ALTER TABLE appointments DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'));
ALTER TABLE appointments ADD CONSTRAINT appointments_payment_status_check
  CHECK (payment_status IN ('pending', 'paid', 'refunded', 'partial', 'cancelled'));

CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_date_professional ON appointments(appointment_date, professional_id);

-- Reintenta evitar doble reserva a nivel DB
CREATE UNIQUE INDEX uq_appointments_no_double_book ON appointments (
  business_id, professional_id, appointment_date, start_time
) WHERE professional_id IS NOT NULL AND status NOT IN ('cancelled', 'no_show');

-- ============================================
-- 10) Función check_availability con timestamps
-- ============================================
DROP FUNCTION IF EXISTS check_availability(uuid, uuid, uuid, date, time, time, uuid);
DROP FUNCTION IF EXISTS check_availability(uuid, uuid, uuid, timestamp, timestamp, uuid);

CREATE OR REPLACE FUNCTION check_availability(
  p_business_id uuid,
  p_professional_id uuid,
  p_resource_id uuid,
  p_start_time timestamp,
  p_end_time timestamp,
  p_exclude_appointment_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflict_count int;
BEGIN
  IF p_professional_id IS NOT NULL THEN
    SELECT count(*) INTO v_conflict_count
    FROM appointments
    WHERE business_id = p_business_id
      AND professional_id = p_professional_id
      AND status NOT IN ('cancelled', 'no_show')
      AND start_time < p_end_time
      AND end_time > p_start_time
      AND (p_exclude_appointment_id IS NULL OR id != p_exclude_appointment_id);
    IF v_conflict_count > 0 THEN
      RETURN jsonb_build_object('available', false, 'reason', 'El profesional ya tiene un turno en este horario');
    END IF;
  END IF;
  IF p_resource_id IS NOT NULL THEN
    SELECT count(*) INTO v_conflict_count
    FROM appointments
    WHERE business_id = p_business_id
      AND resource_id = p_resource_id
      AND status NOT IN ('cancelled', 'no_show')
      AND start_time < p_end_time
      AND end_time > p_start_time
      AND (p_exclude_appointment_id IS NULL OR id != p_exclude_appointment_id);
    IF v_conflict_count > 0 THEN
      RETURN jsonb_build_object('available', false, 'reason', 'El recurso ya esta reservado en este horario');
    END IF;
  END IF;
  RETURN jsonb_build_object('available', true);
END;
$$;

-- ============================================
-- 11) Trigger: business_id automático en availability
--     y blocked_dates (la app no lo envía)
-- ============================================
CREATE OR REPLACE FUNCTION set_business_from_professional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.business_id IS NULL AND NEW.professional_id IS NOT NULL THEN
    SELECT business_id INTO NEW.business_id
    FROM professionals
    WHERE id = NEW.professional_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_availability_business ON availability;
CREATE TRIGGER trg_availability_business
  BEFORE INSERT OR UPDATE ON availability
  FOR EACH ROW EXECUTE FUNCTION set_business_from_professional();

DROP TRIGGER IF EXISTS trg_blocked_dates_business ON blocked_dates;
CREATE TRIGGER trg_blocked_dates_business
  BEFORE INSERT OR UPDATE ON blocked_dates
  FOR EACH ROW EXECUTE FUNCTION set_business_from_professional();

-- ============================================
-- 12) Trigger: estadísticas del cliente
-- ============================================
CREATE OR REPLACE FUNCTION refresh_customer_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
  IF v_customer_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE customers
  SET
    total_appointments = (
      SELECT count(*) FROM appointments
      WHERE customer_id = v_customer_id
        AND status NOT IN ('cancelled', 'no_show')
    ),
    last_appointment_at = (
      SELECT max(start_time) FROM appointments
      WHERE customer_id = v_customer_id
        AND status NOT IN ('cancelled', 'no_show')
    )
  WHERE id = v_customer_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_customer_stats ON appointments;
CREATE TRIGGER trg_refresh_customer_stats
  AFTER INSERT OR UPDATE OR DELETE ON appointments
  FOR EACH ROW EXECUTE FUNCTION refresh_customer_stats();
