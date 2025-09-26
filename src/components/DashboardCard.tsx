"use client";
import React, { useCallback, useState } from "react";
import { Account, DashboardCard as DashboardCardType } from "./canvasApi";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Link } from "@instructure/ui-link";
// import "../app/stylesheets/bundles/dashboard_card-3d0c6d4d27.css";

type Props = {
  card: DashboardCardType & { account: Account };
};

export default function DashboardCardComponent({ card }: Props) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const baseCourseUrl = `${card.account.domain}/${card.id}`;
  const coursesPathUrl = `${card.account.domain}/courses/${card.id}`;

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
      className="dashboard-card-modern-inner ic-DashboardCard"
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
      onMouseEnter={(e) => {
        const card = e.currentTarget.querySelector('.ic-DashboardCard__box') as HTMLElement;
        if (card) {
          card.style.transform = 'translateY(-2px)';
          card.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.2)';
        }
      }}
      onMouseLeave={(e) => {
        const card = e.currentTarget.querySelector('.ic-DashboardCard__box') as HTMLElement;
        if (card) {
          card.style.transform = 'translateY(0)';
          card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        }
      }}
    >
      <div className="ic-DashboardCard__box__container" style={{ height: '100%' }}>
        <div
          className="ic-DashboardCard__box"
          style={{ 
            background: 'var(--surface-elevated)', 
            border: '2px solid #d1d5db',
            borderRadius: 'var(--radius-lg)', 
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            height: '100%',
            minHeight: card.image ? '240px' : '160px',
            display: 'flex',
            flexDirection: 'column',
            transition: 'all var(--transition-normal)',
            overflow: 'hidden'
          }}
        >
          {card.image && !imageError ? (
            <div className="ic-DashboardCard__header_image" style={{ position: 'relative' }}>
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
              <img
                src={card.image}
                alt={`${card.longName || card.shortName || card.originalName} course image`}
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
              />
            </div>
          ) : card.color ? (
            <div 
              className="ic-DashboardCard__header_color"
              style={{
                width: '100%',
                height: '120px',
                backgroundColor: card.color,
                borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
              }}
            />
          ) : (
            <div 
              className="ic-DashboardCard__header_gradient"
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
            className="ic-DashboardCard__header"
            style={{ 
              padding: (card.image && !imageError) || card.color || !card.image ? '1rem' : '1.5rem 1rem' 
            }}
          >
            <div className="ic-DashboardCard__header_content">
              <Heading
                level="h5"
                margin="0"
                themeOverride={{ h5FontWeight: 600 }}
                className="ic-DashboardCard__header-title"
              >
                {card.longName || card.shortName || card.originalName}
              </Heading>
              {/* {card.courseCode && (
                <Text
                  as="p"
                  size="small"
                  color="secondary"
                  className="ic-DashboardCard__header-subtitle"
                >
                  {card.courseCode}
                </Text>
              )} */}
              {card.term && (
                <Text
                  as="p"
                  size="x-small"
                  color="secondary"
                  className="ic-DashboardCard__header-term"
                >
                  {card.term}
                </Text>
              )}
            </div>
            <div className="ic-DashboardCard__action-layout">
              <div className="ic-DashboardCard__action-container">
                <Text as="p" className="dashboard-card__footerLink">
                  <Link
                    href={baseCourseUrl}
                    onClick={(e) => { e.stopPropagation(); }}
                    className="ic-DashboardCard__action"
                  >Open Course</Link>
                </Text>
                <Text size="x-small" color="secondary">
                  <Link
                    href={coursesPathUrl}
                    onClick={(e) => { e.stopPropagation(); }}
                  >{card.account.domain}</Link>
                </Text>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
