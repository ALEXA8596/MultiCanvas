"use client";
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { View } from '@instructure/ui-view';
import { Heading } from '@instructure/ui-heading';
import { Text } from '@instructure/ui-text';
import { Link } from '@instructure/ui-link';
import CourseNav from '../../CourseNav';
import CourseHeader from '../../CourseHeader';
import { Account, CanvasFile, fetchCourseFile } from '../../../../../components/canvasApi';

export default function FileDetailPage() {
	const params = useParams();
	const accountDomain = params?.accountDomain as string;
	const courseIdStr = params?.courseId as string;
	const fileIdStr = params?.fileId as string;
	const courseId = courseIdStr ? parseInt(courseIdStr, 10) : NaN;
	const fileId = fileIdStr ? parseInt(fileIdStr, 10) : NaN;

	const [account, setAccount] = useState<Account | null>(null);
	const [file, setFile] = useState<CanvasFile | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [textPreview, setTextPreview] = useState<string | null>(null);
	const [objectUrl, setObjectUrl] = useState<string | null>(null);

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
		if (!account || isNaN(fileId)) return;
		let cancelled = false;
		setLoading(true); setError(null);
		fetchCourseFile(account, fileId)
			.then(f => { if (!cancelled) setFile(f); })
			.catch(e => !cancelled && setError((e as Error).message))
			.finally(() => !cancelled && setLoading(false));
		return () => { cancelled = true; };
	}, [account, fileId]);

	const isTextLike = useCallback((f: CanvasFile | null) => {
		if (!f) return false;
		const ct = (f.content_type || '').toLowerCase();
		if (ct.startsWith('text/')) return true;
		const name = (f.display_name || f.filename || '').toLowerCase();
		return /(\.(txt|md|csv|json|js|ts|tsx|css|scss|html|xml|yml|yaml|log))$/.test(name);
	}, []);

	useEffect(() => {
		if (!file || !file.url) return;
		setPreviewError(null);
		setTextPreview(null);
		if (objectUrl) { URL.revokeObjectURL(objectUrl); setObjectUrl(null); }
		const ct = (file.content_type || '').toLowerCase();
		const nameLower = (file.display_name || file.filename || '').toLowerCase();
		const isPdf = ct === 'application/pdf' || ct.startsWith('application/pdf') || nameLower.endsWith('.pdf');
		const wantText = isTextLike(file);
		const wantBlob = ct.startsWith('image/') || isPdf;
		if (!wantText && !wantBlob) return;
		let cancelled = false;
		setPreviewLoading(true);
		(async () => {
			try {
				const res = await fetch(file.url!);
				if (!res.ok) throw new Error(`Preview fetch failed (${res.status})`);
				if (wantText) {
					const raw = await res.text();
					const limited = raw.length > 100_000 ? raw.slice(0, 100_000) + '\n\n… (truncated)' : raw;
					if (!cancelled) setTextPreview(limited);
				} else if (wantBlob) {
					const blob = await res.blob();
					const url = URL.createObjectURL(blob);
					if (!cancelled) setObjectUrl(url);
				}
			} catch (e: any) {
				if (!cancelled) setPreviewError(e.message);
			} finally {
				if (!cancelled) setPreviewLoading(false);
			}
		})();
		return () => { cancelled = true; };
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [file?.id, file?.url]);

	useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }, [objectUrl]);

	if (isNaN(courseId) || isNaN(fileId)) return <Text>Invalid URL</Text>;

	return (
		<View as="div" padding="medium" width="100%">
			<CourseHeader />
			<CourseNav accountDomain={accountDomain} courseId={courseId} />
			<Heading level="h3" margin="0 0 medium">File</Heading>
			{loading && <Text>Loading file...</Text>}
			{!loading && error && <Text color="danger">{error}</Text>}
			{!loading && !error && !file && <Text>File not found.</Text>}
			{!loading && !error && file && (
				<View>
					<Heading level="h4" margin="0 0 small">{file.display_name || file.filename || 'Untitled file'}</Heading>
					<Text size="small" color="secondary" as="p">ID: {file.id}</Text>
					<Text size="small" as="p">Size: {file.size ? (Math.round(file.size/102.4)/10)+' KB' : '—'}</Text>
					<Text size="small" as="p">Type: {file.content_type || file.mime_class || 'unknown'}</Text>
					{file.locked && <Text size="small" color="danger" as="p">Locked</Text>}
					{file.hidden_for_user && <Text size="small" color="danger" as="p">Hidden</Text>}
					{file.created_at && <Text size="small" as="p">Created: {new Date(file.created_at).toLocaleString()}</Text>}
					{file.updated_at && <Text size="small" as="p">Updated: {new Date(file.updated_at).toLocaleString()}</Text>}
					{file.unlock_at && <Text size="small" as="p">Unlocks: {new Date(file.unlock_at).toLocaleString()}</Text>}
					{file.lock_at && <Text size="small" as="p">Locks: {new Date(file.lock_at).toLocaleString()}</Text>}
					<View margin="medium 0 0">
						<Heading level="h5" margin="0 0 x-small">Links</Heading>
						{file.html_url && account && (
							<Text as="p" size="small"><Link href={`https://${account.domain}${file.html_url}`}>Open in Canvas</Link></Text>
						)}
						{file.url && <Text as="p" size="small"><Link href={file.url}>Download</Link></Text>}
						{file.preview_url && <Text as="p" size="small"><Link href={file.preview_url}>Preview (Canvas)</Link></Text>}
					</View>

					{(isTextLike(file) || (file.content_type||'').startsWith('image/') || /pdf$/i.test(file.content_type||'') || /(\.pdf)$/i.test(file.display_name || file.filename || '')) && (
						<View margin="large 0 0">
							<Heading level="h5" margin="0 0 small">Preview</Heading>
							{previewLoading && <Text size="small">Loading preview…</Text>}
							{previewError && <Text size="small" color="danger">{previewError}</Text>}
							{!previewLoading && !previewError && (
								<>
									{textPreview && (
										<pre style={{ maxHeight: '420px', overflow: 'auto', background: 'var(--surface-elevated)', padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.75rem', lineHeight: 1.4 }}>
											{textPreview}
										</pre>
									)}
									{!textPreview && (file.content_type||'').startsWith('image/') && (
										<div style={{ maxWidth: '640px' }}>
											<img src={objectUrl || file.url || file.preview_url || ''} alt={file.display_name || file.filename || 'image'} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
										</div>
									)}
									{!textPreview && (/(pdf)$/i.test(file.content_type||'') || /(\.pdf)$/i.test(file.display_name || file.filename || '')) && (
										<div style={{ width: '100%', maxWidth: '840px', height: '600px', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: '#fff', position: 'relative' }}>
											{/* Try iframe first */}
											<iframe
												key={objectUrl || file.url || file.preview_url || 'pdf'}
												src={objectUrl || file.url || file.preview_url || ''}
												title="PDF Preview"
												style={{ width: '100%', height: '100%', border: 'none' }}
											/>
											{/* Fallback message overlay if blocked by X-Frame-Options */}
											<div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '0.25rem' }}>
												<Text size="x-small" color="secondary">If the PDF fails to load, <Link href={file.url || file.preview_url || '#'}>open in new tab</Link></Text>
											</div>
										</div>
									)}
									{!textPreview && !((file.content_type||'').startsWith('image/')) && !(/pdf$/i.test(file.content_type||'') || /(\.pdf)$/i.test(file.display_name || file.filename || '')) && (
										<Text size="small" color="secondary">No inline preview available.</Text>
									)}
								</>
							)}
						</View>
					)}
				</View>
			)}
		</View>
	);
}
