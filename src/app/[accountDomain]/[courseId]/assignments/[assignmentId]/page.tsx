"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CourseNav from "../../CourseNav";
import CourseHeader from "../../CourseHeader";
import { Account, Assignment, AssignmentOverride, fetchAssignment, fetchAssignmentOverrides, uploadAssignmentFile, submitAssignmentFiles, UploadedFile } from "../../../../../components/canvasApi";
import "../../../../stylesheets/assignment.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFile, faCheckCircle } from "@fortawesome/free-solid-svg-icons";

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
  const [showSubmission, setShowSubmission] = useState(false);

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

  if (isNaN(courseId) || isNaN(assignmentId)) return <div>Invalid URL</div>;

  return (
    <div className="ic-Layout-wrapper">
      <CourseHeader />
      <div className="ic-Layout-columns">
        <CourseNav accountDomain={accountDomain} courseId={courseId} />
        <div className="ic-Layout-contentMain">
          {loading && <div>Loading assignment...</div>}
          {!loading && error && <div style={{ color: 'red' }}>{error}</div>}
          {!loading && !error && assignment && (
            <div id="assignment_show" className="assignment content_underline_links">
              <div className="assignment-title">
                <div className="title-content">
                  <h1 className="title">{assignment.name}</h1>
                </div>
                <div className="assignment-buttons">
                  {assignment.submission_types?.includes('online_upload') && (
                    <button 
                      type="button" 
                      className="btn-primary"
                      onClick={() => setShowSubmission(!showSubmission)}
                    >
                      {showSubmission ? "Cancel Attempt" : "Start Assignment"}
                    </button>
                  )}
                </div>
              </div>

              <ul className="student-assignment-overview">
                <li>
                  <span className="title">Due</span>
                  <span className="value">
                    {assignment.due_at ? new Date(assignment.due_at).toLocaleString() : 'No due date'}
                  </span>
                </li>
                <li>
                  <span className="title">Points</span>
                  <span className="value">{assignment.points_possible ?? '—'}</span>
                </li>
                <li>
                  <span className="title">Submitting</span>
                  <span className="value">
                    {assignment.submission_types?.join(', ') || 'Nothing'}
                  </span>
                </li>
                {assignment.allowed_extensions && (
                  <li>
                    <span className="title">File Types</span>
                    <span className="value">{assignment.allowed_extensions.join(', ')}</span>
                  </li>
                )}
              </ul>

              <div className="description user_content" dangerouslySetInnerHTML={{ __html: assignment.description || '' }} />

              {showSubmission && assignment.submission_types?.includes('online_upload') && account && (
                <div style={{ border: '1px solid #C7CDD1', padding: '1rem', borderRadius: '3px', marginBottom: '2rem' }}>
                  <h3 style={{ marginTop: 0 }}>File Upload</h3>
                  <p style={{ fontSize: '0.875rem', color: '#555' }}>Select one or more files then upload & submit.</p>
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
                    style={{ marginBottom: '1rem' }}
                  />
                  {uploading && <div>Uploading...</div>}
                  {uploadedFiles.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <h4 style={{ fontSize: '1rem', margin: '0 0 0.5rem 0' }}>Ready to Submit</h4>
                      <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1rem' }}>
                        {uploadedFiles.map(f => (
                          <li key={f.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <FontAwesomeIcon icon={faFile} style={{ marginRight: '0.5rem', color: '#777' }} />
                            <span style={{ fontSize: '0.875rem' }}>{f.display_name || f.filename} ({f.size ?? 0} bytes)</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={async () => {
                          if (!account) return;
                          setSubmitStatus(null);
                          try {
                            setSubmitStatus('Submitting...');
                            await submitAssignmentFiles(account, courseId, assignment.id, uploadedFiles.map(f => f.id));
                            setSubmitStatus('Submitted successfully at ' + new Date().toLocaleTimeString());
                            setShowSubmission(false);
                            setUploadedFiles([]);
                          } catch (err: any) {
                            setSubmitStatus('Submission failed: ' + (err.message || 'Unknown error'));
                          }
                        }}
                        disabled={uploadedFiles.length === 0 || uploading}
                        className="btn-primary"
                      >
                        Submit Assignment
                      </button>
                      {submitStatus && (
                        <div style={{ marginTop: '0.5rem', color: /failed/i.test(submitStatus) ? '#EE0612' : '#008A00' }}>
                          {/failed/i.test(submitStatus) ? null : <FontAwesomeIcon icon={faCheckCircle} style={{ marginRight: '0.5rem' }} />}
                          {submitStatus}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Rubric Placeholder - mimicking the structure */}
              <div className="rubric_container">
                <div className="rubric_title">
                  Rubric
                </div>
                <table className="rubric_table">
                  <thead>
                    <tr>
                      <th>Criteria</th>
                      <th>Ratings</th>
                      <th>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="criterion_description">
                        <span className="description_title">Example Criterion</span>
                        <span style={{ fontSize: '0.875rem' }}>Description of the criterion goes here.</span>
                      </td>
                      <td className="ratings">
                        <div className="rating-main">
                          <span className="points">5 pts</span>
                          <span>Full Marks</span>
                        </div>
                      </td>
                      <td className="points_form">
                        <span className="points">5 pts</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

