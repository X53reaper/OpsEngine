import React from 'react'
import { Activity, Wifi, WifiOff, Clock } from 'lucide-react'

interface HeaderProps {
  healthy: boolean
  langfuseConnected: boolean
}

export function Header({ healthy, langfuseConnected }: HeaderProps) {
  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 'var(--space-5) var(--space-8)',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--bg-primary)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, var(--accent), #16A34A)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-glow-green)',
        }}>
          <Activity size={18} color="#000" strokeWidth={2.5} />
        </div>
        <div>
          <h1 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 800,
            letterSpacing: '0.04em',
            background: 'linear-gradient(135deg, var(--accent), #86EFAC)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            SAFARI ZETU
          </h1>
          <p style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--fg-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
          }}>
            AI Ops Engine
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
          {langfuseConnected ? <Wifi size={13} color="var(--accent)" /> : <WifiOff size={13} color="var(--fg-muted)" />}
          <span>Langfuse {langfuseConnected ? 'Connected' : 'Off'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: healthy ? 'var(--accent)' : 'var(--danger)',
            boxShadow: `0 0 8px ${healthy ? 'var(--accent)' : 'var(--danger)'}`,
          }} />
          <span style={{ color: healthy ? 'var(--accent)' : 'var(--danger)', fontWeight: 600 }}>
            {healthy ? 'All Systems Operational' : 'Degraded'}
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 'var(--text-xs)',
          color: 'var(--fg-muted)',
          fontFamily: 'var(--font-mono)',
          padding: '4px 10px',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-sm)',
        }}>
          <Clock size={12} />
          {new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </div>
      </div>
    </header>
  )
}
