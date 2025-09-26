"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Account, CanvasCourse, fetchCourse } from "../../../components/canvasApi";

export default function CourseHeader() {
  const params = useParams();
  const accountDomain = params?.accountDomain as string;
  const courseIdStr = params?.courseId as string;
  const courseId = courseIdStr ? parseInt(courseIdStr, 10) : NaN;

  const [account, setAccount] = useState<Account | null>(null);
  const [course, setCourse] = useState<CanvasCourse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("accounts");
      if (saved) {
        const accounts: Account[] = JSON.parse(saved);
        const found = accounts.find(a => a.domain === accountDomain) || null;
        setAccount(found);
        if (!found) setError("Account not found");
      } else { setError("No accounts saved"); }
    } catch { setError("Failed to parse accounts"); }
  }, [accountDomain]);

  useEffect(() => {
    if (!account || isNaN(courseId)) return;
    let cancelled = false;
    fetchCourse(account, courseId)
      .then(data => { if (!cancelled) setCourse(data); })
      .catch(e => !cancelled && setError((e as Error).message));
    return () => { cancelled = true; };
  }, [account, courseId]);

  if (error) {
    return (
      <div style={{
        padding: '1rem',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 'var(--radius-md)',
        color: '#dc2626'
      }}>
        <Text color="danger">{error}</Text>
      </div>
    );
  }
  
  if (!course) {
    return (
      <div className="course-header-modern">
        <div className="skeleton" style={{ height: '2.5rem', width: '60%', marginBottom: '0.5rem' }}></div>
        <div className="skeleton" style={{ height: '1.125rem', width: '40%' }}></div>
      </div>
    );
  }

  return (
    <div className="course-header-modern fade-in">
      <Heading level="h1" margin="0" className="course-title">
        {course.name}
      </Heading>
      <div className="course-code">
        {course.course_code && (
          <Text size="large" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
            {course.course_code}
          </Text>
        )}
        {account && (
          <Text size="medium" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
            📚 {account.domain}
          </Text>
        )}
      </div>
    </div>
  );
}
