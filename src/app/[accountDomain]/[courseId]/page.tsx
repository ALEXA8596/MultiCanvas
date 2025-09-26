"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Flex } from "@instructure/ui-flex";
import { Link } from "@instructure/ui-link";
import { CanvasCourse, Account, fetchCourses, fetchPlannerItems, getMissingSubmissions } from "../../../components/canvasApi";
import TodoSidebar, { PlannerLike, MissingLike } from "../../../components/TodoSidebar";
import CourseNav from "./CourseNav";
import CourseHeader from "./CourseHeader";

export default function CoursePage() {
  const params = useParams();
  const accountDomain = (params?.accountDomain as string) || "";
  const courseIdParam = params?.courseId as string;
  const courseId = courseIdParam ? parseInt(courseIdParam, 10) : NaN;

  const [account, setAccount] = useState<Account | null>(null);
  const [course, setCourse] = useState<CanvasCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Todo sidebar data
  const [assignments, setAssignments] = useState<PlannerLike[]>([]);
  const [announcements, setAnnouncements] = useState<PlannerLike[]>([]);
  const [others, setOthers] = useState<PlannerLike[]>([]);
  const [missing, setMissing] = useState<MissingLike[]>([]);
  const [todoLoading, setTodoLoading] = useState(false);

  useEffect(() => {
    if (!accountDomain || isNaN(courseId)) return;
    const cancelled = false;

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

  // Fetch course-specific todo items
  useEffect(() => {
    if (!account || !course) return;
    let cancelled = false;
    setTodoLoading(true);

    const fetchCourseTodos = async () => {
      try {
        // Fetch planner items for this specific course using context_codes parameter
        const plannerParams = `?context_codes[]=course_${courseId}&per_page=100&order=desc`;
        const plannerItems = await fetchPlannerItems(account, plannerParams);
        
        if (cancelled) return;

        // Filter items by course context and categorize
        const courseItems = plannerItems.filter((item: any) => 
          item.context_name === course.name || 
          item.html_url?.includes(`/courses/${courseId}/`)
        );

        const assignmentItems: PlannerLike[] = [];
        const announcementItems: PlannerLike[] = [];
        const otherItems: PlannerLike[] = [];

        courseItems.forEach((item: any) => {
          const plannerItem: PlannerLike = {
            plannable_id: item.plannable_id,
            plannable_type: item.plannable_type,
            plannable: item.plannable,
            html_url: item.html_url,
            account: account,
            context_name: item.context_name,
            submissions: item.submissions
          };

          if (item.plannable_type === 'assignment') {
            assignmentItems.push(plannerItem);
          } else if (item.plannable_type === 'announcement' || item.plannable_type === 'discussion_topic') {
            announcementItems.push(plannerItem);
          } else {
            otherItems.push(plannerItem);
          }
        });

        // Fetch missing submissions for this course
        const missingItems = await getMissingSubmissions(account);
        const courseMissing = missingItems.filter((item: any) => 
          item.course_id === courseId
        ).map((item: any) => ({
          assignment: item.assignment,
          title: item.assignment?.name || item.title,
          html_url: item.html_url,
          account: account
        }));

        if (!cancelled) {
          setAssignments(assignmentItems);
          setAnnouncements(announcementItems);
          setOthers(otherItems);
          setMissing(courseMissing);
        }
      } catch (error) {
        console.error('Failed to fetch course todos:', error);
      } finally {
        if (!cancelled) setTodoLoading(false);
      }
    };

    fetchCourseTodos();
    return () => { cancelled = true; };
  }, [account, course, courseId]);

  if (!accountDomain || isNaN(courseId)) {
    return <Text>Invalid course URL.</Text>;
  }

  return (
    <div className="course-container fade-in">
      <CourseHeader />
      <CourseNav accountDomain={accountDomain} courseId={courseId} />
      
      <div className="dashboard-main-layout" style={{ 
        display: 'flex', 
        gap: '2rem', 
        alignItems: 'flex-start',
        marginTop: '2rem'
      }}>
        <div className="dashboard-main-content" style={{ flex: 1 }}>
      
      {loading && (
        <div style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          boxShadow: '0 2px 8px var(--shadow-light)'
        }}>
          <div className="skeleton" style={{ height: '2rem', width: '60%', marginBottom: '1rem' }}></div>
          <div className="skeleton" style={{ height: '1rem', width: '40%', marginBottom: '2rem' }}></div>
          <div className="skeleton" style={{ height: '1rem', width: '80%', marginBottom: '0.5rem' }}></div>
          <div className="skeleton" style={{ height: '1rem', width: '70%', marginBottom: '0.5rem' }}></div>
          <div className="skeleton" style={{ height: '1rem', width: '60%' }}></div>
        </div>
      )}
      
      {!loading && error && (
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
      
      {!loading && !error && course && (
        <div className="course-content fade-in">
          {/* Course Info Section */}
          <section style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            marginBottom: '2rem',
            boxShadow: '0 2px 8px var(--shadow-light)'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem'
            }}>
              <div className="stat-card">
                <div className="stat-number">📚</div>
                <div className="stat-label">Course ID</div>
                <Text size="small" color="secondary" style={{ marginTop: '0.5rem' }}>
                  {course.id}
                </Text>
              </div>
              
              <div className="stat-card">
                <div className="stat-number">📋</div>
                <div className="stat-label">Status</div>
                <Text size="small" color="secondary" style={{ 
                  marginTop: '0.5rem',
                  textTransform: 'capitalize'
                }}>
                  {course.workflow_state.replace('_', ' ')}
                </Text>
              </div>
              
              <div className="stat-card">
                <div className="stat-number">👥</div>
                <div className="stat-label">Enrollments</div>
                <Text size="small" color="secondary" style={{ marginTop: '0.5rem' }}>
                  {course.enrollments.length}
                </Text>
              </div>
            </div>
            
            {/* Course Details Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1.5rem'
            }}>
              {/* Basic Info */}
              <div style={{
                padding: '1.5rem',
                background: 'var(--secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)'
              }}>
                <Heading level="h4" margin="0 0 medium">📝 Course Details</Heading>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {course.start_at && (
                    <Text size="small">
                      🗓️ <strong>Start:</strong> {new Date(course.start_at).toLocaleDateString()}
                    </Text>
                  )}
                  {course.end_at && (
                    <Text size="small">
                      🏁 <strong>End:</strong> {new Date(course.end_at).toLocaleDateString()}
                    </Text>
                  )}
                  <Text size="small">
                    🌍 <strong>Time Zone:</strong> {course.time_zone || 'N/A'}
                  </Text>
                  <Text size="small">
                    👁️ <strong>Default View:</strong> {course.default_view || 'N/A'}
                  </Text>
                </div>
              </div>
              
              {/* Settings */}
              <div style={{
                padding: '1.5rem',
                background: 'var(--secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)'
              }}>
                <Heading level="h4" margin="0 0 medium">⚙️ Settings</Heading>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <Text size="small">
                    📐 <strong>Blueprint:</strong> {course.blueprint ? '✅ Yes' : '❌ No'}
                  </Text>
                  <Text size="small">
                    📋 <strong>Template:</strong> {course.template ? '✅ Yes' : '❌ No'}
                  </Text>
                  <Text size="small">
                    ⚖️ <strong>Assignment Weights:</strong> {course.apply_assignment_group_weights ? '✅ Yes' : '❌ No'}
                  </Text>
                  <Text size="small">
                    🏢 <strong>Account ID:</strong> {course.account_id}
                  </Text>
                </div>
              </div>
            </div>
          </section>
          
          {/* Enrollments Section */}
          {course.enrollments.length > 0 && (
            <section style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              marginBottom: '2rem',
              boxShadow: '0 2px 8px var(--shadow-light)'
            }}>
              <Heading level="h3" margin="0 0 large">👥 Enrollments</Heading>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem'
              }}>
                {course.enrollments.map((e, i) => (
                  <div key={i} style={{
                    padding: '1rem',
                    background: 'var(--secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)'
                  }}>
                    <Text size="small" weight="bold">
                      {e.type.charAt(0).toUpperCase() + e.type.slice(1)}
                    </Text>
                    <Text size="x-small" color="secondary" style={{ display: 'block', marginTop: '0.25rem' }}>
                      User ID: {e.user_id} • Status: {e.enrollment_state}
                    </Text>
                  </div>
                ))}
              </div>
            </section>
          )}
          
          {/* Calendar Section */}
          <section style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            boxShadow: '0 2px 8px var(--shadow-light)'
          }}>
            <Heading level="h3" margin="0 0 large">📅 Calendar</Heading>
            {course.calendar?.ics ? (
              <div style={{
                padding: '1.5rem',
                background: 'var(--secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                textAlign: 'center'
              }}>
                <div style={{ marginBottom: '1rem' }}>
                  <Text size="medium">
                    📥 Calendar feed available
                  </Text>
                </div>
                <Link href={course.calendar.ics} className="btn-primary" style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  textDecoration: 'none',
                  borderRadius: 'var(--radius-md)'
                }}>
                  Download ICS Feed
                </Link>
              </div>
            ) : (
              <div style={{
                padding: '2rem',
                background: 'var(--secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                textAlign: 'center'
              }}>
                <Text color="secondary">📅 No calendar feed available for this course</Text>
              </div>
            )}
          </section>
        </div>
      )}
        </div>
        
        {/* Course-specific Todo Sidebar */}
        <div className="todo-sidebar-container">
          {!todoLoading && course && (
            <TodoSidebar 
              assignments={assignments}
              announcements={announcements}
              others={others}
              missing={missing}
            />
          )}
          {todoLoading && (
            <div style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              boxShadow: '0 2px 8px var(--shadow-light)',
              width: '22rem'
            }}>
              <div className="skeleton" style={{ height: '1.5rem', width: '60%', marginBottom: '1rem' }}></div>
              <div className="skeleton" style={{ height: '8rem', width: '100%', marginBottom: '1rem' }}></div>
              <div className="skeleton" style={{ height: '1rem', width: '80%', marginBottom: '0.5rem' }}></div>
              <div className="skeleton" style={{ height: '1rem', width: '70%', marginBottom: '0.5rem' }}></div>
              <div className="skeleton" style={{ height: '1rem', width: '60%' }}></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
