"use client";
import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCode, faTimes, faChevronDown, faChevronRight, faTrash } from "@fortawesome/free-solid-svg-icons";
import { getApiLogs, clearApiLogs, subscribeToApiLogs, ApiLogEntry } from "./canvasApi";

export function DevTools() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [devMode, setDevMode] = useState(false);

  // Check if dev mode is enabled
  useEffect(() => {
    const checkDevMode = () => {
      const enabled = localStorage.getItem("devMode") === "true";
      setDevMode(enabled);
    };
    
    checkDevMode();
    
    // Listen for storage changes (in case settings page toggles it)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "devMode") {
        checkDevMode();
      }
    };
    
    window.addEventListener("storage", handleStorage);
    
    // Also poll for changes within the same tab
    const interval = setInterval(checkDevMode, 1000);
    
    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, []);

  // Subscribe to API logs
  useEffect(() => {
    if (!devMode) return;
    
    // Get initial logs
    setLogs(getApiLogs());
    
    // Subscribe to updates
    const unsubscribe = subscribeToApiLogs((newLogs) => {
      setLogs([...newLogs]);
    });
    
    return unsubscribe;
  }, [devMode]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClear = () => {
    clearApiLogs();
    setLogs([]);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "#22c55e";
    if (status >= 400 && status < 500) return "#f59e0b";
    if (status >= 500) return "#ef4444";
    return "var(--text-muted)";
  };

  if (!devMode) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          width: "50px",
          height: "50px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          border: "none",
          color: "white",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(99, 102, 241, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.1)";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(99, 102, 241, 0.5)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.4)";
        }}
        title="Open Developer Tools"
      >
        <FontAwesomeIcon icon={faCode} style={{ fontSize: "20px" }} />
        {logs.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-5px",
              right: "-5px",
              background: "#ef4444",
              color: "white",
              borderRadius: "50%",
              width: "22px",
              height: "22px",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
            }}
          >
            {logs.length > 99 ? "99+" : logs.length}
          </span>
        )}
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 10001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setIsOpen(false)}
        >
          {/* Modal Content */}
          <div
            style={{
              background: "var(--surface-elevated)",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "900px",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "1rem 1.5rem",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <FontAwesomeIcon
                  icon={faCode}
                  style={{ color: "#8b5cf6", fontSize: "1.25rem" }}
                />
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
                  API Request Log
                </h2>
                <span
                  style={{
                    background: "var(--secondary)",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                  }}
                >
                  {logs.length} requests
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={handleClear}
                  style={{
                    background: "var(--secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "0.5rem 1rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    color: "var(--foreground)",
                    fontSize: "0.875rem",
                  }}
                >
                  <FontAwesomeIcon icon={faTrash} />
                  Clear
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "0.5rem",
                    color: "var(--text-muted)",
                    fontSize: "1.25rem",
                  }}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "1rem",
              }}
            >
              {logs.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "3rem",
                    color: "var(--text-muted)",
                  }}
                >
                  <FontAwesomeIcon
                    icon={faCode}
                    style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.3 }}
                  />
                  <p>No API requests logged yet.</p>
                  <p style={{ fontSize: "0.875rem" }}>
                    Requests will appear here as you navigate the app.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {logs.map((log) => {
                    const isExpanded = expandedIds.has(log.id);
                    return (
                      <div
                        key={log.id}
                        style={{
                          background: "var(--secondary)",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          overflow: "hidden",
                        }}
                      >
                        {/* Accordion Header */}
                        <button
                          onClick={() => toggleExpanded(log.id)}
                          style={{
                            width: "100%",
                            padding: "0.75rem 1rem",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                            textAlign: "left",
                            color: "var(--foreground)",
                          }}
                        >
                          <FontAwesomeIcon
                            icon={isExpanded ? faChevronDown : faChevronRight}
                            style={{ color: "var(--text-muted)", width: "12px" }}
                          />
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: "0.75rem",
                              padding: "0.125rem 0.5rem",
                              borderRadius: "4px",
                              background:
                                log.method === "GET"
                                  ? "#3b82f620"
                                  : log.method === "POST"
                                  ? "#22c55e20"
                                  : log.method === "PUT"
                                  ? "#f59e0b20"
                                  : "#ef444420",
                              color:
                                log.method === "GET"
                                  ? "#3b82f6"
                                  : log.method === "POST"
                                  ? "#22c55e"
                                  : log.method === "PUT"
                                  ? "#f59e0b"
                                  : "#ef4444",
                            }}
                          >
                            {log.method}
                          </span>
                          <span
                            style={{
                              flex: 1,
                              fontFamily: "var(--font-geist-mono), monospace",
                              fontSize: "0.875rem",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {log.path}
                          </span>
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: "0.75rem",
                              color: getStatusColor(log.status),
                            }}
                          >
                            {log.status}
                          </span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {formatDuration(log.duration)}
                          </span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </button>

                        {/* Accordion Content */}
                        {isExpanded && (
                          <div
                            style={{
                              padding: "1rem",
                              borderTop: "1px solid var(--border)",
                              background: "var(--background)",
                            }}
                          >
                            <div style={{ marginBottom: "1rem" }}>
                              <h4
                                style={{
                                  margin: "0 0 0.5rem",
                                  fontSize: "0.75rem",
                                  textTransform: "uppercase",
                                  color: "var(--text-muted)",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                Request URL
                              </h4>
                              <code
                                style={{
                                  display: "block",
                                  padding: "0.75rem",
                                  background: "var(--secondary)",
                                  borderRadius: "6px",
                                  fontSize: "0.8rem",
                                  wordBreak: "break-all",
                                  fontFamily: "var(--font-geist-mono), monospace",
                                }}
                              >
                                {log.url}
                              </code>
                            </div>

                            <div style={{ marginBottom: "1rem" }}>
                              <h4
                                style={{
                                  margin: "0 0 0.5rem",
                                  fontSize: "0.75rem",
                                  textTransform: "uppercase",
                                  color: "var(--text-muted)",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                Canvas Domain
                              </h4>
                              <code
                                style={{
                                  display: "block",
                                  padding: "0.75rem",
                                  background: "var(--secondary)",
                                  borderRadius: "6px",
                                  fontSize: "0.8rem",
                                  fontFamily: "var(--font-geist-mono), monospace",
                                }}
                              >
                                {log.domain}
                              </code>
                            </div>

                            {log.requestBody && (
                              <div style={{ marginBottom: "1rem" }}>
                                <h4
                                  style={{
                                    margin: "0 0 0.5rem",
                                    fontSize: "0.75rem",
                                    textTransform: "uppercase",
                                    color: "var(--text-muted)",
                                    letterSpacing: "0.05em",
                                  }}
                                >
                                  Request Body
                                </h4>
                                <pre
                                  style={{
                                    margin: 0,
                                    padding: "0.75rem",
                                    background: "var(--secondary)",
                                    borderRadius: "6px",
                                    fontSize: "0.75rem",
                                    overflow: "auto",
                                    maxHeight: "200px",
                                    fontFamily: "var(--font-geist-mono), monospace",
                                  }}
                                >
                                  {typeof log.requestBody === "string"
                                    ? log.requestBody
                                    : JSON.stringify(log.requestBody, null, 2)}
                                </pre>
                              </div>
                            )}

                            <div>
                              <h4
                                style={{
                                  margin: "0 0 0.5rem",
                                  fontSize: "0.75rem",
                                  textTransform: "uppercase",
                                  color: "var(--text-muted)",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                Response
                              </h4>
                              <pre
                                style={{
                                  margin: 0,
                                  padding: "0.75rem",
                                  background: "var(--secondary)",
                                  borderRadius: "6px",
                                  fontSize: "0.75rem",
                                  overflow: "auto",
                                  maxHeight: "300px",
                                  fontFamily: "var(--font-geist-mono), monospace",
                                }}
                              >
                                {log.responseBody
                                  ? typeof log.responseBody === "string"
                                    ? log.responseBody
                                    : JSON.stringify(log.responseBody, null, 2)
                                  : "(No response body)"}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
