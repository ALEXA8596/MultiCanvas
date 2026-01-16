"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CourseSetting,
  getCourseSettingId,
  getCourseSettings,
  updateCourseSetting,
  upsertCourseSettings,
} from "@/lib/db";
import {
  exportToFile,
  parseImportFile,
  hasEncryptedCredentials,
  importData,
  ExportData,
  ExportOptions,
} from "@/lib/dataExport";
import { fetchAllCourses, Account } from "@/components/canvasApi";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { TextInput } from "@instructure/ui-text-input";
import { Checkbox } from "@instructure/ui-checkbox";
import { Table } from "@instructure/ui-table";
import { NumberInput } from "@instructure/ui-number-input";
import { Button } from "@instructure/ui-buttons";
import { getCourseDisplay } from "@/lib/courseDisplay";
import { useOfflineSupport } from "@/hooks/useOfflineSupport";

type CourseSettingRow = CourseSetting & {
  accountDomain: string;
  courseId: number;
  courseName?: string;
  courseCode?: string;
};

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [courseSettings, setCourseSettings] = useState<CourseSettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  
  // Export/Import state
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeAccounts: true,
    includeCourseSettings: true,
    includeGradeData: true,
    includeGpaProfiles: true,
    encryptCredentials: false,
    password: "",
  });
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<ExportData | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { isOnline, cacheStats, refreshCacheStats, clearCache } = useOfflineSupport();

  // Load developer mode setting
  useEffect(() => {
    const saved = localStorage.getItem("devMode");
    setDevMode(saved === "true");
  }, []);

  const handleClearCache = async () => {
    setClearingCache(true);
    await clearCache();
    setClearingCache(false);
  };

  const handleDevModeToggle = () => {
    const newValue = !devMode;
    setDevMode(newValue);
    localStorage.setItem("devMode", String(newValue));
    // Dispatch storage event for other tabs/components
    window.dispatchEvent(new StorageEvent("storage", { key: "devMode", newValue: String(newValue) }));
  };

  // Export/Import handlers
  const handleExport = async () => {
    setExporting(true);
    setImportMessage(null);
    try {
      await exportToFile(exportOptions);
      setImportMessage({ type: "success", text: "Data exported successfully!" });
    } catch (e) {
      setImportMessage({ type: "error", text: `Export failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setExporting(false);
      setTimeout(() => setImportMessage(null), 5000);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    setImportMessage(null);
    
    try {
      const content = await file.text();
      const data = parseImportFile(content);
      
      if (!data) {
        setImportMessage({ type: "error", text: "Invalid file format" });
        setImporting(false);
        return;
      }

      // Check if password is needed
      if (hasEncryptedCredentials(data)) {
        setPendingImport(data);
        setShowPasswordDialog(true);
        setImporting(false);
        return;
      }

      // Import directly
      const result = await importData(data);
      setImportMessage({ 
        type: result.success ? "success" : "error", 
        text: result.message 
      });
      
      // Reload accounts if imported
      if (result.imported.accounts > 0) {
        const saved = localStorage.getItem("accounts");
        if (saved) setAccounts(JSON.parse(saved));
      }
      
      // Reload page to reflect changes
      if (result.success && (result.imported.courseSettings > 0 || result.imported.terms > 0)) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      setImportMessage({ type: "error", text: `Import failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handlePasswordSubmit = async () => {
    if (!pendingImport) return;
    
    setImporting(true);
    try {
      const result = await importData(pendingImport, importPassword);
      setImportMessage({ 
        type: result.success ? "success" : "error", 
        text: result.message 
      });
      
      if (result.success) {
        setShowPasswordDialog(false);
        setPendingImport(null);
        setImportPassword("");
        
        // Reload accounts if imported
        if (result.imported.accounts > 0) {
          const saved = localStorage.getItem("accounts");
          if (saved) setAccounts(JSON.parse(saved));
        }
        
        // Reload page to reflect changes
        if (result.imported.courseSettings > 0 || result.imported.terms > 0) {
          setTimeout(() => window.location.reload(), 1500);
        }
      }
    } catch (err) {
      setImportMessage({ type: "error", text: `Decryption failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setImporting(false);
    }
  };

  const handleCancelPasswordDialog = () => {
    setShowPasswordDialog(false);
    setPendingImport(null);
    setImportPassword("");
  };

  useEffect(() => {
    const saved = localStorage.getItem("accounts");
    if (!saved) return;
    try {
      setAccounts(JSON.parse(saved));
    } catch {
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const existing = await getCourseSettings();
        if (cancelled) return;

        if (accounts.length === 0) {
          setCourseSettings(existing.map((setting) => {
            const derived = parseFallback(setting.id);
            return {
              accountDomain: derived.accountDomain ?? "",
              courseId: derived.courseId ?? 0,
              ...setting,
            };
          }));
          setLoading(false);
          return;
        }

        const courseResults = await fetchAllCourses(accounts).catch(() => []);
        if (cancelled) return;

        const existingMap = new Map(existing.map((s) => [s.id, s]));
        const ensure: CourseSetting[] = [];
        const rows: CourseSettingRow[] = [];

        courseResults.forEach(({ account, courses }) => {
          (Array.isArray(courses) ? courses : []).forEach((course) => {
            const id = getCourseSettingId(account.domain, course.id);
            const current = existingMap.get(id);
            const merged: CourseSetting = {
              id,
              accountDomain: account.domain,
              courseId: course.id,
              courseName: course.name,
              courseCode:
                course.course_code || course.friendly_name || current?.courseCode,
              nickname: current?.nickname ?? "",
              order:
                typeof current?.order === "number"
                  ? current.order
                  : existing.length + ensure.length + 1,
              visible: current?.visible !== false,
              credits: current?.credits,
            };
            ensure.push(merged);
            rows.push({ accountDomain: account.domain, courseId: course.id, ...merged });
          });
        });

        const finalSettings = await upsertCourseSettings(ensure);
        if (cancelled) return;
        const finalMap = new Map(finalSettings.map((s) => [s.id, s]));
        const hydrated = rows.map((row) => ({
          ...row,
          ...finalMap.get(row.id),
          accountDomain: row.accountDomain,
          courseId: row.courseId,
        }));
        setCourseSettings(hydrated);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load settings");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [accounts]);

  const handleCourseSettingChange = async (
    id: string,
    patch: Partial<CourseSetting>
  ) => {
    setCourseSettings((prev) =>
      prev.map((setting) =>
        setting.id === id
          ? {
              ...setting,
              ...patch,
            }
          : setting
      )
    );
    await updateCourseSetting(id, patch);
  };

  const sortedSettings = useMemo(
    () =>
      [...courseSettings].sort((a, b) => {
        const orderA = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
        const orderB = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      }),
    [courseSettings]
  );

  if (loading) {
    return <Text>Loading settings...</Text>;
  }

  if (error) {
    return <Text color="danger">Error: {error}</Text>;
  }

  if (sortedSettings.length === 0) {
    return (
      <View as="div" padding="large" className="modern-card fade-in">
        <Heading level="h3" margin="0 0 small 0">No Courses Found</Heading>
        <Text as="p" color="secondary">
          Add Canvas accounts and refresh to manage course display settings.
        </Text>
      </View>
    );
  }

  return (
    <div className="settings-container fade-in">
      <Heading level="h2" margin="0 0 medium 0" className="text-gradient">
        Course Settings
      </Heading>

      <View as="section" margin="0 0 large 0">
        <Heading level="h3" margin="0 0 medium 0">Display & Ordering</Heading>
        <Table caption="Course Display Settings">
          <Table.Head>
            <Table.Row>
              <Table.ColHeader id="account">Account</Table.ColHeader>
              <Table.ColHeader id="course">Course</Table.ColHeader>
              <Table.ColHeader id="nickname">Nickname</Table.ColHeader>
              <Table.ColHeader id="order">Order</Table.ColHeader>
              <Table.ColHeader id="visible">Visible</Table.ColHeader>
              <Table.ColHeader id="credits">Credits</Table.ColHeader>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {sortedSettings.map((setting) => {
              const { displayName, subtitle } = getCourseDisplay({
                actualName: setting.courseName,
                nickname: setting.nickname,
                fallback: setting.courseName || String(setting.courseId),
              });
              return (
                <Table.Row key={setting.id}>
                  <Table.Cell>{setting.accountDomain}</Table.Cell>
                  <Table.Cell>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <Text>{displayName}</Text>
                      {subtitle && (
                        <Text size="x-small" color="secondary">
                          {subtitle}
                        </Text>
                      )}
                      {setting.courseCode && (
                        <Text size="x-small" color="secondary">
                          {setting.courseCode}
                        </Text>
                      )}
                    </div>
                  </Table.Cell>
                <Table.Cell>
                  <TextInput
                    renderLabel=""
                    value={setting.nickname || ""}
                    onChange={(_, value) =>
                      handleCourseSettingChange(setting.id, { nickname: value })
                    }
                    placeholder={setting.courseName || "Nickname"}
                  />
                </Table.Cell>
                <Table.Cell>
                  <NumberInput
                    renderLabel=""
                    value={typeof setting.order === "number" ? setting.order : ""}
                    onChange={(_, value) =>
                      handleCourseSettingChange(setting.id, {
                        order: value === "" ? undefined : Number(value),
                      })
                    }
                  />
                </Table.Cell>
                <Table.Cell>
                  <Checkbox
                    label="Visible"
                    checked={setting.visible !== false}
                    onChange={() =>
                      handleCourseSettingChange(setting.id, {
                        visible: !(setting.visible !== false),
                      })
                    }
                  />
                </Table.Cell>
                <Table.Cell>
                  <NumberInput
                    renderLabel=""
                    value={typeof setting.credits === "number" ? setting.credits : ""}
                    onChange={(_, value) => {
                      const parsed = Number(value);
                      handleCourseSettingChange(setting.id, {
                        credits: value === "" || Number.isNaN(parsed) ? undefined : parsed,
                      });
                    }}
                  />
                </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      </View>

      {/* Offline & Cache Settings Section */}
      <View as="section" margin="large 0 0 0">
        <Heading level="h3" margin="0 0 medium 0">Offline & Cache</Heading>
        <View
          as="div"
          padding="medium"
          background="secondary"
          borderRadius="medium"
          borderWidth="small"
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div>
              <Text weight="bold">Connection Status</Text>
              <Text as="p" size="small" color="secondary" style={{ margin: "0.25rem 0 0 0" }}>
                {isOnline ? "✅ Online - Data is being synced with Canvas" : "📡 Offline - Viewing cached data"}
              </Text>
            </div>
            <div style={{
              padding: "0.25rem 0.75rem",
              borderRadius: "var(--radius-sm)",
              backgroundColor: isOnline ? "var(--success-bg, #d4edda)" : "var(--warning-bg, #fff3cd)",
              color: isOnline ? "var(--success-text, #155724)" : "var(--warning-text, #856404)",
              fontWeight: 500,
              fontSize: "0.875rem",
            }}>
              {isOnline ? "Online" : "Offline"}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div>
              <Text weight="bold">Cached Data</Text>
              <Text as="p" size="small" color="secondary" style={{ margin: "0.25rem 0 0 0" }}>
                {cacheStats 
                  ? `${cacheStats.totalEntries} cached API responses (${(cacheStats.totalSize / 1024).toFixed(1)} KB)`
                  : "Loading cache stats..."
                }
              </Text>
            </div>
            <Button
              size="small"
              onClick={refreshCacheStats}
            >
              Refresh Stats
            </Button>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <Text weight="bold">Clear Cache</Text>
              <Text as="p" size="small" color="secondary" style={{ margin: "0.25rem 0 0 0" }}>
                Clear all cached data. You&apos;ll need an internet connection to reload data.
              </Text>
            </div>
            <Button
              size="small"
              color="danger"
              onClick={handleClearCache}
              interaction={clearingCache ? "disabled" : "enabled"}
            >
              {clearingCache ? "Clearing..." : "Clear Cache"}
            </Button>
          </div>
        </View>
      </View>

      {/* Data Export/Import Section */}
      <View as="section" margin="large 0 0 0">
        <Heading level="h3" margin="0 0 medium 0">Data Export & Import</Heading>
        <View
          as="div"
          padding="medium"
          background="secondary"
          borderRadius="medium"
          borderWidth="small"
        >
          {importMessage && (
            <div style={{
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              borderRadius: "var(--radius-sm)",
              backgroundColor: importMessage.type === "success" ? "var(--success-bg, #d4edda)" : "var(--error-bg, #f8d7da)",
              color: importMessage.type === "success" ? "var(--success-text, #155724)" : "var(--error-text, #721c24)",
            }}>
              {importMessage.text}
            </div>
          )}

          <div style={{ marginBottom: "1.5rem" }}>
            <Text weight="bold">Export Data</Text>
            <Text as="p" size="small" color="secondary" style={{ margin: "0.25rem 0 0.75rem 0" }}>
              Select data to include in the export file.
            </Text>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
              <Checkbox
                label="Account Credentials (API Keys)"
                checked={exportOptions.includeAccounts}
                onChange={() => setExportOptions(prev => ({ ...prev, includeAccounts: !prev.includeAccounts }))}
              />
              <Checkbox
                label="Course Settings (nicknames, order, visibility, credits)"
                checked={exportOptions.includeCourseSettings}
                onChange={() => setExportOptions(prev => ({ ...prev, includeCourseSettings: !prev.includeCourseSettings }))}
              />
              <Checkbox
                label="GPA Terms & Saved Grades"
                checked={exportOptions.includeGradeData}
                onChange={() => setExportOptions(prev => ({ ...prev, includeGradeData: !prev.includeGradeData }))}
              />
              <Checkbox
                label="GPA Profiles"
                checked={exportOptions.includeGpaProfiles}
                onChange={() => setExportOptions(prev => ({ ...prev, includeGpaProfiles: !prev.includeGpaProfiles }))}
              />
            </div>

            {exportOptions.includeAccounts && (
              <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--warning-bg, #fff3cd)", borderRadius: "var(--radius-sm)" }}>
                <Checkbox
                  label="Encrypt credentials with password"
                  checked={exportOptions.encryptCredentials}
                  onChange={() => setExportOptions(prev => ({ ...prev, encryptCredentials: !prev.encryptCredentials }))}
                />
                {exportOptions.encryptCredentials && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <TextInput
                      renderLabel="Encryption Password"
                      type="password"
                      value={exportOptions.password || ""}
                      onChange={(_, value) => setExportOptions(prev => ({ ...prev, password: value }))}
                      placeholder="Enter a strong password"
                    />
                    <Text size="x-small" color="secondary" style={{ marginTop: "0.25rem", display: "block" }}>
                      ⚠️ You will need this password to import credentials. There is no recovery option.
                    </Text>
                  </div>
                )}
              </div>
            )}

            <Button
              color="primary"
              onClick={handleExport}
              interaction={exporting ? "disabled" : "enabled"}
            >
              {exporting ? "Exporting..." : "Export Data"}
            </Button>
          </div>

          <div style={{ borderTop: "1px solid var(--border-color, #ddd)", paddingTop: "1rem" }}>
            <Text weight="bold">Import Data</Text>
            <Text as="p" size="small" color="secondary" style={{ margin: "0.25rem 0 0.75rem 0" }}>
              Import a previously exported MultiCanvas data file. Existing data will be merged.
            </Text>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".json"
              style={{ display: "none" }}
            />
            <Button
              color="secondary"
              onClick={handleImportClick}
              interaction={importing ? "disabled" : "enabled"}
            >
              {importing ? "Importing..." : "Import Data"}
            </Button>
          </div>
        </View>
      </View>

      {/* Password Dialog for encrypted imports */}
      {showPasswordDialog && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <View
            as="div"
            padding="large"
            background="primary"
            borderRadius="medium"
            shadow="above"
            width="400px"
          >
            <Heading level="h4" margin="0 0 medium 0">Enter Decryption Password</Heading>
            <Text as="p" size="small" color="secondary" style={{ marginBottom: "1rem" }}>
              This export file contains encrypted credentials. Enter the password used during export.
            </Text>
            <TextInput
              renderLabel="Password"
              type="password"
              value={importPassword}
              onChange={(_, value) => setImportPassword(value)}
              placeholder="Decryption password"
            />
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", justifyContent: "flex-end" }}>
              <Button color="secondary" onClick={handleCancelPasswordDialog}>
                Cancel
              </Button>
              <Button 
                color="primary" 
                onClick={handlePasswordSubmit}
                interaction={importing || !importPassword ? "disabled" : "enabled"}
              >
                {importing ? "Decrypting..." : "Import"}
              </Button>
            </div>
          </View>
        </div>
      )}

      {/* Developer Settings Section */}
      <View as="section" margin="large 0 0 0">
        <Heading level="h3" margin="0 0 medium 0">Developer Settings</Heading>
        <View
          as="div"
          padding="medium"
          background="secondary"
          borderRadius="medium"
          borderWidth="small"
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <Text weight="bold">Developer Mode</Text>
              <Text as="p" size="small" color="secondary" style={{ margin: "0.25rem 0 0 0" }}>
                When enabled, shows a floating button to view all Canvas API requests and responses.
              </Text>
            </div>
            <Checkbox
              label=""
              variant="toggle"
              checked={devMode}
              onChange={handleDevModeToggle}
            />
          </div>
        </View>
      </View>
    </div>
  );
}

function parseFallback(id: string) {
  const [accountDomain, rawCourseId] = id.split("::");
  const courseId = rawCourseId ? Number(rawCourseId) : undefined;
  return { accountDomain, courseId };
}
