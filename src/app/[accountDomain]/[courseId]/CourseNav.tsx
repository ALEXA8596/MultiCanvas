"use client";
import { usePathname } from "next/navigation";

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
    <nav style={{
      background: 'var(--surface-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '0.5rem',
      marginBottom: '1.5rem',
      boxShadow: '0 2px 4px var(--shadow-light)'
    }}>
      <ul style={{ 
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        listStyle: 'none', 
        margin: 0, 
        padding: 0 
      }}>
        {PAGES.map(({ slug, label }, index) => {
          const href = slug ? `${base}/${slug}` : base;
          const active = pathname === href;
          return (
            <li key={href} className="fade-in" style={{
              animationDelay: `${index * 0.05}s`
            }}>
              <a 
                href={href}
                style={{
                  textDecoration: 'none',
                  display: 'block',
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: active ? 'var(--gradient-primary)' : 'transparent',
                  color: active ? 'white' : 'var(--foreground)',
                  fontWeight: active ? '600' : '500',
                  fontSize: '0.875rem',
                  transition: 'all var(--transition-fast)',
                  border: active ? 'none' : '1px solid transparent'
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'var(--secondary)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
              >
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
