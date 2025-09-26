"use client";
import React, { useMemo, useState, useCallback, useRef } from "react";
import CircularProgress from "./CircularProgress";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Link } from "@instructure/ui-link";
import "../app/stylesheets/todo-sidebar.css";

export interface PlannerLike {
  plannable_id?: any;
  plannable_type?: string;
  plannable?: any;
  html_url?: string;
  account: any;
  context_name?: string;
  submissions?: { submitted?: boolean };
}

export interface MissingLike {
  assignment?: { name?: string };
  title?: string;
  html_url?: string;
  account?: any;
}

interface Props {
  assignments: PlannerLike[];
  announcements: PlannerLike[];
  others: PlannerLike[];
  missing: MissingLike[];
}

const formatDate = (d?: string) => {
  if (!d) return null;
  const date = new Date(d);
  return isNaN(date.getTime()) ? d : date.toLocaleDateString();
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

// Helper function to get the Monday of the current week
const getMondayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  return new Date(d.setDate(diff));
};

// Helper function to format date range
const formatDateRange = (startDate: Date): string => {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 7); // 7 days + 1 day for the range
  return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
};

// Helper function to check if a date is within the interval
const isDateInInterval = (dates: (string | undefined)[] | undefined, intervalStart: Date): boolean => {
  // Ensure dates is an array
  if (!dates || !Array.isArray(dates)) return true;
  
  // Try each date field until we find a valid one
  for (const date of dates) {
    if (!date) continue;
    
    const itemDate = new Date(date);
    if (isNaN(itemDate.getTime())) continue;
    
    const intervalEnd = new Date(intervalStart);
    intervalEnd.setDate(intervalStart.getDate() + 8); // 7 days + 1 day
    
    // Reset time to start of day for proper comparison
    const itemDateOnly = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
    const intervalStartOnly = new Date(intervalStart.getFullYear(), intervalStart.getMonth(), intervalStart.getDate());
    const intervalEndOnly = new Date(intervalEnd.getFullYear(), intervalEnd.getMonth(), intervalEnd.getDate());
    
    // If we found a valid date, use it for filtering
    return itemDateOnly >= intervalStartOnly && itemDateOnly < intervalEndOnly;
  }
  
  // If no valid date found, include the item (show items without dates)
  return true;
};

