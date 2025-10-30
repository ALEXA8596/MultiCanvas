"use client";
import { useEffect, useMemo, useState } from "react";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Link } from "@instructure/ui-link";
import {
  Account,
  PlannerItem,
  SubmissionStatus,
  fetchPlannerItems,
  fetchAssignment,
  uploadAssignmentFile,
  submitAssignmentFiles,
  UploadedFile,
} from "../../components/canvasApi";

// Runtime type guard for SubmissionStatus object variant
function isSubmissionObject(s: SubmissionStatus | undefined | null): s is Exclude<SubmissionStatus, false> {
  return !!s && typeof s === 'object';
}

// Prefer due_at when available
function getDueAt(pi: PlannerItem): string | null {
  const p: any = pi.plannable;
  if (p && typeof p === 'object' && typeof p.due_at === 'string') return p.due_at as string;
  return null;
}

export default function FocusModePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<(PlannerItem & { account: Account })[]>([]);
  const [index, setIndex] = useState(0);

  // Current assignment expanded details
  const [currentAssignmentHtml, setCurrentAssignmentHtml] = useState<string | null>(null);
  const [currentAssignmentName, setCurrentAssignmentName] = useState<string | null>(null);
  const [currentAssignmentUrl, setCurrentAssignmentUrl] = useState<string | null>(null);

  // Submission UI state
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("accounts");
    if (saved) {
      try { setAccounts(JSON.parse(saved)); } catch {}
    }
  }, []);

  // Fetch assignment-type planner items across a broad range, filter unsent/ungraded
  useEffect(() => {
    if (accounts.length === 0) { setAssignments([]); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const lastYearISO = (() => { const d=new Date(); d.setFullYear(d.getFullYear()-1); return d.toISOString().split('T')[0]; })();
        const nextYearISO = (() => { const d=new Date(); d.setFullYear(d.getFullYear()+1); return d.toISOString().split('T')[0]; })();
        const results = await Promise.all(accounts.map(async (account) => {
          const a: PlannerItem[] = await fetchPlannerItems(account, `?start_date=${lastYearISO}&end_date=${nextYearISO}&per_page=100`).catch(() => []);
          return (Array.isArray(a) ? a : [])
            .filter(pi => pi.plannable_type === 'assignment')
            .map(pi => ({ ...pi, account }));
        }));
        let merged = results.flat();
        // Filter: not submitted AND not graded
        merged = merged.filter(pi => {
          const sub = (pi as any).submissions as SubmissionStatus | undefined;
          if (!isSubmissionObject(sub)) return true; // if we don't have info, keep it (conservative)
          if (sub.graded) return false;
          if (sub.submitted) return false;
          return true;
        });
        // Sort by due date (ascending), nulls last
        merged.sort((a,b) => {
          const da = getDueAt(a); const db = getDueAt(b);
          if (da && db) return new Date(da).getTime() - new Date(db).getTime();
          if (da && !db) return -1;
          if (!da && db) return 1;
          return 0;
        });
        if (!cancelled) {
          setAssignments(merged);
          setIndex(0);
        }
      } catch (e:any) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accounts]);

  // Load details for the current assignment (name, description, html_url)
  const current = assignments[index];
  useEffect(() => {
    setUploadedFiles([]);
    setSubmitStatus(null);
    setCurrentAssignmentHtml(null);
    setCurrentAssignmentName(null);
    setCurrentAssignmentUrl(null);
    if (!current) return;
    let cancelled = false;
    (async () => {
      try {
        const asn = await fetchAssignment(current.account, current.course_id!, Number(current.plannable_id));
        if (cancelled) return;
        setCurrentAssignmentName(asn.name || 'Assignment');
        setCurrentAssignmentHtml(asn.description || null);
        setCurrentAssignmentUrl(asn.html_url || null);
      } catch (e) {
        // Ignore; show minimal info
      }
    })();
    return () => { cancelled = true; };
  }, [current]);

  const advance = () => {
    setUploadedFiles([]);
    setSubmitStatus(null);
    setIndex(i => Math.min(assignments.length - 1, i + 1));
  };
  const goBack = () => setIndex(i => Math.max(0, i - 1));

  return (
    <div className="dashboard-container fade-in">
      <div className="dashboard-header">
        <Heading level="h2" style={{ margin: 0 }} className="text-gradient">Focus Mode</Heading>
        <Text size="medium" color="secondary">Work through your most urgent assignments one-by-one.</Text>
      </div>

      {loading && <Text>Loading assignments…</Text>}
      {error && <Text color="danger">{error}</Text>}
      {!loading && assignments.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '2rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--surface-elevated)'
        }}>
          <Heading level="h4" style={{ margin: 0 }}>No pending assignments</Heading>
          <Text color="secondary">Everything’s caught up. Nice!</Text>
        </div>
      )}

      {!loading && assignments.length > 0 && current && (
        <View as="section" margin="medium 0 0" width="100%">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <button className="btn" onClick={goBack} disabled={index === 0}>◀ Prev</button>
            <Text size="small" color="secondary">{index + 1} of {assignments.length}</Text>
            <button className="btn" onClick={advance} disabled={index >= assignments.length - 1}>Next ▶</button>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--background)', padding: '1rem' }}>
            <Heading level="h3" style={{ margin: 0 }}>{currentAssignmentName || (current.plannable as any)?.title || 'Assignment'}</Heading>
            <Text size="small" color="secondary" as="p">
              Due: {(() => { const d = getDueAt(current); return d ? new Date(d).toLocaleString() : 'No due date'; })()}
            </Text>
            {(currentAssignmentHtml || (current.plannable as any)?.description) && (
              <View margin="small 0 0">
                <Text as="div" size="small" dangerouslySetInnerHTML={{ __html: currentAssignmentHtml || (current.plannable as any)?.description || '' }} />
              </View>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {currentAssignmentUrl && (
                <Link href={`https://${current.account.domain}${currentAssignmentUrl}`}>
                  Open in Canvas
                </Link>
              )}
              <Link href={`/${current.account.domain}/${current.course_id}/assignments/${current.plannable_id}`}>
                Open in app
              </Link>
            </div>

            {/* Submission - files */}
            <div style={{ marginTop: '1rem' }}>
              <Heading level="h4" style={{ margin: 0 }}>Submit Files</Heading>
              <Text size="small" color="secondary" as="p">Upload one or more files and submit when ready.</Text>
              <input
                type="file"
                multiple
                onChange={async (e) => {
                  if (!e.target.files) return;
                  setSubmitStatus(null);
                  setUploading(true);
                  try {
                    const list = Array.from(e.target.files);
                    const uploaded: UploadedFile[] = [];
                    for (const f of list) {
                      const uf = await uploadAssignmentFile(current.account, current.course_id!, Number(current.plannable_id), f);
                      uploaded.push(uf);
                    }
                    setUploadedFiles(prev => [...prev, ...uploaded]);
                  } catch (err: any) {
                    setSubmitStatus('Upload failed: ' + (err.message || 'Unknown error'));
                  } finally {
                    setUploading(false);
                  }
                }}
                disabled={uploading}
              />
              {uploading && <Text size="small">Uploading…</Text>}
              {uploadedFiles.length > 0 && (
                <View margin="small 0 0">
                  <Heading level="h5" style={{ margin: 0 }}>Ready to Submit</Heading>
                  <View as="ul" margin="0 0 small" padding="0">
                    {uploadedFiles.map(f => (
                      <View as="li" key={f.id} margin="0 0 xx-small">
                        <Text size="x-small">{f.display_name || f.filename} ({f.size ?? 0} bytes)</Text>
                      </View>
                    ))}
                  </View>
                  <button
                    onClick={async () => {
                      setSubmitStatus(null);
                      try {
                        setSubmitStatus('Submitting…');
                        await submitAssignmentFiles(current.account, current.course_id!, Number(current.plannable_id), uploadedFiles.map(f => f.id));
                        setSubmitStatus('Submitted successfully at ' + new Date().toLocaleTimeString());
                        // Remove current item from the list and move to next
                        setAssignments(prev => prev.filter((_, i) => i !== index));
                        setIndex(i => Math.max(0, Math.min(i, assignments.length - 2)));
                        setUploadedFiles([]);
                      } catch (err: any) {
                        setSubmitStatus('Submission failed: ' + (err.message || 'Unknown error'));
                      }
                    }}
                    disabled={uploadedFiles.length === 0 || uploading}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--gradient-primary)',
                      color: 'white'
                    }}
                  >
                    Submit Assignment
                  </button>
                </View>
              )}
              {submitStatus && (
                <Text as="p" size="x-small" color={/failed/i.test(submitStatus) ? 'danger' : 'success'}>{submitStatus}</Text>
              )}
            </div>
          </div>
        </View>
      )}
    </div>
  );
}
