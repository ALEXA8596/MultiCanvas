import { CourseSetting } from "./db";

function truncateWithEllipsis(value: string, maxLength: number) {
  if (maxLength <= 0) return "";
  if (value.length <= maxLength) return value;
  if (maxLength <= 3) return value.slice(0, maxLength);
  return `${value.slice(0, maxLength - 3)}...`;
}

export function getCourseDisplay({
  actualName,
  nickname,
  fallback,
  maxSubtitleLength = 15,
}: {
  actualName?: string | null;
  nickname?: string | null;
  fallback?: string;
  maxSubtitleLength?: number;
}) {
  const trimmedActual = (actualName ?? "").trim();
  const trimmedNickname = (nickname ?? "").trim();
  const trimmedFallback = (fallback ?? "").trim();
  const fallbackName = trimmedActual || trimmedFallback || "Course";
  const displayName = trimmedNickname.length > 0 ? trimmedNickname : fallbackName;
  const subtitleSource = trimmedActual || trimmedFallback;
  const subtitle = subtitleSource
    ? truncateWithEllipsis(subtitleSource, maxSubtitleLength)
    : "";

  return {
    displayName,
    subtitle,
  };
}

export function getDisplayFromSetting({
  setting,
  actualName,
  fallback,
  maxSubtitleLength,
}: {
  setting?: CourseSetting | null;
  actualName?: string | null;
  fallback?: string;
  maxSubtitleLength?: number;
}) {
  return getCourseDisplay({
    actualName,
    nickname: setting?.nickname,
    fallback: fallback ?? setting?.courseName,
    maxSubtitleLength,
  });
}
