"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Flex } from "@instructure/ui-flex";
import { Link } from "@instructure/ui-link";
import CourseNav from "../CourseNav";
import CourseHeader from "../CourseHeader";
import { Account, DiscussionTopic, fetchDiscussionTopics } from "../../../../components/canvasApi";

export default function DiscussionsPage() {
  const params = useParams();
  const accountDomain = params?.accountDomain as string;
  const courseIdStr = params?.courseId as string;
  const courseId = courseIdStr ? parseInt(courseIdStr, 10) : NaN;

  const [account, setAccount] = useState<Account | null>(null);
  const [topics, setTopics] = useState<DiscussionTopic[]>([]);
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
    if (!account || isNaN(courseId)) return;
    let cancelled = false; setLoading(true); setError(null);
    fetchDiscussionTopics(account, courseId)
      .then(data => { if (!cancelled) setTopics(Array.isArray(data) ? data : []); })
      .catch(e => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [account, courseId]);

  if (!accountDomain || isNaN(courseId)) return <Text>Invalid URL</Text>;

  return (
    <View as="div" padding="medium" width="100%">
      <CourseHeader />
      <CourseNav accountDomain={accountDomain} courseId={courseId} />
      <Heading level="h3" margin="0 0 medium">Discussions</Heading>
      {loading && <Text>Loading discussions...</Text>}
      {!loading && error && <Text color="danger">{error}</Text>}
      {!loading && !error && topics.length === 0 && <Text>No discussions found.</Text>}
      <Flex direction="column" gap="small">
        {topics.map(t => (
          <View key={t.id} padding="small" background="primary" borderWidth="small" borderRadius="medium" shadow="resting">
            <Heading level="h5" margin="0 0 x-small">{t.title || `Topic #${t.id}`}</Heading>
            <Text size="x-small" color="secondary" as="p">{t.posted_at ? new Date(t.posted_at).toLocaleString() : ''}{t.replies_count != null && ` • ${t.replies_count} replies`}</Text>
            <Text as="p" size="x-small"><Link href={`/${accountDomain}/${courseId}/discussions/${t.id}`}>Open</Link>{t.html_url && account && (<> | <Link href={`https://${account.domain}${t.html_url}`}>Canvas</Link></>)}</Text>
          </View>
        ))}
      </Flex>
    </View>
  );
}
