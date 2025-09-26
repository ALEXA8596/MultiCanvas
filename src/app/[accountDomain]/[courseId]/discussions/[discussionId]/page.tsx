"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Link } from "@instructure/ui-link";
import CourseNav from "../../CourseNav";
import CourseHeader from "../../CourseHeader";
import { Account, DiscussionTopic, fetchDiscussionTopic } from "../../../../../components/canvasApi";

export default function DiscussionDetailPage() {
  const params = useParams();
  const accountDomain = params?.accountDomain as string;
  const courseIdStr = params?.courseId as string;
  const discussionIdStr = params?.discussionId as string;
  const courseId = courseIdStr ? parseInt(courseIdStr, 10) : NaN;
  const discussionId = discussionIdStr ? parseInt(discussionIdStr, 10) : NaN;

  const [account, setAccount] = useState<Account | null>(null);
  const [topic, setTopic] = useState<DiscussionTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("accounts");
      if (saved) {
        const accounts: Account[] = JSON.parse(saved);
        const found = accounts.find(a => a.domain === accountDomain) || null;
        setAccount(found);
        if (!found) setError("Account not found");
      } else { setError("No accounts saved"); }
    } catch { setError("Failed to parse accounts"); }
  }, [accountDomain]);

  useEffect(() => {
    if (!account || isNaN(courseId) || isNaN(discussionId)) return;
    let cancelled = false; setLoading(true); setError(null);
    fetchDiscussionTopic(account, courseId, discussionId)
      .then(data => { if (!cancelled) setTopic(data); })
      .catch(e => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [account, courseId, discussionId]);

  if (isNaN(courseId) || isNaN(discussionId)) return <Text>Invalid URL</Text>;

  return (
    <View as="div" padding="medium" width="100%">
      <CourseHeader />
      <CourseNav accountDomain={accountDomain} courseId={courseId} />
      <Heading level="h3" margin="0 0 medium">Discussion</Heading>
      {loading && <Text>Loading discussion...</Text>}
      {!loading && error && <Text color="danger">{error}</Text>}
      {!loading && !error && topic && (
        <View>
          <Heading level="h4" margin="0 0 small">{topic.title}</Heading>
          <Text size="x-small" color="secondary" as="p">{topic.posted_at ? new Date(topic.posted_at).toLocaleString() : ''}{topic.replies_count != null && ` • ${topic.replies_count} replies`}</Text>
          {topic.message && (
            <View margin="medium 0 0">
              <Heading level="h5" margin="0 0 x-small">Body</Heading>
              <Text as="div" size="small" dangerouslySetInnerHTML={{ __html: topic.message }} />
            </View>
          )}
          {topic.html_url && account && (
            <View margin="medium 0 0">
              <Text as="p" size="small"><Link href={`https://${account.domain}${topic.html_url}`}>Open in Canvas</Link></Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
