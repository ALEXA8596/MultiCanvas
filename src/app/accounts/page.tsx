"use client"
import { useEffect, useState } from "react"
import AccountForm from "../../components/AccountForm"
import { fetchAllCourses, Account } from "../../components/canvasApi"
import { View } from "@instructure/ui-view"
import { Flex } from "@instructure/ui-flex"
import { Heading } from "@instructure/ui-heading"
import { Text } from "@instructure/ui-text"
import { Link } from "@instructure/ui-link"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faBookOpen } from '@fortawesome/free-solid-svg-icons'

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [coursesData, setCoursesData] = useState<{ account: Account; courses: any[] }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (accounts.length === 0) {
      setCoursesData([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchAllCourses(accounts)
      .then((results: any) => {
        if (!cancelled) setCoursesData(results)
      })
      .catch((e: any) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [accounts])

  useEffect(() => {
    const saved = localStorage.getItem("accounts")
    if (saved) {
      try {
        setAccounts(JSON.parse(saved))
      } catch {
        // ignore parse errors
      }
    }
  }, [])

  return (
    <div className="fade-in" style={{
      padding: '2rem',
      margin: '0 auto'
    }}>
      {/* Page Header */}
      <div style={{
        marginBottom: '2rem',
        textAlign: 'center'
      }}>
        <Heading level="h2" margin="0 0 small" style={{
          background: 'var(--gradient-primary)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontWeight: '700'
        }}>
          Account Management
        </Heading>
        <Text size="medium" style={{ color: 'var(--text-muted)' }}>
          Manage your Canvas accounts and view connected courses
        </Text>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2rem'
      }}>
        <div className="fade-in" style={{ animationDelay: '0.1s' }}>
          <Heading level="h3" margin="0 0 large" style={{ color: 'var(--foreground)' }}>
            <Flex alignItems="center" gap="medium">
              <div style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                background: 'var(--gradient-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}>
                <FontAwesomeIcon icon={faUser} />
              </div>
              Canvas Accounts
            </Flex>
          </Heading>
          <AccountForm onAccountsChange={setAccounts} />
        </div>

        <div className="fade-in" style={{ animationDelay: '0.2s' }}>
          <Heading level="h4" margin="0 0 large" style={{ color: 'var(--foreground)' }}>
            <Flex alignItems="center" gap="medium">
              <div style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}>
                <FontAwesomeIcon icon={faBookOpen} />
              </div>
              Connected Courses
            </Flex>
          </Heading>
          
          {loading && (
            <div>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="modern-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ 
                    height: '1.5rem', 
                    width: '60%', 
                    marginBottom: '0.5rem',
                    background: 'var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }}></div>
                  <div style={{ 
                    height: '1rem', 
                    width: '80%',
                    background: 'var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    animationDelay: '0.1s'
                  }}></div>
                </div>
              ))}
            </div>
          )}
          
          {error && (
            <div className="modern-card" style={{
              padding: '1rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626'
            }}>
              <Text style={{ color: '#dc2626' }}>Error: {error}</Text>
            </div>
          )}
          
          {!loading && coursesData.length === 0 && (
            <div className="modern-card" style={{
              textAlign: 'center',
              padding: '2rem'
            }}>
              <Text style={{ color: 'var(--text-muted)' }}>
                No courses found. Add a Canvas account to get started!
              </Text>
            </div>
          )}
          
          {coursesData.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {coursesData.map(({ account, courses }, accountIndex) => (
                <div key={account.id} className="modern-card fade-in" style={{
                  padding: '1.5rem',
                  animationDelay: `${accountIndex * 0.1}s`
                }}>
                  <Heading level="h5" margin="0 0 small" style={{ color: 'var(--foreground)' }}>
                    <Flex alignItems="center" gap="small">
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#22c55e',
                        display: 'inline-block'
                      }}></span>
                      {account.domain}
                    </Flex>
                  </Heading>
                  {Array.isArray(courses) && courses.length > 0 ? (
                    <div style={{ paddingLeft: '1rem' }}>
                      {courses.map((course: any, courseIndex) => (
                        <div key={course.id} style={{
                          padding: '0.75rem 0',
                          borderBottom: courseIndex < courses.length - 1 ? '1px solid var(--border)' : 'none'
                        }}>
                          <Link 
                            href={`/${account.domain}/${course.id}`}
                            style={{
                              textDecoration: 'none',
                              color: 'var(--primary)',
                              fontWeight: '500',
                              transition: 'color var(--transition-fast)'
                            }}
                          >
                            <Text size="small">{course.name}</Text>
                          </Link>
                          <br />
                          {course.course_code && (
                            <View margin="xxx-small 0 0">
                              <Text size="x-small" style={{ color: 'var(--text-muted)' }}>
                                {course.course_code}
                              </Text>
                            </View>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <View margin="0 0 0 medium">
                      <Text size="small" style={{ color: 'var(--text-muted)' }}>
                        No courses available
                      </Text>
                    </View>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
