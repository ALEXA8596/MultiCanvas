"use client";
import { useEffect, useState } from "react";
import { CourseSetting, getCourseSetting, getCourseSettings } from "@/lib/db";

function arrayToMap(settings: CourseSetting[]) {
  const map: Record<string, CourseSetting> = {};
  settings.forEach((setting) => {
    if (setting?.id) {
      map[setting.id] = setting;
    }
  });
  return map;
}

export function useCourseSettingsMap() {
  const [settingsMap, setSettingsMap] = useState<Record<string, CourseSetting>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const loadAll = async () => {
      try {
        const settings = await getCourseSettings();
        if (!cancelled) {
          setSettingsMap(arrayToMap(settings));
        }
      } catch {
        // ignore failures
      }
    };

    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      if (detail?.id) {
        getCourseSetting(detail.id)
          .then((setting) => {
            if (cancelled) return;
            setSettingsMap((prev) => {
              const next = { ...prev };
              if (setting) {
                next[detail.id!] = setting;
              } else {
                delete next[detail.id!];
              }
              return next;
            });
          })
          .catch(() => {
            if (cancelled) return;
            setSettingsMap((prev) => {
              const next = { ...prev };
              delete next[detail.id!];
              return next;
            });
          });
      } else {
        loadAll();
      }
    };

    loadAll();
    window.addEventListener("mc-course-settings-updated", handleUpdate as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener("mc-course-settings-updated", handleUpdate as EventListener);
    };
  }, []);

  return settingsMap;
}
