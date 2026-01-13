"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Link } from "@instructure/ui-link";
import { Flex } from "@instructure/ui-flex";
import { Button } from "@instructure/ui-buttons";
import {
  CanvasCourse,
  Account,
  fetchCourses,
  CourseModule,
  ModuleItem,
  fetchCourseModules,
  AssignmentGroup,
  fetchAssignmentGroups,
  WikiPage,
  fetchCourseFrontPage,
  fetchCoursePages,
} from "../../../components/canvasApi";
import CourseTodoSidebar from "../../../components/CourseTodoSidebar";
import "../../stylesheets/modules.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFile,
  faPenToSquare,
  faQuestionCircle,
  faComments,
  faLink,
  faCaretDown,
  faCaretRight,
} from "@fortawesome/free-solid-svg-icons";

// ============ Modules View Component ============
function ModulesView({
  account,
  courseId,
}: {
  account: Account;
  courseId: number;
}) {
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedModules, setCollapsedModules] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCourseModules(account, courseId)
      .then((data) => {
        if (!cancelled) setModules(Array.isArray(data) ? data : []);
      })
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [account, courseId]);

  const internalLinkForItem = (item: ModuleItem): string | null => {
    const type = item.type?.toLowerCase();
    if (type === "page") {
      if (item.page_url) return `./pages/${encodeURIComponent(item.page_url)}`;
      if (item.html_url) {
        const slugMatch = item.html_url.match(/\/pages\/(.+)$/);
        if (slugMatch) return `./pages/${encodeURIComponent(slugMatch[1])}`;
      }
      return null;
    }
    if (!item.content_id && type !== "external_url") return null;
    if (type === "assignment") return `./assignments/${item.content_id}`;
    if (type === "discussion") return `./discussions/${item.content_id}`;
    if (type === "file") return `./files/${item.content_id}`;
    if (type === "external_url") return (item as any).external_url || null;
    return null;
  };

  const toggleModule = (moduleId: number) => {
    setCollapsedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const getIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case "assignment": return faPenToSquare;
      case "quiz": return faQuestionCircle;
      case "file": return faFile;
      case "page": return faFile;
      case "discussion": return faComments;
      case "external_url": return faLink;
      case "sub_header": return null;
      default: return faFile;
    }
  };

  if (loading) return <Text>Loading modules...</Text>;
  if (error) return <Text color="danger">{error}</Text>;
  if (modules.length === 0) return <Text>No modules found.</Text>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <Heading level="h2" margin="0">Modules</Heading>
        <button
          onClick={() => {
            const allCollapsed = modules.every((m) => collapsedModules[m.id]);
            const newState: Record<number, boolean> = {};
            modules.forEach((m) => (newState[m.id] = !allCollapsed));
            setCollapsedModules(newState);
          }}
          style={{
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            padding: "5px 10px",
            cursor: "pointer",
            borderRadius: "3px",
            color: "var(--foreground)",
          }}
        >
          {modules.every((m) => collapsedModules[m.id]) ? "Expand All" : "Collapse All"}
        </button>
      </div>

      <div className="item-group-container">
        {modules.map((m) => (
          <div key={m.id} className="item-group-condensed context_module">
            <div
              className={`ig-header ${collapsedModules[m.id] ? "collapsed" : ""}`}
              onClick={() => toggleModule(m.id)}
            >
              <span className="ig-header-title">
                <FontAwesomeIcon
                  icon={collapsedModules[m.id] ? faCaretRight : faCaretDown}
                  className="icon-mini-arrow-down"
                />
                <span className="name">{m.name}</span>
              </span>
            </div>

            {!collapsedModules[m.id] && (
              <div className="content">
                <ul className="ig-list">
                  {m.items?.map((it) => {
                    const internal = internalLinkForItem(it);
                    const icon = getIcon(it.type);
                    const isSubHeader = it.type === "SubHeader";
                    const indentClass = `indent_${it.indent || 0}`;

                    if (isSubHeader) {
                      return (
                        <li key={it.id} className={`context_module_item ${indentClass}`}>
                          <div className="ig-row" style={{ background: "transparent", border: "none", paddingLeft: "10px" }}>
                            <div className="ig-info">
                              <div className="module-item-title">
                                <span className="item_name" style={{ fontWeight: "bold", color: "var(--text-muted)" }}>
                                  {it.title}
                                </span>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    }

                    return (
                      <li key={it.id} className={`context_module_item ${indentClass}`}>
                        <div className="ig-row">
                          <span className="type_icon">{icon && <FontAwesomeIcon icon={icon} />}</span>
                          <div className="ig-info">
                            <div className="module-item-title">
                              <span className="item_name">
                                {internal ? (
                                  <a
                                    href={internal}
                                    className="ig-title"
                                    target={it.type === "external_url" ? "_blank" : "_self"}
                                  >
                                    {it.title}
                                  </a>
                                ) : (
                                  <span className="ig-title" style={{ color: "var(--text-muted)" }}>
                                    {it.title}
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="ig-details">
                              {it.published === false && <span style={{ color: "red" }}>Unpublished</span>}
                            </div>
                          </div>
                          <div className="module-item-status-icon"></div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Assignments View Component ============
function AssignmentsView({
  account,
  courseId,
  accountDomain,
}: {
  account: Account;
  courseId: number;
  accountDomain: string;
}) {
  const [groups, setGroups] = useState<AssignmentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"group" | "due">("group");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAssignmentGroups(account, courseId)
      .then((data) => {
        if (!cancelled) setGroups(Array.isArray(data) ? data : []);
      })
      .catch((e: any) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [account, courseId]);

  const allAssignments = useMemo(() => {
    return groups.flatMap((g) => (g.assignments || []).map((a) => ({ ...a, group: g })));
  }, [groups]);

  const assignmentsByDue = useMemo(() => {
    return [...allAssignments].sort((a, b) => {
      const da = a.due_at ? new Date(a.due_at).getTime() : Infinity;
      const db = b.due_at ? new Date(b.due_at).getTime() : Infinity;
      if (da === db) return (a.name || "").localeCompare(b.name || "");
      return da - db;
    });
  }, [allAssignments]);

  if (loading) return <Text>Loading assignments...</Text>;
  if (error) return <Text color="danger">{error}</Text>;
  if (groups.length === 0) return <Text>No assignments found.</Text>;

  return (
    <View as="div">
      <Flex justifyItems="space-between" alignItems="center" margin="0 0 small">
        <Heading level="h2" margin="0">Assignments</Heading>
        <Button onClick={() => setSortMode((m) => (m === "group" ? "due" : "group"))}>
          Sort: {sortMode === "group" ? "By Due Date" : "By Group"}
        </Button>
      </Flex>

      {sortMode === "group" && (
        <Flex direction="column" gap="large">
          {groups.map((g) => (
            <View key={g.id}>
              <Heading level="h4" margin="0 0 small">{g.name}</Heading>
              {(!g.assignments || g.assignments.length === 0) && (
                <Text size="small" color="secondary">No assignments in this group.</Text>
              )}
              <View as="ul" margin="0" padding="0">
                {g.assignments?.map((a) => (
                  <View
                    key={a.id}
                    as="li"
                    margin="0 0 x-small"
                    padding="x-small small"
                    background="primary"
                    borderWidth="small"
                    borderRadius="medium"
                  >
                    <Text as="p" size="small" weight="bold">{a.name}</Text>
                    <Text as="p" size="x-small" color="secondary">
                      {a.due_at ? new Date(a.due_at).toLocaleString() : "No due date"}
                    </Text>
                    <Text as="p" size="x-small">Points: {a.points_possible ?? "—"}</Text>
                    <Text as="p" size="x-small">
                      <Link href={`/${accountDomain}/${courseId}/assignments/${a.id}`}>Open</Link>
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Flex>
      )}

      {sortMode === "due" && (
        <View as="ul" margin="0" padding="0">
          {assignmentsByDue.map((a) => (
            <View
              key={a.id}
              as="li"
              margin="0 0 x-small"
              padding="x-small small"
              background="primary"
              borderWidth="small"
              borderRadius="medium"
            >
              <Text as="p" size="small" weight="bold">{a.name}</Text>
              <Text as="p" size="x-small" color="secondary">
                {a.due_at ? new Date(a.due_at).toLocaleString() : "No due date"}
              </Text>
              <Text as="p" size="x-small">Points: {a.points_possible ?? "—"} | Group: {a.group.name}</Text>
              <Text as="p" size="x-small">
                <Link href={`/${accountDomain}/${courseId}/assignments/${a.id}`}>Open</Link>
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ============ Wiki (Front Page) View Component ============
function WikiView({
  account,
  courseId,
  accountDomain,
}: {
  account: Account;
  courseId: number;
  accountDomain: string;
}) {
  const [frontPage, setFrontPage] = useState<WikiPage | null>(null);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFrontPage, setHasFrontPage] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Try to fetch front page first
    fetchCourseFrontPage(account, courseId)
      .then((page) => {
        if (!cancelled) {
          setFrontPage(page);
          setHasFrontPage(true);
        }
      })
      .catch(() => {
        // No front page, fall back to pages list
        if (!cancelled) setHasFrontPage(false);
        return fetchCoursePages(account, courseId);
      })
      .then((pagesData) => {
        if (!cancelled && pagesData && Array.isArray(pagesData)) {
          setPages(pagesData);
        }
      })
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [account, courseId]);

  if (loading) return <Text>Loading wiki page...</Text>;
  if (error) return <Text color="danger">{error}</Text>;

  // Show front page content if available
  if (hasFrontPage && frontPage) {
    return (
      <div>
        <Heading level="h2" margin="0 0 medium">{frontPage.title}</Heading>
        {frontPage.body ? (
          <div
            className="user_content modern-card"
            style={{ padding: "1.5rem" }}
            dangerouslySetInnerHTML={{ __html: frontPage.body }}
          />
        ) : (
          <Text color="secondary">This page has no content.</Text>
        )}
        <div style={{ marginTop: "1rem" }}>
          <Link href={`/${accountDomain}/${courseId}/pages`}>View All Pages →</Link>
        </div>
      </div>
    );
  }

  // Fall back to pages list
  if (pages.length === 0) return <Text>No pages found.</Text>;

  return (
    <View as="div">
      <Heading level="h2" margin="0 0 medium">Pages</Heading>
      <Flex direction="column" gap="small">
        {pages.map((p) => {
          const internal = `/${accountDomain}/${courseId}/pages/${p.url}`;
          return (
            <View
              key={p.page_id}
              padding="x-small small"
              background="secondary"
              borderRadius="medium"
              borderWidth="small"
            >
              <Flex direction="column">
                <Text as="p" weight="bold" size="small">
                  <Link href={internal}>{p.title}</Link>
                  {p.front_page ? " (Front Page)" : ""}
                </Text>
                <Text as="p" size="x-small" color="secondary">
                  Slug: {p.url}
                  {p.published === false ? " (unpublished)" : ""}
                </Text>
              </Flex>
            </View>
          );
        })}
      </Flex>
    </View>
  );
}

// ============ Feed (Activity Dashboard) View Component ============
function FeedView({ course }: { course: CanvasCourse }) {
  return (
    <div className="fade-in">
      {/* Course Info Section */}
      <section className="modern-card" style={{ padding: "2rem", marginBottom: "2rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div style={{ textAlign: "center", padding: "1.5rem", background: "var(--secondary)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📚</div>
            <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              Course ID
            </div>
            <Text size="small" style={{ color: "var(--foreground)" }}>{course.id}</Text>
          </div>

          <div style={{ textAlign: "center", padding: "1.5rem", background: "var(--secondary)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📋</div>
            <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              Status
            </div>
            <Text size="small" style={{ color: "var(--foreground)", textTransform: "capitalize" }}>
              {course.workflow_state.replace("_", " ")}
            </Text>
          </div>

          <div style={{ textAlign: "center", padding: "1.5rem", background: "var(--secondary)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👥</div>
            <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              Enrollments
            </div>
            <Text size="small" style={{ color: "var(--foreground)" }}>{course.enrollments.length}</Text>
          </div>
        </div>

        {/* Course Details Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
          <div style={{ padding: "1.5rem", background: "var(--secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
            <Heading level="h4" margin="0 0 medium" style={{ color: "var(--foreground)" }}>📝 Course Details</Heading>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {course.start_at && (
                <Text size="small" style={{ color: "var(--foreground)" }}>
                  🗓️ <strong>Start:</strong> {new Date(course.start_at).toLocaleDateString()}
                </Text>
              )}
              {course.end_at && (
                <Text size="small" style={{ color: "var(--foreground)" }}>
                  🏁 <strong>End:</strong> {new Date(course.end_at).toLocaleDateString()}
                </Text>
              )}
              <Text size="small" style={{ color: "var(--foreground)" }}>
                🌍 <strong>Time Zone:</strong> {course.time_zone || "N/A"}
              </Text>
              <Text size="small" style={{ color: "var(--foreground)" }}>
                👁️ <strong>Default View:</strong> {course.default_view || "N/A"}
              </Text>
            </div>
          </div>

          <div style={{ padding: "1.5rem", background: "var(--secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
            <Heading level="h4" margin="0 0 medium" style={{ color: "var(--foreground)" }}>⚙️ Settings</Heading>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Text size="small" style={{ color: "var(--foreground)" }}>
                📐 <strong>Blueprint:</strong> {course.blueprint ? "✅ Yes" : "❌ No"}
              </Text>
              <Text size="small" style={{ color: "var(--foreground)" }}>
                📋 <strong>Template:</strong> {course.template ? "✅ Yes" : "❌ No"}
              </Text>
              <Text size="small" style={{ color: "var(--foreground)" }}>
                ⚖️ <strong>Assignment Weights:</strong> {course.apply_assignment_group_weights ? "✅ Yes" : "❌ No"}
              </Text>
              <Text size="small" style={{ color: "var(--foreground)" }}>
                🏢 <strong>Account ID:</strong> {course.account_id}
              </Text>
            </div>
          </div>
        </div>
      </section>

      {/* Enrollments Section */}
      {course.enrollments.length > 0 && (
        <section className="modern-card" style={{ padding: "2rem", marginBottom: "2rem" }}>
          <Heading level="h3" margin="0 0 large" style={{ color: "var(--foreground)" }}>👥 Enrollments</Heading>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
            {course.enrollments.map((e, i) => (
              <div key={i} style={{ padding: "1rem", background: "var(--secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                <Text size="small" weight="bold" style={{ color: "var(--foreground)" }}>
                  {e.type.charAt(0).toUpperCase() + e.type.slice(1)}
                </Text>
                <Text size="x-small" style={{ color: "var(--text-muted)", display: "block", marginTop: "0.25rem" }}>
                  User ID: {e.user_id} • Status: {e.enrollment_state}
                </Text>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Calendar Section */}
      <section className="modern-card" style={{ padding: "2rem" }}>
        <Heading level="h3" margin="0 0 large" style={{ color: "var(--foreground)" }}>📅 Calendar</Heading>
        {course.calendar?.ics ? (
          <div style={{ padding: "1.5rem", background: "var(--secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ marginBottom: "1rem" }}>
              <Text size="medium" style={{ color: "var(--foreground)" }}>📥 Calendar feed available</Text>
            </div>
            <Link href={course.calendar.ics} className="btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>
              Download ICS Feed
            </Link>
          </div>
        ) : (
          <div style={{ padding: "2rem", background: "var(--secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", textAlign: "center" }}>
            <Text style={{ color: "var(--text-muted)" }}>📅 No calendar feed available for this course</Text>
          </div>
        )}
      </section>
    </div>
  );
}

// ============ Syllabus View Component ============
function SyllabusView({ course, account }: { course: CanvasCourse; account: Account }) {
  return (
    <div className="modern-card" style={{ padding: "2rem" }}>
      <Heading level="h2" margin="0 0 medium">Syllabus</Heading>
      {course.syllabus_body ? (
        <div className="user_content" dangerouslySetInnerHTML={{ __html: course.syllabus_body }} />
      ) : (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <Text color="secondary">No syllabus content available.</Text>
          <div style={{ marginTop: "1rem" }}>
            <Link href={`https://${account.domain}/courses/${course.id}/assignments/syllabus`}>
              View on Canvas →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Main Course Page Component ============
export default function CoursePage() {
  const params = useParams();
  const accountDomain = (params?.accountDomain as string) || "";
  const courseIdParam = params?.courseId as string;
  const courseId = courseIdParam ? parseInt(courseIdParam, 10) : NaN;

  const [account, setAccount] = useState<Account | null>(null);
  const [course, setCourse] = useState<CanvasCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountDomain || isNaN(courseId)) return;

    // load account from localStorage
    try {
      const saved = localStorage.getItem("accounts");
      if (saved) {
        const accounts: Account[] = JSON.parse(saved);
        const found = accounts.find((a) => a.domain === accountDomain);
        if (found) setAccount(found); else setError("Account not found");
      } else {
        setError("No accounts in localStorage");
      }
    } catch {
      setError("Failed to parse accounts");
    }
  }, [accountDomain, courseId]);

  useEffect(() => {
    if (!account || isNaN(courseId)) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCourses(account)
      .then((courses) => {
        if (cancelled) return;
        const c = courses.find((c) => c.id === courseId) || null;
        setCourse(c);
        if (!c) setError("Course not found");
      })
      .catch((e: any) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [account, courseId]);

  if (!accountDomain || isNaN(courseId)) {
    return <Text>Invalid course URL.</Text>;
  }

  const renderDefaultView = () => {
    if (!course || !account) return null;

    const defaultView = course.default_view || "feed";

    switch (defaultView) {
      case "modules":
        return <ModulesView account={account} courseId={courseId} />;
      case "assignments":
        return <AssignmentsView account={account} courseId={courseId} accountDomain={accountDomain} />;
      case "wiki":
        return <WikiView account={account} courseId={courseId} accountDomain={accountDomain} />;
      case "syllabus":
        return <SyllabusView course={course} account={account} />;
      case "feed":
      default:
        return <FeedView course={course} />;
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
      
      {loading && (
        <div className="modern-card" style={{ padding: '2rem' }}>
          <div style={{ 
            height: '2rem', 
            width: '60%', 
            marginBottom: '1rem',
            background: 'var(--border)',
            borderRadius: 'var(--radius-sm)',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}></div>
          <div style={{ 
            height: '1rem', 
            width: '40%', 
            marginBottom: '2rem',
            background: 'var(--border)',
            borderRadius: 'var(--radius-sm)',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            animationDelay: '0.1s'
          }}></div>
          <div style={{ 
            height: '1rem', 
            width: '80%', 
            marginBottom: '0.5rem',
            background: 'var(--border)',
            borderRadius: 'var(--radius-sm)',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            animationDelay: '0.2s'
          }}></div>
        </div>
      )}
      
      {!loading && error && (
        <div className="modern-card" style={{
          padding: '2rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          textAlign: 'center'
        }}>
          <Text style={{ color: '#dc2626' }}>Error: {error}</Text>
        </div>
      )}
      
      {!loading && !error && course && renderDefaultView()}
      </div>
        
      {/* Course-specific Todo Sidebar */}
      <div style={{
        minWidth: '320px',
        maxWidth: '400px'
      }}>
        {account && course && (
          <CourseTodoSidebar 
            account={account}
            course={course}
            courseId={courseId}
          />
        )}
      </div>
    </div>
  );
}
