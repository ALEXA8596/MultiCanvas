"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { TextInput } from "@instructure/ui-text-input";
import { NumberInput } from "@instructure/ui-number-input";
import { Checkbox } from "@instructure/ui-checkbox";
import { Button } from "@instructure/ui-buttons";
import {
  CourseSetting,
  getCourseSettingId,
  getCourseSettings,
  updateCourseSetting,
  upsertCourseSettings,
} from "@/lib/db";
import { getCourseDisplay } from "@/lib/courseDisplay";
import TodoSidebar from "../components/TodoSidebar";

type SettingsModalState = {
  id: string;
  account: Account;
  courseId: number;
  card: DashboardCard & { account: Account };
  draft: CourseSetting;
  saving: boolean;
  error: string | null;
};


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
  const [courseSettings, setCourseSettings] = useState<Record<string, CourseSetting>>({});
  const [settingsModal, setSettingsModal] = useState<SettingsModalState | null>(null);

  const handleOpenCourseSettings = useCallback(
    ({ account, courseId, card, setting }: {
      account: Account;
      courseId: number;
      card: DashboardCard;
      setting?: CourseSetting | null;
    }) => {
      const id = getCourseSettingId(account.domain, courseId);
      const existing = setting ?? courseSettings[id];
      const cardWithAccount = { ...card, account } as DashboardCard & { account: Account };
      const fallbackName =
        existing?.courseName || card.longName || card.shortName || card.originalName || `Course ${card.id}`;
      const draft: CourseSetting = {
        id,
        accountDomain: account.domain,
        courseId,
        courseName: fallbackName,
        courseCode: existing?.courseCode || card.shortName || card.originalName,
        nickname: existing?.nickname ?? "",
        order: existing?.order,
        visible: existing?.visible !== false,
        credits: existing?.credits,
      };
      setSettingsModal({
        id,
        account,
        courseId,
        card: cardWithAccount,
        draft,
        saving: false,
        error: null,
      });
    },
    [courseSettings]
  );

  const handleCloseCourseSettings = useCallback(() => {
    setSettingsModal(null);
  }, []);

  const handleDraftChange = useCallback((patch: Partial<CourseSetting>) => {
    setSettingsModal((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              ...patch,
            },
          }
        : current
    );
  }, []);

  const handleSaveCourseSettings = useCallback(async () => {
    if (!settingsModal) return;
    const current = settingsModal;
    setSettingsModal({ ...current, saving: true, error: null });

    const fallbackName =
      current.draft.courseName?.trim() ||
      current.card.longName ||
      current.card.shortName ||
      current.card.originalName ||
      `Course ${current.card.id}`;
    const normalizedDraft: CourseSetting = {
      id: current.id,
      accountDomain: current.account.domain,
      courseId: current.courseId,
      courseName: fallbackName,
      courseCode: current.draft.courseCode?.trim() || current.card.shortName || current.card.originalName,
      nickname: current.draft.nickname?.trim() || "",
      order: current.draft.order,
      visible: current.draft.visible !== false,
      credits:
        typeof current.draft.credits === "number" && !Number.isNaN(current.draft.credits)
          ? current.draft.credits
          : undefined,
    };

    try {
      const updated = await updateCourseSetting(current.id, normalizedDraft);
      setCourseSettings((prev) => ({
        ...prev,
        [current.id]: {
          ...(prev[current.id] ?? {}),
          ...normalizedDraft,
          ...updated,
        },
      }));
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("mc-course-settings-updated", { detail: { id: current.id } })
        );
      }
      setSettingsModal(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save settings.";
      setSettingsModal((prev) =>
        prev
          ? {
              ...prev,
              saving: false,
              error: message,
            }
          : prev
      );
    }
  }, [settingsModal]);

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

  useEffect(() => {
    if (dashboardCards.length === 0) {
      setCourseSettings({});
      return;
    }
    let cancelled = false;

    const syncCourseSettings = async () => {
      try {
        const existing = await getCourseSettings();
        if (cancelled) return;

        const existingMap = new Map(existing.map((s) => [s.id, s]));
        const ensureMap = new Map(existing.map((s) => [s.id, s]));
        dashboardCards.forEach(({ account, cards }) => {
          (Array.isArray(cards) ? cards : []).forEach((card) => {
            const id = getCourseSettingId(account.domain, card.id);
            const current = ensureMap.get(id) || existingMap.get(id);
            const courseName =
              current?.courseName ||
              card.longName ||
              card.shortName ||
              card.originalName ||
              `Course ${card.id}`;
            const merged: CourseSetting = {
              id,
              accountDomain: account.domain,
              courseId: Number(card.id),
              courseName,
              courseCode: current?.courseCode || card.shortName || card.originalName,
              nickname: current?.nickname ?? "",
              order: current?.order,
              visible: current?.visible !== false,
              credits: current?.credits,
            };
            ensureMap.set(id, merged);
          });
        });

        const ensure = Array.from(ensureMap.values());
        const final = await upsertCourseSettings(ensure);
        if (cancelled) return;

        const mergedMap: Record<string, CourseSetting> = {};
        ensure.forEach((setting) => {
          mergedMap[setting.id] = setting;
        });
        final.forEach((setting) => {
          mergedMap[setting.id] = {
            ...mergedMap[setting.id],
            ...setting,
          };
        });
        setCourseSettings(mergedMap);
      } catch {
        // ignore sync errors; UI will fall back to defaults
      }
    };

    syncCourseSettings();
    return () => {
      cancelled = true;
    };
  }, [dashboardCards]);

  const mergedDashboardCards = useMemo(
    () =>
      dashboardCards.flatMap(({ account, cards }) => {
        const list = Array.isArray(cards) ? cards : [];
        return list
          .map((card) => {
            const cardWithAccount = { ...card, account };
            const id = getCourseSettingId(account.domain, card.id);
            const setting = courseSettings[id];
            return {
              card: cardWithAccount,
              setting,
            };
          })
          .filter(({ setting }) => (setting?.visible ?? true));
      }),
    [dashboardCards, courseSettings]
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

  const modalDisplay = settingsModal
    ? getCourseDisplay({
        actualName:
          settingsModal.card.originalName ||
          settingsModal.card.longName ||
          settingsModal.card.shortName ||
          settingsModal.draft.courseName,
        nickname: settingsModal.draft.nickname,
        fallback:
          settingsModal.card.longName ||
          settingsModal.card.shortName ||
          settingsModal.card.originalName ||
          settingsModal.draft.courseName ||
          `Course ${settingsModal.card.id}`,
      })
    : null;

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
      {settingsModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={handleCloseCourseSettings}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            zIndex: 1000,
          }}
        >
          <div
            className="modern-card"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              padding: "1.5rem",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={handleCloseCourseSettings}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                fontSize: "1.5rem",
                cursor: "pointer",
              }}
              aria-label="Close course settings"
            >
              x
            </button>

            <Heading level="h4" margin="0 0 x-small" style={{ color: "var(--foreground)" }}>
              {modalDisplay?.displayName ??
                settingsModal.card.longName ??
                settingsModal.card.shortName ??
                settingsModal.card.originalName}
            </Heading>
            {modalDisplay?.subtitle && (
              <Text size="small" color="secondary" as="p" style={{ margin: "0 0 0.75rem" }}>
                {modalDisplay.subtitle}
              </Text>
            )}
            <Text
              size="small"
              color="secondary"
              as="p"
              style={{ margin: "0 0 1rem" }}
            >
              {settingsModal.account.domain} - Course ID {settingsModal.courseId}
            </Text>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <TextInput
                renderLabel="Course display name"
                value={settingsModal.draft.courseName || ""}
                onChange={(_, value) => handleDraftChange({ courseName: value })}
              />
              <TextInput
                renderLabel="Nickname"
                value={settingsModal.draft.nickname || ""}
                onChange={(_, value) => handleDraftChange({ nickname: value })}
                placeholder="Shown on cards when present"
              />
              <TextInput
                renderLabel="Course code"
                value={settingsModal.draft.courseCode || ""}
                onChange={(_, value) => handleDraftChange({ courseCode: value })}
              />
              <NumberInput
                renderLabel="Credits"
                value={
                  typeof settingsModal.draft.credits === "number"
                    ? settingsModal.draft.credits
                    : ""
                }
                onChange={(_, value) =>
                  handleDraftChange({
                    credits: value === "" || Number.isNaN(Number(value)) ? undefined : Number(value),
                  })
                }
                min={0}
              />
              <Checkbox
                label="Show on dashboard"
                checked={settingsModal.draft.visible !== false}
                onChange={() =>
                  handleDraftChange({ visible: !(settingsModal.draft.visible !== false) })
                }
              />
            </div>

            {settingsModal.error && (
              <Text color="danger" size="small" as="p" style={{ marginTop: "1rem" }}>
                {settingsModal.error}
              </Text>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                marginTop: "1.5rem",
              }}
            >
              <Button onClick={handleCloseCourseSettings} disabled={settingsModal.saving}>
                Cancel
              </Button>
              <Button onClick={handleSaveCourseSettings} disabled={settingsModal.saving}>
                {settingsModal.saving ? "Saving..." : "Save settings"}
              </Button>
            </div>
          </div>
        </div>
      )}

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
                  {mergedDashboardCards.map(({ card, setting }, index) => (
                    <div
                      key={`${card.id}-${card.account.id}`}
                      className="fade-in"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <DashboardCardComponent
                        card={card}
                        setting={setting}
                        onOpenSettings={handleOpenCourseSettings}
                      />
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
