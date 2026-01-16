"use client";

import React, { useEffect, useState } from "react";

type Account = {
  id: string;
  domain: string;
  apiKey: string;
};

export default function AccountForm({ onAccountsChange }: { onAccountsChange?: (accounts: Account[]) => void }) {
  const [domain, setDomain] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("accounts");
      if (raw) setAccounts(JSON.parse(raw));
    } catch {
      // ignore parse errors
    }
  }, []);

  function saveAccounts(next: Account[]) {
    setAccounts(next);
    try {
      localStorage.setItem("accounts", JSON.stringify(next));
      if (onAccountsChange) onAccountsChange(next);
    } catch (e) {
      console.error("Failed to save accounts", e);
      setMessage("Failed to save to localStorage");
    }
  }

  function onAdd(e?: React.FormEvent) {
    e?.preventDefault();
    const d = domain.trim();
    const k = apiKey.trim();
    if (!d || !k) {
      setMessage("Domain and API key are required");
      return;
    }

    const id = String(Date.now());
    const next = [...accounts, { id, domain: d, apiKey: k }];
    saveAccounts(next);
    setDomain("");
    setApiKey("");
    setMessage("Saved");
    setTimeout(() => setMessage(null), 2500);
  }

  function onRemove(id: string) {
    const next = accounts.filter((a) => a.id !== id);
    saveAccounts(next);
    setMessage("Removed");
    setTimeout(() => setMessage(null), 2000);
  }

  return (
    <section style={{ width: '100%', maxWidth: '40rem', marginTop: '1rem' }}>
      <form onSubmit={onAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ fontWeight: '600', fontSize: '1.125rem', color: 'var(--foreground)' }}>
          Add Canvas account
        </h3>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.875rem' }}>
          <span style={{ marginBottom: '0.5rem', color: 'var(--foreground)', fontWeight: '500' }}>
            Domain
          </span>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="e.g. canvas.example.edu"
            style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--foreground)',
              fontSize: '0.875rem',
              transition: 'all var(--transition-fast)'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--primary)';
              e.target.style.outline = '2px solid var(--primary)';
              e.target.style.outlineOffset = '2px';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border)';
              e.target.style.outline = 'none';
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.875rem' }}>
          <span style={{ marginBottom: '0.5rem', color: 'var(--foreground)', fontWeight: '500' }}>
            API / Access Key
          </span>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste API key"
            type="password"
            style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--foreground)',
              fontSize: '0.875rem',
              transition: 'all var(--transition-fast)'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--primary)';
              e.target.style.outline = '2px solid var(--primary)';
              e.target.style.outlineOffset = '2px';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border)';
              e.target.style.outline = 'none';
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="submit"
            className="btn-primary"
          >
            Add account
          </button>
          {message && (
            <div style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: '500' }}>
              {message}
            </div>
          )}
        </div>
      </form>

      {accounts.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h4 style={{ fontWeight: '500', fontSize: '1rem', color: 'var(--foreground)', marginBottom: '1rem' }}>
            Saved accounts
          </h4>
          <ul style={{ listStyle: 'none', padding: '0', margin: '0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {accounts.map((a) => (
              <li
                key={a.id}
                className="modern-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '1rem'
                }}
              >
                <div style={{ overflow: 'hidden', flex: '1' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--foreground)', fontWeight: '500' }}>
                    {a.domain}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.apiKey.slice(0, 20)}...
                  </div>
                </div>
                <button
                  onClick={() => onRemove(a.id)}
                  style={{
                    fontSize: '0.875rem',
                    color: '#dc2626',
                    background: 'transparent',
                    border: '1px solid #dc2626',
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    fontWeight: '500'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#dc2626';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#dc2626';
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
