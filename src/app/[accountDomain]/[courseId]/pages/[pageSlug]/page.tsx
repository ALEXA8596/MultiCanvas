"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Link } from "@instructure/ui-link";
import CourseNav from "../../CourseNav";
import CourseHeader from "../../CourseHeader";
import { Account, WikiPage, fetchCoursePage } from "../../../../../components/canvasApi";

export default function CoursePageDetail() {
  const params = useParams();
  const accountDomain = params?.accountDomain as string;
  const courseIdStr = params?.courseId as string;
  const courseId = courseIdStr ? parseInt(courseIdStr, 10) : NaN;
  const pageSlug = params?.pageSlug as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [page, setPage] = useState<WikiPage | null>(null);
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
    if (!account || isNaN(courseId) || !pageSlug) return;
    let cancelled = false; setLoading(true); setError(null);
    fetchCoursePage(account, courseId, pageSlug)
      .then(data => { if (!cancelled) setPage(data); })
      .catch(e => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [account, courseId, pageSlug]);

  if (!accountDomain || isNaN(courseId) || !pageSlug) return <Text>Invalid URL</Text>;

  return (
    <View as="div" padding="medium" width="100%">
      <CourseHeader />
      <CourseNav accountDomain={accountDomain} courseId={courseId} />
      {loading && <Text>Loading page...</Text>}
      {!loading && error && <Text color="danger">{error}</Text>}
      {!loading && !error && !page && <Text>Page not found.</Text>}
      {!loading && !error && page && (
        <View>
          <Heading level="h3" margin="0 0 small">{page.title}{page.front_page ? " (Front Page)" : ""}</Heading>
          {page.html_url && account && (
            <Text as="p" size="small"><Link href={`https://${account.domain}${page.html_url}`}>Open in Canvas</Link></Text>
          )}
          {page.body && (
            <View as="div" margin="small 0 0" style={{ maxWidth: "800px" }}
              dangerouslySetInnerHTML={{ __html: page.body }} />
          )}
        </View>
      )}
    </View>
  );
}
