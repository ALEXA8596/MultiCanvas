"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { TextInput } from "@instructure/ui-text-input";
import { NumberInput } from "@instructure/ui-number-input";
import { Checkbox } from "@instructure/ui-checkbox";
import { Button } from "@instructure/ui-buttons";
import CourseHeader from "../CourseHeader";
import CourseNav from "../CourseNav";
import { Account, CanvasCourse, fetchCourse } from "@/components/canvasApi";
import {
  CourseSetting,
  getCourseSetting,
  getCourseSettingId,
  upsertCourseSettings,
  updateCourseSetting,
} from "@/lib/db";

export default function CourseSettingsPage() {
  const params = useParams();
  const accountDomain = params?.accountDomain as string;
  const courseIdParam = params?.courseId as string;
  const courseId = courseIdParam ? parseInt(courseIdParam, 10) : NaN;

  const [account, setAccount] = useState<Account | null>(null);
  const [course, setCourse] = useState<CanvasCourse | null>(null);
  const [initialSetting, setInitialSetting] = useState<CourseSetting | null>(null);
  const [draft, setDraft] = useState<CourseSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setAccount(null);
    if (!accountDomain) {
      setError("Missing account domain");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const saved = localStorage.getItem("accounts");
      if (!saved) {
        setError("No accounts saved");
        setLoading(false);
        return;
      }
      const accounts: Account[] = JSON.parse(saved);
      const found = accounts.find((a) => a.domain === accountDomain) || null;
      setAccount(found);
      if (!found) {
        setError("Account not found");
        setLoading(false);
      }
    } catch {
      setError("Failed to parse accounts");
      setLoading(false);
    }
  }, [accountDomain]);

  useEffect(() => {
    if (!account || Number.isNaN(courseId)) return;
    let cancelled = false;
    const id = getCourseSettingId(account.domain, courseId);
    setLoading(true);
    setError(null);
    setStatus(null);

    const load = async () => {
      try {
        const [courseData, existingSetting] = await Promise.all([
          fetchCourse(account, courseId).catch(() => null),
          getCourseSetting(id).catch(() => null),
        ]);
        if (cancelled) return;
        setCourse(courseData);

        const base: CourseSetting = {
          id,
          accountDomain: account.domain,
          courseId,
          courseName:
            existingSetting?.courseName ||
            courseData?.name ||
            `Course ${courseId}`,
          courseCode:
            existingSetting?.courseCode || courseData?.course_code || undefined,
          nickname: existingSetting?.nickname || "",
          order: existingSetting?.order,
          visible: existingSetting?.visible !== false,
          credits: existingSetting?.credits,
        };

        if (!existingSetting) {
          await upsertCourseSettings([base]);
        }

        if (cancelled) return;
        setInitialSetting(base);
        setDraft(base);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load settings";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [account, courseId]);

  const handleDraftChange = useCallback((patch: Partial<CourseSetting>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setStatus(null);
  }, []);

  const normalizedDraft = useMemo(() => {
    if (!draft || !account || Number.isNaN(courseId)) return null;
    return {
      id: getCourseSettingId(account.domain, courseId),
      accountDomain: account.domain,
      courseId,
      courseName:
        draft.courseName?.trim() || course?.name || `Course ${courseId}`,
      courseCode: draft.courseCode?.trim() || undefined,
      nickname: draft.nickname?.trim() || "",
      order: draft.order,
      visible: draft.visible !== false,
      credits:
        typeof draft.credits === "number" && !Number.isNaN(draft.credits)
          ? draft.credits
          : undefined,
    } satisfies CourseSetting;
  }, [account, courseId, course, draft]);

  const hasChanges = useMemo(() => {
    if (!normalizedDraft || !initialSetting) return false;
    const comparable = {
      courseName: normalizedDraft.courseName,
      courseCode: normalizedDraft.courseCode || "",
      nickname: normalizedDraft.nickname || "",
      credits: typeof normalizedDraft.credits === "number" ? normalizedDraft.credits : null,
      visible: normalizedDraft.visible,
    };
    const baseline = {
      courseName: initialSetting.courseName || "",
      courseCode: initialSetting.courseCode || "",
      nickname: initialSetting.nickname || "",
      credits:
        typeof initialSetting.credits === "number" ? initialSetting.credits : null,
      visible: initialSetting.visible !== false,
    };
    return JSON.stringify(comparable) !== JSON.stringify(baseline);
  }, [normalizedDraft, initialSetting]);

  const handleReset = useCallback(() => {
    if (initialSetting) {
      setDraft(initialSetting);
      setStatus(null);
    }
  }, [initialSetting]);

  const handleSave = useCallback(async () => {
    if (!normalizedDraft) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCourseSetting(normalizedDraft.id, normalizedDraft);
      const merged = {
        ...normalizedDraft,
        ...updated,
      } as CourseSetting;
      setInitialSetting(merged);
      setDraft(merged);
      setStatus("Changes saved");
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("mc-course-settings-updated", { detail: { id: merged.id } })
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save settings";
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [normalizedDraft]);

  if (!accountDomain || Number.isNaN(courseId)) {
    return (
      <View as="div" padding="medium" width="100%">
        <Text>Invalid course URL.</Text>
      </View>
    );
  }

  return (
    <View as="div" padding="medium" width="100%">
      <CourseHeader />
      <CourseNav accountDomain={accountDomain} courseId={courseId} />

      <div className="modern-card" style={{ padding: "1.5rem" }}>
        <Heading level="h3" margin="0 0 medium" style={{ color: "var(--foreground)" }}>
          Course Settings
        </Heading>

        {loading && <Text>Loading settings...</Text>}

        {!loading && error && (
          <Text color="danger" as="p">
            {error}
          </Text>
        )}

        {!loading && !error && !draft && (
          <Text>Settings are not available for this course.</Text>
        )}

        {!loading && !error && draft && normalizedDraft && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <TextInput
              renderLabel="Course display name"
              value={draft.courseName || ""}
              onChange={(_, value) => handleDraftChange({ courseName: value })}
            />
            <TextInput
              renderLabel="Nickname"
              value={draft.nickname || ""}
              onChange={(_, value) => handleDraftChange({ nickname: value })}
            />
            <TextInput
              renderLabel="Course code"
              value={draft.courseCode || ""}
              onChange={(_, value) => handleDraftChange({ courseCode: value })}
            />
            <NumberInput
              renderLabel="Credits"
              value={
                typeof draft.credits === "number" ? draft.credits : ""
              }
              onChange={(_, value) =>
                handleDraftChange({
                  credits:
                    value === "" || Number.isNaN(Number(value))
                      ? undefined
                      : Number(value),
                })
              }
              min={0}
            />
            <Checkbox
              label="Show on dashboard"
              checked={draft.visible !== false}
              onChange={() =>
                handleDraftChange({ visible: !(draft.visible !== false) })
              }
            />

            {status && (
              <Text color="success" size="small">
                {status}
              </Text>
            )}

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
              <Button onClick={handleReset} disabled={!hasChanges || saving}>
                Reset
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges || saving}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </View>
  );
}
