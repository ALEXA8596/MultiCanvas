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
  fetchCoursePage,
  fetchAnnouncements,
  fetchDiscussionTopics,
  fetchCourseFiles,
} from "@/components/canvasApi";
import { getCourseSettingId } from "@/lib/db";
import { getCourseDisplay } from "@/lib/courseDisplay";
import { useCourseSettingsMap } from "@/hooks/useCourseSettingsMap";
import { CANVAS_NAV_CSS, MODULES_CSS, ASSIGNMENT_CSS, ANNOUNCEMENTS_CSS } from "./offlineStyles";
import "./download.css";

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
  const courseSettings = useCourseSettingsMap();

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

  // --- Offline Website Generation Helpers ---

  const generateHtmlShell = (title: string, content: string, depth: number, courseNavHtml: string = '') => {
    const rootPath = "../".repeat(depth);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="${rootPath}styles.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
  <div class="ic-app-header">
    <div class="ic-app-header__logomark-container">
      <svg class="ic-icon-svg" viewBox="0 0 26 26"><path d="M13 0C5.8 0 0 5.8 0 13s5.8 13 13 13 13-5.8 13-13S20.2 0 13 0zm0 23c-5.5 0-10-4.5-10-10S7.5 3 13 3s10 4.5 10 10-4.5 10-10 10z"/></svg>
    </div>
    <ul class="ic-app-header__menu-list">
      <li class="ic-app-header__menu-list-item">
        <a href="${rootPath}index.html" class="ic-app-header__menu-list-link">
          <div class="menu-item-icon-container">
            <i class="fas fa-tachometer-alt ic-icon-svg" style="color:white"></i>
          </div>
          <div class="menu-item__text">Dashboard</div>
        </a>
      </li>
    </ul>
  </div>
  <div class="layout-shell">
    <div class="ic-Layout-wrapper">
      <div class="ic-Layout-columns">
        ${courseNavHtml ? `<div class="course-nav">${courseNavHtml}</div>` : ''}
        <div class="ic-Layout-contentMain">
          ${content}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
  };

  const generateCourseNav = (courseId: number, active: string, depthInsideCourse: number = 0) => {
    const prefix = "../".repeat(depthInsideCourse);
    const links = [
      { id: 'home', label: 'Home', href: 'index.html' },
      { id: 'announcements', label: 'Announcements', href: 'announcements.html' },
      { id: 'assignments', label: 'Assignments', href: 'assignments.html' },
      { id: 'modules', label: 'Modules', href: 'modules.html' },
      { id: 'pages', label: 'Pages', href: 'pages.html' },
      { id: 'files', label: 'Files', href: 'files.html' },
    ];
    return `
      <nav role="navigation" aria-label="Course Navigation">
        <ul>
          ${links.map(l => `<li><a href="${prefix}${l.href}" class="${active === l.id ? 'active' : ''}">${l.label}</a></li>`).join('')}
        </ul>
      </nav>
    `;
  };

  async function exportOfflineWebsite() {
    if (selectedCourses.length === 0) return;
    setExporting(true);
    setError(null);
    setProgress("Preparing offline export...");

    try {
      const zip = new JSZip();
      
      // Add global styles
      const allStyles = [CANVAS_NAV_CSS, MODULES_CSS, ASSIGNMENT_CSS, ANNOUNCEMENTS_CSS].join('\n');
      zip.file("styles.css", allStyles);

      const dashboardLinks: string[] = [];

      for (const item of selectedCourses) {
        const { account, course } = item;
        const setting = courseSettings[getCourseSettingId(account.domain, course.id)];
        const { displayName } = getCourseDisplay({
          actualName: course.name,
          nickname: setting?.nickname,
          fallback: course.name,
        });
        const safeName = (course.name || String(course.id)).replace(/[^a-z0-9\-_. ]/gi, "_");
        const courseDir = `courses/${course.id}_${safeName}`;
        
        setProgress(`Processing ${displayName}...`);

        // 1. Modules (Home)
        const modules = await fetchCourseModules(account, course.id).catch(() => []);
        const modulesHtmlContent = `
          <div class="course-header">
            <h1>${displayName}</h1>
          </div>
          <div class="item-group-container">
            ${modules.map((m: any) => `
              <div class="item-group-condensed">
                <div class="ig-header">
                  <span class="name">${m.name}</span>
                </div>
                <ul class="ig-list">
                  ${m.items.map((i: any) => {
                    let icon = 'fa-file';
                    let href = '#';
                    if (i.type === 'Assignment') { icon = 'fa-pen-square'; href = `assignments/${i.content_id}.html`; }
                    else if (i.type === 'Page') { icon = 'fa-file-alt'; href = `pages/${i.page_url}.html`; }
                    else if (i.type === 'Discussion') { icon = 'fa-comments'; href = `discussions/${i.content_id}.html`; }
                    else if (i.type === 'File') { icon = 'fa-paperclip'; href = `files/${i.content_id}.html`; } // Files not fully implemented
                    
                    return `
                    <li class="ig-row indent_${i.indent || 0}">
                      <div class="type_icon"><i class="fas ${icon}"></i></div>
                      <div class="ig-info">
                        <a href="${href}" class="ig-title">${i.title}</a>
                      </div>
                    </li>`;
                  }).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        `;
        const modulesPage = generateHtmlShell(displayName, modulesHtmlContent, 2, generateCourseNav(course.id, 'modules', 0));
        zip.file(`${courseDir}/modules.html`, modulesPage);
        zip.file(`${courseDir}/index.html`, modulesPage); // Home defaults to modules

        await sleep(delayMs);

        // 2. Assignments
        const assignmentGroups = await fetchAssignmentGroups(account, course.id).catch(() => []);
        const assignmentsListContent = `
          <div class="course-header"><h1>Assignments</h1></div>
          <div class="item-group-container">
            ${assignmentGroups.map(g => `
              <div class="item-group-condensed">
                <div class="ig-header"><span class="name">${g.name}</span></div>
                <ul class="ig-list">
                  ${g.assignments?.map(a => `
                    <li class="ig-row">
                      <div class="type_icon"><i class="fas fa-pen-square"></i></div>
                      <div class="ig-info">
                        <a href="assignments/${a.id}.html" class="ig-title">${a.name}</a>
                        <div class="ig-details">
                          ${a.due_at ? `<span>Due: ${new Date(a.due_at).toLocaleString()}</span>` : ''}
                          <span>${a.points_possible || 0} pts</span>
                        </div>
                      </div>
                    </li>
                  `).join('') || ''}
                </ul>
              </div>
            `).join('')}
          </div>
        `;
        zip.file(`${courseDir}/assignments.html`, generateHtmlShell(`Assignments - ${displayName}`, assignmentsListContent, 2, generateCourseNav(course.id, 'assignments', 0)));

        // Individual Assignments
        const allAssignments = assignmentGroups.flatMap(g => g.assignments || []);
        for (const a of allAssignments) {
          const assignmentContent = `
            <div class="assignment-title">
              <div class="title-content"><h1 class="title">${a.name}</h1></div>
            </div>
            <ul class="student-assignment-overview">
              <li><span class="title">Due</span><span class="value">${a.due_at ? new Date(a.due_at).toLocaleString() : 'No due date'}</span></li>
              <li><span class="title">Points</span><span class="value">${a.points_possible || 0}</span></li>
              <li><span class="title">Submitting</span><span class="value">${a.submission_types?.join(', ') || 'Nothing'}</span></li>
            </ul>
            <div class="description user_content">${a.description || ''}</div>
          `;
          zip.file(`${courseDir}/assignments/${a.id}.html`, generateHtmlShell(`${a.name} - ${displayName}`, assignmentContent, 3, generateCourseNav(course.id, 'assignments', 1)));
        }
        await sleep(delayMs);

        // 3. Announcements
        const announcements = await fetchAnnouncements(account, course.id).catch(() => []);
        const announcementsListContent = `
          <div class="course-header"><h1>Announcements</h1></div>
          <div class="ic-announcement-list">
            ${announcements.map((ann: any) => `
              <div class="ic-announcement-row">
                <div class="ic-item-row__content-col">
                  <a href="announcements/${ann.id}.html" class="ic-item-row__content-link">
                    <h3>${ann.title}</h3>
                    <div class="ic-announcement-row__content">${(ann.message || '').replace(/<[^>]+>/g, '').slice(0, 150)}...</div>
                  </a>
                </div>
                <div class="ic-item-row__meta-col">
                  <span class="ic-item-row__meta-content-timestamp">${ann.created_at ? new Date(ann.created_at).toLocaleDateString() : ''}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        zip.file(`${courseDir}/announcements.html`, generateHtmlShell(`Announcements - ${displayName}`, announcementsListContent, 2, generateCourseNav(course.id, 'announcements', 0)));

        for (const ann of announcements) {
          const annContent = `
            <div class="course-header"><h1>${ann.title}</h1></div>
            <div style="margin-bottom: 1rem; color: #666;">Posted on ${ann.created_at ? new Date(ann.created_at).toLocaleString() : ''}</div>
            <div class="description user_content">${ann.message || ''}</div>
          `;
          zip.file(`${courseDir}/announcements/${ann.id}.html`, generateHtmlShell(`${ann.title} - ${displayName}`, annContent, 3, generateCourseNav(course.id, 'announcements', 1)));
        }
        await sleep(delayMs);

        // 4. Pages
        const pages = await fetchCoursePages(account, course.id).catch(() => []);
        const pagesListContent = `
          <div class="course-header"><h1>Pages</h1></div>
          <ul class="ig-list">
            ${pages.map((p: any) => `
              <li class="ig-row">
                <div class="type_icon"><i class="fas fa-file-alt"></i></div>
                <div class="ig-info">
                  <a href="pages/${p.url}.html" class="ig-title">${p.title}</a>
                </div>
              </li>
            `).join('')}
          </ul>
        `;
        zip.file(`${courseDir}/pages.html`, generateHtmlShell(`Pages - ${displayName}`, pagesListContent, 2, generateCourseNav(course.id, 'pages', 0)));

        // Fetch individual pages
        for (const p of pages) {
           try {
             const pageDetails = await fetchCoursePage(account, course.id, p.url);
             const pageContent = `
               <div class="course-header"><h1>${pageDetails.title}</h1></div>
               <div class="description user_content">${pageDetails.body || ''}</div>
             `;
             zip.file(`${courseDir}/pages/${p.url}.html`, generateHtmlShell(`${pageDetails.title} - ${displayName}`, pageContent, 3, generateCourseNav(course.id, 'pages', 1)));
           } catch {
             const pageContent = `
               <div class="course-header"><h1>${p.title}</h1></div>
               <div class="description user_content">
                 <p><em>Failed to load page content.</em></p>
                 <p><a href="https://${account.domain}/courses/${course.id}/pages/${p.url}" target="_blank">View on Canvas</a></p>
               </div>
             `;
             zip.file(`${courseDir}/pages/${p.url}.html`, generateHtmlShell(`${p.title} - ${displayName}`, pageContent, 3, generateCourseNav(course.id, 'pages', 1)));
           }
           await sleep(delayMs);
        }

        // 5. Files
        const files = await fetchCourseFiles(account, course.id).catch(() => []);
        const filesListContent = `
          <div class="course-header"><h1>Files</h1></div>
          <div class="item-group-container">
            <div class="item-group-condensed">
              <ul class="ig-list">
                ${files.map((f: any) => `
                  <li class="ig-row">
                    <div class="type_icon"><i class="fas fa-file"></i></div>
                    <div class="ig-info">
                      <a href="${f.url}" target="_blank" class="ig-title">${f.display_name}</a>
                      <div class="ig-details">
                        <span>${(f.size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                  </li>
                `).join('')}
              </ul>
            </div>
          </div>
        `;
        zip.file(`${courseDir}/files.html`, generateHtmlShell(`Files - ${displayName}`, filesListContent, 2, generateCourseNav(course.id, 'files', 0)));

        dashboardLinks.push(`
          <div class="ic-DashboardCard" style="width: 260px; background: white; border: 1px solid #C7CDD1; border-radius: 4px; overflow: hidden; display: flex; flex-direction: column;">
            <div style="height: 140px; background: #394B58; display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem;">
              ${displayName.slice(0, 2)}
            </div>
            <div style="padding: 1rem;">
              <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem;">
                <a href="${courseDir}/index.html" style="text-decoration: none; color: #2D3B45; font-weight: bold;">${displayName}</a>
              </h3>
              <div style="font-size: 0.875rem; color: #666;">${account.domain}</div>
            </div>
          </div>
        `);
      }

      // Dashboard
      const dashboardContent = `
        <div class="course-header"><h1>Dashboard</h1></div>
        <div style="display: flex; flex-wrap: wrap; gap: 24px;">
          ${dashboardLinks.join('')}
        </div>
      `;
      zip.file("index.html", generateHtmlShell("Dashboard", dashboardContent, 0));

      setProgress("Zipping...");
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `canvas-offline-site-${new Date().toISOString().slice(0,10)}.zip`;
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

  async function downloadAllFiles() {
    if (selectedCourses.length === 0) return;
    setExporting(true);
    setError(null);
    setProgress("Preparing file download...");

    try {
      const zip = new JSZip();

      for (const item of selectedCourses) {
        const { account, course } = item;
        const setting = courseSettings[getCourseSettingId(account.domain, course.id)];
        const { displayName } = getCourseDisplay({
          actualName: course.name,
          nickname: setting?.nickname,
          fallback: course.name,
        });
        const safeName = (course.name || String(course.id)).replace(/[^a-z0-9\-_. ]/gi, "_");
        const courseDir = `courses/${course.id}_${safeName}/files`;
        
        setProgress(`Fetching file list for ${displayName}...`);
        // Fetch up to 5000 files per course
        const files = await fetchCourseFiles(account, course.id, 100, 50).catch(() => []);
        
        let count = 0;
        for (const file of files) {
            count++;
            setProgress(`Downloading ${displayName}: ${file.display_name} (${count}/${files.length})`);
            if (!file.url) continue;
            
            try {
                const res = await fetch(file.url);
                if (!res.ok) throw new Error(`Failed to fetch ${file.display_name}`);
                const blob = await res.blob();
                // Use id prefix to avoid name collisions
                zip.file(`${courseDir}/${file.id}_${file.filename}`, blob);
            } catch (e) {
                console.error(`Failed to download ${file.display_name}`, e);
                zip.file(`${courseDir}/${file.id}_${file.filename}.error.txt`, `Failed to download: ${e}`);
            }
            await sleep(delayMs);
        }
      }

      setProgress("Zipping files...");
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `canvas-files-${new Date().toISOString().slice(0,10)}.zip`;
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

  // --- End Offline Helpers ---

  async function addJson(zip: JSZip, path: string, data: any) {
    const pretty = JSON.stringify(data, null, 2);
    zip.file(path, pretty);
  }

  async function exportCourse(zip: JSZip, item: CourseWithAccount) {
    const { account, course } = item;
    const setting = courseSettings[getCourseSettingId(account.domain, course.id)];
    const { displayName, subtitle } = getCourseDisplay({
      actualName: course.name,
      nickname: setting?.nickname,
      fallback: course.name,
    });
    const progressName = subtitle ? `${displayName} (${subtitle})` : displayName;
    const safeName = (course.name || String(course.id)).replace(/[^a-z0-9\-_. ]/gi, "_");
    const basePath = `${account.domain}/courses/${course.id} - ${safeName}`;
    setProgress(`Exporting ${account.domain} / ${progressName}...`);

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
      try {
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
    setProgress("Preparing zip...");
    try {
      const zip = new JSZip();
      for (const item of selectedCourses) {
        await exportCourse(zip, item);
      }
      setProgress("Zipping...");
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
        <Heading level="h2" style={{ margin: 0 }} className="text-gradient">Export Courses</Heading>
        <Text size="medium" color="secondary">Select courses to export.</Text>
      </div>

      {error && (
        <div style={{ padding: '1rem', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', borderRadius: 12 }}>
          <Text color="danger">{error}</Text>
        </div>
      )}

      <View as="section" margin="medium 0 0" width="100%">
        <div className="download-controls">
          <button className="btn" onClick={() => toggleAll(true)}>Select All</button>
          <button className="btn" onClick={() => toggleAll(false)}>Deselect All</button>
          <label>
            <span>Delay (ms):</span>
            <input type="number" min={0} value={delayMs} onChange={e => setDelayMs(Math.max(0, Number(e.target.value)||0))} style={{ width: 80 }} />
          </label>
          <div style={{ flex: 1 }}></div>
          <button className="btn" onClick={startExport} disabled={exporting || selectedCourses.length === 0}>
            Export JSON
          </button>
          <button className="btn-primary" onClick={exportOfflineWebsite} disabled={exporting || selectedCourses.length === 0}>
            Export Offline Website
          </button>
          <button className="btn" onClick={downloadAllFiles} disabled={exporting || selectedCourses.length === 0}>
            Download All Files
          </button>
        </div>

        <div className="course-selection-area">
          {accounts.length === 0 && <Text color="secondary">Add accounts on the Accounts page to begin.</Text>}
          {accounts.map(acc => (
            <div key={acc.id} className="account-group">
              <Heading level="h4" className="account-title">{acc.domain}</Heading>
              <div className="course-grid">
                {courses.filter(c => c.account.id === acc.id).map(({account, course}) => {
                  const key = `${account.domain}:${course.id}`;
                  const isSelected = !!selected[key];
                  const setting = courseSettings[getCourseSettingId(account.domain, course.id)];
                  const { displayName, subtitle } = getCourseDisplay({
                    actualName: course.name,
                    nickname: setting?.nickname,
                    fallback: course.name,
                  });
                  return (
                    <label key={key} className={`course-card ${isSelected ? 'selected' : ''}`}>
                      <input type="checkbox" checked={isSelected} onChange={e => setSelected(s => ({ ...s, [key]: e.target.checked }))} />
                      <span className="course-info">
                        <span className="course-name">{displayName}</span>
                        <span className="course-meta">
                          {(subtitle ? `${subtitle} ` : '')}({course.id})
                        </span>
                      </span>
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
