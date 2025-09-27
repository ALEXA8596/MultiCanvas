"use client"
import { useEffect, useState, useMemo, useCallback } from 'react'
import { View } from '@instructure/ui-view'
import { Flex } from '@instructure/ui-flex'
import { Heading } from '@instructure/ui-heading'
import { Text } from '@instructure/ui-text'
import { Link } from '@instructure/ui-link'
import { Pill } from '@instructure/ui-pill'
import CircularProgress from '../../components/CircularProgress'
import {
  Account,
  fetchPlannerItems,
  getMissingSubmissions,
  PlannerItem,
  SubmissionStatus
} from '../../components/canvasApi'

// Helper functions from TodoSidebar
const getMondayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const formatDateRange = (startDate: Date): string => {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 7);
  return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
};

const isDateInInterval = (dates: (string | undefined)[] | undefined, intervalStart: Date): boolean => {
  if (!dates || !Array.isArray(dates)) return true;
  
  for (const date of dates) {
    if (!date) continue;
    
    const itemDate = new Date(date);
    if (isNaN(itemDate.getTime())) continue;
    
    const intervalEnd = new Date(intervalStart);
    intervalEnd.setDate(intervalStart.getDate() + 8);
    
    const itemDateOnly = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
    const intervalStartOnly = new Date(intervalStart.getFullYear(), intervalStart.getMonth(), intervalStart.getDate());
    const intervalEndOnly = new Date(intervalEnd.getFullYear(), intervalEnd.getMonth(), intervalEnd.getDate());
    
    return itemDateOnly >= intervalStartOnly && itemDateOnly < intervalEndOnly;
  }
  
  return true;
};

const isSubmissionObject = (s: SubmissionStatus | undefined | null): s is Exclude<SubmissionStatus, false> => {
  return typeof s === 'object' && s !== null;
};

// Helper function to check if an assignment is actually completed/submitted
const isAssignmentCompleted = (item: any): boolean => {
  return (
    (isSubmissionObject(item.submissions) && item.submissions.submitted === true) ||
    (isSubmissionObject(item.plannable?.submissions) && item.plannable!.submissions!.submitted === true) ||
    item.plannable?.has_submissions === true ||
    item.plannable?.submitted === true ||
    item.submitted === true
  );
};

const relativeTime = (dateStr?: string) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let diff = d.getTime() - now.getTime();
  const past = diff < 0;
  diff = Math.abs(diff);
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  let value: number;
  let unit: string;
  if (weeks > 0) {
    value = weeks;
    unit = "w";
  } else if (days > 0) {
    value = days;
    unit = "d";
  } else if (hours > 0) {
    value = hours;
    unit = "h";
  } else {
    value = mins;
    unit = "m";
  }
  return past ? value + unit + " ago" : "in " + value + unit;
};

type TabKey = "all" | "assignments" | "announcements" | "missing" | "completed";

