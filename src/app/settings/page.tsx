"use client";
import { useEffect, useState } from "react";
import {
  fetchAllCourses,
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


type CoursesResult = { account: Account; courses: any[] };


// TODO
// This is currenlty just a copy of the home page
export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [coursesData, setCoursesData] = useState<CoursesResult[]>([]);
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
      setCoursesData([]);
      setDashboardCards([]);
      setPlannerItems([]);
      setMissingSubmissions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAllCourses(accounts)
      .then((results: any) => {
        if (!cancelled) setCoursesData(results);
      })
      .catch((e: any) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    Promise.all(
      accounts.map(async (account) => ({
        account,
        cards: await fetchDashboardCards(account).catch(() => []),
      }))
    )
      .then((res) => !cancelled && setDashboardCards(res))
      .catch((e) => !cancelled && setError(e.message));

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

  const formatTodoDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleString();
  };

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
    <div className="dashboard-container fade-in">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <Heading level="h2" margin="0" className="text-gradient">
          Dashboard Overview
        </Heading>
        <Text size="medium" color="secondary">
          Your Canvas courses and activities at a glance
        </Text>
      </div>

      {/* Dashboard Stats */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-number">{mergedDashboardCards.length}</div>
          <div className="stat-label">Active Courses</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{assignmentItems.length}</div>
          <div className="stat-label">Assignments</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{announcementItems.length}</div>
          <div className="stat-label">Announcements</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{missingSubmissions.length}</div>
          <div className="stat-label">Missing Items</div>
        </div>
      </div>

      <Flex 
        direction="row" 
        gap="large" 
        alignItems="start" 
        wrap="wrap"
        className="dashboard-main-layout"
      >
        <Flex.Item shouldGrow shouldShrink className="dashboard-main-content">
          <View as="section" margin="0" width="100%">
            <View as="div" margin="0" width="100%">
              <Flex alignItems="center" gap="small" margin="0 0 large">
                <Heading level="h3" margin="0">
                  Course Cards
                </Heading>
                <Pill 
                  margin="0"
                  style={{
                    background: 'var(--gradient-primary)',
                    color: 'white',
                    border: 'none'
                  }}
                >
                  {mergedDashboardCards.length}
                </Pill>
              </Flex>
              
              {loading && (
                <div className="dashboard-cards-grid">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="dashboard-card-modern">
                      <div className="dashboard-card-header">
                        <div className="skeleton" style={{ height: '1.5rem', width: '70%', marginBottom: '0.5rem' }}></div>
                        <div className="skeleton" style={{ height: '1rem', width: '50%' }}></div>
                      </div>
                      <div className="dashboard-card-body">
                        <div className="skeleton" style={{ height: '1rem', width: '100%', marginBottom: '0.5rem' }}></div>
                        <div className="skeleton" style={{ height: '1rem', width: '80%' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && (
                <div className="dashboard-cards-grid">
                  {mergedDashboardCards.map((card, index) => (
                    <div
                      key={`${card.id}-${card.account.id}`}
                      className="dashboard-card-modern fade-in"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <DashboardCardComponent card={card} />
                    </div>
                  ))}
                </div>
              )}
              
              {mergedDashboardCards.length === 0 && !loading && (
                <div style={{
                  textAlign: 'center',
                  padding: '3rem',
                  background: 'var(--surface-elevated)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)'
                }}>
                  <Heading level="h4" margin="0 0 small">No Courses Found</Heading>
                  <Text color="secondary">
                    Get started by adding your Canvas accounts in the accounts tab!
                  </Text>
                  <View margin="medium 0 0">
                    <Link href="/accounts" className="btn-primary" style={{
                      display: 'inline-block',
                      padding: '0.75rem 1.5rem',
                      textDecoration: 'none',
                      borderRadius: 'var(--radius-md)'
                    }}>
                      Add Accounts
                    </Link>
                  </View>
                </div>
              )}
            </View>
          </View>
        </Flex.Item>

          <Flex.Item shouldShrink shouldGrow={false} className="todo-sidebar-container">
            <div className="slide-in-right" style={{ animationDelay: '0.3s' }}>
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
