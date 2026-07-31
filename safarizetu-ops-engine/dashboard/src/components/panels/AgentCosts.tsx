import React from 'react'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { DollarSign, Cpu, Zap } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface AgentCost {
  agent_name: string
  runs: number
  cost: number
}

interface Props {
  totalCost: number
  totalTokens: number
  avgLatency: number
  byModel: Record<string, number>
  byStatus: Record<string, number>
}

export function AgentCosts({ totalCost, totalTokens, avgLatency, byModel, byStatus }: Props) {
  const modelData = Object.entries(byModel).map(([name, cost]) => ({
    name: name.replace('-free', '').replace('opencode-zen', 'Zen'),
    cost: cost || 0,
  })).sort((a, b) => b.cost - a.cost)

  const statusColors: Record<string, string> = {
    success: 'var(--accent)',
    error: 'var(--danger)',
    timeout: 'var(--gold)',
  }

  return (
    <Card>
      <CardHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <CardTitle>AI Cost Monitor</CardTitle>
          <Badge variant="accent" dot>Live</Badge>
        </div>
      </CardHeader>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
        }}>
          <DollarSign size={16} style={{ color: 'var(--accent)', margin: '0 auto var(--space-2)' }} />
          <div style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent)',
          }}>
            ${totalCost.toFixed(4)}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginTop: 2 }}>Total Cost</div>
        </div>

        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
        }}>
          <Cpu size={16} style={{ color: 'var(--fg-secondary)', margin: '0 auto var(--space-2)' }} />
          <div style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--fg-primary)',
          }}>
            {totalTokens.toLocaleString()}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginTop: 2 }}>Total Tokens</div>
        </div>

        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
        }}>
          <Zap size={16} style={{ color: 'var(--gold)', margin: '0 auto var(--space-2)' }} />
          <div style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--fg-primary)',
          }}>
            {(avgLatency / 1000).toFixed(1)}s
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginTop: 2 }}>Avg Latency</div>
        </div>
      </div>

      {modelData.length > 0 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginBottom: 'var(--space-3)', letterSpacing: '0.05em' }}>
            COST BY MODEL
          </div>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 11, fill: 'var(--fg-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--fg-primary)',
                  }}
                  formatter={(v: number) => [`$${v.toFixed(4)}`, 'Cost']}
                />
                <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                  {modelData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? 'var(--accent)' : i === 1 ? 'var(--info)' : 'var(--fg-muted)'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {Object.keys(byStatus).length > 0 && (
        <div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginBottom: 'var(--space-3)', letterSpacing: '0.05em' }}>
            BY STATUS
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            {Object.entries(byStatus).map(([status, count]) => (
              <Badge key={status} variant={status === 'success' ? 'success' : status === 'error' ? 'danger' : 'warning'}>
                {status}: {count}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
