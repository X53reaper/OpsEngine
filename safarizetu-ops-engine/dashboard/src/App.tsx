import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Header } from './components/layout/Header'
import { MetricCard } from './components/ui/MetricCard'
import { Card, CardHeader, CardTitle } from './components/ui/Card'
import { Badge, StatusDot } from './components/ui/Badge'
import { ApprovalQueue } from './components/panels/ApprovalQueue'
import { AgentCosts } from './components/panels/AgentCosts'
import { Pipeline } from './components/panels/Pipeline'
import { useMetrics, useHealth, useApprovalQueue, useSkills } from './hooks/useApi'
import {
  Users, UserCheck, Handshake, FileCheck, Brain,
  Activity, Boxes, Workflow, Globe
} from 'lucide-react'
import './styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchInterval: 30000, retry: 1 } },
})

function Dashboard() {
  const { data: health } = useHealth()
  const { data: metrics } = useMetrics()
  const { data: approvalData, approve, reject, approveAll } = useApprovalQueue()
  const { data: skillsData } = useSkills()

  const langfuseConnected = health?.langfuse === 'connected'
  const healthy = health?.status === 'ok'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header healthy={healthy} langfuseConnected={langfuseConnected} />

      <main style={{
        flex: 1,
        padding: 'var(--space-8)',
        maxWidth: 1440,
        width: '100%',
        margin: '0 auto',
      }}>
        {/* ── Top Metrics ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-8)',
        }}>
          <MetricCard
            label="Enquiries This Week"
            value={metrics?.enquiries_this_week || 0}
            delta={metrics?.enquiry_delta}
            icon={<Users size={16} />}
          />
          <MetricCard
            label="Response Rate"
            value={`${metrics?.response_rate || 0}%`}
            icon={<Activity size={16} />}
            color={metrics?.response_rate > 80 ? 'var(--accent)' : 'var(--danger)'}
          />
          <MetricCard
            label="Operators Active"
            value={metrics?.operators_activated || 0}
            icon={<UserCheck size={16} />}
            color="var(--gold)"
          />
          <MetricCard
            label="Leads in Pipeline"
            value={metrics?.total_leads || 0}
            icon={<Handshake size={16} />}
          />
          <MetricCard
            label="Pending Approvals"
            value={metrics?.pending_approvals || 0}
            icon={<FileCheck size={16} />}
            color={metrics?.pending_approvals > 0 ? 'var(--gold)' : 'var(--accent)'}
          />
          <MetricCard
            label="Skills Loaded"
            value={skillsData?.count || 0}
            icon={<Brain size={16} />}
            color="var(--info)"
          />
        </div>

        {/* ── Main Grid ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-6)',
          marginBottom: 'var(--space-6)',
        }}>
          <ApprovalQueue
            items={approvalData?.items || []}
            onApprove={(id) => approve.mutate(id)}
            onReject={(id) => reject.mutate(id)}
            onApproveAll={() => approveAll.mutate()}
          />
          <AgentCosts
            totalCost={metrics?.total_cost_usd || 0}
            totalTokens={metrics?.total_tokens || 0}
            avgLatency={metrics?.avg_latency_ms || 0}
            byModel={metrics?.cost_by_model || {}}
            byStatus={metrics?.traces_by_status || {}}
          />
        </div>

        {/* ── Pipeline Grid ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-6)',
          marginBottom: 'var(--space-6)',
        }}>
          <Pipeline title="Competitor Landscape" items={[]} />
          <Pipeline
            title="Agent Skills"
            items={(skillsData?.skills || []).map(s => ({
              id: `${s.category}/${s.name}`,
              company_name: `${s.category}/${s.name}`,
              status: 'active',
            }))}
            statusColors={{ active: { variant: 'success' } }}
          />
        </div>

        {/* ── System Status Grid ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 'var(--space-6)',
        }}>
          <Card>
            <CardHeader>
              <CardTitle>Container Status</CardTitle>
            </CardHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[
                { name: 'ops_engine', label: 'Ops Engine', status: 'healthy' },
                { name: 'ops_n8n', label: 'N8N Orchestrator', status: 'healthy' },
                { name: 'ops_langfuse', label: 'Langfuse', status: langfuseConnected ? 'healthy' : 'unhealthy' },
                { name: 'ops_postgres', label: 'PostgreSQL', status: 'healthy' },
                { name: 'ops_cloudflared', label: 'Cloudflare Tunnel', status: 'healthy' },
                { name: 'ops_chroma', label: 'ChromaDB', status: 'healthy' },
              ].map((c) => (
                <div key={c.name} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-3)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{c.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <StatusDot status={c.status as any} />
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      color: c.status === 'healthy' ? 'var(--accent)' : 'var(--danger)',
                      fontWeight: 600,
                    }}>
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Endpoints</CardTitle>
            </CardHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[
                { url: 'ops.safarizetu.com/health', label: 'API', status: true },
                { url: 'dashboard.safarizetu.com', label: 'Dashboard', status: true },
                { url: 'n8n.safarizetu.com', label: 'N8N', status: true },
                { url: 'langfuse.safarizetu.com', label: 'Langfuse', status: langfuseConnected },
              ].map((ep) => (
                <div key={ep.label} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-3)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{ep.label}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
                      {ep.url}
                    </div>
                  </div>
                  <Badge variant={ep.status ? 'success' : 'danger'} dot>
                    {ep.status ? 'Live' : 'Down'}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[
                { icon: <Globe size={16} />, label: 'Open Dashboard', url: 'https://dashboard.safarizetu.com' },
                { icon: <Workflow size={16} />, label: 'N8N Workflows', url: 'https://n8n.safarizetu.com' },
                { icon: <Activity size={16} />, label: 'Langfuse Traces', url: 'https://langfuse.safarizetu.com' },
                { icon: <Boxes size={16} />, label: 'API Health', url: 'https://ops.safarizetu.com/health' },
              ].map((action) => (
                <a
                  key={action.label}
                  href={action.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--fg-primary)',
                    textDecoration: 'none',
                    transition: 'all var(--transition-fast)',
                    border: '1px solid var(--border-subtle)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)'
                    e.currentTarget.style.background = 'var(--bg-muted)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)'
                    e.currentTarget.style.background = 'var(--bg-secondary)'
                  }}
                >
                  <span style={{ color: 'var(--accent)' }}>{action.icon}</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{action.label}</span>
                </a>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  )
}
