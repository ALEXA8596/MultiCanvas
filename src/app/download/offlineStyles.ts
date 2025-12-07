
export const CANVAS_NAV_CSS = `
:root {
  --ic-brand-global-nav-bgd: #394B58;
  --ic-brand-global-nav-ic-icon-svg-fill: #ffffff;
  --ic-brand-global-nav-ic-icon-svg-fill--active: #394B58;
  --ic-brand-global-nav-menu-item__text-color: #ffffff;
  --ic-brand-global-nav-menu-item__text-color--active: #394B58;
  --ic-brand-global-nav-logo-bgd: #394B58;
  --ic-brand-header-image: none;
  --ic-brand-watermark-opacity: 1;
}

body {
  margin: 0;
  font-family: "Lato Extended", Lato, "Helvetica Neue", Helvetica, Arial, sans-serif;
  background-color: #f5f5f5;
}

.ic-app-header {
  box-sizing: border-box;
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  width: 84px;
  display: flex;
  flex-direction: column;
  background-color: var(--ic-brand-global-nav-bgd);
  z-index: 100;
}

.ic-app-header__main-navigation {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}

.ic-app-header__logomark-container {
  width: 100%;
  background-color: var(--ic-brand-global-nav-logo-bgd);
  height: 85px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ic-app-header__menu-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
}

.ic-app-header__menu-list-link {
  display: block;
  color: var(--ic-brand-global-nav-menu-item__text-color);
  text-decoration: none;
  padding: 0.5rem 0;
  width: 100%;
  text-align: center;
}

.ic-icon-svg {
  width: 26px;
  height: 26px;
  fill: var(--ic-brand-global-nav-ic-icon-svg-fill);
}

.menu-item__text {
  display: block;
  font-size: 0.75rem;
  margin-top: 2px;
}

.layout-shell {
  margin-left: 84px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.ic-Layout-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.ic-Layout-columns {
  display: flex;
  flex: 1;
  max-width: 1366px;
  margin: 0 auto;
  width: 100%;
  padding: 24px;
  box-sizing: border-box;
}

.ic-Layout-contentMain {
  flex: 1;
  min-width: 0;
  background: #fff;
  padding: 24px;
  border: 1px solid #C7CDD1;
  border-radius: 3px;
}

/* Course Nav */
.course-nav {
  width: 180px;
  margin-right: 24px;
  flex-shrink: 0;
}

.course-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.course-nav li {
  margin-bottom: 4px;
}

.course-nav a {
  display: block;
  padding: 8px 0;
  color: #2D3B45;
  text-decoration: none;
  font-size: 0.875rem;
}

.course-nav a:hover {
  text-decoration: underline;
  color: #008EE2;
}

.course-nav a.active {
  font-weight: bold;
  color: #2D3B45;
  border-left: 2px solid #2D3B45;
  padding-left: 8px;
}

/* Header */
.course-header {
  margin-bottom: 24px;
  border-bottom: 1px solid #C7CDD1;
  padding-bottom: 12px;
}

.course-header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #2D3B45;
}

.course-header .breadcrumbs {
  font-size: 0.875rem;
  color: #6c757c;
  margin-bottom: 8px;
}
`;

export const MODULES_CSS = `
.item-group-container {
  background: #fff;
  padding-bottom: 72px;
  border: 0;
}
.item-group-condensed {
  padding: 9px 0;
}
.item-group-condensed .ig-header {
  margin-top: 15px;
  background-color: #f2f4f4;
  border: 1px solid #e8eaec;
  padding: 12px 6px;
  color: #2D3B45;
  position: relative;
  display: flex;
  align-items: center;
}
.ig-header .name {
  color: #3d454c;
  font-size: 1rem;
  font-weight: bold;
}
.ig-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.ig-list .ig-row {
  padding: 12px 6px 12px 10px;
  border: 1px solid #e8eaec;
  border-top-width: 0;
  background: #fff;
  display: flex;
  align-items: center;
}
.ig-list .ig-row a.ig-title {
  color: #2d3b45;
  text-decoration: none;
  font-weight: bold;
  font-size: 0.875rem;
}
.type_icon {
  width: 1.875rem;
  height: 1.875rem;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-right: 8px;
  color: #73818c;
}
.indent_0 { margin-left: 0; }
.indent_1 { margin-left: 20px; }
.indent_2 { margin-left: 40px; }
.indent_3 { margin-left: 60px; }
.indent_4 { margin-left: 80px; }
`;

export const ASSIGNMENT_CSS = `
.assignment-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  border-bottom: 1px solid #C7CDD1;
  padding-bottom: 1rem;
}
.assignment-title .title {
  font-size: 1.5rem;
  font-weight: normal;
  margin: 0;
  color: #2D3B45;
}
.student-assignment-overview {
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem 0;
  border-bottom: 1px solid #C7CDD1;
  display: flex;
  flex-wrap: wrap;
}
.student-assignment-overview li {
  margin-right: 2rem;
  margin-bottom: 1rem;
}
.student-assignment-overview .title {
  display: block;
  font-weight: bold;
  font-size: 0.875rem;
  color: #2D3B45;
  margin-bottom: 0.25rem;
}
.description.user_content {
  font-size: 1rem;
  line-height: 1.5;
  color: #2D3B45;
  margin-bottom: 2rem;
}
`;

export const ANNOUNCEMENTS_CSS = `
.ic-announcement-row {
  display: flex;
  padding: 12px 0;
  border-bottom: 1px solid #e1e1e1;
  background-color: #fff;
}
.ic-item-row__content-link {
  text-decoration: none;
  color: inherit;
  display: block;
}
.ic-announcement-row h3 {
  margin: 0 0 4px 0;
  font-size: 1rem;
  font-weight: bold;
  color: #2d3b45;
}
.ic-announcement-row__content {
  color: #2d3b45;
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
`;
