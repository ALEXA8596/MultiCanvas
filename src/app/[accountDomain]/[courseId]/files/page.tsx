"use client";
import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { View } from '@instructure/ui-view';
import { Heading } from '@instructure/ui-heading';
import { Text } from '@instructure/ui-text';
import { Link } from '@instructure/ui-link';
import CourseNav from '../CourseNav';
import CourseHeader from '../CourseHeader';
import { Account, CanvasFile, fetchCourseFiles } from '../../../../components/canvasApi';

export default function CourseFilesPage() {
	const params = useParams();
	const accountDomain = params?.accountDomain as string;
	const courseIdStr = params?.courseId as string;
	const courseId = courseIdStr ? parseInt(courseIdStr, 10) : NaN;

	const [account, setAccount] = useState<Account | null>(null);
	const [files, setFiles] = useState<CanvasFile[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [typeFilter, setTypeFilter] = useState<string>('all');

	useEffect(() => {
		try {
			const saved = localStorage.getItem('accounts');
			if (saved) {
				const accounts: Account[] = JSON.parse(saved);
				const found = accounts.find(a => a.domain === accountDomain) || null;
				setAccount(found);
				if (!found) setError('Account not found');
			} else setError('No accounts saved');
		} catch { setError('Failed to parse accounts'); }
	}, [accountDomain]);

	useEffect(() => {
		if (!account || isNaN(courseId)) return;
		let cancelled = false;
		setLoading(true); setError(null);
		fetchCourseFiles(account, courseId, 100, 3)
			.then(f => { if (!cancelled) setFiles(f); })
			.catch(e => !cancelled && setError((e as Error).message))
			.finally(() => !cancelled && setLoading(false));
		return () => { cancelled = true; };
	}, [account, courseId]);

	if (!accountDomain || isNaN(courseId)) return <Text>Invalid URL</Text>;

	const filtered = useMemo(() => files.filter(f => {
		if (typeFilter !== 'all' && f.mime_class !== typeFilter) return false;
		const name = (f.display_name || f.filename || '').toLowerCase();
		if (query && !name.includes(query.toLowerCase())) return false;
		return true;
	}), [files, query, typeFilter]);

	const mimeClasses = useMemo(() => {
		const set = new Set<string>();
		files.forEach(f => { if (f.mime_class) set.add(f.mime_class); });
		return Array.from(set).sort();
	}, [files]);

	return (
		<View as="div" padding="medium" width="100%">
			<CourseHeader />
			<CourseNav accountDomain={accountDomain} courseId={courseId} />
			<Heading level="h3" margin="0 0 medium">Files</Heading>
			{loading && <Text>Loading files...</Text>}
			{!loading && error && <Text color="danger">{error}</Text>}
			{!loading && !error && files.length === 0 && <Text>No files found.</Text>}
			<div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
				<input
					placeholder="Search files"
					value={query}
						onChange={e => setQuery(e.target.value)}
						style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6 }}
				/>
				<select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6 }}>
					<option value="all">All types</option>
					{mimeClasses.map(mc => <option key={mc} value={mc}>{mc}</option>)}
				</select>
				<span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{filtered.length} / {files.length}</span>
			</div>
			<View as="ul" margin="0" padding="0" style={{ listStyle: 'none', display: 'grid', gap: '0.75rem' }}>
				{filtered.map(f => (
					<View as="li" key={f.id} padding="small" borderWidth="small" borderRadius="medium" background={f.locked ? 'secondary' : 'primary'}>
						<Text as="p" weight="bold" size="small">{f.display_name || f.filename || 'Untitled file'}</Text>
						<Text as="p" size="x-small" color="secondary">{f.mime_class || f.content_type || 'unknown'} • {f.size ? (Math.round(f.size/102.4)/10)+' KB' : '—'}{f.locked && ' • locked'}</Text>
						<Text as="p" size="x-small">
							<Link href={`/${accountDomain}/${courseId}/files/${f.id}`}>App</Link>{' | '}
							{f.html_url && account && <Link href={`https://${account.domain}${f.html_url}`}>Canvas</Link>}
							{f.url && <> | <Link href={f.url}>Download</Link></>}
						</Text>
					</View>
				))}
			</View>
		</View>
	);
}
