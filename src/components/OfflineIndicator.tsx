"use client";
import { useOfflineSupport } from '@/hooks/useOfflineSupport';
import { Text } from '@instructure/ui-text';

export default function OfflineIndicator() {
  const { isOnline } = useOfflineSupport();

  if (isOnline) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'var(--warning-bg, #fff3cd)',
        color: 'var(--warning-text, #856404)',
        padding: '0.5rem 1rem',
        borderRadius: 'var(--radius-md, 8px)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        border: '1px solid var(--warning-border, #ffc107)',
      }}
    >
      <span style={{ fontSize: '1.2rem' }}>📡</span>
      <Text size="small" weight="bold">
        You&apos;re offline - viewing cached data
      </Text>
    </div>
  );
}
