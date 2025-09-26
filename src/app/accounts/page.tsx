"use client"
import { useEffect, useState } from "react"
import AccountForm from "../../components/AccountForm"
import {
  fetchAllCourses,
  Account,
  fetchDashboardCards,
  fetchPlannerItems,
  getMissingSubmissions,
  PlannerItem
} from "../../components/canvasApi"
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
    <div className="accounts-container fade-in">
      {/* Page Header */}
      <div className="dashboard-header">
        <Heading level="h2" margin="0" className="text-gradient">
          Account Management
        </Heading>
        <Text size="medium" color="secondary">
          Manage your Canvas accounts and view connected courses
        </Text>
      </div>

      <div className="accounts-grid">
        <div className="account-form-section slide-in-left">
          <Heading level="h3" margin="0 0 large">
            <Flex alignItems="center" gap="medium">
              <div className="todo-section-icon">
                <FontAwesomeIcon icon={faUser} />
              </div>
              Canvas Accounts
            </Flex>
          </Heading>
          <AccountForm onAccountsChange={setAccounts} />
        </div>

        <div className="courses-list-section slide-in-right">
          <Heading level="h4" margin="0 0 large">
            <Flex alignItems="center" gap="medium">
              <div className="todo-section-icon" style={{ background: 'var(--accent)' }}>
                <FontAwesomeIcon icon={faBookOpen} />
              </div>
              Connected Courses
            </Flex>
          </Heading>
          
          {loading && (
            <div>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="course-list-item">
                  <div className="skeleton" style={{ height: '1.5rem', width: '60%', marginBottom: '0.5rem' }}></div>
                  <div className="skeleton" style={{ height: '1rem', width: '80%' }}></div>
                </div>
              ))}
            </div>
          )}
          
          {error && (
            <div style={{
              padding: '1rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--radius-md)',
              color: '#dc2626'
            }}>
              <Text color="danger">Error: {error}</Text>
            </div>
          )}
          
          {!loading && coursesData.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              background: 'var(--secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)'
            }}>
              <Text color="secondary">No courses found. Add a Canvas account to get started!</Text>
            </div>
          )}
          
          {coursesData.length > 0 && (
            <div>
              {coursesData.map(({ account, courses }, accountIndex) => (
                <div key={account.id} className="course-list-item fade-in" style={{
                  animationDelay: `${accountIndex * 0.1}s`
                }}>
                  <Heading level="h5" margin="0 0 small">
                    <Flex alignItems="center" gap="small">
                      <span className="status-dot status-success"></span>
                      {account.domain}
                    </Flex>
                  </Heading>
                  {Array.isArray(courses) && courses.length > 0 ? (
                    <div style={{ paddingLeft: '1rem' }}>
                      {courses.map((course: any, courseIndex) => (
                        <div key={course.id} style={{
                          padding: '0.5rem 0',
                          borderBottom: courseIndex < courses.length - 1 ? '1px solid var(--border)' : 'none'
                        }}>
                          <Link 
                            href={`/${account.domain}/${course.id}`}
                            style={{
                              textDecoration: 'none',
                              color: 'var(--primary)',
                              fontWeight: '500'
                            }}
                          >
                            <Text size="small">{course.name}</Text>
                          </Link>
                          <br />
                          {course.course_code && (
                            <View margin="xxx-small 0 0">
                              <Text size="x-small" color="secondary">
                                {course.course_code}
                              </Text>
                            </View>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <View margin="0 0 0 medium">
                      <Text size="small" color="secondary">
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
