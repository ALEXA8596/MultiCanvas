"use client";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Link } from "@instructure/ui-link";

function InProgressContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  
  const tabId = searchParams?.get("tab") || "unknown";
  const tabLabel = searchParams?.get("label") || "This Feature";
  const canvasUrl = searchParams?.get("canvasUrl") || "";

  return (
    <div className="fade-in" style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center", padding: "2rem 0" }}>
      {/* Construction Icon */}
      <div style={{ 
        fontSize: "4rem", 
        marginBottom: "1.5rem",
        animation: "bounce 1s ease infinite"
      }}>
        🚧
      </div>
      
      <Heading level="h1" margin="0 0 medium 0">
        {tabLabel}
      </Heading>
      
      <div className="modern-card" style={{ 
        padding: "2rem", 
        marginBottom: "1.5rem",
        background: "var(--secondary)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)"
      }}>
        <Text as="p" size="large" style={{ marginBottom: "1rem" }}>
          This feature is currently in development.
        </Text>
        <Text as="p" color="secondary" style={{ marginBottom: "1.5rem" }}>
          We&apos;re working on bringing <strong>{tabLabel}</strong> directly into MultiCanvas. 
          In the meantime, you can access this feature on Canvas.
        </Text>
        
        {canvasUrl && (
          <Link
            href={canvasUrl}
            target="_blank"
            rel="noopener noreferrer"
            isWithinText={false}
          >
            <button
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "white",
                border: "none",
                padding: "0.75rem 1.5rem",
                borderRadius: "var(--radius-md)",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              Open in Canvas
              <span style={{ fontSize: "1.1rem" }}>↗</span>
            </button>
          </Link>
        )}
      </div>

      {/* Additional Info */}
      <div style={{ 
        padding: "1rem",
        background: "var(--background)",
        borderRadius: "var(--radius-sm)",
        border: "1px dashed var(--border)"
      }}>
        <Text size="small" color="secondary">
          Tab ID: <code style={{ 
            background: "var(--secondary)", 
            padding: "0.125rem 0.375rem",
            borderRadius: "4px",
            fontFamily: "var(--font-geist-mono), monospace"
          }}>{tabId}</code>
        </Text>
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}

export default function InProgressPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <Text>Loading...</Text>
      </div>
    }>
      <InProgressContent />
    </Suspense>
  );
}
