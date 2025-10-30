"use client";
import { useEffect, useMemo, useState } from "react";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import JSZip from "jszip";
import {
  Account,
  CanvasCourse,
  fetchCourses,
  fetchCourse,
  fetchAssignmentGroups,
  fetchCourseModules,
  fetchCoursePages,
  fetchAnnouncements,
  fetchDiscussionTopics,
  fetchCourseFiles,
} from "../components/canvasApi";

type CourseWithAccount = { account: Account; course: CanvasCourse };

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

export default function DownloadExportPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [courses, setCourses] = useState<CourseWithAccount[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [delayMs, setDelayMs] = useState(250);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("accounts");
    if (saved) {
      try { setAccounts(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (accounts.length === 0) { setCourses([]); setSelected({}); return; }
    let cancelled = false;
    (async () => {
      try {
        const lists = await Promise.all(accounts.map(async (account) => {
          const cs = await fetchCourses(account).catch(() => [] as CanvasCourse[]);
          return cs.map(course => ({ account, course }));
        }));
        const merged = lists.flat();
        if (!cancelled) {
          setCourses(merged);
          const sel: Record<string, boolean> = {};
          merged.forEach(({account, course}) => { sel[`${account.domain}:${course.id}`] = true; });
          setSelected(sel);
        }
      } catch (e:any) {
        if (!cancelled) setError(e.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [accounts]);

  const selectedCourses = useMemo(() => courses.filter(({account, course}) => selected[`${account.domain}:${course.id}`]), [courses, selected]);

  const toggleAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    courses.forEach(({account, course}) => { next[`${account.domain}:${course.id}`] = value; });
    setSelected(next);
  };

  async function addJson(zip: JSZip, path: string, data: any) {
    const pretty = JSON.stringify(data, null, 2);
    zip.file(path, pretty);
  }

  async function exportCourse(zip: JSZip, item: CourseWithAccount) {
    const { account, course } = item;
    const safeName = (course.name || String(course.id)).replace(/[^a-z0-9\-_. ]/gi, "_");
    const basePath = `${account.domain}/courses/${course.id} - ${safeName}`;
    setProgress(`Exporting ${account.domain} / ${course.name}…`);

    // Course core
    const courseJson = await fetchCourse(account, course.id).catch(() => course);
    await addJson(zip, `${basePath}/course.json`, courseJson); await sleep(delayMs);

    // Assignments via groups
    const assignmentGroups = await fetchAssignmentGroups(account, course.id).catch(() => []);
    await addJson(zip, `${basePath}/assignment_groups.json`, assignmentGroups); await sleep(delayMs);

    // Modules (with items)
    const modules = await fetchCourseModules(account, course.id).catch(() => []);
    await addJson(zip, `${basePath}/modules.json`, modules); await sleep(delayMs);

    // Pages list and individual pages
    const pages = await fetchCoursePages(account, course.id).catch(() => []);
    await addJson(zip, `${basePath}/pages.json`, pages);
    await sleep(delayMs);
    const pagesFolder = zip.folder(`${basePath}/pages`)!;
    for (const p of pages) {
      const slug = (p as any).url || String((p as any).page_id);
      // Optionally fetch full page body
      // Import lazily to avoid heavy requests; we already have body for single page fetch only
      try {
        // Reuse fetchCoursePage via dynamic import path to avoid circular deps here; but we can call directly if exposed
        // We'll stash body if present, else skip fetching
        if (!(p as any).body) {
          // no-op; we keep list file only to reduce calls
        }
        pagesFolder.file(`${slug}.json`, JSON.stringify(p, null, 2));
      } catch {}
      await sleep(delayMs);
    }

    // Announcements
    const anns = await fetchAnnouncements(account, course.id).catch(() => []);
    await addJson(zip, `${basePath}/announcements.json`, anns); await sleep(delayMs);

    // Discussions (topics)
    const topics = await fetchDiscussionTopics(account, course.id).catch(() => []);
    await addJson(zip, `${basePath}/discussions.json`, topics); await sleep(delayMs);

    // Files (metadata only)
    const files = await fetchCourseFiles(account, course.id, 100, 5).catch(() => []);
    await addJson(zip, `${basePath}/files.json`, files); await sleep(delayMs);
  }

  async function startExport() {
    if (selectedCourses.length === 0) return;
    setExporting(true);
    setError(null);
    setProgress("Preparing zip…");
    try {
      const zip = new JSZip();
      for (const item of selectedCourses) {
        await exportCourse(zip, item);
      }
      setProgress("Zipping…");
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `canvas-export-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setProgress("Done");
    } catch (e:any) {
      setError(e.message || String(e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="dashboard-container fade-in">
      <div className="dashboard-header">
        <Heading level="h2" style={{ margin: 0 }} className="text-gradient">Export Courses (ZIP)</Heading>
        <Text size="medium" color="secondary">Select courses to export as a structured JSON zip. Requests are rate-limited.</Text>
      </div>

      {error && (
        <div style={{ padding: '1rem', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', borderRadius: 12 }}>
          <Text color="danger">{error}</Text>
        </div>
      )}

      <View as="section" margin="medium 0 0" width="100%">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
          <button className="btn" onClick={() => toggleAll(true)}>Select All</button>
          <button className="btn" onClick={() => toggleAll(false)}>Deselect All</button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span>Delay (ms) between requests:</span>
            <input type="number" min={0} value={delayMs} onChange={e => setDelayMs(Math.max(0, Number(e.target.value)||0))} style={{ width: 100 }} />
          </label>
          <button className="btn-primary" onClick={startExport} disabled={exporting || selectedCourses.length === 0}>
            {exporting ? 'Exporting…' : `Export ${selectedCourses.length} course(s)`}
          </button>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '0.75rem' }}>
          {accounts.length === 0 && <Text color="secondary">Add accounts on the Accounts page to begin.</Text>}
          {accounts.map(acc => (
            <div key={acc.id} style={{ marginBottom: '0.75rem' }}>
              <Heading level="h4" style={{ margin: '0 0 0.25rem' }}>{acc.domain}</Heading>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '6px' }}>
                {courses.filter(c => c.account.id === acc.id).map(({account, course}) => {
                  const key = `${account.domain}:${course.id}`;
                  return (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', background: 'var(--surface-elevated)' }}>
                      <input type="checkbox" checked={!!selected[key]} onChange={e => setSelected(s => ({ ...s, [key]: e.target.checked }))} />
                      <span style={{ fontSize: '0.9rem' }}>{course.name} <span style={{ color: 'var(--foreground-muted)' }}>({course.id})</span></span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {progress && (
          <div style={{ marginTop: '0.75rem' }}>
            <Text size="small" color="secondary">{progress}</Text>
          </div>
        )}
      </View>
    </div>
  );
}
