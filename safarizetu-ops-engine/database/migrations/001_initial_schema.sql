-- Safari Zetu Ops Engine — Initial Schema
-- Run automatically by PostgreSQL on first startup

-- ── EXTENSIONS ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── ENQUIRY LOG ───────────────────────────────────────────────
-- Mirrors Safari Zetu enquiries for AI processing
CREATE TABLE IF NOT EXISTS enquiry_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    safari_zetu_enquiry_id TEXT UNIQUE NOT NULL,
    tourist_name TEXT,
    tourist_email TEXT NOT NULL,
    tourist_country TEXT,
    operator_id TEXT,
    operator_name TEXT,
    destination TEXT,
    travel_dates TEXT,
    group_size INTEGER,
    budget_range TEXT,
    special_requests TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new','acknowledged','operator_notified','operator_responded','completed','cancelled')),
    acknowledgement_sent_at TIMESTAMPTZ,
    operator_notified_at TIMESTAMPTZ,
    operator_responded_at TIMESTAMPTZ,
    review_requested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_enquiry_status ON enquiry_log(status);
CREATE INDEX idx_enquiry_operator ON enquiry_log(operator_id);
CREATE INDEX idx_enquiry_created ON enquiry_log(created_at DESC);

-- ── OPERATOR ACTIVATION QUEUE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS operator_activation_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    safari_zetu_operator_id TEXT UNIQUE NOT NULL,
    operator_name TEXT NOT NULL,
    operator_email TEXT NOT NULL,
    operator_type TEXT,
    destination TEXT,
    listing_completion_score INTEGER DEFAULT 0,
    activation_stage TEXT DEFAULT 'pending' CHECK (activation_stage IN ('pending','day1_sent','day3_sent','day7_sent','activated','unresponsive')),
    day1_sent_at TIMESTAMPTZ,
    day3_sent_at TIMESTAMPTZ,
    day7_sent_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_operator_stage ON operator_activation_queue(activation_stage);

-- ── LEAD PIPELINE ─────────────────────────────────────────────
-- Travel agents, bloggers, corporates, media
CREATE TABLE IF NOT EXISTS lead_pipeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT,
    contact_name TEXT NOT NULL,
    contact_email TEXT,
    contact_linkedin TEXT,
    lead_type TEXT NOT NULL CHECK (lead_type IN ('travel_agent','blogger','corporate','media','influencer','other')),
    country TEXT,
    specialisation TEXT,
    audience_size INTEGER,
    source TEXT,
    research_summary TEXT,
    personalisation_notes TEXT,
    status TEXT DEFAULT 'identified' CHECK (status IN ('identified','researched','outreach_drafted','outreach_sent','replied','meeting_scheduled','converted','not_interested','dormant')),
    first_contact_at TIMESTAMPTZ,
    last_contact_at TIMESTAMPTZ,
    reply_received_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_lead_status ON lead_pipeline(status);
CREATE INDEX idx_lead_type ON lead_pipeline(lead_type);

-- ── PARTNERSHIP PIPELINE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS partnership_pipeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT NOT NULL,
    company_type TEXT NOT NULL CHECK (company_type IN ('airline','hotel','insurance','visa','media','embassy','corporate','other')),
    contact_name TEXT,
    contact_email TEXT,
    contact_role TEXT,
    contact_linkedin TEXT,
    country TEXT,
    partnership_value_proposition TEXT,
    status TEXT DEFAULT 'identified' CHECK (status IN ('identified','researched','brief_prepared','outreach_sent','replied','meeting_scheduled','proposal_sent','negotiating','signed','declined','dormant')),
    research_brief TEXT,
    proposal_document_url TEXT,
    mou_document_url TEXT,
    first_contact_at TIMESTAMPTZ,
    last_contact_at TIMESTAMPTZ,
    meeting_date TIMESTAMPTZ,
    signed_at TIMESTAMPTZ,
    estimated_monthly_value_usd INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_partnership_status ON partnership_pipeline(status);
CREATE INDEX idx_partnership_type ON partnership_pipeline(company_type);

-- ── OUTREACH LOG ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outreach_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('lead','partner','operator','tourist')),
    entity_id UUID NOT NULL,
    email_to TEXT NOT NULL,
    email_subject TEXT NOT NULL,
    email_body TEXT NOT NULL,
    email_type TEXT NOT NULL,
    resend_message_id TEXT,
    status TEXT DEFAULT 'drafted' CHECK (status IN ('drafted','pending_approval','approved','sent','delivered','opened','replied','bounced','failed')),
    drafted_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    agent_name TEXT,
    tokens_used INTEGER,
    model_used TEXT,
    cost_usd NUMERIC(10,6),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_outreach_entity ON outreach_log(entity_type, entity_id);
