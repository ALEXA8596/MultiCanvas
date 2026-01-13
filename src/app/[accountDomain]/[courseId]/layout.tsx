"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import CourseHeader from "./CourseHeader";
import CourseNav from "./CourseNav";
import { Account } from "@/components/canvasApi";
import "./course-layout.css";

export default function CourseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const accountDomain = (params?.accountDomain as string) || "";
  const courseIdParam = params?.courseId as string;
  const courseId = courseIdParam ? parseInt(courseIdParam, 10) : NaN;
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    if (!accountDomain) return;
    try {
      const saved = localStorage.getItem("accounts");
      if (saved) {
        const accounts: Account[] = JSON.parse(saved);
        const found = accounts.find((a) => a.domain === accountDomain);
        if (found) setAccount(found);
      }
    } catch {
      // ignore
    }
  }, [accountDomain]);

  if (!accountDomain || isNaN(courseId)) {
    return <div className="course-layout__error">{children}</div>;
  }

  return (
    <div className="course-layout">
      <CourseHeader />
      <div className="course-layout__container">
        <aside className="course-layout__sidebar">
          <div className="course-layout__sidebar-sticky">
            <CourseNav accountDomain={accountDomain} courseId={courseId} account={account} />
          </div>
        </aside>
        <main className="course-layout__main">
          {children}
        </main>
      </div>
    </div>
  );
}
