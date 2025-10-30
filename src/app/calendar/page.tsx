"use client";
import { useEffect, useMemo, useState } from "react";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Account, fetchAccountCalendars, fetchCalendarEvents, fetchCourses, CalendarEvent } from "../../components/canvasApi";

type DayCell = {
  date: Date;
  inMonth: boolean;
  iso: string; // YYYY-MM-DD
};

function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfMonth(d: Date) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  x.setHours(23, 59, 59, 999);
  return x;
}
function formatYYYYMMDD(d: Date) {
  return d.toISOString().split("T")[0];
}

// Deterministic color generation driven by course id
function hueFromSeed(seed: number) {
  // Golden angle to distribute hues
  return (seed * 137.508) % 360;
}

function courseIdFromContextCode(cc?: string): number | null {
  if (!cc) return null;
  const m = cc.match(/^course_(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function colorForCourseId(id: number) {
  const h = hueFromSeed(id);
  const s = 65; // saturation
  const l = 85; // lightness (light chip background)
  const bg = `hsl(${h} ${s}% ${l}%)`;
  const border = `hsl(${h} ${s}% ${Math.max(40, l - 15)}%)`;
  const text = l >= 70 ? '#1f2937' : '#ffffff';
  return { bg, border, text };
}

export default function CalendarPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<(CalendarEvent & { account: Account })[]>([]);
  const [activeEvent, setActiveEvent] = useState<(CalendarEvent & { account: Account }) | null>(null);

  // Load saved accounts
  useEffect(() => {
    const saved = localStorage.getItem("accounts");
    if (saved) {
      try { setAccounts(JSON.parse(saved)); } catch {}
    }
  }, []);

  const grid = useMemo<DayCell[]>(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    // Find the Monday (or Sunday) start of calendar grid. We'll use Sunday as first day (0)
    const firstDay = new Date(start);
    const dow = firstDay.getDay(); // 0..6
    firstDay.setDate(firstDay.getDate() - dow);
    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(firstDay);
      d.setDate(firstDay.getDate() + i);
      const iso = formatYYYYMMDD(d);
      cells.push({ date: d, iso, inMonth: d.getMonth() === month.getMonth() });
    }
    return cells;
  }, [month]);

  // Fetch events for the month for each account (courses + account calendars)
  useEffect(() => {
    if (accounts.length === 0) { setEvents([]); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const startISO = formatYYYYMMDD(startOfMonth(month));
    const endISO = formatYYYYMMDD(endOfMonth(month));

    (async () => {
      try {
        const results = await Promise.all(accounts.map(async (account) => {
          // gather context codes: all courses + visible account calendars
          let contextCodes: string[] = [];
          try {
            const courses = await fetchCourses(account);
            contextCodes.push(...courses.map(c => `course_${c.id}`));
          } catch {}
          try {
            const accCals = await fetchAccountCalendars(account);
            contextCodes.push(...accCals.filter(c => c.visible !== false)
              .map(c => c.asset_string!).filter(Boolean));
          } catch {}
          // Fallback: if no context codes found, leave empty to let Canvas default to all accessible.
          const evts = await fetchCalendarEvents(account, {
            startDateISO: startISO,
            endDateISO: endISO,
            contextCodes: contextCodes.length ? contextCodes : undefined,
            // Only assignments per request
            type: 'assignment',
            perPage: 50,
            maxPages: 5,
          }).catch(() => [] as CalendarEvent[]);
          return evts.map(e => ({ ...e, account }));
        }));
        if (!cancelled) setEvents(results.flat());
      } catch (e: any) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [accounts, month]);

  // No extra submission fetch; rely on calendar event's assignment.user_submitted when provided

  const eventsByDay = useMemo(() => {
    const map = new Map<string, (CalendarEvent & { account: Account })[]>();
    events.forEach(ev => {
      // Determine event date key: use all_day_date or start_at date
      const dateKey = (ev.all_day && ev.all_day_date)
        ? ev.all_day_date
        : (ev.start_at ? ev.start_at.split('T')[0] : undefined);
      if (!dateKey) return;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(ev);
    });
    return map;
  }, [events]);

  const prevMonth = () => {
    setMonth(m => {
      const d = new Date(m);
      d.setMonth(m.getMonth() - 1);
      return startOfMonth(d);
    });
  };
  const nextMonth = () => {
    setMonth(m => {
      const d = new Date(m);
      d.setMonth(m.getMonth() + 1);
      return startOfMonth(d);
    });
  };
  const thisMonth = () => setMonth(startOfMonth(new Date()));

  const monthLabel = useMemo(() => month.toLocaleString(undefined, { month: 'long', year: 'numeric' }), [month]);
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="dashboard-container fade-in">
      <div className="dashboard-header">
        <Heading level="h2" style={{ margin: 0 }} className="text-gradient">Calendar</Heading>
      </div>

      <View as="section" margin="0" width="100%">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className="btn" onClick={prevMonth} aria-label="Previous Month">◀</button>
            <button className="btn" onClick={thisMonth} aria-label="Current Month">Today</button>
            <button className="btn" onClick={nextMonth} aria-label="Next Month">▶</button>
          </div>
          <Heading level="h3" style={{ margin: 0 }}>{monthLabel}</Heading>
          <div />
        </div>

        {error && (
          <div style={{
            padding: '1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-lg)',
            color: '#dc2626',
            marginBottom: '1rem'
          }}>
            <Text color="danger">Error: {error}</Text>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', borderTop: '1px solid var(--border)' }}>
          {weekdayLabels.map(d => (
            <div key={d} style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600, color: 'var(--foreground-muted)' }}>{d}</div>
          ))}
          {grid.map(cell => {
            const dayEvents = eventsByDay.get(cell.iso) || [];
            return (
              <div key={cell.iso} style={{
                minHeight: '110px',
                border: '1px solid var(--border)',
                borderTop: 'none',
                padding: '0.25rem',
                background: cell.inMonth ? 'var(--surface-elevated)' : 'transparent'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', opacity: cell.inMonth ? 1 : 0.5 }}>{cell.date.getDate()}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)' }}>{dayEvents.length > 0 ? `${dayEvents.length} events` : ''}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                  {dayEvents.slice(0,3).map((ev, idx) => {
                    const cid = courseIdFromContextCode(ev.context_code || undefined);
                    const colors = cid ? colorForCourseId(cid) : { bg: 'var(--surface)', border: 'var(--border)', text: 'var(--foreground)' };
                    const isSubmitted = !!(ev as any)?.assignment?.user_submitted;
                    const bg = isSubmitted ? 'var(--surface)' : colors.bg;
                    const border = isSubmitted ? 'var(--border)' : colors.border;
                    const text = isSubmitted ? 'var(--foreground-muted)' : colors.text;
                    return (
                    <button
                      key={String(ev.id)+idx}
                      onClick={() => setActiveEvent(ev)}
                      title={ev.title || 'Event'}
                      style={{
                        textAlign: 'left',
                        border: `1px solid ${border}`,
                        background: bg,
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.75rem',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        color: text,
                        opacity: isSubmitted ? 0.7 : 1
                      }}
                    >
                      {(ev.title || 'Event')} <span style={{ color: 'var(--foreground-muted)' }}>• {new URL(`https://${ev.account.domain}`).host}</span>
                    </button>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <Text size="x-small" color="secondary">+{dayEvents.length - 3} more</Text>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </View>

      {activeEvent && (
        <div role="dialog" aria-modal="true" className="modal-backdrop" onClick={() => setActiveEvent(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--background)',
            borderColor: 'var(--foreground)',
            borderWidth: 5,
            borderStyle: 'solid',
            borderRadius: 12,
            // Allow width to grow as needed but cap at viewport
            width: 'auto',
            maxWidth: 'min(1000px, calc(100vw - 2rem))',
            // Force height to be less than 100% and scroll when needed
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <Heading level="h3" style={{ margin: 0, color: "var(--foreground)" }}>{activeEvent.title || 'Event'}</Heading>
            <Text as="p" size="small" color="secondary">
              {activeEvent.all_day ? 'All day' : ''}
              {!activeEvent.all_day && activeEvent.start_at && `Starts: ${new Date(activeEvent.start_at).toLocaleString()}`}
              {activeEvent.end_at && ` • Ends: ${new Date(activeEvent.end_at).toLocaleString()}`}
            </Text>
            {activeEvent.description && (
              <Text as="div" size="small" dangerouslySetInnerHTML={{ __html: activeEvent.description }} />
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              {activeEvent.html_url && (
                <a className="btn-primary" href={`https://${activeEvent.account.domain}${activeEvent.html_url}`} target="_blank" rel="noreferrer">Open in Canvas</a>
              )}
              <button className="btn" onClick={() => setActiveEvent(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