export default function TodoSidebar({
  assignments,
  announcements,
  others,
  missing,
}: Props) {
  const [filter, setFilter] = useState<TabKey>("assignments");
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [isSearchCollapsed, setIsSearchCollapsed] = useState(false);
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  const [isViewCollapsed, setIsViewCollapsed] = useState(false);
  const [intervalStart, setIntervalStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const tabRefs = useRef<HTMLButtonElement[]>([]);

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

  const onKeyTabs = useCallback(
    (e: React.KeyboardEvent) => {
      const order: TabKey[] = [
        "all",
        "assignments",
        "announcements",
        "missing",
      ];
      const idx = order.indexOf(filter);
      if (e.key === "ArrowRight") {
        const n = order[(idx + 1) % order.length];
        setFilter(n);
        tabRefs.current[order.indexOf(n)]?.focus();
      } else if (e.key === "ArrowLeft") {
        const n = order[(idx - 1 + order.length) % order.length];
        setFilter(n);
        tabRefs.current[order.indexOf(n)]?.focus();
      }
    },
    [filter]
  );

  // Memoized filtered lists to prevent accumulation issues
  const dedupedAssignments = useMemo(() => assignments.filter(
    (item, idx, self) =>
      idx ===
      self.findIndex(
        (t) =>
          t.plannable_id === item.plannable_id &&
          t.account.id === item.account.id
      )
  ), [assignments]);

  // Deduplicate announcements (combine announcements and others arrays)
  const dedupedAnnouncements = useMemo(() => {
    const combined = [...announcements, ...others];
    return combined.filter(
      (item, idx, self) =>
        idx ===
        self.findIndex(
          (t) =>
            t.plannable_id === item.plannable_id &&
            t.account.id === item.account.id
        )
    );
  }, [announcements, others]);
  
  const filteredQuery = useCallback((title: string) =>
    title.toLowerCase().includes(query.toLowerCase()), [query]);
    
  const assignmentList = useMemo(() => {
    const filtered = dedupedAssignments.filter((it) => {
      if (
        !it ||
        (it.plannable_type && it.plannable_type.toLowerCase() !== "assignment")
      )
        return false; // guard: only true assignments
      
      // Exclude completed assignments (those with submissions.submitted === true)
      if (it.submissions?.submitted === true) 
        return false;
      
      // Check if the assignment is within the current interval
      // Try multiple date fields: due_at, todo_date, created_at
      if (!isDateInInterval([
        it.plannable?.due_at,
        it.plannable?.todo_date,
        it.plannable?.created_at
      ], intervalStart))
        return false;
        
      const title = it.plannable?.title || it.plannable?.name || "Assignment";
      if (domainFilter !== "all" && it.account.domain !== domainFilter)
        return false;
      return query ? filteredQuery(title) : true;
    });

    // Sort by due_at date (earliest first, items without dates last)
    return filtered.sort((a, b) => {
      const aDate = a.plannable?.due_at;
      const bDate = b.plannable?.due_at;
      
      // If both have no date, maintain original order
      if (!aDate && !bDate) return 0;
      // If only a has no date, put it last
      if (!aDate) return 1;
      // If only b has no date, put it last
      if (!bDate) return -1;
      
      // Both have dates, sort chronologically
      const dateA = new Date(aDate);
      const dateB = new Date(bDate);
      
      // Handle invalid dates
      if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      
      return dateA.getTime() - dateB.getTime();
    });
  }, [dedupedAssignments, domainFilter, query, filteredQuery, intervalStart]);

  // Completed assignments list
  const completedList = useMemo(() => {

    
    const filtered = dedupedAssignments.filter((it) => {
      if (
        !it ||
        (it.plannable_type && it.plannable_type.toLowerCase() !== "assignment")
      )
        return false; // guard: only true assignments
      
      const hasSubmission = 
        it.plannable?.submissions?.submitted === true ||
        it.plannable?.submission?.submitted === true ||
        (it as any).submissions?.submitted === true ||
        (it as any).submission?.submitted === true ||
        it.plannable?.has_submissions === true ||
        it.plannable?.submitted === true ||
        (it as any).submitted === true;
        
      if (!hasSubmission) 
        return false;
      
      // Check if the assignment is within the current interval
      if (!isDateInInterval([
        it.plannable?.due_at,
        it.plannable?.todo_date,
        it.plannable?.created_at
      ], intervalStart))
        return false;
        
      const title = it.plannable?.title || it.plannable?.name || "Assignment";
      if (domainFilter !== "all" && it.account.domain !== domainFilter)
        return false;
      return query ? filteredQuery(title) : true;
    });

    // Sort by due_at date (most recent first)
    return filtered.sort((a, b) => {
      const aDate = a.plannable?.due_at;
      const bDate = b.plannable?.due_at;
      
      // If both have no date, maintain original order
      if (!aDate && !bDate) return 0;
      // If only a has no date, put it last
      if (!aDate) return 1;
      // If only b has no date, put it last
      if (!bDate) return -1;
      
      // Both have dates, sort chronologically (most recent first for completed)
      const dateA = new Date(aDate);
      const dateB = new Date(bDate);
      
      // Handle invalid dates
      if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      
      return dateB.getTime() - dateA.getTime(); // Reverse order for completed
    });
  }, [dedupedAssignments, domainFilter, query, filteredQuery, intervalStart]);
  
  const announcementList = useMemo(() => {
    const filtered = dedupedAnnouncements.filter((it) => {
      const pt = it.plannable_type?.toLowerCase();
      // guard: only announcement-like types
      if (!(pt && (pt.includes("announcement") || pt.includes("discussion"))))
        return false;
        
      // Check if the announcement is within the current interval
      // Try multiple date fields: posted_at, todo_date, created_at
      if (!isDateInInterval([
        it.plannable?.posted_at,
        it.plannable?.todo_date,
        it.plannable?.created_at
      ], intervalStart))
        return false;
        
      const title = it.plannable?.title || it.plannable?.message || "Announcement";
      if (domainFilter !== "all" && it.account.domain !== domainFilter)
        return false;
      return query ? filteredQuery(title) : true;
    });

    // Sort by creation date (most recent first)
    return filtered.sort((a, b) => {
      const aDate = a.plannable?.posted_at || a.plannable?.created_at;
      const bDate = b.plannable?.posted_at || b.plannable?.created_at;
      
      // If both have no date, maintain original order
      if (!aDate && !bDate) return 0;
      // If only a has no date, put it last
      if (!aDate) return 1;
      // If only b has no date, put it last
      if (!bDate) return -1;
      
      // Both have dates, sort by most recent first
      const dateA = new Date(aDate);
      const dateB = new Date(bDate);
      
      // Handle invalid dates
      if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });
  }, [dedupedAnnouncements, domainFilter, query, filteredQuery, intervalStart]);
  
  const missingList = useMemo(() => missing.filter((m) => {
    const title = m.assignment?.name || m.title || "Missing submission";
    if (domainFilter !== "all" && m.account?.domain !== domainFilter)
      return false;
    return query ? filteredQuery(title) : true;
  }), [missing, domainFilter, query, filteredQuery]);

  const groupedAll = useMemo(() => {
    const combined = [
      ...assignmentList.map((a) => ({
        kind: "assignment",
        key: `a-${a.plannable_id}-${a.account.id}`,
        title: a.plannable?.title || a.plannable?.name || "Assignment",
        date: a.plannable?.due_at || a.plannable?.todo_date,
        domain: a.account.domain,
        className: a.context_name || "Unknown Class",
        canvasUrl: `https://${a.account.domain}/${a.html_url}`,
        appUrl: a.html_url,
      })),
      ...completedList.map((a) => ({
        kind: "completed",
        key: `c-${a.plannable_id}-${a.account.id}`,
        title: a.plannable?.title || a.plannable?.name || "Assignment",
        date: a.plannable?.due_at || a.plannable?.todo_date,
        domain: a.account.domain,
        className: a.context_name || "Unknown Class",
        canvasUrl: `https://${a.account.domain}/${a.html_url}`,
        appUrl: a.html_url,
      })),
      ...announcementList.map((a) => ({
        kind: "announcement",
        key: `an-${a.plannable_id}-${a.account.id}`,
        title: a.plannable?.title || a.plannable?.message || "Announcement",
        date: a.plannable?.posted_at || a.plannable?.todo_date,
        domain: a.account.domain,
        className: a.context_name || "Unknown Class",
        canvasUrl: `https://${a.account.domain}/${a.html_url}`,
        appUrl: a.html_url,
      })),
      ...missingList.map((m, idx) => ({
        kind: "missing",
        key: `m-${idx}`,
        title: m.assignment?.name || m.title || "Missing submission",
        date: undefined,
        domain: m.account?.domain || "unknown",
        className: (m as any)?.context_name || "Unknown Class",
        canvasUrl: m.html_url ? m.html_url : undefined,
        appUrl: m.html_url,
      })),
    ].sort(
      (a, b) =>
        (a.date ? new Date(a.date).getTime() : Infinity) -
        (b.date ? new Date(b.date).getTime() : Infinity)
    );
    // group by domain for headers
    const grouped: {
      domain: string;
      items: typeof combined;
      progress: number;
    }[] = [] as any;
    combined.forEach((item) => {
      let group = grouped.find((g) => g.domain === item.domain);
      if (!group) {
        group = { domain: item.domain, items: [] as any, progress: 0 };
        grouped.push(group);
      }
      (group.items as any).push(item);
    });
    // compute naive progress per domain (assignments vs missing)
    grouped.forEach((g) => {
      const aCount = g.items.filter((i) => i.kind === "assignment").length;
      const mCount = g.items.filter((i) => i.kind === "missing").length;
      const domainTotal = aCount + mCount;
      g.progress =
        domainTotal === 0
          ? 0
          : Math.round(
              ((aCount - mCount < 0 ? 0 : aCount - mCount) / domainTotal) * 100
            );
    });
    return grouped;
  }, [assignmentList, completedList, announcementList, missingList]);

  const allCount = useMemo(
    () => groupedAll.reduce((acc, g) => acc + g.items.length, 0),
    [groupedAll]
  );
  const allDomains = useMemo(() => {
    const set = new Set<string>();
    [...dedupedAssignments, ...dedupedAnnouncements, ...missing].forEach((i) => {
      if (i.account?.domain) set.add(i.account.domain);
    });
    return Array.from(set).sort();
  }, [dedupedAssignments, dedupedAnnouncements, missing]);

  // Calculate weekly progress: completed assignments vs total assignments in current interval
  const weeklyTotal = assignmentList.length + completedList.length;
  const weeklyCompleted = completedList.length;
  const percent = weeklyTotal === 0 ? 0 : Math.round((weeklyCompleted / weeklyTotal) * 100);

  const radius = 60;
  const stroke = 14;
  const norm = radius - stroke / 2;
  const circ = 2 * Math.PI * norm;
  const offset = circ - (percent / 100) * circ;

  const renderAllSection = useMemo(() => (
    <View as="div" margin="0" padding="0" className="todo-items">
      {groupedAll.length === 0 && (
        <Text size="small" color="secondary">
          No items.
        </Text>
      )}
      {groupedAll.map((group) => (
        <div key={group.domain} className="todo-group">
          <div className="todo-group-header">
            <span className="todo-group-progress">
              <CircularProgress
                size={26}
                stroke={4}
                value={group.progress}
                showText={false}
                ariaLabel={`${group.domain} progress`}
              />
            </span>
            <span>{group.domain}</span>
            <span className="todo-group-count">{group.items.length}</span>
          </div>
          <View as="ul" margin="0 0 small" padding="0">
            {group.items.map((it) => (
              <View
                as="li"
                key={it.key}
                margin="0 0 x-small"
                padding="x-small small"
                borderWidth="small"
                borderRadius="small"
                className={`todo-item todo-kind-${it.kind}`}
              >
                <Text as="p" weight="bold" size="small">
                  {it.title}
                  {it.kind === "completed" && " ✅"}
                </Text>
                <Text as="p" size="x-small" color="secondary">
                  {it.kind === "assignment" && "📚 "}
                  {it.kind === "completed" && "📚 "}
                  {it.kind === "announcement" && "📢 "}
                  {it.kind === "missing" && "⚠️ "}
                  {it.className} • {it.domain}
                </Text>
                {it.date && (
                  <Text as="p" size="x-small" color="secondary">
                    {it.kind === "announcement" ? "Posted" : "Due"}: {formatDate(it.date)} (
                    {relativeTime(it.date)})
                  </Text>
                )}
                {it.kind === "missing" && !it.date && (
                  <Text as="p" size="x-small" color="secondary">
                    Missing
                  </Text>
                )}
                {it.kind === "completed" && (
                  <Text as="p" size="x-small" color="success">
                    Submitted ✓
                  </Text>
                )}
                <Text as="p" size="x-small">
                  <Link href={it.canvasUrl || it.appUrl}>Canvas</Link>
                </Text>
                <Text as="p" size="x-small">
                  <Link href={it.appUrl}>App</Link>
                </Text>
              </View>
            ))}
          </View>
        </div>
      ))}
    </View>
  ), [groupedAll]);

  const renderAssignmentsSection = useMemo(() => (
    <View as="ul" margin="0" padding="0">
      {assignmentList.length === 0 && (
        <Text size="small" color="secondary">
          No assignments.
        </Text>
      )}
      {assignmentList.map((it) => (
        <View
          as="li"
          key={`a-${it.plannable_id}-${it.account.id}`}
          margin="0 0 x-small"
          padding="x-small small"
          borderWidth="small"
          borderRadius="small"
          className="todo-item todo-kind-assignment"
        >
          <Text as="p" weight="bold" size="small">
            {it.plannable?.title || it.plannable?.name || "Assignment"}
          </Text>
          <Text as="p" size="x-small" color="secondary">
            📚 {it.context_name || "Unknown Class"} • {it.account.domain}
          </Text>
          {it.plannable?.due_at && (
            <Text as="p" size="x-small" color="secondary">
              Due: {formatDate(it.plannable.due_at)} (
              {relativeTime(it.plannable.due_at)})
            </Text>
          )}
          <Text as="p" size="x-small">
            <Link href={`https://${it.account.domain}/${it.html_url}`}>
              Canvas
            </Link>
          </Text>
          <Text as="p" size="x-small">
            <Link href={it.html_url}>App</Link>
          </Text>
        </View>
      ))}
    </View>
  ), [assignmentList]);

  const renderAnnouncementsSection = useMemo(() => (
    <View as="ul" margin="0" padding="0">
      {announcementList.length === 0 && (
        <Text size="small" color="secondary">
          No announcements.
        </Text>
      )}
      {announcementList.map((it) => (
        <View
          as="li"
          key={`an-${it.plannable_id}-${it.account.id}`}
          margin="0 0 x-small"
          padding="x-small small"
          borderWidth="small"
          borderRadius="small"
          className="todo-item todo-kind-announcement"
        >
          <Text as="p" weight="bold" size="small">
            {it.plannable?.title || it.plannable?.message || "Announcement"}
          </Text>
          <Text as="p" size="x-small" color="secondary">
            📢 {it.context_name || "Unknown Class"} • {it.account.domain}
          </Text>
          {it.plannable?.posted_at && (
            <Text as="p" size="x-small" color="secondary">
              Posted: {formatDate(it.plannable.posted_at)} (
              {relativeTime(it.plannable.posted_at)})
            </Text>
          )}
          <Text as="p" size="x-small">
            <Link href={`https://${it.account.domain}/${it.html_url}`}>
              Canvas
            </Link>
          </Text>
          <Text as="p" size="x-small">
            <Link href={it.html_url}>App</Link>
          </Text>
        </View>
      ))}
    </View>
  ), [announcementList]);

  const renderMissingSection = useMemo(() => (
    <View as="ul" margin="0" padding="0">
      {missingList.length === 0 && (
        <Text size="small" color="secondary">
          No missing.
        </Text>
      )}
      {missingList.map((m, idx) => (
        <View
          as="li"
          key={idx}
          margin="0 0 x-small"
          padding="x-small small"
          borderWidth="small"
          borderRadius="small"
          className="todo-item todo-kind-missing"
        >
          <Text as="p" weight="bold" size="small">
            {m.assignment
              ? m.assignment.name
              : m.title || "Missing submission"}
          </Text>
          <Text as="p" size="x-small" color="secondary">
            ⚠️ Missing • {m.account?.domain || "unknown"}
          </Text>
          {m.html_url && (
            <Text as="p" size="x-small">
              <Link href={m.html_url}>Open</Link>
            </Text>
          )}
        </View>
      ))}
    </View>
  ), [missingList]);

  const renderCompletedSection = useMemo(() => (
    <View as="ul" margin="0" padding="0">
      {completedList.length === 0 && (
        <Text size="small" color="secondary">
          No completed assignments.
        </Text>
      )}
      {completedList.map((it) => (
        <View
          as="li"
          key={`comp-${it.plannable_id}-${it.account.id}`}
          margin="0 0 x-small"
          padding="x-small small"
          borderWidth="small"
          borderRadius="small"
          className="todo-item todo-kind-completed"
        >
          <Text as="p" weight="bold" size="small">
            {it.plannable?.title || it.plannable?.name || "Assignment"} ✅
          </Text>
          <Text as="p" size="x-small" color="secondary">
            📚 {it.context_name || "Unknown Class"} • {it.account.domain}
          </Text>
          {it.plannable?.due_at && (
            <Text as="p" size="x-small" color="secondary">
              Due: {formatDate(it.plannable.due_at)} (
              {relativeTime(it.plannable.due_at)})
            </Text>
          )}
          <Text as="p" size="x-small" color="success">
            Submitted ✓
          </Text>
          <Text as="p" size="x-small">
            <Link href={`https://${it.account.domain}/${it.html_url}`}>
              Canvas
            </Link>
          </Text>
          <Text as="p" size="x-small">
            <Link href={it.html_url}>App</Link>
          </Text>
        </View>
      ))}
    </View>
  ), [completedList]);

  const sections: Record<string, React.ReactNode> = {
    all: renderAllSection,
    assignments: renderAssignmentsSection,
    announcements: renderAnnouncementsSection,
    completed: renderCompletedSection,
    missing: renderMissingSection,
  };

  return (
    <View
      as="aside"
      width="20rem"
      background="secondary"
      shadow="resting"
      borderRadius="medium"
      padding="medium"
      maxHeight="100vh"
      overflowY="auto"
      className="todo-sidebar"
    >
      <Heading level="h4" margin="0 0 small">
        To-Do
      </Heading>
      <div
        className="todo-progress-ring"
        title={`Weekly Progress: ${weeklyCompleted}/${weeklyTotal} assignments completed`}
      >
        <svg
          width={140}
          height={140}
          role="img"
          aria-label={`Progress ${percent}%`}
        >
          <defs>
            <linearGradient id="todoGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#31b36b" />
              <stop offset="100%" stopColor="#00843d" />
            </linearGradient>
          </defs>
          <circle
            r={radius - stroke / 2}
            cx={70}
            cy={70}
            strokeWidth={stroke}
            fill="transparent"
            className="todo-ring-bg"
          />
          <circle
            r={norm}
            cx={70}
            cy={70}
            strokeWidth={stroke}
            fill="transparent"
            className="todo-ring-progress"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
          <text
            x="50%"
            y="50%"
            dominantBaseline="middle"
            textAnchor="middle"
            className="todo-ring-text"
            style={{ fill: 'var(--foreground-muted)' }}
          >
            {percent}%
          </text>
          <text
            x="50%"
            y="62%"
            dominantBaseline="middle"
            textAnchor="middle"
            className="todo-ring-subtext"
            style={{ fill: 'var(--text-muted)' }}
          >
            {weeklyCompleted}/{weeklyTotal}
          </text>
        </svg>
        <div className="todo-progress-label">
          <span className="status-dot" /> <text style={{ fill: 'var(--foreground-muted)' }}>This Week</text>
        </div>
      </div>
      
      <div className="todo-option-group">
        <div className="group-title">
          <span>Week Interval</span>
        </div>
        <div className="todo-interval-controls">
          <button 
            className="interval-nav-btn" 
            onClick={goToPreviousWeek}
            title="Previous week"
          >
            ◀
          </button>
          <div className="interval-display">
            <div className="interval-dates">{formatDateRange(intervalStart)}</div>
            <button 
              className="interval-current-btn" 
              onClick={goToCurrentWeek}
              title="Go to current week"
            >
              Current Week
            </button>
          </div>
          <button 
            className="interval-nav-btn" 
            onClick={goToNextWeek}
            title="Next week"
          >
            ▶
          </button>
        </div>
      </div>
      
      <div className="todo-option-group">
        <div 
          className="group-title collapsible-header" 
          onClick={() => setIsSearchCollapsed(!isSearchCollapsed)}
          role="button"
          aria-expanded={!isSearchCollapsed}
        >
          <span>Search</span>
          <span className={`collapse-icon ${isSearchCollapsed ? 'collapsed' : ''}`}>▼</span>
        </div>
        {!isSearchCollapsed && (
          <div className="todo-search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              aria-label="Search to-do items"
            />
          </div>
        )}
      </div>

      <div className="todo-option-group">
        <div 
          className="group-title collapsible-header" 
          onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
          role="button"
          aria-expanded={!isFilterCollapsed}
        >
          <span>Filter</span>
          <span className={`collapse-icon ${isFilterCollapsed ? 'collapsed' : ''}`}>▼</span>
        </div>
        {!isFilterCollapsed && (
          <div
            className="todo-domain-filters"
            role="radiogroup"
            aria-label="Filter by domain"
          >
            <button
              className={domainFilter === "all" ? "active" : ""}
              onClick={() => setDomainFilter("all")}
              role="radio"
              aria-checked={domainFilter === "all"}
            >
              All
            </button>
            {allDomains.map((d) => (
              <button
                key={d}
                className={domainFilter === d ? "active" : ""}
                onClick={() => setDomainFilter(d)}
                role="radio"
                aria-checked={domainFilter === d}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="todo-option-group" aria-label="Tabs">
        <div 
          className="group-title collapsible-header" 
          onClick={() => setIsViewCollapsed(!isViewCollapsed)}
          role="button"
          aria-expanded={!isViewCollapsed}
        >
          <span>View</span>
          <span className={`collapse-icon ${isViewCollapsed ? 'collapsed' : ''}`}>▼</span>
        </div>
        {!isViewCollapsed && (
          <div className="todo-tabs" role="tablist" onKeyDown={onKeyTabs}>
            {(["all", "assignments", "announcements", "completed", "missing"] as TabKey[]).map(
              (k, i) => (
                <button
                  key={k}
                  ref={(el) => {
                    if (el) tabRefs.current[i] = el;
                  }}
                  role="tab"
                  aria-selected={filter === k}
                  className={filter === k ? "active" : ""}
                  onClick={() => setFilter(k)}
                >
                  {k === "all" && <>All {allCount}</>}
                  {k === "assignments" && <>📄 {assignmentList.length}</>}
                  {k === "announcements" && <>🔔 {announcementList.length}</>}
                  {k === "completed" && <>✅ {completedList.length}</>}
                  {k === "missing" && <>❌ {missingList.length}</>}
                </button>
              )
            )}
          </div>
        )}
      </div>
      <div className="todo-section" role="tabpanel">
        {useMemo(() => sections[filter], [sections, filter])}
      </div>
    </View>
  );
}
