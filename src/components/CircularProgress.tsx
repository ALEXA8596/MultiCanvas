"use client";
import React from 'react';

interface CircularProgressProps {
  size?: number;          // outer square size
  stroke?: number;        // stroke width
  value: number;          // percent 0-100
  trackColor?: string;
  progressColor?: string; // fallback if no gradient
  ariaLabel?: string;
  showText?: boolean;
  className?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  size = 48,
  stroke = 6,
  value,
  trackColor = '#e3e7e5',
  progressColor = 'url(#todoGradient)',
  ariaLabel = 'progress',
  showText = false,
  className
}) => {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size/2) - stroke/2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct/100) * circ;
  return (
    <svg
      width={size}
      height={size}
      role="img"
      aria-label={`${ariaLabel} ${pct}%`}
      className={className || ''}
      style={{ display:'block' }}
    >
      <circle
        cx={size/2}
        cy={size/2}
        r={r}
        strokeWidth={stroke}
        fill="none"
        stroke={trackColor}
      />
      <circle
        cx={size/2}
        cy={size/2}
        r={r}
        strokeWidth={stroke}
        fill="none"
        stroke={progressColor}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition:'stroke-dashoffset .4s ease' }}
      />
      {showText && (
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize={size*0.32} fontWeight={600}>{pct}</text>
      )}
    </svg>
  );
};

export default CircularProgress;