-- TIER 3: SaaS Scaling Schema
-- Billing, Security, Feature Flags, Docs, Chatbot Training, Revenue Splitting

-- ── MULTI-TENANT BILLING ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled', 'trial')),
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  plan TEXT NOT NULL,
  monthly_price NUMERIC(10,2),
  api_calls_limit INTEGER DEFAULT 1000,
  bookings_limit INTEGER DEFAULT 50,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC(12,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  invoice_number TEXT UNIQUE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  line_items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECURITY & RATE LIMITING ───────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  identifier_type TEXT CHECK (identifier_type IN ('ip', 'tenant', 'api_key', 'user')),
  endpoint TEXT,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  blocked BOOLEAN DEFAULT FALSE,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT CHECK (event_type IN ('rate_limit', 'ddos', 'scraper', 'injection', 'brute_force', 'anomaly', 'blocked')),
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  source_ip TEXT,
  tenant_id UUID,
  endpoint TEXT,
  details JSONB DEFAULT '{}',
  action_taken TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  reason TEXT,
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  auto_blocked BOOLEAN DEFAULT FALSE
);

-- ── FEATURE FLAGS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT FALSE,
  rollout_pct INTEGER DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
  target_audience TEXT DEFAULT 'all',
  kill_switch BOOLEAN DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID REFERENCES feature_flags(id),
  experiment_name TEXT NOT NULL,
  variants JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  winner TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID REFERENCES feature_flags(id),
  experiment_id UUID,
  metric_name TEXT,
  variant TEXT,
  value NUMERIC(12,4),
  sample_size INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── DOCUMENTATION ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type TEXT CHECK (doc_type IN ('api', 'guide', 'changelog', 'help_center', 'faq')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  slug TEXT UNIQUE,
  version TEXT,
  tags TEXT[],
  author TEXT DEFAULT 'ai-agent',
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CHATBOT TRAINING ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT CHECK (source IN ('conversation', 'feedback', 'manual', 'generated')),
  intent TEXT,
  utterance TEXT,
  response TEXT,
  quality_score NUMERIC(3,2),
  verified BOOLEAN DEFAULT FALSE,
  used_in_training BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  training_data_count INTEGER,
  accuracy_score NUMERIC(5,4),
  f1_score NUMERIC(5,4),
  deployed BOOLEAN DEFAULT FALSE,
  deployed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── REVENUE SPLITTING ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID,
  partner_name TEXT,
  period DATE,
  total_bookings INTEGER,
  total_revenue NUMERIC(12,2),
  commission_pct NUMERIC(5,2),
  commission_amount NUMERIC(12,2),
  adjustments NUMERIC(10,2) DEFAULT 0,
  final_payout NUMERIC(12,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'disputed')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revenue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID,
  partner_id UUID,
  safari_type TEXT,
  amount NUMERIC(10,2),
  commission_amount NUMERIC(10,2),
  platform_fee NUMERIC(10,2),
  net_amount NUMERIC(10,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_usage_tenant ON usage_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_date ON usage_records(recorded_at);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_documentation_type ON documentation(doc_type);
CREATE INDEX IF NOT EXISTS idx_training_intent ON training_data(intent);
CREATE INDEX IF NOT EXISTS idx_payouts_partner ON partner_payouts(partner_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON partner_payouts(status);
