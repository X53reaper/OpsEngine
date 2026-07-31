import React from 'react'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { ArrowRight } from 'lucide-react'

interface PipelineItem {
  id: string
  company_name?: string
  contact_name?: string
  operator_name?: string
  status: string
}

interface Props {
  title: string
  items: PipelineItem[]
  statusColors?: Record<string, { variant: 'success' | 'warning' | 'info' | 'default' | 'danger' }>
}

const defaultStatusColors: Record<string, { variant: 'success' | 'warning' | 'info' | 'default' | 'danger' }> = {
  signed: { variant: 'success' },
  converted: { variant: 'success' },
  active: { variant: 'success' },
  negotiating: { variant: 'warning' },
  replied: { variant: 'warning' },
  meeting_scheduled: { variant: 'warning' },
  outreach_sent: { variant: 'info' },
  identified: { variant: 'default' },
  cold: { variant: 'danger' },
}

export function Pipeline({ title, items, statusColors }: Props) {
  const colors = statusColors || defaultStatusColors

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge variant="default">{items.length} items</Badge>
      </CardHeader>

      {items.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-10) 0',
          color: 'var(--fg-muted)',
          fontSize: 'var(--text-sm)',
        }}>
          No pipeline items yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {items.slice(0, 6).map((item, i) => {
            const name = item.company_name || item.contact_name || item.operator_name || 'Unknown'
            const statusConfig = colors[item.status] || colors.identified
            return (
              <div
                key={item.id || i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  transition: 'all var(--transition-fast)',
                  animation: `slideIn 0.2s ease ${i * 0.05}s forwards`,
                  opacity: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.background = 'var(--bg-muted)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                  e.currentTarget.style.background = 'var(--bg-secondary)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    color: 'var(--fg-muted)',
                  }}>
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                    {name}
                  </span>
                </div>
                <Badge variant={statusConfig.variant}>
                  {item.status.replace(/_/g, ' ')}
                </Badge>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
