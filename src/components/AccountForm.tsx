"use client";

import React, { useEffect, useState } from "react";

type Account = {
  id: string;
  domain: string;
  apiKey: string;
};

type AccountFormProps = {
  onAccountsChange?: (accounts: Account[]) => void;
};

export default function AccountForm({ onAccountsChange }: { onAccountsChange?: (accounts: Account[]) => void }) {
  const [domain, setDomain] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("accounts");
      if (raw) setAccounts(JSON.parse(raw));
    } catch (e) {
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

  function handleExport() {
    const blob = new Blob([JSON.stringify(accounts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().replace(/[:T]/g,'-').split('.')[0];
    a.download = `canvas-accounts-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) {
          setMessage('Invalid file: expected an array');
          return;
        }
        const cleaned: Account[] = parsed
          .filter((x: any) => x && typeof x === 'object')
          .map((x: any) => ({ id: x.id || String(Date.now()+Math.random()), domain: String(x.domain||'').trim(), apiKey: String(x.apiKey||'').trim() }))
          .filter((x: Account) => x.domain && x.apiKey);
        if (cleaned.length === 0) {
          setMessage('No valid accounts found');
          return;
        }
        // Merge by domain+apiKey uniqueness
        const existingKey = new Set(accounts.map(a => a.domain+'|'+a.apiKey));
        const merged = [...accounts];
        cleaned.forEach(acc => {
          const key = acc.domain+'|'+acc.apiKey;
          if (!existingKey.has(key)) {
            merged.push(acc);
            existingKey.add(key);
          }
        });
        saveAccounts(merged);
        setMessage(`Imported ${merged.length - accounts.length} new`);
        setTimeout(()=>setMessage(null),2500);
      } catch {
        setMessage('Failed to parse file');
      }
    };
    reader.readAsText(file);
    e.target.value='';
  }

  return (
    <section className="w-full max-w-xl mt-4">
      <form onSubmit={onAdd} className="flex flex-col gap-3">
        <h3 className="font-semibold">Add Canvas account</h3>
        <label className="flex flex-col text-sm">
          Domain
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="e.g. canvas.example.edu"
            className="mt-1 p-2 rounded border"
          />
        </label>

        <label className="flex flex-col text-sm">
          API / Access Key
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste API key"
            className="mt-1 p-2 rounded border"
          />
        </label>

        <div className="flex gap-2 flex-wrap items-center">
          <button
            type="submit"
            className="rounded bg-foreground text-background px-4 py-2"
          >
            Add account
          </button>
          <button type="button" onClick={handleExport} className="rounded bg-foreground text-background border px-3 py-2 text-sm">Export</button>
          <button type="button" onClick={handleImportClick} className="rounded bg-foreground text-background border px-3 py-2 text-sm">Import</button>
          <input ref={fileInputRef} onChange={handleFileChange} type="file" accept="application/json" className="hidden" />
          <div className="text-sm text-green-600 self-center">{message}</div>
        </div>
      </form>

      {accounts.length > 0 && (
        <div className="mt-4">
          <h4 className="font-medium">Saved accounts</h4>
          <ul className="mt-2 space-y-2">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-4 rounded p-2 border"
              >
                <div className="truncate">
                  <div className="font-mono text-sm">{a.domain}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {a.apiKey}
                  </div>
                </div>
                <button
                  onClick={() => onRemove(a.id)}
                  className="text-sm text-red-600"
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
