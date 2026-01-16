"use client";
import { Geist, Geist_Mono } from "next/font/google";
import "./stylesheets/modern-pages.css";
import "./stylesheets/components.css";
import "./stylesheets/canvas-nav.css";
import "./globals.css";

import { View } from "@instructure/ui-view";
import Link from "next/link";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Link as UILink } from "@instructure/ui-link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchAllCourses, CanvasCourse, Account } from "@/components/canvasApi";
import { getCourseSettingId } from "@/lib/db";
import { getCourseDisplay } from "@/lib/courseDisplay";
import { useCourseSettingsMap } from "@/hooks/useCourseSettingsMap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faColumns,
  faBookOpen,
  faCalendarDays,
  faListCheck,
  faInbox,
  faDownload,
  faCog,
  faGraduationCap
} from "@fortawesome/free-solid-svg-icons";
import { ThemeProvider } from "../components/ThemeProvider";
import { ThemeToggle } from "../components/ThemeToggle";
import { DevTools } from "../components/DevTools";
import OfflineIndicator from "../components/OfflineIndicator";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const NAV_ITEMS = [
  { label: "Account", icon: faUser, href: "/accounts" },
  { label: "Dashboard", icon: faColumns, href: "/" },
  { label: "Courses", icon: faBookOpen, href: "/courses" },
  { label: "Grades", icon: faGraduationCap, href: "/grades" },
  { label: "Calendar", icon: faCalendarDays, href: "/calendar" },
  { label: "Todo", icon: faListCheck, href: "/todo" },
  { label: "Inbox", icon: faInbox, href: "/inbox" },
  { label: "Download", icon: faDownload, href: "/download" },
  { label: "Settings", icon: faCog, href: "/settings" }
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [navExpanded, setNavExpanded] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [courses, setCourses] = useState<
    Array<{ account: Account; course: CanvasCourse }>
  >([]);
  const courseSettings = useCourseSettingsMap();

  useEffect(() => {
    // load saved accounts and fetch courses
    const saved =
      typeof window !== "undefined" ? localStorage.getItem("accounts") : null;
    let parsed: Account[] = [];
    if (saved) {
      try {
        parsed = JSON.parse(saved);
      } catch {
        parsed = [];
      }
    }
    setAccounts(parsed || []);
    if ((parsed || []).length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAllCourses(parsed);
        if (cancelled) return;
        const flat: Array<{ account: Account; course: CanvasCourse }> = [];
        for (const r of res) {
          const acct = r.account as Account;
          if (Array.isArray(r.courses)) {
            for (const c of r.courses as CanvasCourse[])
              flat.push({ account: acct, course: c });
          }
        }
        setCourses(flat);
      } catch {
        // ignore failures here; dropdown will be empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasAccounts = accounts.length > 0;
  const isNavItemActive = useCallback(
    (href: string) => {
      if (!href) return false;
      if (href === "/") return pathname === "/";
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname]
  );

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${navExpanded ? 'primary-nav-expanded' : ''}`}>
        <ThemeProvider>
          <header id="header" className="ic-app-header no-print" aria-label="Global Header">
            <div className="ic-app-header__main-navigation" aria-label="Global Navigation">
              <div className="ic-app-header__logomark-container">
                <Link href="/">
                  <Heading level="h4" color="primary-inverse" margin="0">MC</Heading>
                </Link>
              </div>
              <ul id="menu" className="ic-app-header__menu-list">
                {NAV_ITEMS.map((item) => {
                  const active = isNavItemActive(item.href);
                  const itemClass = `menu-item ic-app-header__menu-list-item ${active ? 'ic-app-header__menu-list-item--active' : ''}`;
                  
                  if (item.label === "Courses") {
                    return (
                      <li key={item.label} className={itemClass}>
                        <button
                          type="button"
                          className="ic-app-header__menu-list-link"
                          onClick={() => {
                            if (!hasAccounts) return;
                            setCoursesOpen((o) => !o);
                          }}
                          disabled={!hasAccounts}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                        >
                          <div className="menu-item-icon-container">
                            <FontAwesomeIcon icon={item.icon} className="ic-icon-svg" style={{ width: '26px', height: '26px' }} />
                          </div>
                          <div className="menu-item__text">
                            {item.label}
                          </div>
                        </button>
                        {coursesOpen && hasAccounts && (
                            <div
                              id="nav-tray-portal"
                              style={{
                                position: "fixed",
                                left: navExpanded ? "84px" : "54px",
                                top: "0",
                                height: "100%",
                                minWidth: "320px",
                                maxWidth: "400px",
                                zIndex: 9999,
                                color: "var(--ic-brand-font-color-dark)",
                                padding: "1rem",
                                background: "var(--surface-elevated)",
                                borderRight: "1px solid var(--border)",
                                boxShadow: "0 0 8px rgba(0,0,0,0.1)",
                                overflowY: "auto"
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <Heading level="h3" margin="0">Courses</Heading>
                                <button 
                                  aria-label="Close" 
                                  type="button" 
                                  onClick={() => setCoursesOpen(false)} 
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}
                                >
                                  &times;
                                </button>
                              </div>
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {courses.length === 0 && (
                                  <li style={{ padding: "0.5rem" }}>
                                    <Text size="x-small" color="secondary">No courses</Text>
                                  </li>
                                )}
                                {courses.map(({ account, course }) => {
                                  const setting = courseSettings[getCourseSettingId(account.domain, course.id)];
                                  const { displayName, subtitle } = getCourseDisplay({
                                    actualName: course.name,
                                    nickname: setting?.nickname,
                                    fallback: course.name,
                                  });
                                  return (
                                    <li key={`${account.domain}-${course.id}`} style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
                                      <UILink href={`/${account.domain}/${course.id}`} isWithinText={false} style={{ fontWeight: 600, display: 'block' }}>
                                        {displayName}
                                      </UILink>
                                      {subtitle && <Text size="small" color="secondary" as="div">{subtitle}</Text>}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                        )}
                      </li>
                    );
                  }

                  return (
                    <li key={item.label} className={itemClass}>
                      <Link href={item.href} className="ic-app-header__menu-list-link">
                        <div className="menu-item-icon-container">
                          <FontAwesomeIcon icon={item.icon} className="ic-icon-svg" style={{ width: '26px', height: '26px' }} />
                        </div>
                        <div className="menu-item__text">
                          {item.label}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="ic-app-header__secondary-navigation">
              <ul className="ic-app-header__menu-list">
                <li className="menu-item ic-app-header__menu-list-item">
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0' }}>
                    <ThemeToggle />
                  </div>
                </li>
                <li className="menu-item ic-app-header__menu-list-item">
                  <button 
                    id="primaryNavToggle" 
                    type="button"
                    className="ic-app-header__menu-list-link ic-app-header__menu-list-link--nav-toggle" 
                    aria-label="Minimize global navigation" 
                    title="Minimize global navigation"
                    onClick={() => setNavExpanded(!navExpanded)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    <div className="menu-item-icon-container" aria-hidden="true">
                       <svg xmlns="http://www.w3.org/2000/svg" className="ic-icon-svg ic-icon-svg--navtoggle" version="1.1" x="0" y="0" width="40" height="32" viewBox="0 0 40 32" xmlSpace="preserve">
                         <path d="M39.5,30.28V2.48H37.18v27.8Zm-4.93-13.9L22.17,4,20.53,5.61l9.61,9.61H.5v2.31H30.14l-9.61,9.61,1.64,1.64Z"></path>
                       </svg>
                    </div>
                  </button>
                </li>
              </ul>
            </div>
          </header>

          <View
            as="div"
            className="layout-shell"
          >
            <View
              as="main"
              padding="0"
              margin="0"
              overflowY="auto"
              className="slide-in-right layout-shell__main"
              style={{
                background: "var(--background)",
                minHeight: "100%",
                width: "100%"
              }}
            >
              <div style={{ padding: "2rem" }}>{children}</div>
            </View>
          </View>
          <OfflineIndicator />
          <DevTools />
        </ThemeProvider>
      </body>
    </html>
  );
}
