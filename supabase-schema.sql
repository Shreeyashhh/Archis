-- ============================================================================
-- PCMC WASHING CENTRE - MINI ERP DATABASE SCHEMA & RLS POLICIES
-- Target: Supabase PostgreSQL
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. AUTHORIZED ADMINS TABLE
-- Links directly to Supabase Auth (auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.authorized_admins (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL DEFAULT 'Administrator',
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'manager')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for admin lookups
CREATE INDEX IF NOT EXISTS idx_authorized_admins_email ON public.authorized_admins(email);

-- Helper function to check if the current user is an authorized admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.authorized_admins
    WHERE id = auth.uid() AND is_active = true
  );
$$;

-- ============================================================================
-- 2. SERVICE CATALOG TABLE
-- Defines standard vehicle categories, services, and base rates
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.service_catalog (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    service_name TEXT NOT NULL,
    default_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (default_rate >= 0),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Service Catalog matching PCMC Washing Centre's actual price list
INSERT INTO public.service_catalog (id, category, service_name, default_rate, sort_order) VALUES
('bike_scooter', 'Bike', 'Commuter / Scooter', 80.00, 1),
('bike_sports', 'Bike', 'Sports / Bullet', 100.00, 2),
('car_water_wash', 'Car', 'Car — Water Wash (Only Body)', 130.00, 3),
('car_only_body', 'Car', 'Car — Body Wash (Foam Wash)', 230.00, 4),
('car_full_wash', 'Car', 'Car — Full Wash', 300.00, 5),
('car_underbody_full', 'Car', 'Car — Underbody + Full Body', 350.00, 6),
('rikshaw_full_wash', 'Rickshaw', 'Rikshaw — Full Wash', 150.00, 7),
('tractor_tempo', 'Tractor', 'Tractor / Tempo Wash', 200.00, 8),
('miscellaneous', 'Miscellaneous', 'Miscellaneous Services', 0.00, 9)
ON CONFLICT (id) DO UPDATE SET
    category = EXCLUDED.category,
    service_name = EXCLUDED.service_name,
    default_rate = EXCLUDED.default_rate,
    sort_order = EXCLUDED.sort_order;

-- ============================================================================
-- 3. DAILY RECORDS TABLE
-- Master record for each operational day
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_date DATE NOT NULL UNIQUE,
    day_of_week TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_records_date ON public.daily_records(record_date DESC);

-- ============================================================================
-- 4. DAILY INCOME ENTRIES TABLE
-- Stores daily breakdown for each service category matching the Excel structure
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_income_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_date DATE NOT NULL REFERENCES public.daily_records(record_date) ON DELETE CASCADE,
    service_key TEXT NOT NULL REFERENCES public.service_catalog(id) ON UPDATE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0),
    payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'UPI', 'Card', 'Pending', 'Other')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_daily_income_date_service UNIQUE (record_date, service_key)
);

CREATE INDEX IF NOT EXISTS idx_daily_income_date ON public.daily_income_entries(record_date);
CREATE INDEX IF NOT EXISTS idx_daily_income_service ON public.daily_income_entries(service_key);

