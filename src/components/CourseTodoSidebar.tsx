"use client";
import { useEffect, useState } from "react";
import { CanvasCourse, Account, fetchPlannerItems, getMissingSubmissions } from "./canvasApi";
import TodoSidebar, { PlannerLike, MissingLike } from "./TodoSidebar";

interface CourseTodoSidebarProps {
  account: Account;
  course: CanvasCourse;
  courseId: number;
}

export default function CourseTodoSidebar({ account, course, courseId }: CourseTodoSidebarProps) {
  const [assignments, setAssignments] = useState<PlannerLike[]>([]);
  const [announcements, setAnnouncements] = useState<PlannerLike[]>([]);
  const [others, setOthers] = useState<PlannerLike[]>([]);
  const [missing, setMissing] = useState<MissingLike[]>([]);
  const [todoLoading, setTodoLoading] = useState(false);

  // Fetch course-specific todo items
  useEffect(() => {
    if (!account || !course) return;
    let cancelled = false;
    setTodoLoading(true);

    const fetchCourseTodos = async () => {
      try {
        // Fetch planner items for this specific course using context_codes parameter
        const plannerParams = `?context_codes[]=course_${courseId}&per_page=100&order=desc`;
        const plannerItems = await fetchPlannerItems(account, plannerParams);
        
        if (cancelled) return;

        // Filter items by course context and categorize
        const courseItems = plannerItems.filter((item: any) => 
          item.context_name === course.name || 
          item.html_url?.includes(`/courses/${courseId}/`)
        );

        const assignmentItems: PlannerLike[] = [];
        const announcementItems: PlannerLike[] = [];
        const otherItems: PlannerLike[] = [];

        courseItems.forEach((item: any) => {
          const plannerItem: PlannerLike = {
            course_id: item.course_id ?? courseId ?? null,
            plannable_id: item.plannable_id,
            plannable_type: item.plannable_type,
            plannable: item.plannable,
            html_url: item.html_url,
            account: account,
            context_name: item.context_name,
            submissions: item.submissions
          };

          if (item.plannable_type === 'assignment') {
            assignmentItems.push(plannerItem);
          } else if (item.plannable_type === 'announcement' || item.plannable_type === 'discussion_topic') {
            announcementItems.push(plannerItem);
          } else {
            otherItems.push(plannerItem);
          }
        });

        // Fetch missing submissions for this course
        const missingItems = await getMissingSubmissions(account);
        const courseMissing = missingItems.filter((item: any) => 
          item.course_id === courseId
        ).map((item: any) => ({
          course_id: item.course_id ?? courseId,
          plannable_id: item.plannable_id ?? item.assignment?.id ?? item.id,
          assignment: item.assignment,
          title: item.assignment?.name || item.title,
          html_url: item.html_url,
          account: account
        }));

        if (!cancelled) {
          setAssignments(assignmentItems);
          setAnnouncements(announcementItems);
          setOthers(otherItems);
          setMissing(courseMissing);
        }
      } catch (error) {
        console.error('Failed to fetch course todos:', error);
      } finally {
        if (!cancelled) setTodoLoading(false);
      }
    };

    fetchCourseTodos();
    return () => { cancelled = true; };
  }, [account, course, courseId]);

  if (todoLoading) {
    return (
      <div style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        boxShadow: '0 2px 8px var(--shadow-light)',
        width: '22rem'
      }}>
        <div className="skeleton" style={{ height: '1.5rem', width: '60%', marginBottom: '1rem' }}></div>
        <div className="skeleton" style={{ height: '8rem', width: '100%', marginBottom: '1rem' }}></div>
        <div className="skeleton" style={{ height: '1rem', width: '80%', marginBottom: '0.5rem' }}></div>
        <div className="skeleton" style={{ height: '1rem', width: '70%', marginBottom: '0.5rem' }}></div>
        <div className="skeleton" style={{ height: '1rem', width: '60%' }}></div>
      </div>
    );
  }

  return (
    <TodoSidebar 
      assignments={assignments}
      announcements={announcements}
      others={others}
      missing={missing}
    />
  );
}
