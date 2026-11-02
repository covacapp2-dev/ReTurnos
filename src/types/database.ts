// ============================================================
// Database Types - Matching Supabase Schema
// ============================================================

// --- Enums / Union Types ---

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'refunded'
  | 'partial'
  | 'cancelled';

export type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired';

export type PaymentProvider =
  | 'stripe'
  | 'mercadopago'
  | 'cash'
  | 'other';

export type ResourceType =
  | 'room'
  | 'equipment'
  | 'vehicle'
  | 'table'
  | 'other';

export type NotificationType =
  | 'appointment_reminder'
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'appointment_created'
  | 'payment_received'
  | 'subscription_expiring'
  | 'general';

export type NotificationChannel =
  | 'email'
  | 'sms'
  | 'push'
  | 'whatsapp';

// --- Core Interfaces ---

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  business_type: string | null;
  subscription_status: SubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessMember {
  id: string;
  business_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'staff';
  created_at: string;
}

export interface Branch {
  id: string;
  business_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  business_id: string;
  branch_id: string | null;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  currency: string;
  color: string | null;
  is_active: boolean;
  allows_online_booking: boolean;
  max_advance_days: number | null;
  min_advance_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface Resource {
  id: string;
  business_id: string;
  branch_id: string | null;
  name: string;
  type: ResourceType;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Professional {
  id: string;
  business_id: string;
  branch_id: string | null;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalService {
  id: string;
  professional_id: string;
  service_id: string;
  custom_price: number | null;
  custom_duration_minutes: number | null;
  created_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  total_appointments: number;
  last_appointment_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  business_id: string;
  branch_id: string | null;
  customer_id: string;
  professional_id: string;
  service_id: string;
  resource_id: string | null;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  payment_status: PaymentStatus;
  payment_amount: number | null;
  payment_provider: PaymentProvider | null;
  notes: string | null;
  internal_notes: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Availability {
  id: string;
  professional_id: string;
  day_of_week: number; // 0-6 (Sunday-Saturday)
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BlockedDate {
  id: string;
  professional_id: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  business_id: string;
  plan_name: string;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  cancelled_at: string | null;
  payment_provider: PaymentProvider | null;
  external_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  business_id: string;
  user_id: string | null;
  customer_id: string | null;
  appointment_id: string | null;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  cost: number | null;
  price: number | null;
  barcode: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  business_id: string;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
}
