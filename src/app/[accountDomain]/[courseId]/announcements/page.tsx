"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Link } from "@instructure/ui-link";
import { Flex } from "@instructure/ui-flex";
import { Account, DiscussionTopic, fetchCourseAnnouncements } from "../../../../components/canvasApi";
import CourseNav from "../CourseNav";
import CourseHeader from "../CourseHeader";

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
      <CourseHeader />
      <CourseNav accountDomain={accountDomain} courseId={courseId} />
      <Heading level="h3" margin="0 0 medium">Announcements</Heading>
      {loading && <Text>Loading announcements...</Text>}
      {!loading && error && <Text color="danger">{error}</Text>}
      {!loading && !error && announcements.length === 0 && <Text>No announcements found.</Text>}
      <Flex direction="column" gap="small">
        {announcements.map((a) => (
          <View
            key={a.id}
            padding="small"
            background="primary"
            borderWidth="small"
            borderRadius="medium"
            shadow="resting"
          >
            <Heading level="h5" margin="0 0 x-small">{a.title || `Announcement #${a.id}`}</Heading>
            <Text size="x-small" color="secondary" as="p">
              {a.posted_at ? new Date(a.posted_at).toLocaleString() : ""}
            </Text>
            {a.message && (
              <Text
                as="div"
                size="small"
                dangerouslySetInnerHTML={{ __html: a.message }}
              />
            )}
            {a.html_url && account && (
              <View margin="small 0 0">
                <Text as="p" size="small">
                  <Link href={`https://${account.domain}${a.html_url}`}>Open in Canvas</Link>
                </Text>
              </View>
            )}
          </View>
        ))}
      </Flex>
    </View>
  );
}
