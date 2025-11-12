"use client";
import { useEffect, useState } from "react";
import {
  Account,
  fetchDashboardCards,
  DashboardCard,
  fetchPlannerItems,
  getMissingSubmissions,
  PlannerItem,
} from "../components/canvasApi";
import DashboardCardComponent from "../components/DashboardCard";
import { View } from "@instructure/ui-view";
import { Flex } from "@instructure/ui-flex";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Link } from "@instructure/ui-link";
import { Pill } from "@instructure/ui-pill";
import TodoSidebar from "../components/TodoSidebar";


export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dashboardCards, setDashboardCards] = useState<
    { account: Account; cards: DashboardCard[] }[]
  >([]);
  const [plannerItems, setPlannerItems] = useState<
    (PlannerItem & { account: Account })[]
  >([]);
  const [missingSubmissions, setMissingSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accounts.length === 0) {
      setDashboardCards([]);
      setPlannerItems([]);
      setMissingSubmissions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all(
      accounts.map(async (account) => ({
        account,
        cards: await fetchDashboardCards(account).catch(() => []),
      }))
    )
      .then((res) => !cancelled && setDashboardCards(res))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [accounts]);

  useEffect(() => {
    if (accounts.length === 0) return;
    let cancelled = false;
    Promise.all(
      accounts.map(async (account) => {
        const lastYear = new Date();
        lastYear.setFullYear(lastYear.getFullYear() - 1);
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        const start = new Date();
        start.setDate(start.getDate() - start.getDay());
        const end = new Date();
        end.setDate(end.getDate() + (6 - end.getDay()));
        const items1 = await fetchPlannerItems(
          account,
          "?start_date=" + lastYear.toISOString().split("T")[0]
        ).catch(() => []);
        const items2 = await fetchPlannerItems(
          account,
          "?start_date=" +
            start.toISOString().split("T")[0] +
            "&end_date=" +
            end.toISOString().split("T")[0]
        ).catch(() => []);
        const items3 = await fetchPlannerItems(
          account,
          "?end_date=" + nextYear.toISOString().split("T")[0]
        ).catch(() => []);
        const missing = await getMissingSubmissions(account).catch(() => []);
        return {
          account,
          items: [
            ...(Array.isArray(items1) ? items1 : []),
            ...(Array.isArray(items2) ? items2 : []),
            ...(Array.isArray(items3) ? items3 : []),
          ],
          missing,
        };
      })
    )
      .then((results) => {
        if (cancelled) return;
        setPlannerItems(
          results.flatMap(({ account, items }) =>
            (Array.isArray(items) ? items : []).map((it: PlannerItem) => ({
              ...it,
              account,
            }))
          )
        );
        setMissingSubmissions(
          results.flatMap(({ account, missing }) =>
            (Array.isArray(missing) ? missing : []).map((m: any) => ({
              ...m,
              account,
            }))
          )
        );
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [accounts]);

  const mergedDashboardCards = dashboardCards.flatMap(({ account, cards }) =>
    cards.map((card) => ({ ...card, account }))
  );

  const assignmentItems = plannerItems.filter(
    (p) => p.plannable_type === "assignment"
  );
  const announcementItems = plannerItems.filter(
    (p) =>
      /announcement|discussion_topic/i.test(p.plannable_type) ||
      (p.plannable &&
        typeof (p.plannable as any).type === "string" &&
        /announcement/i.test((p.plannable as any).type))
  );
  const otherPlannerItems = plannerItems.filter(
    (p) => p.plannable_type !== "assignment" && !announcementItems.includes(p)
  );

  useEffect(() => {
    const saved = localStorage.getItem("accounts");
    if (saved) {
      try {
        setAccounts(JSON.parse(saved));
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  return (
    <div className="fade-in" style={{
      width: '100%',
      maxWidth: '100%'
    }}>
      {/* Dashboard Header */}
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
          Dashboard Overview
        </Heading>
        <Text size="medium" style={{ color: 'var(--text-muted)' }}>
          Your Canvas courses and activities at a glance
        </Text>
      </div>

      {error && (
        <div
          className="modern-card"
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#dc2626",
          }}
        >
          <Text style={{ color: "#dc2626" }}>Error: {error}</Text>
        </div>
      )}

      {/* Dashboard Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem',
        marginInline: 'auto'
      }}>
        <div className="modern-card" style={{
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: '700', 
            color: 'var(--primary)',
            marginBottom: '0.5rem'
          }}>{mergedDashboardCards.length}</div>
          <div style={{ 
            fontSize: '0.875rem', 
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>Active Courses</div>
        </div>
        <div className="modern-card" style={{
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: '700', 
            color: 'var(--primary)',
            marginBottom: '0.5rem'
          }}>{assignmentItems.length}</div>
          <div style={{ 
            fontSize: '0.875rem', 
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>Assignments</div>
        </div>
        <div className="modern-card" style={{
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: '700', 
            color: 'var(--primary)',
            marginBottom: '0.5rem'
          }}>{announcementItems.length}</div>
          <div style={{ 
            fontSize: '0.875rem', 
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>Announcements</div>
        </div>
        <div className="modern-card" style={{
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: '700', 
            color: 'var(--primary)',
            marginBottom: '0.5rem'
          }}>{missingSubmissions.length}</div>
          <div style={{ 
            fontSize: '0.875rem', 
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>Missing Items</div>
        </div>
      </div>

      <Flex 
        direction="row" 
        gap="large" 
        alignItems="start" 
        wrap="wrap"
        style={{
          gap: '2rem'
        }}
      >
        <Flex.Item shouldGrow shouldShrink style={{ minWidth: '300px', flex: '1' }}>
          <View as="section" margin="0" width="100%">
            <View as="div" margin="0" width="100%">
              <Flex alignItems="center" gap="small" margin="0 0 large">
                <Heading level="h3" margin="0" style={{ color: 'var(--foreground)' }}>
                  Course Cards
                </Heading>
                <Pill 
                  margin="0"
                  style={{
                    background: 'var(--gradient-primary)',
                    color: 'white',
                    border: 'none',
                    padding: '0.25rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: '600'
                  }}
                >
                  {mergedDashboardCards.length}
                </Pill>
              </Flex>
              
              {loading && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: '1.5rem'
                }}>
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="modern-card" style={{ padding: '1.5rem' }}>
                      <div style={{ 
                        height: '1.5rem', 
                        width: '70%', 
                        marginBottom: '0.5rem',
                        background: 'var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                      }}></div>
                      <div style={{ 
                        height: '1rem', 
                        width: '50%',
                        background: 'var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                        animationDelay: '0.1s'
                      }}></div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: '1.5rem'
                }}>
                  {mergedDashboardCards.map((card, index) => (
                    <div
                      key={`${card.id}-${card.account.id}`}
                      className="fade-in"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <DashboardCardComponent card={card} />
                    </div>
                  ))}
                </div>
              )}
              
              {mergedDashboardCards.length === 0 && !loading && (
                <div className="modern-card" style={{
                  textAlign: 'center',
                  padding: '3rem'
                }}>
                  <Heading level="h4" margin="0 0 small" style={{ color: 'var(--foreground)' }}>
                    No Courses Found
                  </Heading>
                  <Text style={{ color: 'var(--text-muted)' }}>
                    Get started by adding your Canvas accounts in the accounts tab!
                  </Text>
                  <br />
                  <View margin="medium 0">
                    <Link href="/accounts" className="btn-primary" style={{
                      display: 'inline-block',
                      textDecoration: 'none'
                    }}>
                      Add Accounts
                    </Link>
                  </View>
                </div>
              )}
            </View>
          </View>
        </Flex.Item>

          <Flex.Item shouldShrink shouldGrow={false} style={{ 
            minWidth: '320px',
            maxWidth: '400px'
          }}>
            <div className="fade-in" style={{ animationDelay: '0.3s' }}>
              <TodoSidebar 
                assignments={assignmentItems}
                announcements={announcementItems}
                others={otherPlannerItems}
                missing={missingSubmissions}
              />
            </div>
          </Flex.Item>
      </Flex>
    </div>
  );
}