-- ============================================================================
-- 5. EXPENSE TRANSACTIONS TABLE
-- Operating expenses (Electricity, Water, Cleaning supplies, Wages, Maintenance, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.expense_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_date DATE NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other')),
    receipt_no TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expense_transactions(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expense_transactions(category);

-- ============================================================================
-- 6. CAPITAL & INVESTMENT TRANSACTIONS TABLE
-- Strictly separates Owner Capital & Asset/Equipment purchases from Operating Expenses
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.capital_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_date DATE NOT NULL,
    investment_type TEXT NOT NULL CHECK (investment_type IN (
        'Owner Capital',
        'Equipment / Machinery',
        'Infrastructure & Civil',
        'Business Loan / Debt',
        'Other Investment'
    )),
    purpose TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'Bank Transfer' CHECK (payment_method IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capital_date ON public.capital_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_capital_type ON public.capital_transactions(investment_type);

-- ============================================================================
-- 7. PICKUP & DROP ORDERS TABLE
-- Customer booking requests originating from the public website
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pickup_drop_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_mobile TEXT NOT NULL,
    customer_whatsapp TEXT,
    vehicle_category TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    vehicle_model TEXT,
    vehicle_reg_number TEXT,
    service_name TEXT NOT NULL,
    service_price NUMERIC(12,2) DEFAULT 0.00,
    pickup_address TEXT NOT NULL,
    pickup_landmark TEXT NOT NULL,
    pickup_maps_link TEXT,
    drop_address TEXT NOT NULL,
    pickup_date DATE NOT NULL,
    pickup_time_slot TEXT NOT NULL,
    customer_notes TEXT,
    order_status TEXT NOT NULL DEFAULT 'New' CHECK (order_status IN (
        'New',
        'Confirmed',
        'Picked Up',
        'Washing',
        'Ready',
        'Delivered',
        'Completed',
        'Cancelled'
    )),
    payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Partially Paid', 'Paid')),
    final_amount NUMERIC(12,2) DEFAULT 0.00,
    payment_method TEXT CHECK (payment_method IN ('Cash', 'UPI', 'Card', 'Pending', 'Other', NULL)),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_booking_id ON public.pickup_drop_orders(booking_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.pickup_drop_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.pickup_drop_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_date ON public.pickup_drop_orders(pickup_date);

-- ============================================================================
-- 8. IMPORT HISTORY TABLE
-- Audit log of all spreadsheet imports (.xlsx / .csv)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.import_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT,
    import_type TEXT NOT NULL DEFAULT 'Daily Records',
    records_imported INTEGER NOT NULL DEFAULT 0,
    records_failed INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Success' CHECK (status IN ('Success', 'Partial', 'Failed')),
    summary JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 9. SYSTEM SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.system_settings (key, value) VALUES
('business_info', '{"name": "PCMC Washing Centre", "location": "Ravet, PCMC, Pune", "phone": "+919594054099", "currency": "INR", "currency_symbol": "₹"}'::jsonb),
('accounting_rules', '{"include_orders_in_income_when": "completed_and_paid", "auto_calculate_day_profit": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.authorized_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_income_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capital_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_drop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Policies for authorized_admins
-- ----------------------------------------------------------------------------
CREATE POLICY "Admins can view admins table"
    ON public.authorized_admins FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admins can update their own profile"
    ON public.authorized_admins FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- Policies for service_catalog
-- Public can read active catalog (for booking forms), Admin has full CRUD
-- ----------------------------------------------------------------------------
CREATE POLICY "Public can view active services"
    ON public.service_catalog FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins have full access to service_catalog"
    ON public.service_catalog FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- Policies for daily_records
-- Only authorized admins can read, insert, update, delete
-- ----------------------------------------------------------------------------
CREATE POLICY "Admins full access to daily_records"
    ON public.daily_records FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- Policies for daily_income_entries
-- Only authorized admins can read, insert, update, delete
-- ----------------------------------------------------------------------------
CREATE POLICY "Admins full access to daily_income_entries"
    ON public.daily_income_entries FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- Policies for expense_transactions
-- Only authorized admins can read, insert, update, delete
-- ----------------------------------------------------------------------------
CREATE POLICY "Admins full access to expense_transactions"
    ON public.expense_transactions FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- Policies for capital_transactions
-- Only authorized admins can read, insert, update, delete
-- ----------------------------------------------------------------------------
CREATE POLICY "Admins full access to capital_transactions"
    ON public.capital_transactions FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- Policies for pickup_drop_orders
-- CRITICAL SECURITY RULE:
-- 1. Anyone (anon public visitor) can INSERT a new order
-- 2. Nobody public can SELECT, UPDATE, or DELETE any orders
-- 3. Only authenticated admins can SELECT, UPDATE, or DELETE
-- ----------------------------------------------------------------------------
CREATE POLICY "Public visitors can create pickup orders"
    ON public.pickup_drop_orders FOR INSERT
    WITH CHECK (
        order_status = 'New' AND
        payment_status = 'Unpaid' AND
        booking_id IS NOT NULL AND
        customer_name IS NOT NULL AND
        customer_mobile IS NOT NULL
    );

CREATE POLICY "Admins can view and manage all orders"
    ON public.pickup_drop_orders FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- Policies for import_history & system_settings
-- Only authorized admins
-- ----------------------------------------------------------------------------
CREATE POLICY "Admins full access to import_history"
    ON public.import_history FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins full access to system_settings"
    ON public.system_settings FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Public can view business info setting"
    ON public.system_settings FOR SELECT
    USING (key = 'business_info');

-- ============================================================================
-- 11. AUTOMATIC UPDATED_AT TIMESTAMP TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_daily_records_updated_at ON public.daily_records;
CREATE TRIGGER trigger_daily_records_updated_at
    BEFORE UPDATE ON public.daily_records
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_daily_income_updated_at ON public.daily_income_entries;
CREATE TRIGGER trigger_daily_income_updated_at
    BEFORE UPDATE ON public.daily_income_entries
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_expenses_updated_at ON public.expense_transactions;
CREATE TRIGGER trigger_expenses_updated_at
    BEFORE UPDATE ON public.expense_transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_capital_updated_at ON public.capital_transactions;
CREATE TRIGGER trigger_capital_updated_at
    BEFORE UPDATE ON public.capital_transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON public.pickup_drop_orders;
CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON public.pickup_drop_orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 12. HELPER PROCEDURE TO AUTHORIZE INITIAL ADMIN
-- Run this in Supabase SQL editor after creating your user in Supabase Auth
-- Example: SELECT public.register_initial_admin('owner@pcmcwashingcentre.com', 'Business Owner');
-- ============================================================================
CREATE OR REPLACE FUNCTION public.register_initial_admin(admin_email TEXT, admin_name TEXT DEFAULT 'Administrator')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id FROM auth.users WHERE email = admin_email;
    
    IF target_user_id IS NULL THEN
        RETURN 'Error: User with email ' || admin_email || ' does not exist in auth.users. Please create user in Authentication -> Users first.';
    END IF;

    INSERT INTO public.authorized_admins (id, email, full_name, role, is_active)
    VALUES (target_user_id, admin_email, admin_name, 'admin', true)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        is_active = true,
        updated_at = now();

    RETURN 'Success: ' || admin_email || ' has been authorized as administrator.';
END;
$$;
