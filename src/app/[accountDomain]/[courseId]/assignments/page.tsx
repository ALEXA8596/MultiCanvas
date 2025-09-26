"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Flex } from "@instructure/ui-flex";
import { Link } from "@instructure/ui-link";
import { Account, AssignmentGroup, fetchAssignmentGroups } from "../../../../components/canvasApi";
import CourseNav from "../CourseNav";
import CourseHeader from "../CourseHeader";
import { Button } from "@instructure/ui-buttons";

export default function AssignmentsListPage() {
  const params = useParams();
  const router = useRouter();
  const accountDomain = params?.accountDomain as string;
  const courseIdStr = params?.courseId as string;
  const courseId = courseIdStr ? parseInt(courseIdStr, 10) : NaN;

  const [account, setAccount] = useState<Account | null>(null);
  const [groups, setGroups] = useState<AssignmentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"group" | "due">("group");

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
    fetchAssignmentGroups(account, courseId)
      .then((data) => { if (!cancelled) setGroups(Array.isArray(data) ? data : []); })
      .catch((e: any) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [account, courseId]);

  const allAssignments = useMemo(() => {
    return groups.flatMap(g => (g.assignments || []).map(a => ({ ...a, group: g })));
  }, [groups]);

  const assignmentsByDue = useMemo(() => {
    return [...allAssignments].sort((a, b) => {
      const da = a.due_at ? new Date(a.due_at).getTime() : Infinity;
      const db = b.due_at ? new Date(b.due_at).getTime() : Infinity;
      if (da === db) return (a.name || "").localeCompare(b.name || "");
      return da - db;
    });
  }, [allAssignments]);

  if (!accountDomain || isNaN(courseId)) return <Text>Invalid URL</Text>;

  return (
    <View as="div" padding="medium" width="100%">
      <CourseHeader />
      <CourseNav accountDomain={accountDomain} courseId={courseId} />
      <Flex justifyItems="space-between" alignItems="center" margin="0 0 small">
        <Heading level="h3" margin="0">Assignments</Heading>
        <Flex gap="small">
            <Button onClick={() => setSortMode(m => m === "group" ? "due" : "group")}>
              Sort: {sortMode === "group" ? "By Due Date" : "By Group"}
            </Button>
        </Flex>
      </Flex>
      {loading && <Text>Loading assignment groups...</Text>}
      {!loading && error && <Text color="danger">{error}</Text>}
      {!loading && !error && groups.length === 0 && <Text>No assignments found.</Text>}

      {sortMode === "group" && (
        <Flex direction="column" gap="large">
          {groups.map((g) => (
            <View key={g.id}>
              <Heading level="h4" margin="0 0 small">{g.name}</Heading>
              {(!g.assignments || g.assignments.length === 0) && (
                <Text size="small" color="secondary">No assignments in this group.</Text>
              )}
              <View as="ul" margin="0" padding="0">
                {g.assignments?.map((a) => (
                  <View as="li" key={a.id} margin="0 0 x-small" padding="x-small small" background="primary" borderWidth="small" borderRadius="medium">
                    <Text as="p" size="small" weight="bold">{a.name}</Text>
                    <Text as="p" size="x-small" color="secondary">{a.due_at ? new Date(a.due_at).toLocaleString() : "No due date"}</Text>
                    <Text as="p" size="x-small">Points: {a.points_possible ?? '—'}</Text>
                    <Text as="p" size="x-small">
                      <Link href={`/${accountDomain}/${courseId}/assignments/${a.id}`}>Open</Link>
                      {a.html_url && account && (
                        <> | <Link href={`https://${account.domain}${a.html_url}`}>Canvas</Link></>
                      )}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Flex>
      )}

      {sortMode === "due" && (
        <View as="ul" margin="medium 0 0" padding="0">
          {assignmentsByDue.map(a => (
            <View as="li" key={a.id} margin="0 0 x-small" padding="x-small small" background="primary" borderWidth="small" borderRadius="medium">
              <Text as="p" size="small" weight="bold">{a.name}</Text>
              <Text as="p" size="x-small" color="secondary">{a.group?.name || 'Ungrouped'} • {a.due_at ? new Date(a.due_at).toLocaleString() : 'No due date'}</Text>
              <Text as="p" size="x-small">Points: {a.points_possible ?? '—'}</Text>
              <Text as="p" size="x-small">
                <Link href={`/${accountDomain}/${courseId}/assignments/${a.id}`}>Open</Link>
                {a.html_url && account && (<> | <Link href={`https://${account.domain}${a.html_url}`}>Canvas</Link></>)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
