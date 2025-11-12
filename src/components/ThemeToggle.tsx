"use client";
import React from 'react';
import { useTheme } from './ThemeProvider';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon } from '@fortawesome/free-solid-svg-icons';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { key: 'light' as const, icon: faSun, label: 'Light' },
    { key: 'dark' as const, icon: faMoon, label: 'Dark' },
  ];

  const currentTheme = themes.find(t => t.key === theme) || themes[0];

  const cycleTheme = () => {
    const currentIndex = themes.findIndex(t => t.key === theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex].key);
  };

  return (
    <button
      onClick={cycleTheme}
      className="theme-toggle"
      title={`Current: ${currentTheme.label} - Click to toggle`}
      style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '0.75rem',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '44px',
        minHeight: '44px',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--gradient-secondary)';
        e.currentTarget.style.borderColor = 'var(--primary)';
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--surface-elevated)';
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <FontAwesomeIcon
        icon={currentTheme.icon}
        style={{
          color: 'var(--primary)',
          fontSize: '1.25rem',
          transition: 'all var(--transition-fast)',
        }}
      />
      
      {/* Theme indicator dots */}
      <div
        style={{
          position: 'absolute',
          bottom: '4px',
          right: '4px',
          display: 'flex',
          gap: '2px',
        }}
      >
        {themes.map((t) => (
          <div
            key={t.key}
            style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: theme === t.key ? 'var(--primary)' : 'var(--border)',
              transition: 'all var(--transition-fast)',
            }}
          />
        ))}
      </div>
    </button>
  );
}
