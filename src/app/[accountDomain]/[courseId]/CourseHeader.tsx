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
      <div className="modern-card" style={{
        padding: '1rem',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#dc2626'
      }}>
        <Text style={{ color: '#dc2626' }}>{error}</Text>
      </div>
    );
  }
  
  if (!course) {
    return (
      <div style={{
        padding: '2rem',
        background: 'var(--gradient-primary)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '1.5rem'
      }}>
        <div style={{ 
          height: '2.5rem', 
          width: '60%', 
          marginBottom: '0.5rem',
          background: 'rgba(255, 255, 255, 0.3)',
          borderRadius: 'var(--radius-sm)',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
        }}></div>
        <div style={{ 
          height: '1.125rem', 
          width: '40%',
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 'var(--radius-sm)',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          animationDelay: '0.1s'
        }}></div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{
      padding: '2rem',
      background: 'var(--gradient-primary)',
      borderRadius: 'var(--radius-lg)',
      marginBottom: '1.5rem',
      boxShadow: '0 4px 12px var(--shadow-medium)'
    }}>
      <Heading level="h1" margin="0 0 small" style={{
        color: 'white',
        fontSize: '2rem',
        fontWeight: '700'
      }}>
        {course.name}
      </Heading>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem'
      }}>
        {course.course_code && (
          <Text size="large" style={{ color: 'rgba(255, 255, 255, 0.95)', fontWeight: '500' }}>
            {course.course_code}
          </Text>
        )}
        {account && (
          <Text size="medium" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
            📚 {account.domain}
          </Text>
        )}
      </div>
    </div>
  );
}
