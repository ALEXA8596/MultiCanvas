"use client"
import { useEffect, useState } from 'react'
import { View } from '@instructure/ui-view'
import { Flex } from '@instructure/ui-flex'
import { Heading } from '@instructure/ui-heading'
import { Text } from '@instructure/ui-text'
import { Link } from '@instructure/ui-link'
import { Pill } from '@instructure/ui-pill'
import {
  Account,
  fetchPlannerItems,
  getMissingSubmissions,
  PlannerItem
} from '../../components/canvasApi'

export default function TodoPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [plannerItems, setPlannerItems] = useState<(PlannerItem & { account: Account })[]>([])
  const [missingSubmissions, setMissingSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('accounts')
    if (saved) {
      try { setAccounts(JSON.parse(saved)) } catch {}
    }
  }, [])

  useEffect(() => {
    if (accounts.length === 0) { setPlannerItems([]); setMissingSubmissions([]); return }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all(accounts.map(async account => {
      const now = new Date()
      const nextWeek = new Date(now)
      nextWeek.setDate(now.getDate()+7)
      const items = await fetchPlannerItems(account, `?start_date=${now.toISOString().split('T')[0]}&end_date=${nextWeek.toISOString().split('T')[0]}`).catch(()=>[])
      const missing = await getMissingSubmissions(account).catch(()=>[])
      return { account, items: Array.isArray(items)? items: [], missing: Array.isArray(missing)? missing: [] }
    })).then(results => {
      if (cancelled) return
      setPlannerItems(results.flatMap(r => r.items.map(it => ({ ...it, account: r.account }))))
      setMissingSubmissions(results.flatMap(r => r.missing.map(m => ({ ...m, account: r.account }))))
    }).catch(e => !cancelled && setError(e.message)).finally(()=>!cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [accounts])

  const assignments = plannerItems.filter(p=>p.plannable_type === 'assignment')
  const otherItems = plannerItems.filter(p=>p.plannable_type !== 'assignment')

  const formatDate = (d?: string|null) => {
    if(!d) return null
    const dt = new Date(d)
    return isNaN(dt.getTime())? d : dt.toLocaleString()
  }

  return (
    <div className="todo-container fade-in">
      {/* Todo Header */}
      <div className="todo-header">
        <Heading level="h1" margin="0" className="todo-main-title">
          Todo Dashboard
        </Heading>
        <Text size="large" color="secondary">
          Your upcoming tasks for the next 7 days
        </Text>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="todo-sections">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="todo-section-modern">
              <div className="todo-section-header">
                <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }}></div>
                <div className="skeleton" style={{ height: '1.5rem', width: '150px' }}></div>
              </div>
              {[...Array(2)].map((_, j) => (
                <div key={j} className="todo-item-modern">
                  <div className="skeleton" style={{ height: '1.5rem', width: '70%', marginBottom: '0.5rem' }}></div>
                  <div className="skeleton" style={{ height: '1rem', width: '50%', marginBottom: '0.5rem' }}></div>
                  <div className="skeleton" style={{ height: '0.875rem', width: '40%' }}></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={{
          padding: '2rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-lg)',
          color: '#dc2626',
          textAlign: 'center'
        }}>
          <Text color="danger">Error: {error}</Text>
        </div>
      )}

      {/* Empty State */}
      {!loading && assignments.length === 0 && otherItems.length === 0 && missingSubmissions.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          background: 'var(--surface-elevated)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
          <Heading level="h3" margin="0 0 small">All caught up!</Heading>
          <Text color="secondary">No upcoming items for the next 7 days.</Text>
        </div>
      )}

      {/* Todo Sections */}
      {!loading && (assignments.length > 0 || otherItems.length > 0 || missingSubmissions.length > 0) && (
        <div className="todo-sections">
          {/* Assignments Section */}
          {assignments.length > 0 && (
            <div className="todo-section-modern slide-in-left">
              <div className="todo-section-header">
                <div className="todo-section-icon">
                  📝
                </div>
                <div>
                  <Heading level="h3" margin="0" className="todo-section-title">
                    Assignments
                  </Heading>
                  <Pill 
                    margin="xxx-small 0 0"
                    style={{ 
                      background: 'var(--gradient-primary)', 
                      color: 'white',
                      border: 'none'
                    }}
                  >
                    {assignments.length}
                  </Pill>
                </div>
              </div>
              
              <div>
                {assignments.map((it, index) => (
                  <div 
                    key={`${it.plannable_id}-${it.account.id}`} 
                    className="todo-item-modern todo-kind-assignment fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <Heading level="h5" margin="0 0 x-small" className="todo-item-title">
                      {(it.plannable as any)?.title || (it.plannable as any)?.name || 'Assignment'}
                    </Heading>
                    <div className="todo-item-meta">
                      <Text size="small" margin="0 0 x-small">
                        🏫 {it.account.domain}
                      </Text>
                      {(it.plannable as any)?.todo_date && (
                        <Text size="small" margin="0 0 x-small">
                          📅 Due: {formatDate((it.plannable as any)?.todo_date)}
                        </Text>
                      )}
                    </div>
                    <div className="todo-links">
                      <Link href={`https://${it.account.domain}/${it.html_url}`} target="_blank">
                        <Text size="x-small">Canvas</Text>
                      </Link>
                      <Link href={it.html_url}>
                        <Text size="x-small">View in App</Text>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Items Section */}
          {otherItems.length > 0 && (
            <div className="todo-section-modern slide-in-right" style={{ animationDelay: '0.1s' }}>
              <div className="todo-section-header">
                <div className="todo-section-icon" style={{ background: 'var(--accent)' }}>
                  📚
                </div>
                <div>
                  <Heading level="h3" margin="0" className="todo-section-title">
                    Other Items
                  </Heading>
                  <Pill 
                    margin="xxx-small 0 0"
                    style={{ 
                      background: 'var(--accent)', 
                      color: 'white',
                      border: 'none'
                    }}
                  >
                    {otherItems.length}
                  </Pill>
                </div>
              </div>
              
              <div>
                {otherItems.map((it, index) => (
                  <div 
                    key={`${it.plannable_id}-${it.account.id}`} 
                    className="todo-item-modern fade-in"
                    style={{ animationDelay: `${(index + assignments.length) * 0.1}s` }}
                  >
                    <Heading level="h5" margin="0 0 x-small" className="todo-item-title">
                      {(it.plannable as any)?.title || (it.plannable as any)?.name || it.plannable_type}
                    </Heading>
                    <div className="todo-item-meta">
                      <Text size="small" margin="0 0 x-small">
                        🏫 {it.account.domain} • {it.plannable_type}
                      </Text>
                      {(it.plannable as any)?.todo_date && (
                        <Text size="small" margin="0 0 x-small">
                          📅 {formatDate((it.plannable as any)?.todo_date)}
                        </Text>
                      )}
                    </div>
                    <div className="todo-links">
                      <Link href={`https://${it.account.domain}/${it.html_url}`} target="_blank">
                        <Text size="x-small">Canvas</Text>
                      </Link>
                      <Link href={it.html_url}>
                        <Text size="x-small">View in App</Text>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing Submissions Section */}
          {missingSubmissions.length > 0 && (
            <div className="todo-section-modern slide-in-left" style={{ animationDelay: '0.2s' }}>
              <div className="todo-section-header">
                <div className="todo-section-icon" style={{ background: '#dc2626' }}>
                  ⚠️
                </div>
                <div>
                  <Heading level="h3" margin="0" className="todo-section-title">
                    Missing Submissions
                  </Heading>
                  <Pill 
                    margin="xxx-small 0 0"
                    style={{ 
                      background: '#dc2626', 
                      color: 'white',
                      border: 'none'
                    }}
                  >
                    {missingSubmissions.length}
                  </Pill>
                </div>
              </div>
              
              <div>
                {missingSubmissions.map((m, index) => (
                  <div 
                    key={index} 
                    className="todo-item-modern todo-kind-missing fade-in"
                    style={{ animationDelay: `${(index + assignments.length + otherItems.length) * 0.1}s` }}
                  >
                    <Heading level="h5" margin="0 0 x-small" className="todo-item-title">
                      {m.assignment ? m.assignment.name : m.title || 'Missing submission'}
                    </Heading>
                    <div className="todo-item-meta">
                      <Text size="small" margin="0 0 x-small">
                        🏫 {m.account?.domain || 'unknown'}
                      </Text>
                    </div>
                    {m.html_url && (
                      <div className="todo-links">
                        <Link href={m.html_url}>
                          <Text size="x-small">Open Assignment</Text>
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
