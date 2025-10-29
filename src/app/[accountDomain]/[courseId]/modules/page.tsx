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
import { Account, CourseModule, ModuleItem, fetchCourseModules } from "../../../../components/canvasApi";

export default function ModulesPage() {
  const params = useParams();
  const accountDomain = params?.accountDomain as string;
  const courseIdStr = params?.courseId as string;
  const courseId = courseIdStr ? parseInt(courseIdStr, 10) : NaN;

  const [account, setAccount] = useState<Account | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
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
    fetchCourseModules(account, courseId)
      .then(data => { if (!cancelled) setModules(Array.isArray(data) ? data : []); })
      .catch(e => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [account, courseId]);

  if (!accountDomain || isNaN(courseId)) return <Text>Invalid URL</Text>;

  const internalLinkForItem = (item: ModuleItem): string | null => {
    const type = item.type?.toLowerCase();
    if (!item.content_id) return null;
  // Use relative navigation for assignments & files (one level up from /modules)
  if (type === 'assignment') return `./assignments/${item.content_id}`;
    if (type === 'discussion') return `./discussions/${item.content_id}`;
    if (type === 'page' && item.html_url) {
      // html_url like /courses/:course_id/pages/:slug
      const slugMatch = item.html_url.match(/\/pages\/(.+)$/);
      if (slugMatch) return `./pages/${slugMatch[1]}`;
    }
  if (type === 'file') return `./files/${item.content_id}`;
    // Additional mappings (files, quizzes, etc.) could be added later
    return null;
  };

  return (
    <View as="div" padding="medium" width="100%">
      <CourseHeader />
      <CourseNav accountDomain={accountDomain} courseId={courseId} />
      <Heading level="h3" margin="0 0 medium">Modules</Heading>
      {loading && <Text>Loading modules...</Text>}
      {!loading && error && <Text color="danger">{error}</Text>}
      {!loading && !error && modules.length === 0 && <Text>No modules found.</Text>}
      <Flex direction="column" gap="large">
        {modules.map(m => (
          <View key={m.id}>
            <Heading level="h4" margin="0 0 small">{m.name}</Heading>
            <View as="ul" margin="0" padding="0">
              {m.items?.map(it => {
                const internal = internalLinkForItem(it);
                return (
                  <View as="li" key={it.id} margin="0 0 x-small" padding="x-small small" background="primary" borderWidth="small" borderRadius="medium">
                    <Text as="p" size="small" weight="bold">{it.title}</Text>
                    <Text as="p" size="x-small" color="secondary">{it.type}{it.published === false ? ' (unpublished)' : ''}</Text>
                    <Text as="p" size="x-small">
                      {internal && <><Link href={internal}>App</Link> | </>}
                      {it.html_url && account && <Link href={`${it.html_url}`}>Canvas</Link>}
                      {!internal && !it.html_url && 'No link'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </Flex>
    </View>
  );
}
