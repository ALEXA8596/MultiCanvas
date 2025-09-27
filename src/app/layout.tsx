// NOTE: Requires: npm i @instructure/ui @instructure/emotion @instructure/ui-themes
"use client";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./stylesheets/modern-pages.css";
import "./stylesheets/components.css";
import "./globals.css";

import { InstUISettingsProvider } from "@instructure/emotion";
// Canvas theme might be default export or named differently; fallback to default import
import * as InstructureThemes from "@instructure/ui-themes";
// Use provided canvas theme token; fallback to whole module object
const canvasTheme = (InstructureThemes as any).canvas || InstructureThemes;
import { View } from "@instructure/ui-view";
import { Flex } from "@instructure/ui-flex";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Link } from "@instructure/ui-link";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faColumns,
  faBookOpen,
  faCalendarDays,
  faListCheck,
  faInbox,
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
  { label: "Calendar", icon: faCalendarDays, href: "/calendar" },
  { label: "Todo", icon: faListCheck, href: "/todo" },
  { label: "Inbox", icon: faInbox, href: "/inbox" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider>
          {/* <View as="div" background="secondary" className="fade-in" style={{ 
            borderBottom: '1px solid var(--border)',
            background: 'var(--gradient-secondary)',
            boxShadow: '0 2px 8px var(--shadow-light)'
          }}>
            <Flex alignItems="center" gap="large" wrap="no-wrap" padding="medium large">
              <Heading level="h3" margin="0 small 0 0" className="text-gradient">
                Canvas MultiInstance
              </Heading>
            </Flex>
          </View> */}
          <Flex
            alignItems="center"
            gap="large"
            wrap="no-wrap"
            padding="medium large"
            justifyItems="space-between"
          >
            <Heading level="h3" margin="0 small 0 0" className="text-gradient">
              Canvas MultiInstance
            </Heading>
            <div style={{ marginLeft: 'auto' }}>
              <ThemeToggle />
            </div>
          </Flex>
          <Flex
            as="div"
            alignItems="start"
            style={{ minHeight: "calc(100vh - 80px)" }}
          >
            <View
              background="primary"
              padding="medium 0"
              width="5rem"
              borderWidth="0 small 0 0"
              shadow="resting"
              as="nav"
              className="nav-modern slide-in-left"
              style={{
                background: "var(--surface-elevated)",
                borderRight: "1px solid var(--border)",
                boxShadow: "2px 0 8px var(--shadow-light)",
                display: "flex",
                flexDirection: "column",
              }}
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
                      <Link
                        href={item.href}
                        isWithinText={false}
                        interaction="enabled"
                        className={`nav-item-modern ${active ? "active" : ""}`}
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
                              fontSize: "1.5rem",
                              color: active ? "var(--foreground)" : "var(--primary)",
                            }}
                          />
                          <Text
                            size="x-small"
                            weight={active ? "bold" : "normal"}
                            style={{
                              color: active ? "var(--foreground)" : "var(--foreground)",
                              textAlign: "center",
                              lineHeight: "1.2",
                            }}
                          >
                            {item.label}
                          </Text>
                        </div>
                      </Link>
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
              className="slide-in-right"
              style={{
                flex: 1,
                background: "var(--background)",
                minHeight: "100%",
              }}
            >
              <div style={{ padding: "2rem" }}>{children}</div>
            </View>
          </Flex>
        </ThemeProvider>
      </body>
    </html>
  );
}