export default function TodoPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [plannerItems, setPlannerItems] = useState<(PlannerItem & { account: Account })[]>([])
  const [missingSubmissions, setMissingSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // New state for enhanced features
  const [filter, setFilter] = useState<TabKey>("all")
  const [query, setQuery] = useState("")
  const [domainFilter, setDomainFilter] = useState<string>("all")
  const [intervalStart, setIntervalStart] = useState<Date>(() => getMondayOfWeek(new Date()))
  const [isSearchCollapsed, setIsSearchCollapsed] = useState(false)
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false)
  const [isViewCollapsed, setIsViewCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('accounts')
    if (saved) {
      try { setAccounts(JSON.parse(saved)) } catch {}
    }
  }, [])

  // Week navigation functions
  const goToPreviousWeek = useCallback(() => {
    setIntervalStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() - 7);
      return newDate;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setIntervalStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + 7);
      return newDate;
    });
  }, []);

  const goToCurrentWeek = useCallback(() => {
    setIntervalStart(getMondayOfWeek(new Date()));
  }, []);

  useEffect(() => {
    if (accounts.length === 0) { setPlannerItems([]); setMissingSubmissions([]); return }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all(accounts.map(async account => {
      // Fetch a wider range to allow for week navigation
      const startDate = new Date(intervalStart)
      startDate.setDate(startDate.getDate() - 14) // 2 weeks before
      const endDate = new Date(intervalStart)
      endDate.setDate(endDate.getDate() + 21) // 3 weeks after
      const items = await fetchPlannerItems(account, `?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`).catch(()=>[])
      const missing = await getMissingSubmissions(account).catch(()=>[])
      return { account, items: Array.isArray(items)? items: [], missing: Array.isArray(missing)? missing: [] }
    })).then(results => {
      if (cancelled) return
      setPlannerItems(results.flatMap(r => r.items.map(it => ({ ...it, account: r.account }))))
      setMissingSubmissions(results.flatMap(r => r.missing.map(m => ({ ...m, account: r.account }))))
    }).catch(e => !cancelled && setError(e.message)).finally(()=>!cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [accounts, intervalStart])

  // Enhanced filtering and processing
  const filteredQuery = useCallback((title: string) =>
    title.toLowerCase().includes(query.toLowerCase()), [query]);

  // Deduplicate items
  const dedupedAssignments = useMemo(() => plannerItems.filter(
    (item, idx, self) =>
      idx ===
      self.findIndex(
        (t) =>
          t.plannable_id === item.plannable_id &&
          t.account.id === item.account.id
      )
  ), [plannerItems]);

  const dedupedAnnouncements = useMemo(() => {
    const announcements = plannerItems.filter(p => {
      const pt = p.plannable_type?.toLowerCase();
      return pt && (pt.includes("announcement") || pt.includes("discussion"));
    });
    return announcements.filter(
      (item, idx, self) =>
        idx ===
        self.findIndex(
          (t) =>
            t.plannable_id === item.plannable_id &&
            t.account.id === item.account.id
        )
    );
  }, [plannerItems]);

  // Filter assignments (incomplete only)
  const assignmentList = useMemo(() => {
    const filtered = dedupedAssignments.filter((it) => {
      if (!it || (it.plannable_type && it.plannable_type.toLowerCase() !== "assignment"))
        return false;
      
      // Exclude completed assignments (those that are actually submitted)
      if (isAssignmentCompleted(it))
        return false;
      
      // Check if within current interval
      if (!isDateInInterval([
        (it.plannable as any)?.due_at,
        (it.plannable as any)?.todo_date,
        (it.plannable as any)?.created_at
      ], intervalStart))
        return false;
        
      const title = (it.plannable as any)?.title || (it.plannable as any)?.name || "Assignment";
      if (domainFilter !== "all" && it.account.domain !== domainFilter)
        return false;
      return query ? filteredQuery(title) : true;
    });

    return filtered.sort((a, b) => {
      const aDate = (a.plannable as any)?.due_at;
      const bDate = (b.plannable as any)?.due_at;
      
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      
      const dateA = new Date(aDate);
      const dateB = new Date(bDate);
      
      if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      
      return dateA.getTime() - dateB.getTime();
    });
  }, [dedupedAssignments, domainFilter, query, filteredQuery, intervalStart]);

  // Completed assignments
  const completedList = useMemo(() => {
    const filtered = dedupedAssignments.filter((it) => {
      if (!it || (it.plannable_type && it.plannable_type.toLowerCase() !== "assignment"))
        return false;
      
      if (!isAssignmentCompleted(it)) 
        return false;
      
      if (!isDateInInterval([
        (it.plannable as any)?.due_at,
        (it.plannable as any)?.todo_date,
        (it.plannable as any)?.created_at
      ], intervalStart))
        return false;
        
      const title = (it.plannable as any)?.title || (it.plannable as any)?.name || "Assignment";
      if (domainFilter !== "all" && it.account.domain !== domainFilter)
        return false;
      return query ? filteredQuery(title) : true;
    });

    return filtered.sort((a, b) => {
      const aDate = (a.plannable as any)?.due_at;
      const bDate = (b.plannable as any)?.due_at;
      
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      
      const dateA = new Date(aDate);
      const dateB = new Date(bDate);
      
      if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      
      return dateB.getTime() - dateA.getTime();
    });
  }, [dedupedAssignments, domainFilter, query, filteredQuery, intervalStart]);

  // Filter announcements
  const announcementList = useMemo(() => {
    const filtered = dedupedAnnouncements.filter((it) => {
      if (!isDateInInterval([
        (it.plannable as any)?.posted_at,
        (it.plannable as any)?.todo_date,
        (it.plannable as any)?.created_at
      ], intervalStart))
        return false;
        
      const title = (it.plannable as any)?.title || (it.plannable as any)?.message || "Announcement";
      if (domainFilter !== "all" && it.account.domain !== domainFilter)
        return false;
      return query ? filteredQuery(title) : true;
    });

    return filtered.sort((a, b) => {
      const aDate = (a.plannable as any)?.posted_at || (a.plannable as any)?.created_at;
      const bDate = (b.plannable as any)?.posted_at || (b.plannable as any)?.created_at;
      
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      
      const dateA = new Date(aDate);
      const dateB = new Date(bDate);
      
      if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      
      return dateB.getTime() - dateA.getTime();
    });
  }, [dedupedAnnouncements, domainFilter, query, filteredQuery, intervalStart]);

  // Filter missing submissions
  const missingList = useMemo(() => missingSubmissions.filter((m) => {
    const title = m.assignment?.name || m.title || "Missing submission";
    if (domainFilter !== "all" && m.account?.domain !== domainFilter)
      return false;
    return query ? filteredQuery(title) : true;
  }), [missingSubmissions, domainFilter, query, filteredQuery]);

  // Get all domains for filter
  const allDomains = useMemo(() => {
    const set = new Set<string>();
    [...dedupedAssignments, ...dedupedAnnouncements, ...missingSubmissions].forEach((i) => {
      if (i.account?.domain) set.add(i.account.domain);
    });
    return Array.from(set).sort();
  }, [dedupedAssignments, dedupedAnnouncements, missingSubmissions]);

  // Calculate weekly progress
  const weeklyTotal = assignmentList.length + completedList.length;
  const weeklyCompleted = completedList.length;
  const percent = weeklyTotal === 0 ? 0 : Math.round((weeklyCompleted / weeklyTotal) * 100);

  // Determine what to show based on filter
  const getFilteredContent = () => {
    switch (filter) {
      case "assignments":
        return { items: assignmentList, type: "assignments" };
      case "announcements":
        return { items: announcementList, type: "announcements" };
      case "completed":
        return { items: completedList, type: "completed" };
      case "missing":
        return { items: missingList, type: "missing" };
      case "all":
      default:
        return {
          items: [
            ...assignmentList.map(item => ({ ...item, itemType: "assignment" })),
            ...completedList.map(item => ({ ...item, itemType: "completed" })),
            ...announcementList.map(item => ({ ...item, itemType: "announcement" })),
            ...missingList.map(item => ({ ...item, itemType: "missing" }))
          ],
          type: "all"
        };
    }
  };

  const { items: filteredItems, type: contentType } = getFilteredContent();

  const formatDate = (d?: string|null) => {
    if(!d) return null
    const dt = new Date(d)
    return isNaN(dt.getTime())? d : dt.toLocaleDateString()
  }

  return (
    <div className="todo-container fade-in">
      {/* Todo Header with Progress */}
      <div className="todo-header">
        <div>
          <Heading level="h1" style={{ margin: 0 }} className="todo-main-title">
            Todo Dashboard
          </Heading>
          <Text size="large" color="secondary">
            Your tasks for {formatDateRange(intervalStart)}
          </Text>
        </div>
        
        {/* Weekly Progress Ring */}
        <div className="todo-progress-ring" style={{ marginLeft: 'auto' }}>
          <CircularProgress
            size={120}
            stroke={12}
            value={percent}
            ariaLabel={`Weekly Progress: ${weeklyCompleted}/${weeklyTotal} assignments completed`}
          />
          <div className="todo-progress-label" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <Text size="small" color="secondary">
              {weeklyCompleted}/{weeklyTotal} completed
            </Text>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="todo-controls" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Week Navigation */}
        <div className="todo-option-group" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div className="group-title" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>
            Week Interval
          </div>
          <div className="todo-interval-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button 
              className="interval-nav-btn"
              style={{ padding: '0.5rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              onClick={goToPreviousWeek}
              title="Previous week"
            >
              ◀
            </button>
            <div className="interval-display" style={{ textAlign: 'center', minWidth: '200px' }}>
              <div className="interval-dates" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                {formatDateRange(intervalStart)}
              </div>
              <button 
                className="interval-current-btn"
                style={{ fontSize: '0.75rem', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={goToCurrentWeek}
                title="Go to current week"
              >
                Current Week
              </button>
            </div>
            <button 
              className="interval-nav-btn"
              style={{ padding: '0.5rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              onClick={goToNextWeek}
              title="Next week"
            >
              ▶
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="todo-option-group" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', padding: '1rem', borderRadius: 'var(--radius-md)', flex: 1, minWidth: '200px' }}>
          <div 
            className="group-title collapsible-header"
            style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            onClick={() => setIsSearchCollapsed(!isSearchCollapsed)}
          >
            <span>Search</span>
            <span style={{ transform: isSearchCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
          </div>
          {!isSearchCollapsed && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items..."
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
            />
          )}
        </div>

        {/* Domain Filter */}
        <div className="todo-option-group" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div 
            className="group-title collapsible-header"
            style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
          >
            <span>Filter by Domain</span>
            <span style={{ transform: isFilterCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
          </div>
          {!isFilterCollapsed && (
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setDomainFilter("all")}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  background: domainFilter === "all" ? 'var(--primary)' : 'var(--gradient-secondary)',
                  color: domainFilter === "all" ? 'var(--gradient-secondary)' : 'var(--foreground)',
                  cursor: 'pointer'
                }}
              >
                All
              </button>
              {allDomains.map((d) => (
                <button
                  key={d}
                  onClick={() => setDomainFilter(d)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    background: domainFilter === d ? 'var(--primary)' : 'var(--gradient-secondary)',
                    color: domainFilter === d ? 'var(--gradient-secondary)' : 'var(--foreground)',
                    cursor: 'pointer'
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View Tabs */}
        <div className="todo-option-group" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div 
            className="group-title collapsible-header"
            style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            onClick={() => setIsViewCollapsed(!isViewCollapsed)}
          >
            <span>View</span>
            <span style={{ transform: isViewCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
          </div>
          {!isViewCollapsed && (
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {(["all", "assignments", "announcements", "completed", "missing"] as TabKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    background: filter === k ? 'var(--primary)' : 'var(--secondary)',
                    color: filter === k ? 'var(--secondary)' : 'var(--foreground)',
                    cursor: 'pointer'
                  }}
                >
                  {k === "all" && `All (${assignmentList.length + completedList.length + announcementList.length + missingList.length})`}
                  {k === "assignments" && `📄 Assignments (${assignmentList.length})`}
                  {k === "announcements" && `🔔 Announcements (${announcementList.length})`}
                  {k === "completed" && `✅ Completed (${completedList.length})`}
                  {k === "missing" && `❌ Missing (${missingList.length})`}
                </button>
              ))}
            </div>
          )}
        </div>
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
      {!loading && filteredItems.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          background: 'var(--surface-elevated)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
          <Heading level="h3" style={{ margin: '0 0 small' }}>
            {query ? 'No matching items found' : 'All caught up!'}
          </Heading>
          <Text color="secondary">
            {query 
              ? `No items match "${query}" for ${formatDateRange(intervalStart)}`
              : `No items for ${formatDateRange(intervalStart)}`
            }
          </Text>
        </div>
      )}

      {/* Filtered Content */}
      {!loading && filteredItems.length > 0 && (
        <div className="todo-sections">
          <div className="todo-section-modern slide-in-left">
            <div className="todo-section-header">
              <div className="todo-section-icon">
                {filter === "assignments" && "📝"}
                {filter === "announcements" && "🔔"}
                {filter === "completed" && "✅"}
                {filter === "missing" && "⚠️"}
                {filter === "all" && "📚"}
              </div>
              <div>
                <Heading level="h3" style={{ margin: 0 }} className="todo-section-title">
                  {filter === "assignments" && "Assignments"}
                  {filter === "announcements" && "Announcements"}
                  {filter === "completed" && "Completed Assignments"}
                  {filter === "missing" && "Missing Submissions"}
                  {filter === "all" && "All Items"}
                </Heading>
                <Pill style={{ 
                  margin: 'xxx-small 0 0', 
                  background: filter === "missing" ? '#dc2626' : 'var(--gradient-primary)', 
                  color: 'white', 
                  border: 'none' 
                }}>
                  {filteredItems.length}
                </Pill>
              </div>
            </div>
            
            <div>
              {filteredItems.map((item: any, index) => {
                // Determine item type and properties
                const isAssignment = item.plannable_type === 'assignment' || (item as any).itemType === 'assignment';
                const isCompleted = (item as any).itemType === 'completed';
                const isAnnouncement = item.plannable_type?.toLowerCase().includes('announcement') || 
                                     item.plannable_type?.toLowerCase().includes('discussion') ||
                                     (item as any).itemType === 'announcement';
                const isMissing = (item as any).itemType === 'missing' || !item.plannable_id;
                
                const title = isMissing 
                  ? (item.assignment?.name || item.title || 'Missing submission')
                  : ((item.plannable as any)?.title || (item.plannable as any)?.name || item.plannable_type || 'Item');
                
                const dueDate = (item.plannable as any)?.due_at || (item.plannable as any)?.todo_date;
                const postedDate = (item.plannable as any)?.posted_at || (item.plannable as any)?.created_at;
                const dateToShow = isAnnouncement ? postedDate : dueDate;
                
                return (
                  <div 
                    key={item.plannable_id ? `${item.plannable_id}-${item.account.id}` : `missing-${index}`} 
                    className={`todo-item-modern fade-in ${
                      isCompleted ? 'todo-kind-completed' :
                      isMissing ? 'todo-kind-missing' : 
                      isAssignment ? 'todo-kind-assignment' : 
                      'todo-kind-announcement'
                    }`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <Heading level="h5" style={{ margin: '0 0 x-small' }} className="todo-item-title">
                      {title}
                      {isCompleted && " ✅"}
                    </Heading>
                    <div className="todo-item-meta">
                      <Text size="small" style={{ margin: '0 0 x-small' }}>
                        {isAssignment && "📚 "}
                        {isCompleted && "📚 "}
                        {isAnnouncement && "📢 "}
                        {isMissing && "⚠️ "}
                        🏫 {item.account?.domain || 'unknown'}
                        {item.plannable_type && !isMissing && ` • ${item.plannable_type}`}
                      </Text>
                      {dateToShow && (
                        <Text size="small" style={{ margin: '0 0 x-small' }}>
                          📅 {isAnnouncement ? "Posted" : "Due"}: {formatDate(dateToShow)}
                          {relativeTime(dateToShow) && ` (${relativeTime(dateToShow)})`}
                        </Text>
                      )}
                      {isCompleted && (
                        <Text size="small" style={{ margin: '0 0 x-small', color: 'var(--success)' }}>
                          Submitted ✓
                        </Text>
                      )}
                      {isMissing && !dateToShow && (
                        <Text size="small" style={{ margin: '0 0 x-small', color: 'var(--danger)' }}>
                          Missing
                        </Text>
                      )}
                    </div>
                    <div className="todo-links">
                      {item.html_url && (
                        <>
                          {item.account?.domain && (
                            <Link href={`https://${item.account.domain}/${item.html_url}`} target="_blank">
                              <Text size="x-small">Canvas</Text>
                            </Link>
                          )}
                          <Link href={item.html_url}>
                            <Text size="x-small">{isMissing ? 'Open Assignment' : 'View in App'}</Text>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
