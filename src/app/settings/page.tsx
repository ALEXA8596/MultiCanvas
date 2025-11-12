"use client";
import { useEffect, useMemo, useState } from "react";
import {
  CourseSetting,
  getCourseSettingId,
  getCourseSettings,
  updateCourseSetting,
  upsertCourseSettings,
} from "@/lib/db";
import { fetchAllCourses, Account } from "@/components/canvasApi";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { TextInput } from "@instructure/ui-text-input";
import { Checkbox } from "@instructure/ui-checkbox";
import { Table } from "@instructure/ui-table";
import { NumberInput } from "@instructure/ui-number-input";
import { getCourseDisplay } from "@/lib/courseDisplay";

type CourseSettingRow = CourseSetting & {
  accountDomain: string;
  courseId: number;
  courseName?: string;
  courseCode?: string;
};

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [courseSettings, setCourseSettings] = useState<CourseSettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("accounts");
    if (!saved) return;
    try {
      setAccounts(JSON.parse(saved));
    } catch {
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const existing = await getCourseSettings();
        if (cancelled) return;

        if (accounts.length === 0) {
          setCourseSettings(existing.map((setting) => {
            const derived = parseFallback(setting.id);
            return {
              accountDomain: derived.accountDomain ?? "",
              courseId: derived.courseId ?? 0,
              ...setting,
            };
          }));
          setLoading(false);
          return;
        }

        const courseResults = await fetchAllCourses(accounts).catch(() => []);
        if (cancelled) return;

        const existingMap = new Map(existing.map((s) => [s.id, s]));
        const ensure: CourseSetting[] = [];
        const rows: CourseSettingRow[] = [];

        courseResults.forEach(({ account, courses }) => {
          (Array.isArray(courses) ? courses : []).forEach((course) => {
            const id = getCourseSettingId(account.domain, course.id);
            const current = existingMap.get(id);
            const merged: CourseSetting = {
              id,
              accountDomain: account.domain,
              courseId: course.id,
              courseName: course.name,
              courseCode:
                course.course_code || course.friendly_name || current?.courseCode,
              nickname: current?.nickname ?? "",
              order:
                typeof current?.order === "number"
                  ? current.order
                  : existing.length + ensure.length + 1,
              visible: current?.visible !== false,
              credits: current?.credits,
            };
            ensure.push(merged);
            rows.push({ accountDomain: account.domain, courseId: course.id, ...merged });
          });
        });

        const finalSettings = await upsertCourseSettings(ensure);
        if (cancelled) return;
        const finalMap = new Map(finalSettings.map((s) => [s.id, s]));
        const hydrated = rows.map((row) => ({
          ...row,
          ...finalMap.get(row.id),
          accountDomain: row.accountDomain,
          courseId: row.courseId,
        }));
        setCourseSettings(hydrated);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load settings");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [accounts]);

  const handleCourseSettingChange = async (
    id: string,
    patch: Partial<CourseSetting>
  ) => {
    setCourseSettings((prev) =>
      prev.map((setting) =>
        setting.id === id
          ? {
              ...setting,
              ...patch,
            }
          : setting
      )
    );
    await updateCourseSetting(id, patch);
  };

  const sortedSettings = useMemo(
    () =>
      [...courseSettings].sort((a, b) => {
        const orderA = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
        const orderB = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      }),
    [courseSettings]
  );

  if (loading) {
    return <Text>Loading settings...</Text>;
  }

  if (error) {
    return <Text color="danger">Error: {error}</Text>;
  }

  if (sortedSettings.length === 0) {
    return (
      <View as="div" padding="large" className="modern-card fade-in">
        <Heading level="h3" margin="0 0 small 0">No Courses Found</Heading>
        <Text as="p" color="secondary">
          Add Canvas accounts and refresh to manage course display settings.
        </Text>
      </View>
    );
  }

  return (
    <div className="settings-container fade-in">
      <Heading level="h2" margin="0 0 medium 0" className="text-gradient">
        Course Settings
      </Heading>

      <View as="section" margin="0 0 large 0">
        <Heading level="h3" margin="0 0 medium 0">Display & Ordering</Heading>
        <Table caption="Course Display Settings">
          <Table.Head>
            <Table.Row>
              <Table.ColHeader id="account">Account</Table.ColHeader>
              <Table.ColHeader id="course">Course</Table.ColHeader>
              <Table.ColHeader id="nickname">Nickname</Table.ColHeader>
              <Table.ColHeader id="order">Order</Table.ColHeader>
              <Table.ColHeader id="visible">Visible</Table.ColHeader>
              <Table.ColHeader id="credits">Credits</Table.ColHeader>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {sortedSettings.map((setting) => {
              const { displayName, subtitle } = getCourseDisplay({
                actualName: setting.courseName,
                nickname: setting.nickname,
                fallback: setting.courseName || String(setting.courseId),
              });
              return (
                <Table.Row key={setting.id}>
                  <Table.Cell>{setting.accountDomain}</Table.Cell>
                  <Table.Cell>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <Text>{displayName}</Text>
                      {subtitle && (
                        <Text size="x-small" color="secondary">
                          {subtitle}
                        </Text>
                      )}
                      {setting.courseCode && (
                        <Text size="x-small" color="secondary">
                          {setting.courseCode}
                        </Text>
                      )}
                    </div>
                  </Table.Cell>
                <Table.Cell>
                  <TextInput
                    renderLabel=""
                    value={setting.nickname || ""}
                    onChange={(_, value) =>
                      handleCourseSettingChange(setting.id, { nickname: value })
                    }
                    placeholder={setting.courseName || "Nickname"}
                  />
                </Table.Cell>
                <Table.Cell>
                  <NumberInput
                    renderLabel=""
                    value={typeof setting.order === "number" ? setting.order : ""}
                    onChange={(_, value) =>
                      handleCourseSettingChange(setting.id, {
                        order: value === "" ? undefined : Number(value),
                      })
                    }
                  />
                </Table.Cell>
                <Table.Cell>
                  <Checkbox
                    label="Visible"
                    checked={setting.visible !== false}
                    onChange={() =>
                      handleCourseSettingChange(setting.id, {
                        visible: !(setting.visible !== false),
                      })
                    }
                  />
                </Table.Cell>
                <Table.Cell>
                  <NumberInput
                    renderLabel=""
                    value={typeof setting.credits === "number" ? setting.credits : ""}
                    onChange={(_, value) => {
                      const parsed = Number(value);
                      handleCourseSettingChange(setting.id, {
                        credits: value === "" || Number.isNaN(parsed) ? undefined : parsed,
                      });
                    }}
                  />
                </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      </View>
    </div>
  );
}

function parseFallback(id: string) {
  const [accountDomain, rawCourseId] = id.split("::");
  const courseId = rawCourseId ? Number(rawCourseId) : undefined;
  return { accountDomain, courseId };
}
