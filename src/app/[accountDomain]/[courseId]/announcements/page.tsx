"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Account, DiscussionTopic, fetchCourseAnnouncements } from "../../../../components/canvasApi";
import "../../../stylesheets/announcements.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";

export default function AnnouncementsPage() {
  const params = useParams();
  const accountDomain = params?.accountDomain as string;
  const courseIdStr = params?.courseId as string;
  const courseId = courseIdStr ? parseInt(courseIdStr, 10) : NaN;

  const [account, setAccount] = useState<Account | null>(null);
  const [announcements, setAnnouncements] = useState<DiscussionTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // load account
  useEffect(() => {
    try {
      const saved = localStorage.getItem("accounts");
      if (saved) {
        const accounts: Account[] = JSON.parse(saved);
        const found = accounts.find((a) => a.domain === accountDomain) || null;
        setAccount(found);
        if (!found) setError("Account not found");
      } else {
        setError("No accounts saved");
      }
    } catch {
      setError("Failed to parse accounts");
    }
  }, [accountDomain]);

  useEffect(() => {
    if (!account || isNaN(courseId)) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCourseAnnouncements(account, courseId)
      .then((data) => {
        if (cancelled) return;
        setAnnouncements(Array.isArray(data) ? data : []);
      })
      .catch((e: any) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [account, courseId]);

  if (!accountDomain || isNaN(courseId)) {
    return <Text>Invalid URL</Text>;
  }

  return (
    <View as="div" padding="medium" width="100%">
      <Heading level="h3" margin="0 0 medium">Announcements</Heading>
      {loading && <Text>Loading announcements...</Text>}
      {!loading && error && <Text color="danger">{error}</Text>}
      {!loading && !error && announcements.length === 0 && <Text>No announcements found.</Text>}
      
      <div className="announcements-list">
        {announcements.map((a) => (
          <div key={a.id} className="ic-announcement-row">
            <div className="ic-item-row__author-col">
              <div className="ic-avatar" title={a.author?.display_name || "User"}>
                 <FontAwesomeIcon icon={faUser} />
              </div>
            </div>
            <div className="ic-item-row__content-col">
              <a href={a.html_url || "#"} className="ic-item-row__content-link" target="_blank" rel="noreferrer">
                <h3>{a.title || `Announcement #${a.id}`}</h3>
                <div 
                  className="ic-announcement-row__content"
                  dangerouslySetInnerHTML={{ __html: a.message || "" }}
                />
              </a>
            </div>
            <div className="ic-item-row__meta-col">
              <div className="ic-item-row__meta-content">
                <span className="ic-item-row__meta-content-heading">Posted on:</span>
                <span className="ic-item-row__meta-content-timestamp">
                  {a.posted_at ? new Date(a.posted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ""}
                  {a.posted_at ? " at " + new Date(a.posted_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ""}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </View>
  );
}
