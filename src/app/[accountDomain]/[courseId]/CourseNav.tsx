"use client";
import { usePathname } from "next/navigation";
import { View } from "@instructure/ui-view";
import { Flex } from "@instructure/ui-flex";
import { Link } from "@instructure/ui-link";
import { Text } from "@instructure/ui-text";

interface CourseNavProps {
  accountDomain: string;
  courseId: number;
}

const PAGES = [
  { slug: "", label: "Overview" },
  { slug: "announcements", label: "Announcements" },
  { slug: "assignments", label: "Assignments" },
  { slug: "discussions", label: "Discussions" },
  { slug: "modules", label: "Modules" },
  { slug: "files", label: "Files" },
  { slug: "people", label: "People" },
  { slug: "wiki", label: "Wiki" }
];

export default function CourseNav({ accountDomain, courseId }: CourseNavProps) {
  const pathname = usePathname();
  const base = `/${accountDomain}/${courseId}`;

  return (
    <nav className="course-nav-modern slide-in-right">
      <ul style={{ 
        display: 'contents', 
        listStyle: 'none', 
        margin: 0, 
        padding: 0 
      }}>
        {PAGES.map(({ slug, label }, index) => {
          const href = slug ? `${base}/${slug}` : base;
          const active = pathname === href;
          return (
            <li key={href} className="scale-in" style={{
              animationDelay: `${index * 0.05}s`
            }}>
              <Link 
                href={href} 
                isWithinText={false}
                className={`course-nav-item ${active ? 'active' : ''}`}
                style={{
                  textDecoration: 'none',
                  display: 'block'
                }}
              >
                <Text 
                  size="small" 
                  weight={active ? "bold" : "normal"}
                  style={{ 
                    color: 'inherit'
                  }}
                >
                  {label}
                </Text>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
