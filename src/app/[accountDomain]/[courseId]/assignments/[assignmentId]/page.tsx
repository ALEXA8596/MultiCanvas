"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Link } from "@instructure/ui-link";
import CourseNav from "../../CourseNav";
import CourseHeader from "../../CourseHeader";
import { Account, Assignment, AssignmentOverride, fetchAssignment, fetchAssignmentOverrides, uploadAssignmentFile, submitAssignmentFiles, UploadedFile } from "../../../../../components/canvasApi";

export default function AssignmentDetailPage() {
  const params = useParams();
  const accountDomain = params?.accountDomain as string;
  const courseIdStr = params?.courseId as string;
  const assignmentIdStr = params?.assignmentId as string;
  const courseId = courseIdStr ? parseInt(courseIdStr, 10) : NaN;
  const assignmentId = assignmentIdStr ? parseInt(assignmentIdStr, 10) : NaN;

  const [account, setAccount] = useState<Account | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [overrides, setOverrides] = useState<AssignmentOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("accounts");
      if (saved) {
        const accounts: Account[] = JSON.parse(saved);
        const found = accounts.find((a) => a.domain === accountDomain) || null;
        setAccount(found);
        if (!found) setError("Account not found");
      } else {
        setError("No accounts saved");
      }
    } catch {
      setError("Failed to parse accounts");
    }
  }, [accountDomain]);

  useEffect(() => {
    if (!account || isNaN(courseId) || isNaN(assignmentId)) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchAssignment(account, courseId, assignmentId).catch((e) => { throw e; }),
      fetchAssignmentOverrides(account, courseId, assignmentId).catch(() => [])
    ])
      .then(([a, ovs]) => {
        if (cancelled) return;
        setAssignment(a);
        setOverrides(Array.isArray(ovs) ? ovs : []);
        if (!a) setError("Assignment not found");
      })
      .catch((e: any) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [account, courseId, assignmentId]);

  if (isNaN(courseId) || isNaN(assignmentId)) return <Text>Invalid URL</Text>;

  return (
    <View as="div" padding="medium" width="100%">
      <CourseHeader />
      <CourseNav accountDomain={accountDomain} courseId={courseId} />
      <Heading level="h3" margin="0 0 medium">Assignment</Heading>
      {loading && <Text>Loading assignment...</Text>}
      {!loading && error && <Text color="danger">{error}</Text>}
      {!loading && !error && assignment && (
        <View>
          <Heading level="h4" margin="0 0 small">{assignment.name}</Heading>
          <Text size="small" color="secondary" as="p">ID: {assignment.id}</Text>
          <Text size="small" as="p">Points: {assignment.points_possible ?? '—'}</Text>
          <Text size="small" as="p">Due: {assignment.due_at ? new Date(assignment.due_at).toLocaleString() : 'No due date'}</Text>
          {assignment.description && (
            <View margin="medium 0 0">
              <Heading level="h5" margin="0 0 x-small">Description</Heading>
              <Text as="div" size="small" dangerouslySetInnerHTML={{ __html: assignment.description }} />
            </View>
          )}
          <View margin="medium 0 0">
            <Heading level="h5" margin="0 0 x-small">Links</Heading>
            {assignment.html_url && account && (
              <Text as="p" size="small"><Link href={`https://${account.domain}${assignment.html_url}`}>Open in Canvas</Link></Text>
            )}
          </View>
          <View margin="medium 0 0">
            <Heading level="h5" margin="0 0 x-small">Overrides</Heading>
            {overrides.length === 0 && <Text size="small" color="secondary">No overrides.</Text>}
            {overrides.length > 0 && (
              <View as="ul" margin="0" padding="0">
                {overrides.map((o) => (
                  <View as="li" key={o.id} margin="0 0 x-small" padding="x-small small" background="primary" borderWidth="small" borderRadius="medium">
                    <Text as="p" size="small" weight="bold">Override {o.id}</Text>
                    {o.title && <Text as="p" size="x-small">{o.title}</Text>}
                    {o.due_at && <Text as="p" size="x-small">Due: {new Date(o.due_at).toLocaleString()}</Text>}
                    {o.unlock_at && <Text as="p" size="x-small">Unlock: {new Date(o.unlock_at).toLocaleString()}</Text>}
                    {o.lock_at && <Text as="p" size="x-small">Lock: {new Date(o.lock_at).toLocaleString()}</Text>}
                    {o.student_ids && o.student_ids.length > 0 && <Text as="p" size="x-small">Students: {o.student_ids.join(', ')}</Text>}
                    {o.group_id && <Text as="p" size="x-small">Group: {o.group_id}</Text>}
                    {o.course_section_id && <Text as="p" size="x-small">Section: {o.course_section_id}</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>

          {assignment.submission_types?.includes('online_upload') && account && (
            <View margin="large 0 0">
              <Heading level="h5" margin="0 0 small">Submit Files</Heading>
              <Text size="small" color="secondary" as="p">Select one or more files then upload & submit.</Text>
              <input
                type="file"
                multiple
                onChange={async (e) => {
                  if (!e.target.files || !account) return;                  
                  setSubmitStatus(null);
                  setUploading(true);
                  try {
                    const list = Array.from(e.target.files);
                    const uploaded: UploadedFile[] = [];
                    for (const f of list) {
                      const uf = await uploadAssignmentFile(account, courseId, assignment.id, f);
                      uploaded.push(uf);
                    }
                    setUploadedFiles(prev => [...prev, ...uploaded]);
                  } catch (err: any) {
                    setError(err.message || 'Upload failed');
                  } finally {
                    setUploading(false);
                  }
                }}
                disabled={uploading}
              />
              {uploading && <Text size="small">Uploading...</Text>}
              {uploadedFiles.length > 0 && (
                <View margin="small 0 0">
                  <Heading level="h6" margin="0 0 x-small">Ready to Submit</Heading>
                  <View as="ul" margin="0 0 small" padding="0">
                    {uploadedFiles.map(f => (
                      <View as="li" key={f.id} margin="0 0 xx-small">
                        <Text size="x-small">{f.display_name || f.filename} ({f.size ?? 0} bytes)</Text>
                      </View>
                    ))}
                  </View>
                  <button
                    onClick={async () => {
                      if (!account) return;
                      setSubmitStatus(null);
                      try {
                        setSubmitStatus('Submitting...');
                        await submitAssignmentFiles(account, courseId, assignment.id, uploadedFiles.map(f => f.id));
                        setSubmitStatus('Submitted successfully at ' + new Date().toLocaleTimeString());
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
                  {submitStatus && <Text as="p" size="x-small" color={/failed/i.test(submitStatus) ? 'danger' : 'success'}>{submitStatus}</Text>}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
