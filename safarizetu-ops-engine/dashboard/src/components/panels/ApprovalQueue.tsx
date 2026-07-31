import React from 'react'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Check, X, Clock, AlertTriangle } from 'lucide-react'

interface ApprovalItem {
  id: string
  title: string
  item_type: string
  preview: string
  priority: string
  created_at: string
}

interface Props {
  items: ApprovalItem[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onApproveAll: () => void
}

const priorityVariant: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'default',
}

export function ApprovalQueue({ items, onApprove, onReject, onApproveAll }: Props) {
  const urgentCount = items.filter(i => i.priority === 'urgent' || i.priority === 'high').length

  return (
    <Card glow={urgentCount > 0 ? 'gold' : 'none'}>
      <CardHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <CardTitle>Approval Queue</CardTitle>
          {urgentCount > 0 && (
            <Badge variant="danger" dot pulse>
              {urgentCount} urgent
            </Badge>
          )}
        </div>
        {items.length > 0 && (
          <button
            onClick={onApproveAll}
            style={{
              background: 'var(--accent)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 14px',
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              letterSpacing: '0.03em',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            Approve All
          </button>
        )}
      </CardHeader>

      {items.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-10) 0',
          color: 'var(--fg-muted)',
          fontSize: 'var(--text-sm)',
        }}>
          <Check size={32} style={{ margin: '0 auto var(--space-3)', opacity: 0.3 }} />
          <div>No items pending approval</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {items.slice(0, 5).map((item) => (
            <div
              key={item.id}
              style={{
                padding: 'var(--space-4)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                transition: 'border-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--fg-primary)' }}>
                      {item.title}
                    </span>
                    <Badge variant={priorityVariant[item.priority] || 'default'}>
                      {item.priority}
                    </Badge>
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span>{item.item_type}</span>
                    <span>·</span>
                    <Clock size={10} />
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'var(--space-4)' }}>
                  <button
                    onClick={() => onApprove(item.id)}
                    style={{
                      background: 'var(--accent)',
                      color: '#000',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      padding: '5px 12px',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                      transition: 'opacity var(--transition-fast)',
                    }}
                  >
                    <Check size={12} /> Approve
                  </button>
                  <button
                    onClick={() => onReject(item.id)}
                    style={{
                      background: 'transparent',
                      color: 'var(--danger)',
                      border: '1px solid var(--danger-dim)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '5px 12px',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              </div>

              {item.preview && (
                <p style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--fg-muted)',
                  fontStyle: 'italic',
                  lineHeight: 1.5,
                  marginTop: 'var(--space-2)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {item.preview.substring(0, 120)}...
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
