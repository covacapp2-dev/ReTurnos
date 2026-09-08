-- ============================================
-- ReTurnos - Supabase Schema
-- Multi-tenant SaaS Appointment Booking System
-- ============================================

-- ============================================
-- TABLES (first, so functions can reference them)
-- ============================================

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  description text,
  phone text,
  email text,
  address text,
  timezone text DEFAULT 'America/Argentina/Buenos_Aires' NOT NULL,
  currency text DEFAULT 'ARS' NOT NULL,
  business_type text,
  subscription_status text DEFAULT 'trial' NOT NULL CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')),
  trial_started_at timestamptz DEFAULT now(),
  trial_ends_at timestamptz DEFAULT (now() + interval '3 months'),
  subscription_started_at timestamptz,
  subscription_ends_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'staff' NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(business_id, user_id)
);

CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  phone text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  duration_minutes int DEFAULT 60 NOT NULL,
  price decimal(10,2) DEFAULT 0,
  currency text DEFAULT 'ARS',
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  resource_type text DEFAULT 'otro' CHECK (resource_type IN ('cancha', 'consultorio', 'sala', 'sillon', 'otro')),
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  specialty text,
  avatar_url text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE professional_services (
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (professional_id, service_id)
);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text,
  email text,
  phone text,
  dni text,
  notes text,
  birth_date date,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES professionals(id) ON DELETE SET NULL,
  resource_id uuid REFERENCES resources(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  appointment_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  duration_minutes int NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  price decimal(10,2) DEFAULT 0,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  payment_method text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  block_date date NOT NULL,
  start_time time,
  end_time time,
  reason text,
  all_day boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('monthly_ars', 'monthly_usd')),
  amount decimal(10,2) NOT NULL,
  currency text NOT NULL,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'cancelled', 'past_due')),
  payment_provider text CHECK (payment_provider IN ('mercadopago', 'paypal')),
  external_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('booking_confirmed', 'booking_cancelled', 'reminder')),
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'push')),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_business_members_user ON business_members(user_id);
CREATE INDEX idx_business_members_business ON business_members(business_id);
CREATE INDEX idx_branches_business ON branches(business_id);
CREATE INDEX idx_services_business ON services(business_id);
CREATE INDEX idx_services_branch ON services(branch_id);
CREATE INDEX idx_resources_business ON resources(business_id);
CREATE INDEX idx_resources_branch ON resources(branch_id);
CREATE INDEX idx_professionals_business ON professionals(business_id);
CREATE INDEX idx_professionals_branch ON professionals(branch_id);
CREATE INDEX idx_customers_business ON customers(business_id);
CREATE INDEX idx_customers_phone ON customers(business_id, phone);
CREATE INDEX idx_appointments_business ON appointments(business_id);
CREATE INDEX idx_appointments_customer ON appointments(customer_id);
CREATE INDEX idx_appointments_professional ON appointments(professional_id);
CREATE INDEX idx_appointments_resource ON appointments(resource_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_date_professional ON appointments(appointment_date, professional_id);

CREATE UNIQUE INDEX uq_appointments_no_double_book ON appointments (
  business_id, professional_id, appointment_date, start_time
) WHERE professional_id IS NOT NULL AND status NOT IN ('cancelled', 'no_show');

CREATE INDEX idx_availability_business ON availability(business_id);
CREATE INDEX idx_availability_professional ON availability(professional_id);
CREATE INDEX idx_blocked_dates_business ON blocked_dates(business_id);
CREATE INDEX idx_blocked_dates_professional ON blocked_dates(professional_id);
CREATE INDEX idx_blocked_dates_date ON blocked_dates(block_date);
CREATE INDEX idx_subscriptions_business ON subscriptions(business_id);
CREATE INDEX idx_notifications_business ON notifications(business_id);

-- ============================================
-- HELPER FUNCTIONS (after tables exist)
-- ============================================

CREATE OR REPLACE FUNCTION get_user_business_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT business_id FROM business_members WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_business_member(biz_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_members WHERE business_id = biz_id AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION check_availability(
  p_business_id uuid,
  p_professional_id uuid,
  p_resource_id uuid,
  p_appointment_date date,
  p_start_time time,
  p_end_time time,
  p_exclude_appointment_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conflict_count int;
BEGIN
  IF p_professional_id IS NOT NULL THEN
    SELECT count(*) INTO v_conflict_count
    FROM appointments
    WHERE business_id = p_business_id
      AND professional_id = p_professional_id
      AND appointment_date = p_appointment_date
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
      AND appointment_date = p_appointment_date
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

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_resources_updated_at BEFORE UPDATE ON resources FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_professionals_updated_at BEFORE UPDATE ON professionals FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Members can view business" ON businesses FOR SELECT USING (is_business_member(id));
CREATE POLICY "Owner can update business" ON businesses FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can create business" ON businesses FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Members can view members" ON business_members FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "Owner can manage members" ON business_members FOR ALL USING (
  EXISTS (SELECT 1 FROM businesses WHERE id = business_members.business_id AND owner_id = auth.uid())
);

CREATE POLICY "Members can view branches" ON branches FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "Members can manage branches" ON branches FOR ALL USING (is_business_member(business_id));

CREATE POLICY "Members can view services" ON services FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "Members can manage services" ON services FOR ALL USING (is_business_member(business_id));

CREATE POLICY "Members can view resources" ON resources FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "Members can manage resources" ON resources FOR ALL USING (is_business_member(business_id));

CREATE POLICY "Members can view professionals" ON professionals FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "Members can manage professionals" ON professionals FOR ALL USING (is_business_member(business_id));

CREATE POLICY "Members can view prof services" ON professional_services FOR SELECT USING (
  EXISTS (SELECT 1 FROM professionals WHERE id = professional_services.professional_id AND is_business_member(business_id))
);
CREATE POLICY "Members can manage prof services" ON professional_services FOR ALL USING (
  EXISTS (SELECT 1 FROM professionals WHERE id = professional_services.professional_id AND is_business_member(business_id))
);

CREATE POLICY "Members can view customers" ON customers FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "Members can manage customers" ON customers FOR ALL USING (is_business_member(business_id));

CREATE POLICY "Members can view appointments" ON appointments FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "Members can manage appointments" ON appointments FOR ALL USING (is_business_member(business_id));

CREATE POLICY "Members can view availability" ON availability FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "Members can manage availability" ON availability FOR ALL USING (is_business_member(business_id));

CREATE POLICY "Members can view blocked dates" ON blocked_dates FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "Members can manage blocked dates" ON blocked_dates FOR ALL USING (is_business_member(business_id));

CREATE POLICY "Members can view subscriptions" ON subscriptions FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "Owner can manage subscriptions" ON subscriptions FOR ALL USING (
  EXISTS (SELECT 1 FROM businesses WHERE id = subscriptions.business_id AND owner_id = auth.uid())
);

CREATE POLICY "Members can view notifications" ON notifications FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "Members can manage notifications" ON notifications FOR ALL USING (is_business_member(business_id));

-- ============================================
-- PUBLIC ACCESS FOR BOOKING PAGE
-- ============================================

CREATE POLICY "Public can view business by slug" ON businesses FOR SELECT USING (true);
CREATE POLICY "Public can view active services" ON services FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view active professionals" ON professionals FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view prof services link" ON professional_services FOR SELECT USING (true);
CREATE POLICY "Public can view active resources" ON resources FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view availability" ON availability FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view blocked dates" ON blocked_dates FOR SELECT USING (true);
CREATE POLICY "Public can create appointments" ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can create customers" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view customers by phone" ON customers FOR SELECT USING (true);
