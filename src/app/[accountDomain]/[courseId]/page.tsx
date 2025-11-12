"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Link } from "@instructure/ui-link";
import { CanvasCourse, Account, fetchCourses } from "../../../components/canvasApi";
import CourseTodoSidebar from "../../../components/CourseTodoSidebar";
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

  return (
    <div className="fade-in" style={{
      padding: '2rem',
      margin: '0 auto'
    }}>
      <CourseHeader />
      <CourseNav accountDomain={accountDomain} courseId={courseId} />
      
      <div style={{ 
        display: 'flex', 
        gap: '2rem', 
        alignItems: 'flex-start',
        marginTop: '2rem'
      }}>
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
          <div style={{ 
            height: '1rem', 
            width: '70%', 
            marginBottom: '0.5rem',
            background: 'var(--border)',
            borderRadius: 'var(--radius-sm)',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            animationDelay: '0.3s'
          }}></div>
          <div style={{ 
            height: '1rem', 
            width: '60%',
            background: 'var(--border)',
            borderRadius: 'var(--radius-sm)',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            animationDelay: '0.4s'
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
      
      {!loading && !error && course && (
        <div className="fade-in">
          {/* Course Info Section */}
          <section className="modern-card" style={{
            padding: '2rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                textAlign: 'center',
                padding: '1.5rem',
                background: 'var(--secondary)',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.5rem'
                }}>Course ID</div>
                <Text size="small" style={{ color: 'var(--foreground)' }}>
                  {course.id}
                </Text>
              </div>
              
              <div style={{
                textAlign: 'center',
                padding: '1.5rem',
                background: 'var(--secondary)',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.5rem'
                }}>Status</div>
                <Text size="small" style={{ 
                  color: 'var(--foreground)',
                  textTransform: 'capitalize'
                }}>
                  {course.workflow_state.replace('_', ' ')}
                </Text>
              </div>
              
              <div style={{
                textAlign: 'center',
                padding: '1.5rem',
                background: 'var(--secondary)',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.5rem'
                }}>Enrollments</div>
                <Text size="small" style={{ color: 'var(--foreground)' }}>
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
                <Heading level="h4" margin="0 0 medium" style={{ color: 'var(--foreground)' }}>
                  📝 Course Details
                </Heading>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {course.start_at && (
                    <Text size="small" style={{ color: 'var(--foreground)' }}>
                      🗓️ <strong>Start:</strong> {new Date(course.start_at).toLocaleDateString()}
                    </Text>
                  )}
                  {course.end_at && (
                    <Text size="small" style={{ color: 'var(--foreground)' }}>
                      🏁 <strong>End:</strong> {new Date(course.end_at).toLocaleDateString()}
                    </Text>
                  )}
                  <Text size="small" style={{ color: 'var(--foreground)' }}>
                    🌍 <strong>Time Zone:</strong> {course.time_zone || 'N/A'}
                  </Text>
                  <Text size="small" style={{ color: 'var(--foreground)' }}>
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
                <Heading level="h4" margin="0 0 medium" style={{ color: 'var(--foreground)' }}>
                  ⚙️ Settings
                </Heading>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <Text size="small" style={{ color: 'var(--foreground)' }}>
                    📐 <strong>Blueprint:</strong> {course.blueprint ? '✅ Yes' : '❌ No'}
                  </Text>
                  <Text size="small" style={{ color: 'var(--foreground)' }}>
                    📋 <strong>Template:</strong> {course.template ? '✅ Yes' : '❌ No'}
                  </Text>
                  <Text size="small" style={{ color: 'var(--foreground)' }}>
                    ⚖️ <strong>Assignment Weights:</strong> {course.apply_assignment_group_weights ? '✅ Yes' : '❌ No'}
                  </Text>
                  <Text size="small" style={{ color: 'var(--foreground)' }}>
                    🏢 <strong>Account ID:</strong> {course.account_id}
                  </Text>
                </div>
              </div>
            </div>
          </section>
          
          {/* Enrollments Section */}
          {course.enrollments.length > 0 && (
            <section className="modern-card" style={{
              padding: '2rem',
              marginBottom: '2rem'
            }}>
              <Heading level="h3" margin="0 0 large" style={{ color: 'var(--foreground)' }}>
                👥 Enrollments
              </Heading>
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
                    <Text size="small" weight="bold" style={{ color: 'var(--foreground)' }}>
                      {e.type.charAt(0).toUpperCase() + e.type.slice(1)}
                    </Text>
                    <Text size="x-small" style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                      User ID: {e.user_id} • Status: {e.enrollment_state}
                    </Text>
                  </div>
                ))}
              </div>
            </section>
          )}
          
          {/* Calendar Section */}
          <section className="modern-card" style={{ padding: '2rem' }}>
            <Heading level="h3" margin="0 0 large" style={{ color: 'var(--foreground)' }}>
              📅 Calendar
            </Heading>
            {course.calendar?.ics ? (
              <div style={{
                padding: '1.5rem',
                background: 'var(--secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                textAlign: 'center'
              }}>
                <div style={{ marginBottom: '1rem' }}>
                  <Text size="medium" style={{ color: 'var(--foreground)' }}>
                    📥 Calendar feed available
                  </Text>
                </div>
                <Link href={course.calendar.ics} className="btn-primary" style={{
                  display: 'inline-block',
                  textDecoration: 'none'
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
                <Text style={{ color: 'var(--text-muted)' }}>
                  📅 No calendar feed available for this course
                </Text>
              </div>
            )}
          </section>
        </div>
      )}
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
    </div>
  );
}
