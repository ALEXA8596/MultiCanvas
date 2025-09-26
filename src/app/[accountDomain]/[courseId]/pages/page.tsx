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
import { Account, WikiPage, fetchCoursePages } from "../../../../components/canvasApi";

export default function CoursePagesPage() {
	const params = useParams();
	const accountDomain = params?.accountDomain as string;
	const courseIdStr = params?.courseId as string;
	const courseId = courseIdStr ? parseInt(courseIdStr, 10) : NaN;
	const [account, setAccount] = useState<Account | null>(null);
	const [pages, setPages] = useState<WikiPage[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Load account from localStorage
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

	// Fetch pages
	useEffect(() => {
	if (!account || isNaN(courseId)) return;
	let cancelled = false; setLoading(true); setError(null);
	fetchCoursePages(account, courseId)
	.then(data => { if (!cancelled) setPages(Array.isArray(data) ? data : []); })
	.catch(e => !cancelled && setError((e as Error).message))
	.finally(() => !cancelled && setLoading(false));
		return () => { cancelled = true; };
	}, [account, courseId]);

	if (!accountDomain || isNaN(courseId)) return <Text>Invalid URL</Text>;
	return (
			<View as="div" padding="medium" width="100%">
				<CourseHeader />
				<CourseNav accountDomain={accountDomain} courseId={courseId} />
	<Heading level="h3" margin="0 0 medium">Pages</Heading>
	{loading && <Text>Loading pages...</Text>}
	{!loading && error && <Text color="danger">{error}</Text>}
			{!loading && !error && pages.length === 0 && <Text>No pages found.</Text>}
			<Flex direction="column" gap="small">
						{pages.map(p => {
							const internal = `/${accountDomain}/${courseId}/pages/${p.url}`;
							return (
								<View key={p.page_id} padding="x-small small" background="secondary" borderRadius="medium" borderWidth="small">
									<Flex direction="column">
										<Text as="p" weight="bold" size="small"><Link href={internal}>{p.title}</Link>{p.front_page ? " (Front Page)" : ""}</Text>
										<Text as="p" size="x-small" color="secondary">Slug: {p.url}{p.published === false ? " (unpublished)" : ""}</Text>
										<Text as="p" size="x-small">
											<Link href={internal}>App</Link>
											{p.html_url && account && <> | <Link href={`https://${account.domain}${p.html_url}`}>Canvas</Link></>}
										</Text>
									</Flex>
								</View>
							);
						})}
			</Flex>
		</View>
	);
}
