"use client";
import React, { useCallback, useState } from "react";
import { Account, DashboardCard as DashboardCardType } from "./canvasApi";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Link } from "@instructure/ui-link";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog } from "@fortawesome/free-solid-svg-icons";
import { CourseSetting } from "@/lib/db";
import { getCourseDisplay } from "@/lib/courseDisplay";
// import "../app/stylesheets/bundles/dashboard_card-3d0c6d4d27.css";

type Props = {
  card: DashboardCardType & { account: Account };
  setting?: CourseSetting | null;
  onOpenSettings?: (course: {
    account: Account;
    courseId: number;
    card: DashboardCardType;
    setting?: CourseSetting | null;
  }) => void;
};

export default function DashboardCardComponent({ card, setting, onOpenSettings }: Props) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const baseCourseUrl = `${card.account.domain}/${card.id}`;
  const coursesPathUrl = `${card.account.domain}/courses/${card.id}`;
  const fallbackName =
    card.originalName || card.longName || card.shortName || setting?.courseName || "Course";
  const { displayName, subtitle } = getCourseDisplay({
    actualName: card.originalName || card.longName || card.shortName || setting?.courseName,
    nickname: setting?.nickname,
    fallback: fallbackName,
  });

  // Generate a consistent random gradient based on card ID
  const generateRandomGradient = useCallback(() => {
    const colors = [
      ['#667eea', '#764ba2'], // Purple to blue
      ['#f093fb', '#f5576c'], // Pink to red
      ['#4facfe', '#00f2fe'], // Blue to cyan
      ['#43e97b', '#38f9d7'], // Green to turquoise
      ['#fa709a', '#fee140'], // Pink to yellow
      ['#a8edea', '#fed6e3'], // Mint to pink
      ['#ffecd2', '#fcb69f'], // Cream to peach
      ['#667eea', '#764ba2'], // Purple gradient
      ['#ff9a9e', '#fecfef'], // Pink gradient
      ['#a18cd1', '#fbc2eb'], // Purple to pink
    ];
    
    // Use card ID to consistently pick the same gradient
    const index = parseInt(card.id.toString()) % colors.length;
    const [color1, color2] = colors[index];
    return `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
  }, [card.id]);

  const handleNavigate = useCallback(() => {
    // Use window.open to keep consistent with Link default new tab? Could be location.assign.
    window.location.href = baseCourseUrl;
  }, [baseCourseUrl]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNavigate();
    }
  }, [handleNavigate]);

  return (
    <div
      className="ic-DashboardCard"
      data-course-id={card.id}
      role="button"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={handleKey}
      style={{ 
        cursor: 'pointer',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ height: '100%' }}>
        <div
          className="modern-card"
          style={{ 
            height: '100%',
            minHeight: card.image ? '240px' : '160px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '0'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.5rem' }}>
            <button
              type="button"
              aria-label={`Edit settings for ${displayName}`}
              onClick={(event) => {
                event.stopPropagation();
                if (onOpenSettings) {
                  onOpenSettings({
                    account: card.account,
                    courseId: Number(card.id),
                    card,
                    setting: setting ?? undefined,
                  });
                }
              }}
              style={{
                border: 'none',
                background: 'var(--background)',
                borderRadius: '999px',
                padding: '0.35rem 0.6rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
              }}
            >
              <FontAwesomeIcon icon={faCog} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground)' }}>Settings</span>
            </button>
          </div>
          {card.image && !imageError ? (
            <div style={{ position: 'relative' }}>
              {!imageLoaded && (
                <div
                  style={{
                    width: '100%',
                    height: '120px',
                    background: generateRandomGradient(),
                    borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Loading...
                </div>
              )}
              <Image
                src={card.image}
                alt={`${card.longName || card.shortName || card.originalName} course image`}
                width={600}
                height={360}
                style={{
                  width: '100%',
                  height: '120px',
                  objectFit: 'cover',
                  borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                  display: imageLoaded ? 'block' : 'none'
                }}
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                  setImageError(true);
                  setImageLoaded(false);
                }}
                unoptimized
              />
            </div>
          ) : card.color ? (
            <div 
              style={{
                width: '100%',
                height: '120px',
                backgroundColor: card.color,
                borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
              }}
            />
          ) : (
            <div 
              style={{
                width: '100%',
                height: '120px',
                background: generateRandomGradient(),
                borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '2rem',
                fontWeight: '600',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              {(card.longName || card.shortName || card.originalName || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div 
            style={{ 
              padding: '1rem',
              flex: '1',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <Heading
                level="h5"
                margin="0 0 x-small"
                themeOverride={{ h5FontWeight: 600 }}
                style={{ color: 'var(--foreground)' }}
              >
                {displayName}
              </Heading>
              {subtitle && (
                <Text
                  as="p"
                  size="x-small"
                  style={{ color: "var(--text-muted)", margin: "0" }}
                >
                  {subtitle}
                </Text>
              )}
              {card.term && (
                <Text
                  as="p"
                  size="x-small"
                  style={{ color: 'var(--text-muted)', margin: '0' }}
                >
                  {card.term}
                </Text>
              )}
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              marginTop: '0.75rem'
            }}>
              <Text as="p" style={{ margin: '0' }}>
                <Link
                  href={baseCourseUrl}
                  onClick={(e) => { e.stopPropagation(); }}
                  style={{
                    color: 'var(--primary)',
                    textDecoration: 'none',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    transition: 'color var(--transition-fast)'
                  }}
                >
                  Open Course
                </Link>
              </Text>
              <Text size="x-small" style={{ color: 'var(--text-muted)', margin: '0' }}>
                <Link
                  href={coursesPathUrl}
                  onClick={(e) => { e.stopPropagation(); }}
                  style={{
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    transition: 'color var(--transition-fast)'
                  }}
                >
                  {card.account.domain}
                </Link>
              </Text>
              {typeof setting?.credits === 'number' && (
                <Text size="x-small" color="secondary" style={{ margin: '0' }}>
                  Credits: {setting.credits}
                </Text>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
