"use client";
import { useEffect, useState, useCallback, useMemo } from 'react';
import { View } from '@instructure/ui-view';
import { Heading } from '@instructure/ui-heading';
import { Text } from '@instructure/ui-text';
import { Link } from '@instructure/ui-link';
import { Pill } from '@instructure/ui-pill';
import { Account, Conversation, fetchConversations, updateConversationState, markAllConversationsRead } from '../../components/canvasApi';

interface AccountConversations { account: Account; conversations: Conversation[]; }

type Scope = 'all' | 'unread' | 'starred' | 'archived' | 'sent';

export default function InboxPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [data, setData] = useState<AccountConversations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [scope, setScope] = useState<Scope>('all');
  const [query, setQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('accounts');
      if (saved) setAccounts(JSON.parse(saved));
    } catch {/* ignore */}
  }, []);

  useEffect(() => {
    if (accounts.length === 0) { setData([]); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    const load = async () => {
      try {
        const results: AccountConversations[] = [];
        for (const acct of accounts) {
          try {
            const convs = await fetchConversations(acct, { scope: scope === 'all' ? undefined : scope as any, per_page: 30 });
            if (!cancelled) results.push({ account: acct, conversations: convs });
          } catch (e:any) {
            if (!cancelled) console.warn('Failed to fetch conversations for', acct.domain, e.message);
          }
        }
        if (!cancelled) setData(results);
      } catch (e:any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [accounts, scope, refreshKey]);

  const merged = useMemo(() => data.flatMap(d => d.conversations.map(c => ({ ...c, account: d.account }))), [data]);

  const filtered = useMemo(() => {
    return merged.filter(c => {
      if (scope === 'unread' && c.workflow_state !== 'unread') return false;
      if (scope === 'archived' && c.workflow_state !== 'archived') return false;
      if (scope === 'starred' && !(c.properties||[]).includes('starred')) return false;
      const subj = (c.subject || '').toLowerCase();
      const body = (c.last_message || '').toLowerCase();
      if (query && !(subj.includes(query.toLowerCase()) || body.includes(query.toLowerCase()))) return false;
      return true;
    }).sort((a,b) => {
      const aT = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bT = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bT - aT;
    });
  }, [merged, scope, query]);

  const onMarkRead = useCallback(async (c: Conversation) => {
    try {
      await updateConversationState(c.account!, c.id, 'read');
      setRefreshKey(k => k+1);
    } catch (e:any) { setError(e.message); }
  }, []);

  const onArchive = useCallback(async (c: Conversation) => {
    try {
      await updateConversationState(c.account!, c.id, 'archived');
      setRefreshKey(k => k+1);
    } catch (e:any) { setError(e.message); }
  }, []);

  const onMarkAllRead = useCallback(async () => {
    try {
      for (const acct of accounts) {
        await markAllConversationsRead(acct).catch(()=>{});
      }
      setRefreshKey(k => k+1);
    } catch (e:any) { setError(e.message); }
  }, [accounts]);

  return (
    <View as="div" padding="medium" width="100%" className="inbox-page">
      <Heading level="h2" margin="0 0 medium">Inbox</Heading>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {(['all','unread','starred','archived','sent'] as Scope[]).map(s => (
          <button
            key={s}
            onClick={() => setScope(s)}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '1rem',
              border: scope === s ? '1px solid var(--gradient-primary-start,#1976d2)' : '1px solid var(--border)',
              background: scope === s ? 'var(--gradient-primary)' : 'var(--surface-elevated)',
              color: scope === s ? 'white' : 'inherit'
            }}
          >{s}</button>
        ))}
        <button onClick={onMarkAllRead} style={{ padding: '0.4rem 0.85rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>Mark All Read</button>
        <input
          placeholder="Search..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ flex: '1 1 200px', minWidth: '200px', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}
        />
      </div>
      {loading && <Text>Loading conversations...</Text>}
      {error && !loading && <Text color="danger">{error}</Text>}
      {!loading && filtered.length === 0 && <Text size="small" color="secondary">No conversations.</Text>}
      <View as="ul" margin="0" padding="0" style={{ listStyle: 'none', display: 'grid', gap: '0.75rem' }}>
        {filtered.map(c => (
          <View
            as="li"
            key={`${c.account?.id || c.account?.domain}-${c.id}`}
            padding="small"
            borderWidth="small"
            borderRadius="medium"
            background={c.workflow_state === 'unread' ? 'primary' : 'secondary'}
            className={`conversation-item ${c.workflow_state}`}
            style={{ position: 'relative' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 auto', minWidth: '240px' }}>
                <Heading level="h5" margin="0 0 x-small" data-state={c.workflow_state}>
                  {c.subject || '(No subject)'}{' '}
                  {c.workflow_state === 'unread' && <Pill margin="0 0 0 small" color="info">Unread</Pill>}
                  {(c.properties||[]).includes('starred') && <Pill margin="0 0 0 small" color="warning">Star</Pill>}
                </Heading>
                <Text as="p" size="x-small" color="secondary">
                  {c.participants?.map(p => p.short_name || p.name).filter(Boolean).join(', ') || 'Participants'} • {c.account?.domain}
                </Text>
                {c.last_message && (
                  <Text as="p" size="small" lineHeight="condensed" style={{ maxHeight: '5.5rem', overflow: 'hidden' }}>
                    {c.last_message}
                  </Text>
                )}
                {c.last_message_at && (
                  <Text as="p" size="x-small" color="secondary">
                    {new Date(c.last_message_at).toLocaleString()}
                  </Text>
                )}
                <Text as="p" size="x-small">
                  <Link href={`https://${c.account?.domain}/conversations/${c.id}`}>Open in Canvas</Link>
                </Text>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-start' }}>
                {c.workflow_state === 'unread' && (
                  <button onClick={() => onMarkRead(c)} style={{ padding: '0.35rem 0.7rem', borderRadius: 6, border: '1px solid var(--border)' }}>Mark Read</button>
                )}
                {c.workflow_state !== 'archived' && (
                  <button onClick={() => onArchive(c)} style={{ padding: '0.35rem 0.7rem', borderRadius: 6, border: '1px solid var(--border)' }}>Archive</button>
                )}
              </div>
            </div>
          </View>
        ))}
      </View>
    </View>
  );
}
