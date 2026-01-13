"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Account, CourseTab, fetchCourseTabs } from "../../../components/canvasApi";
import "./course-nav.css";

interface CourseNavProps {
  accountDomain: string;
  courseId: number;
  account?: Account | null;
}

// Map of tab IDs to internal routes we support
const SUPPORTED_INTERNAL_TABS: Record<string, { slug: string; icon: string }> = {
  "home": { slug: "", icon: "🏠" },
  "modules": { slug: "modules", icon: "📚" },
  "announcements": { slug: "announcements", icon: "📢" },
  "assignments": { slug: "assignments", icon: "📝" },
  "discussions": { slug: "discussions", icon: "💬" },
  "grades": { slug: "grades", icon: "📊" },
  "pages": { slug: "pages", icon: "📄" },
  "files": { slug: "files", icon: "📁" },
  "settings": { slug: "settings", icon: "⚙️" },
  "syllabus": { slug: "syllabus", icon: "📖" },
  "outcomes": { slug: "outcomes", icon: "🎯" },
  "quizzes": { slug: "quizzes", icon: "❓" },
  "people": { slug: "people", icon: "👥" },
  "collaborations": { slug: "collaborations", icon: "🤝" },
  "conferences": { slug: "conferences", icon: "📹" },
};

// Default tabs to show if API fails or during loading
const DEFAULT_PAGES = [
  { slug: "", label: "Home", icon: "🏠" },
  { slug: "modules", label: "Modules", icon: "📚" },
  { slug: "announcements", label: "Announcements", icon: "📢" },
  { slug: "assignments", label: "Assignments", icon: "📝" },
  { slug: "discussions", label: "Discussions", icon: "💬" },
  { slug: "grades", label: "Grades", icon: "📊" },
  { slug: "pages", label: "Pages", icon: "📄" },
  { slug: "files", label: "Files", icon: "📁" },
  { slug: "settings", label: "Settings", icon: "⚙️" }
];

function getIconForTab(tab: CourseTab): string {
  // Check if it's a known internal tab
  if (SUPPORTED_INTERNAL_TABS[tab.id]) {
    return SUPPORTED_INTERNAL_TABS[tab.id].icon;
  }
  
  // External tool icons
  if (tab.type === "external") {
    return "🔗";
  }
  
  // Default icon for unknown internal tabs
  return "📋";
}

export default function CourseNav({ accountDomain, courseId, account }: CourseNavProps) {
  const pathname = usePathname();
  const base = `/${accountDomain}/${courseId}`;
  const [tabs, setTabs] = useState<CourseTab[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account) {
      setLoading(false);
      return;
    }
    
    let cancelled = false;
    setLoading(true);
    
    fetchCourseTabs(account, courseId)
      .then((fetchedTabs) => {
        if (!cancelled) {
          // Filter out hidden tabs and sort by position
          const visibleTabs = fetchedTabs
            .filter(tab => !tab.hidden)
            .sort((a, b) => a.position - b.position);
          setTabs(visibleTabs);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch course tabs:", err);
        // Keep empty - will fall back to defaults
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    
    return () => { cancelled = true; };
  }, [account, courseId]);

  const isActive = (slug: string) => {
    const href = slug ? `${base}/${slug}` : base;
    if (slug === "") {
      return pathname === base;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const getTabHref = (tab: CourseTab): { href: string; external: boolean; inProgress: boolean } => {
    if (tab.type === "external") {
      // External tools redirect to Canvas
      return { href: tab.full_url || tab.html_url, external: true, inProgress: false };
    }
    
    // Internal tab - check if we support it
    const supported = SUPPORTED_INTERNAL_TABS[tab.id];
    if (supported) {
      const slug = supported.slug;
      return { 
        href: slug ? `${base}/${slug}` : base, 
        external: false, 
        inProgress: false 
      };
    }
    
    // Unsupported internal tab - show in-progress page
    return { 
      href: `${base}/in-progress?tab=${encodeURIComponent(tab.id)}&label=${encodeURIComponent(tab.label)}&canvasUrl=${encodeURIComponent(tab.full_url || tab.html_url)}`,
      external: false,
      inProgress: true
    };
  };

  // Use tabs from API if available, otherwise fall back to defaults
  const navItems = tabs.length > 0 ? tabs : null;

  return (
    <nav className="course-nav" role="navigation" aria-label="Course Navigation Menu">
      <ul className="course-nav__list">
        {navItems ? (
          // Render tabs from API
          navItems.map((tab) => {
            const { href, external, inProgress } = getTabHref(tab);
            const icon = getIconForTab(tab);
            
            // Determine if this tab is active
            let active = false;
            if (!external && !inProgress) {
              const supported = SUPPORTED_INTERNAL_TABS[tab.id];
              if (supported) {
                active = isActive(supported.slug);
              }
            } else if (inProgress) {
              active = pathname.startsWith(`${base}/in-progress`) && 
                       pathname.includes(`tab=${encodeURIComponent(tab.id)}`);
            }
            
            return (
              <li key={tab.id} className="course-nav__item">
                <a 
                  href={href}
                  className={`course-nav__link ${active ? 'course-nav__link--active' : ''} ${external ? 'course-nav__link--external' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noopener noreferrer' : undefined}
                  title={external ? `Opens in Canvas: ${tab.label}` : undefined}
                >
                  <span className="course-nav__icon">{icon}</span>
                  <span className="course-nav__label">{tab.label}</span>
                  {external && <span className="course-nav__external-indicator">↗</span>}
                </a>
              </li>
            );
          })
        ) : (
          // Render default pages during loading or if no account
          DEFAULT_PAGES.map(({ slug, label, icon }) => {
            const href = slug ? `${base}/${slug}` : base;
            const active = isActive(slug);
            return (
              <li key={href} className="course-nav__item">
                <a 
                  href={href}
                  className={`course-nav__link ${active ? 'course-nav__link--active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="course-nav__icon">{icon}</span>
                  <span className="course-nav__label">{label}</span>
                </a>
              </li>
            );
          })
        )}
      </ul>
    </nav>
  );
}

