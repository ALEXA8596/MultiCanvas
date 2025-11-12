"use client";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./stylesheets/modern-pages.css";
import "./stylesheets/components.css";
import "./globals.css";

import { View } from "@instructure/ui-view";
import { Flex } from "@instructure/ui-flex";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Link } from "@instructure/ui-link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  fetchAllCourses,
  CanvasCourse,
  Account,
} from "../components/canvasApi";
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

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const metadata: Metadata = {
  title: "Canvas MultiInstance",
  description: "Merge multiple Canvas instances into one app",
};

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [courses, setCourses] = useState<
    Array<{ account: Account; course: CanvasCourse }>
  >([]);

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
  const appTitle = typeof metadata.title === "string" ? metadata.title : "MultiCanvas";

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider>
          <Flex
            alignItems="center"
            gap="large"
            wrap="no-wrap"
            padding="small small"
            justifyItems="space-between"
            className="title-bar"
          >
            <Heading level="h3" margin="0 0 0 0" className="text-gradient">
              {appTitle}
            </Heading>
            <div style={{ marginLeft: "auto" }}>
              <ThemeToggle />
            </div>
          </Flex>
          <View
            as="div"
            className="layout-shell"
          >
            <View
              background="primary"
              padding="low 0"
              width="5rem"
              borderWidth="0 small 0 0"
              shadow="resting"
              as="nav"
              style={{
                background: "var(--surface-elevated)",
                borderRight: "1px solid var(--border)",
                boxShadow: "2px 0 8px var(--shadow-light)",
                display: "flex",
                flexDirection: "column",
              }}
              className="nav-modern slide-in-left layout-shell__nav"
            >
              <Flex
                direction="column"
                gap="x-small"
                margin="0"
                padding="small"
                alignItems="center"
              >
                {NAV_ITEMS.map((item, index) => {
                  const active = pathname === item.href;
                  return (
                    <View
                      key={item.label}
                      margin="0"
                      padding="0"
                      className="scale-in"
                      style={{
                        animationDelay: `${index * 0.1}s`,
                        width: "100%",
                      }}
                    >
                      {item.label === "Courses" ? (
                        <div
                          // className={`nav-item-modern ${active ? "active" : ""}`}
                          style={{}}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <FontAwesomeIcon
                              icon={item.icon}
                              style={{
                                fontSize: "2.5rem",
                                color: active
                                  ? "var(--foreground)"
                                  : "var(--primary)",
                              }}
                            />
                            <div
                              style={{ position: "relative", width: "100%" }}
                            >
                              <button
                                onClick={() => {
                                  if (!hasAccounts) return;
                                  setCoursesOpen((o) => !o);
                                }}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  padding: 0,
                                  cursor: "pointer",
                                  // color: active ? 'var(--foreground)' : 'var(--foreground)'
                                }}
                                disabled={!hasAccounts}
                                aria-disabled={!hasAccounts}
                              >
                                <Text
                                  size="x-small"
                                  weight={active ? "bold" : "normal"}
                                  style={{
                                    color: active
                                      ? "var(--foreground)"
                                      : "var(--foreground)",
                                    textAlign: "center",
                                    lineHeight: "1.2",
                                  }}
                                >
                                  {item.label}
                                </Text>
                              </button>

                              {coursesOpen && hasAccounts && (
                                <div
                                  id="nav-tray-portal"
                                  style={{
                                    position: "fixed",
                                    left: "6rem",
                                    top: "5vw",
                                    minWidth: "320px",
                                    maxWidth: "calc(100% - 6rem)",
                                    zIndex: 9999,
                                    color: "white",
                                    padding: "0.5rem",
                                    background: "var(--surface-elevated)",
                                    border: "1px solid var(--border)",
                                    borderRadius: 8,
                                    boxShadow: "0 6px 28px rgba(0,0,0,0.18)",
                                  }}
                                >
                                  <span dir="ltr">
                                    <span
                                      dir="ltr"
                                      className="css-1gto5tw-tray transition--slide-left-entered"
                                    >
                                      <div
                                        role="dialog"
                                        aria-label="Courses tray"
                                      >
                                        <div
                                          className="css-1kdtqv3-tray__content"
                                          style={{ padding: "0.5rem" }}
                                        >
                                          <div
                                            className="navigation-tray-container courses-tray"
                                            style={{
                                              display: "flex",
                                              gap: "0.5rem",
                                              flexDirection: "column",
                                            }}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                              <h2 dir="ltr" className="css-1hr8vi3-view-heading" style={{ margin: 0 }}>Courses</h2>
                                              <span className="css-zvg8k4-closeButton">
                                                <button aria-label="Close" type="button" onClick={() => setCoursesOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                                    <svg viewBox="0 0 1920 1920" width="1em" height="1em" aria-hidden="true" role="presentation" focusable="false" style={{ width: '1em', height: '1em' }}>
                                                      <g role="presentation"><path d="M797.32 985.882 344.772 1438.43l188.561 188.562 452.549-452.549 452.548 452.549 188.562-188.562-452.549-452.548 452.549-452.549-188.562-188.561L985.882 797.32 533.333 344.772 344.772 533.333z"></path></g>
                                                    </svg>
                                                    <span style={{ position: 'absolute', left: '-9999px' }}>Close</span>
                                                  </span>
                                                </button>
                                              </span>
                                            </div>

                                            <div>
                                              <div dir="ltr">
                                                <hr role="presentation" />
                                                <span dir="ltr">
                                                  <hr role="presentation" />
                                                  <ul dir="ltr" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                    {courses.length === 0 && (
                                                      <li
                                                        style={{
                                                          padding: "0.5rem",
                                                        }}
                                                      >
                                                        <Text
                                                          size="x-small"
                                                          color="secondary"
                                                        >
                                                          No courses
                                                        </Text>
                                                      </li>
                                                    )}
                                                    {courses.map(
                                                      ({ account, course }) => (
                                                        <li
                                                          key={`${account.domain}-${course.id}`}
                                                          style={{
                                                            padding:
                                                              "0.25rem 0",
                                                            borderBottom:
                                                              "1px solid rgba(0,0,0,0.04)",
                                                          }}
                                                        >
                                                          <Link
                                                            href={`/${account.domain}/${course.id}`}
                                                            isWithinText={false}
                                                            interaction="enabled"
                                                            style={{ textDecoration: 'underline', color: 'var(--primary)', display: 'inline-block' }}
                                                          >
                                                            <div style={{ fontWeight: 600 }}>{course.name}</div>
                                                          </Link>
                                                          <div
                                                            style={{
                                                              color:
                                                                "var(--muted)",
                                                              fontSize:
                                                                "0.8rem",
                                                            }}
                                                          >
                                                            {course.course_code ||
                                                              course.friendly_name ||
                                                              ""}
                                                          </div>
                                                        </li>
                                                      )
                                                    )}
                                                  </ul>
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </span>
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Link
                          href={item.href}
                          isWithinText={false}
                          interaction="enabled"
                          style={{
                            textDecoration: "none",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "0.75rem 0.5rem",
                            margin: "0.125rem",
                            borderRadius: "var(--radius-md)",
                            transition: "all var(--transition-fast)",
                            background: active
                              ? "var(--gradient-primary)"
                              : "transparent",
                            color: active ? "white" : "var(--foreground)",
                            position: "relative",
                            minHeight: "4rem",
                            width: "100%",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "0.25rem",
                            }}
                          >
                            <FontAwesomeIcon
                              icon={item.icon}
                              style={{
                                fontSize: "2.5rem",
                                color: active
                                  ? "var(--foreground)"
                                  : "var(--primary)",
                              }}
                            />
                            <Text
                              size="x-small"
                              weight={active ? "bold" : "normal"}
                              style={{
                                color: active
                                  ? "var(--foreground)"
                                  : "var(--foreground)",
                                textAlign: "center",
                                lineHeight: "1.2",
                              }}
                            >
                              {item.label}
                            </Text>
                          </div>
                        </Link>
                      )}
                    </View>
                  );
                })}
              </Flex>
            </View>
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
              <div style={{ padding: "0 2rem 2rem " }}>{children}</div>
            </View>
          </View>
        </ThemeProvider>
      </body>
    </html>
  );
}