CREATE INDEX idx_outreach_status ON outreach_log(status);

-- ── CONTENT QUEUE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type TEXT NOT NULL CHECK (content_type IN ('blog_article','instagram_caption','linkedin_post','x_thread','operator_spotlight','destination_guide')),
    title TEXT,
    topic TEXT NOT NULL,
    keywords TEXT[],
    target_destination TEXT,
    draft_content TEXT,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued','generating','draft_ready','pending_approval','approved','published','rejected')),
    generated_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    published_url TEXT,
    word_count INTEGER,
    tokens_used INTEGER,
    model_used TEXT,
    cost_usd NUMERIC(10,6),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_content_status ON content_queue(status);
CREATE INDEX idx_content_type ON content_queue(content_type);

-- ── AGENT RUN LOG ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_run_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name TEXT NOT NULL,
    division TEXT NOT NULL CHECK (division IN ('growth','operator_relations','partnership','tourist_experience','intelligence')),
    trigger_type TEXT NOT NULL,
    trigger_payload JSONB,
    status TEXT DEFAULT 'running' CHECK (status IN ('running','success','failed','partial')),
    result_summary TEXT,
    error_message TEXT,
    tokens_used INTEGER,
    model_used TEXT,
    cost_usd NUMERIC(10,6),
    duration_ms INTEGER,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX idx_agent_run_agent ON agent_run_log(agent_name);
CREATE INDEX idx_agent_run_status ON agent_run_log(status);
CREATE INDEX idx_agent_run_started ON agent_run_log(started_at DESC);

-- ── WEEKLY METRICS SNAPSHOT ───────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    week_start DATE NOT NULL UNIQUE,
    total_enquiries INTEGER DEFAULT 0,
    new_enquiries INTEGER DEFAULT 0,
    operator_response_rate NUMERIC(5,2),
    new_operators_activated INTEGER DEFAULT 0,
    leads_identified INTEGER DEFAULT 0,
    leads_outreach_sent INTEGER DEFAULT 0,
    leads_replied INTEGER DEFAULT 0,
    partnerships_progressed INTEGER DEFAULT 0,
    content_pieces_published INTEGER DEFAULT 0,
    total_agent_cost_usd NUMERIC(10,4) DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── APPROVAL QUEUE ────────────────────────────────────────────
-- Everything AI drafts that needs founder review before sending
CREATE TABLE IF NOT EXISTS approval_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_type TEXT NOT NULL CHECK (item_type IN ('outreach_email','partnership_email','content','proposal','report')),
    reference_id UUID,
    title TEXT NOT NULL,
    preview TEXT,
    full_content TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent','high','normal','low')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','edited_and_approved')),
    reviewed_at TIMESTAMPTZ,
    reviewer_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_approval_status ON approval_queue(status);
CREATE INDEX idx_approval_priority ON approval_queue(priority, created_at DESC);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_enquiry_log_updated_at BEFORE UPDATE ON enquiry_log FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_operator_activation_updated_at BEFORE UPDATE ON operator_activation_queue FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_lead_pipeline_updated_at BEFORE UPDATE ON lead_pipeline FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_partnership_pipeline_updated_at BEFORE UPDATE ON partnership_pipeline FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_content_queue_updated_at BEFORE UPDATE ON content_queue FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_approval_queue_updated_at BEFORE UPDATE ON approval_queue FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ── SEED DATA — FASTJET PARTNERSHIP ───────────────────────────
INSERT INTO partnership_pipeline (company_name, company_type, country, partnership_value_proposition, status)
VALUES (
    'FastJet',
    'airline',
    'Zimbabwe',
    'Co-marketing integration: Safari Zetu featured on FastJet booking confirmation emails to ZW-bound passengers. FastJet flight search widget embedded on Safari Zetu destination pages. Mutual referral traffic and tourist journey completion.',
    'identified'
) ON CONFLICT DO NOTHING;

INSERT INTO partnership_pipeline (company_name, company_type, country, partnership_value_proposition, status)
VALUES (
    'Air Zimbabwe',
    'airline',
    'Zimbabwe',
    'National carrier partnership: official safari marketplace endorsement, co-marketing on Air Zimbabwe channels, potential bundled safari+flight packages for international tourists.',
    'identified'
) ON CONFLICT DO NOTHING;
