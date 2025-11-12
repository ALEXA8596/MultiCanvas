"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Account,
  Enrollment,
  fetchUserEnrollments,
  CanvasCourse,
  fetchAllCourses,
} from "@/components/canvasApi";
import {
  Term,
  TermCourse,
  getTerms,
  addTerm,
  deleteTerm,
  updateTerm,
  getAllTermCourses,
  addTermCourse,
  updateTermCourse,
  deleteTermCourse,
  getCourseSettingId,
} from "@/lib/db";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Link } from "@instructure/ui-link";
import { Table } from "@instructure/ui-table";
import { Button } from "@instructure/ui-buttons";
import "./grades.css";
import { getCourseDisplay } from "@/lib/courseDisplay";
import { useCourseSettingsMap } from "@/hooks/useCourseSettingsMap";

type CourseWithGrade = {
  course: CanvasCourse;
  enrollment: Enrollment;
  account: Account;
};

const GRADE_POINT_MAP: Record<string, number> = {
  "A": 4.0,
  "A-": 3.7,
  "B+": 3.3,
  "B": 3.0,
  "B-": 2.7,
  "C+": 2.3,
  "C": 2.0,
  "C-": 1.7,
  "D+": 1.3,
  "D": 1.0,
  "D-": 0.7,
  "F": 0.0,
};

const COURSE_TYPES: { value: string; label: string }[] = [
  { value: "regular", label: "Regular" },
  { value: "academic", label: "Academic" },
  { value: "non-academic", label: "Non-Academic" },
  { value: "honors", label: "Honors" },
  { value: "accelerated", label: "Accelerated" },
  { value: "ap", label: "AP" },
  { value: "ib", label: "IB" },
  { value: "dual-enrollment", label: "Dual Enrollment" },
  { value: "concurrent-enrollment", label: "Concurrent Enrollment" },
];

const COURSE_TYPE_WEIGHTS: Record<string, number> = {
  "regular": 0,
  "academic": 0,
  "non-academic": 0,
  "honors": 1,
  "accelerated": 0,
  "ap": 1,
  "ib": 1,
  "dual-enrollment": 1,
  "concurrent-enrollment": 1,
};

const HONORS_WEIGHT_TYPES = new Set(["honors", "ap", "ib", "dual-enrollment", "concurrent-enrollment"]);

type ManualCourseWithTerm = TermCourse & {
  term?: Term;
  termLabel: string;
  gradeLevel: number | null;
};

function extractGradeLevel(gradeText?: string | null): number | null {
  if (!gradeText) return null;
  const match = gradeText.match(/(\d+)/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  if (!Number.isFinite(value)) return null;
  if (value < 6 || value > 14) return null;
  return value;
}

type WhatIfCourse = {
  id: string;
  courseName: string;
  credits: number;
  grade: string;
  courseType: string;
  termLabel: string;
};

export default function GradesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [coursesWithGrades, setCoursesWithGrades] = useState<
    CourseWithGrade[]
  >([]);
  const courseSettings = useCourseSettingsMap();
  const [terms, setTerms] = useState<Term[]>([]);
  const [termCourses, setTermCourses] = useState<TermCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state for adding a term
  const [termYear, setTermYear] = useState(new Date().getFullYear());
  const [termSeason, setTermSeason] = useState("Fall");
  const [termGradeLevel, setTermGradeLevel] = useState("");

  // Form state for adding/editing a course
  const [editingCourse, setEditingCourse] = useState<TermCourse | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);
  const [formCourseName, setFormCourseName] = useState("");
  const [formCredits, setFormCredits] = useState(3);
  const [formGrade, setFormGrade] = useState("A");
  const [formCourseType, setFormCourseType] = useState("regular");
  const [whatIfCourses, setWhatIfCourses] = useState<WhatIfCourse[]>([]);
  const [whatIfActive, setWhatIfActive] = useState(false);
  const [whatIfTermGrades, setWhatIfTermGrades] = useState<Record<string, string>>({});
  const [customExtraPoints, setCustomExtraPoints] = useState<Record<string, number>>({
    accelerated: 0,
    honors: 1,
    ap: 1,
    ib: 1,
    "dual-enrollment": 1,
    "concurrent-enrollment": 1,
  });
  const [customGradeCaps, setCustomGradeCaps] = useState<Record<string, string>>({
    "9": "",
    "10": "",
    "11": "",
    "12": "",
  });
  const [customTotalExtraCap, setCustomTotalExtraCap] = useState("");
  const [customSelectedCourses, setCustomSelectedCourses] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const saved = localStorage.getItem("accounts");
    if (saved) {
      try {
        setAccounts(JSON.parse(saved));
      } catch {
        // ignore parse errors
      }
    }
    loadManualGradeData();
  }, []);

  async function loadManualGradeData() {
    const [terms, courses] = await Promise.all([getTerms(), getAllTermCourses()]);
    const seasonOrder: { [key: string]: number } = { "Fall": 3, "Summer": 2, "Spring": 1, "Winter": 0 };
    setTerms(terms.sort((a, b) => {
        if (a.year !== b.year) {
            return b.year - a.year;
        }
        return (seasonOrder[b.season] ?? -1) - (seasonOrder[a.season] ?? -1);
    }));
    setTermCourses(courses);
  }

  useEffect(() => {
    setCustomSelectedCourses((prev) => {
      const updated: Record<number, boolean> = {};
      let changed = false;
      termCourses.forEach((course) => {
        if (course.id != null) {
          updated[course.id] = prev[course.id] ?? true;
          if (prev[course.id] === undefined) {
            changed = true;
          }
        }
      });
      if (Object.keys(prev).length !== Object.keys(updated).length) {
        changed = true;
      }
      return changed ? updated : prev;
    });
  }, [termCourses]);

  const manualCoursesWithTerm = useMemo<ManualCourseWithTerm[]>(() => {
    return termCourses.map((course) => {
      const term = terms.find((t) => t.id === course.termId);
      const termLabel = term ? `${term.season} ${term.year}` : "Unknown Term";
      const gradeLevel = term ? extractGradeLevel(term.termGrade) : null;
      return {
        ...course,
        term,
        termLabel,
        gradeLevel,
      };
    });
  }, [termCourses, terms]);

  useEffect(() => {
    if (accounts.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchAllCourses(accounts), ...accounts.map(fetchUserEnrollments)])
      .then((results) => {
        if (cancelled) return;

        const courseResults = results[0] as { account: Account; courses: CanvasCourse[] }[];
        const enrollmentResults = results.slice(1) as Enrollment[][];

        const allCourses = courseResults.flatMap(({ account, courses }) =>
          courses.map((course) => ({ account, course }))
        );

        const allEnrollments = enrollmentResults.flatMap((enrollments, index) =>
          enrollments.map(e => ({...e, account: accounts[index]}))
        );

        const merged: CourseWithGrade[] = [];
        allEnrollments.forEach((enrollment) => {
          if (enrollment.type === 'StudentEnrollment') {
            const courseInfo = allCourses.find(
              (c) => c.course.id === enrollment.course_id && c.account.id === enrollment.account.id
            );
            if (courseInfo) {
              merged.push({
                course: courseInfo.course,
                enrollment,
                account: courseInfo.account,
              });
            }
          }
        });

        setCoursesWithGrades(merged);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accounts]);

  const handleAddTerm = async () => {
    if (!termGradeLevel.trim()) {
      window.alert("Please enter a grade level for this term (e.g., 9th).");
      return;
    }
    await addTerm({
      year: termYear,
      season: termSeason,
      termGrade: termGradeLevel.trim(),
    });
    await loadManualGradeData();
    setTermGradeLevel("");
  };

  const handleDeleteTerm = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this term and all its courses?")) {
      await deleteTerm(id);
      await loadManualGradeData();
    }
  };

  const handleTermGradeChange = async (term: Term, grade: string) => {
    await updateTerm({ ...term, termGrade: grade.trim() });
    await loadManualGradeData();
  };

  const handleSaveCourse = async () => {
    if (!selectedTermId) return;

    const courseData: TermCourse = {
      id: editingCourse?.id,
      termId: selectedTermId,
      courseName: formCourseName,
      credits: formCredits,
      grade: formGrade.trim().toUpperCase(),
      courseType: formCourseType,
    };

    if (editingCourse?.id) {
      await updateTermCourse(courseData);
    } else {
      await addTermCourse(courseData);
    }
    
    setEditingCourse(null);
    resetCourseForm();
    await loadManualGradeData();
  };

  const handleEditCourse = (course: TermCourse) => {
    setEditingCourse(course);
    setSelectedTermId(course.termId);
    setFormCourseName(course.courseName);
    setFormCredits(course.credits);
    setFormGrade(course.grade?.toUpperCase() ?? "");
    setFormCourseType(course.courseType ?? "regular");
  };

  const handleDeleteCourse = async (id: number) => {
    await deleteTermCourse(id);
    await loadManualGradeData();
  };

  const handleSyncCourse = async (courseWithGrade: CourseWithGrade) => {
    if (!selectedTermId) {
      window.alert("Select a term in the manual GPA section before syncing a course.");
      return;
    }

    const grade =
      courseWithGrade.enrollment.grades.current_grade ??
      courseWithGrade.enrollment.grades.final_grade ??
      "";

    await addTermCourse({
      termId: selectedTermId,
      courseName: courseWithGrade.course.name,
      credits: 1,
      grade: grade.trim().toUpperCase(),
      courseType: "regular",
    });

    await loadManualGradeData();
  };

  const startWhatIfScenario = () => {
    if (coursesWithGrades.length === 0) {
      window.alert("There are no current grades to copy into a what-if scenario.");
      return;
    }

    const scenarioCourses = coursesWithGrades.map(({ course, enrollment }) => ({
      id: `${course.id}-${enrollment.id}`,
      courseName: course.name,
      credits: 1,
      grade:
        (
          enrollment.grades.current_grade ??
          enrollment.grades.final_grade ??
          ""
        ).trim().toUpperCase(),
      courseType: "regular",
      termLabel:
        (enrollment.current_grading_period_title && enrollment.current_grading_period_title.trim().length > 0)
          ? enrollment.current_grading_period_title
          : "Scenario Term",
    }));

    setWhatIfCourses(scenarioCourses);

    const initialTermGrades: Record<string, string> = {};
    scenarioCourses.forEach((course) => {
      if (!initialTermGrades[course.termLabel]) {
        initialTermGrades[course.termLabel] = "";
      }
    });
    setWhatIfTermGrades(initialTermGrades);
    setWhatIfActive(true);
  };

  const resetWhatIfScenario = () => {
    setWhatIfCourses([]);
    setWhatIfTermGrades({});
    setWhatIfActive(false);
  };

  const handleWhatIfCourseChange = (id: string, field: keyof WhatIfCourse, value: string | number) => {
    setWhatIfCourses((prev) => {
      let previousLabel = "";
      let updatedLabel = "";

      const updatedCourses = prev.map((course) => {
        if (course.id !== id) return course;

        previousLabel = course.termLabel;

        if (field === "credits") {
          const creditsValue = Number(value);
          return {
            ...course,
            credits: Number.isFinite(creditsValue) && creditsValue >= 0 ? creditsValue : 0,
          };
        }

        if (field === "termLabel") {
          updatedLabel =
            typeof value === "string" && value.trim().length > 0 ? value : "Scenario Term";
          return {
            ...course,
            termLabel: updatedLabel,
          };
        }

        if (field === "grade") {
          const gradeValue =
            typeof value === "string" ? value.toUpperCase().trim() : String(value).toUpperCase().trim();
          return {
            ...course,
            grade: gradeValue,
          };
        }

        return {
          ...course,
          [field]: typeof value === "string" ? value : String(value),
        } as WhatIfCourse;
      });

      if (field === "termLabel") {
        const remainingLabels = new Set(updatedCourses.map((course) => course.termLabel));
        setWhatIfTermGrades((prevGrades) => {
          const nextGrades: Record<string, string> = {};
          remainingLabels.forEach((label) => {
            if (label === updatedLabel) {
              nextGrades[label] =
                prevGrades[label] ??
                (previousLabel && prevGrades[previousLabel] !== undefined ? prevGrades[previousLabel] : "");
            } else if (prevGrades[label] !== undefined) {
              nextGrades[label] = prevGrades[label];
            } else {
              nextGrades[label] = "";
            }
          });
          return nextGrades;
        });
      }

      return updatedCourses;
    });
  };

  const handleWhatIfCourseDelete = (id: string) => {
    setWhatIfCourses((prev) => {
      const updated = prev.filter((course) => course.id !== id);
      const remainingLabels = new Set(updated.map((course) => course.termLabel));
      setWhatIfTermGrades((prevGrades) => {
        const nextGrades: Record<string, string> = {};
        remainingLabels.forEach((label) => {
          nextGrades[label] = prevGrades[label] ?? "";
        });
        return nextGrades;
      });
      if (updated.length === 0) {
        setWhatIfActive(false);
      }
      return updated;
    });
  };

  const handleWhatIfTermGradeChange = (termLabel: string, grade: string) => {
    setWhatIfTermGrades((prev) => ({ ...prev, [termLabel]: grade.toUpperCase().trim() }));
  };

  const handleCustomExtraPointChange = (type: keyof typeof customExtraPoints, value: string) => {
    const parsed = Number(value);
    setCustomExtraPoints((prev) => ({
      ...prev,
      [type]: Number.isFinite(parsed) ? parsed : 0,
    }));
  };

  const handleCustomGradeCapChange = (grade: string, value: string) => {
    setCustomGradeCaps((prev) => ({
      ...prev,
      [grade]: value,
    }));
  };

  const handleCustomTotalCapChange = (value: string) => {
    setCustomTotalExtraCap(value);
  };

  const handleToggleCustomCourse = (courseId: number, checked: boolean) => {
    setCustomSelectedCourses((prev) => ({
      ...prev,
      [courseId]: checked,
    }));
  };

  const handleSelectAllCustomCourses = () => {
    setCustomSelectedCourses((prev) => {
      const updated: Record<number, boolean> = { ...prev };
      manualCoursesWithTerm.forEach((course) => {
        if (course.id != null) {
          updated[course.id] = true;
        }
      });
      return updated;
    });
  };

  const handleClearCustomCourses = () => {
    setCustomSelectedCourses((prev) => {
      const updated: Record<number, boolean> = { ...prev };
      manualCoursesWithTerm.forEach((course) => {
        if (course.id != null) {
          updated[course.id] = false;
        }
      });
      return updated;
    });
  };

  const resetCourseForm = () => {
    setFormCourseName("");
    setFormCredits(3);
    setFormGrade("A");
    setFormCourseType("regular");
  };

  const calculateGPASummary = (courses: { grade: string; credits: number; courseType?: string }[]) => {
    let totalCredits = 0;
    let totalPoints = 0;
    let totalWeightedPoints = 0;

    courses.forEach((course) => {
      const normalizedGrade = (course.grade || "").trim().toUpperCase();
      const basePoints = GRADE_POINT_MAP[normalizedGrade];
      if (basePoints === undefined) return;

      const credits = Number(course.credits) || 0;
      if (credits <= 0) return;

      const courseType = course.courseType ?? "regular";
      const weightBonus = COURSE_TYPE_WEIGHTS[courseType] ?? 0;
      const weightedPoints = Math.min(basePoints + weightBonus, 5.0);

      totalCredits += credits;
      totalPoints += basePoints * credits;
      totalWeightedPoints += weightedPoints * credits;
    });

    if (totalCredits === 0) {
      return { unweighted: "N/A", weighted: "N/A" };
    }

    return {
      unweighted: (totalPoints / totalCredits).toFixed(2),
      weighted: (totalWeightedPoints / totalCredits).toFixed(2),
    };
  };

  const calculateUCGPACapped = (courses: ManualCourseWithTerm[]) => {
    let totalCredits = 0;
    let basePoints = 0;
    let extraPoints = 0;
    let extraUsedGrade10 = 0;
    let totalExtraUsed = 0;
    let countedCourses = 0;

    courses.forEach((course) => {
      if (course.gradeLevel !== 10 && course.gradeLevel !== 11) return;
      const normalizedGrade = (course.grade || "").trim().toUpperCase();
      const base = GRADE_POINT_MAP[normalizedGrade];
      if (base === undefined) return;
      const credits = Number(course.credits) || 0;
      if (credits <= 0) return;

      totalCredits += credits;
      basePoints += base * credits;
      countedCourses += 1;

      const courseType = course.courseType ?? "regular";
      if (!HONORS_WEIGHT_TYPES.has(courseType)) {
        return;
      }

      const availableTotal = Math.max(0, 8 - totalExtraUsed);
      if (availableTotal <= 0) return;

      const candidate = credits;

      if (course.gradeLevel === 10) {
        const availableGrade10 = Math.max(0, 4 - extraUsedGrade10);
        if (availableGrade10 <= 0) return;
        const applied = Math.min(candidate, availableTotal, availableGrade10);
        extraPoints += applied;
        extraUsedGrade10 += applied;
        totalExtraUsed += applied;
      } else {
        const applied = Math.min(candidate, availableTotal);
        extraPoints += applied;
        totalExtraUsed += applied;
      }
    });

    if (totalCredits === 0) {
      return {
        gpa: "N/A",
        credits: 0,
        courses: 0,
        extraUsed: 0,
        extraUsedGrade10: 0,
      };
    }

    return {
      gpa: ((basePoints + extraPoints) / totalCredits).toFixed(2),
      credits: totalCredits,
      courses: countedCourses,
      extraUsed: Number(extraPoints.toFixed(2)),
      extraUsedGrade10: Number(extraUsedGrade10.toFixed(2)),
    };
  };

  const calculateUCUnweighted = (courses: ManualCourseWithTerm[]) => {
    let totalCredits = 0;
    let basePoints = 0;
    let countedCourses = 0;

    courses.forEach((course) => {
      if (course.gradeLevel !== 10 && course.gradeLevel !== 11) return;

      const normalizedGrade = (course.grade || "").trim().toUpperCase();
      const base = GRADE_POINT_MAP[normalizedGrade];
      if (base === undefined) return;

      const credits = Number(course.credits) || 0;
      if (credits <= 0) return;

      totalCredits += credits;
      basePoints += base * credits;
      countedCourses += 1;
    });

    if (totalCredits === 0) {
      return { gpa: "N/A", credits: 0, courses: 0 };
    }

    return {
      gpa: (basePoints / totalCredits).toFixed(2),
      credits: totalCredits,
      courses: countedCourses,
    };
  };

  const calculateUCFullWeighted = (courses: ManualCourseWithTerm[]) => {
    let totalCredits = 0;
    let basePoints = 0;
    let extraPoints = 0;
    let countedCourses = 0;

    courses.forEach((course) => {
      if (course.gradeLevel !== 10 && course.gradeLevel !== 11) return;

      const normalizedGrade = (course.grade || "").trim().toUpperCase();
      const base = GRADE_POINT_MAP[normalizedGrade];
      if (base === undefined) return;

      const credits = Number(course.credits) || 0;
      if (credits <= 0) return;

      totalCredits += credits;
      basePoints += base * credits;
      countedCourses += 1;

      const courseType = course.courseType ?? "regular";
      if (HONORS_WEIGHT_TYPES.has(courseType)) {
        extraPoints += credits;
      }
    });

    if (totalCredits === 0) {
      return { gpa: "N/A", credits: 0, courses: 0, extraUsed: 0 };
    }

    return {
      gpa: ((basePoints + extraPoints) / totalCredits).toFixed(2),
      credits: totalCredits,
      courses: countedCourses,
      extraUsed: Number(extraPoints.toFixed(2)),
    };
  };

  const calculateCustomGPA = (
    courses: ManualCourseWithTerm[],
    selection: Record<number, boolean>,
    extraConfig: Record<string, number>,
    gradeCaps: Record<string, string>,
    totalCap: string
  ) => {
    let totalCredits = 0;
    let basePoints = 0;
    let extraPoints = 0;
    let extraUsedTotal = 0;
    const extraUsedByGrade: Record<number, number> = {};

    const parsedTotalCap = Number(totalCap);
    const totalCapValue = totalCap.trim() === "" || !Number.isFinite(parsedTotalCap) || parsedTotalCap < 0
      ? Number.POSITIVE_INFINITY
      : parsedTotalCap;

    courses.forEach((course) => {
  if (course.id == null) return;
  if (selection[course.id] === false) return;

      const normalizedGrade = (course.grade || "").trim().toUpperCase();
      const base = GRADE_POINT_MAP[normalizedGrade];
      if (base === undefined) return;
      const credits = Number(course.credits) || 0;
      if (credits <= 0) return;

      totalCredits += credits;
      basePoints += base * credits;

      const courseType = course.courseType ?? "regular";
      const extraPerCredit = extraConfig[courseType] ?? 0;
      const candidate = extraPerCredit * credits;
      if (candidate <= 0) return;

  const availableTotal = totalCapValue - extraUsedTotal;
      if (availableTotal <= 0) return;

      let availableForGrade = Number.POSITIVE_INFINITY;
      if (course.gradeLevel && course.gradeLevel >= 0) {
        const capString = gradeCaps[course.gradeLevel.toString()];
        const parsedCap = Number(capString);
        const capValue = capString && capString.trim() !== "" && Number.isFinite(parsedCap) && parsedCap >= 0
          ? parsedCap
          : Number.POSITIVE_INFINITY;
        const alreadyUsed = extraUsedByGrade[course.gradeLevel] ?? 0;
        availableForGrade = capValue - alreadyUsed;
        if (availableForGrade <= 0) return;
      }

      const applied = Math.max(0, Math.min(candidate, availableTotal, availableForGrade));
      if (applied <= 0) return;

      extraPoints += applied;
      extraUsedTotal += applied;
      if (course.gradeLevel) {
        extraUsedByGrade[course.gradeLevel] = (extraUsedByGrade[course.gradeLevel] ?? 0) + applied;
      }
    });

    if (totalCredits === 0) {
      return {
        gpa: "N/A",
        credits: 0,
        extraUsed: 0,
        extraByGrade: {},
      };
    }

    const extraSummary: Record<number, number> = {};
    Object.entries(extraUsedByGrade).forEach(([grade, value]) => {
      if (value > 0) {
        extraSummary[Number(grade)] = Number(value.toFixed(2));
      }
    });

    return {
      gpa: ((basePoints + extraPoints) / totalCredits).toFixed(2),
      credits: totalCredits,
      extraUsed: Number(extraPoints.toFixed(2)),
      extraByGrade: extraSummary,
    };
  };

  const manualGPA = calculateGPASummary(termCourses);
  const whatIfGPA = calculateGPASummary(whatIfCourses);
  const whatIfTermLabels = Array.from(
    new Set(
      whatIfCourses.map((course) => {
        const label = course.termLabel?.trim();
        return label && label.length > 0 ? label : "Scenario Term";
      })
    )
  );
  const ucGPA = calculateUCGPACapped(manualCoursesWithTerm);
  const ucUnweighted = calculateUCUnweighted(manualCoursesWithTerm);
  const ucFullWeighted = calculateUCFullWeighted(manualCoursesWithTerm);
  const customGPA = calculateCustomGPA(
    manualCoursesWithTerm,
    customSelectedCourses,
    customExtraPoints,
    customGradeCaps,
    customTotalExtraCap
  );

  return (
    <div className="grades-container fade-in">
      <div className="grades-header">
        <Heading level="h2" margin="0 0 medium 0" className="text-gradient">
          Grades
        </Heading>
      </div>

      {loading && <Text>Loading grades...</Text>}
      {error && <Text color="danger">Error: {error}</Text>}

      {!loading && !error && coursesWithGrades.length === 0 && (
        <View as="div" textAlign="center" padding="large">
          <Heading level="h3" margin="0 0 small 0">No Grades Available</Heading>
          <Text>
            Either you have no active student enrollments, or grades are not available.
          </Text>
        </View>
      )}

      {!loading && !error && coursesWithGrades.length > 0 && (
        <Table caption="Course Grades">
          <Table.Head>
            <Table.Row>
              <Table.ColHeader id="course-name">Course</Table.ColHeader>
              <Table.ColHeader id="current-score">Current Score</Table.ColHeader>
              <Table.ColHeader id="current-grade">Current Grade</Table.ColHeader>
              <Table.ColHeader id="final-score">Final Score</Table.ColHeader>
              <Table.ColHeader id="final-grade">Final Grade</Table.ColHeader>
              <Table.ColHeader id="details">Details</Table.ColHeader>
              <Table.ColHeader id="sync">Sync</Table.ColHeader>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {coursesWithGrades.map(({ course, enrollment, account }) => {
              const setting = courseSettings[getCourseSettingId(account.domain, course.id)];
              const { displayName, subtitle } = getCourseDisplay({
                actualName: course.name,
                nickname: setting?.nickname,
                fallback: course.name,
              });
              return (
                <Table.Row key={`${account.id}-${course.id}`}>
                  <Table.Cell>
                    <Link href={`/${account.domain}/${course.id}`}>
                      {displayName}
                    </Link>
                    {subtitle && (
                      <>
                        <br />
                        <Text size="x-small" color="secondary">{subtitle}</Text>
                      </>
                    )}
                    <br />
                    <Text size="small" color="secondary">{account.domain}</Text>
                  </Table.Cell>
                <Table.Cell>{enrollment.grades.current_score ?? 'N/A'}</Table.Cell>
                <Table.Cell>{enrollment.grades.current_grade ?? 'N/A'}</Table.Cell>
                <Table.Cell>{enrollment.grades.final_score ?? 'N/A'}</Table.Cell>
                <Table.Cell>{enrollment.grades.final_grade ?? 'N/A'}</Table.Cell>
                <Table.Cell>
                  <Link href={`/${account.domain}/${course.id}/grades`}>
                    What-If Grades
                  </Link>
                </Table.Cell>
                <Table.Cell>
                  <Button onClick={() => handleSyncCourse({ course, enrollment, account })} size="small" disabled={!selectedTermId}>
                    Sync
                  </Button>
                </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      )}

      <View as="section" margin="large 0 0 0">
        <Heading level="h3" margin="0 0 medium 0">Manual Grades for GPA Calculation</Heading>
        <View as="div" margin="0 0 medium 0" className="gpa-summary">
          <Text><strong>Manual Unweighted GPA:</strong> {manualGPA.unweighted}</Text>
          <Text><strong>Manual Weighted GPA:</strong> {manualGPA.weighted}</Text>
          <Text><strong>UC Unweighted GPA:</strong> {ucUnweighted.gpa}</Text>
          <Text><strong>UC Full Weighted GPA:</strong> {ucFullWeighted.gpa}</Text>
          <Text><strong>UC Capped GPA:</strong> {ucGPA.gpa}</Text>
        </View>
        <View as="div" className="course-type-hint">
          <Text size="small" color="secondary">
            Course type selections add weight to the manual GPA calculation (Accelerated +0.0, Honors/AP/IB/Dual/Concurrent +1.0, Academic and others +0.0).
          </Text>
          {ucGPA.credits > 0 ? (
            <Text size="small" color="secondary">
              UC capped honors points used: {ucGPA.extraUsed.toFixed(2)} total (Grade 10: {ucGPA.extraUsedGrade10.toFixed(2)}).
            </Text>
          ) : (
            <Text size="small" color="secondary">
              Add 10th or 11th grade courses to view UC GPA metrics.
            </Text>
          )}
        </View>

        <div className="manual-grade-form">
          <Heading level="h4">Add New Term</Heading>
          <div className="form-row">
            <div className="input-container">
                <label htmlFor="term-year"><Text>Year</Text></label>
                <input id="term-year" type="number" value={termYear} onChange={(e) => setTermYear(Number(e.target.value))} />
            </div>
            <div className="input-container">
                <label htmlFor="season-select"><Text>Season</Text></label>
                <select id="season-select" value={termSeason} onChange={(e) => setTermSeason(e.target.value)}>
                    <option value="Winter">Winter</option>
                    <option value="Spring">Spring</option>
                    <option value="Summer">Summer</option>
                    <option value="Fall">Fall</option>
                </select>
            </div>
            <div className="input-container term-grade-inline">
                <label htmlFor="term-grade-level"><Text>Grade Level (e.g., 9th)</Text></label>
                <input
                  id="term-grade-level"
                  type="text"
                  value={termGradeLevel}
                  placeholder="e.g., 11th"
                  onChange={(e) => setTermGradeLevel(e.target.value)}
                />
            </div>
            <Button onClick={handleAddTerm} color="primary">Add Term</Button>
          </div>
        </div>

        <div className="manual-grade-form" style={{marginTop: '2rem'}}>
          <Heading level="h4">{editingCourse ? "Edit" : "Add"} Course</Heading>
          <div className="form-column">
            <div className="input-container">
                <label htmlFor="term-select"><Text>Term</Text></label>
                <select
                  id="term-select"
                  value={selectedTermId ?? ''}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setSelectedTermId(Number.isFinite(value) && value > 0 ? value : null);
                  }}
                >
                    <option value="">Select a Term</option>
                    {terms.map(term => (
                        <option key={term.id} value={term.id}>{term.season} {term.year}</option>
                    ))}
                </select>
            </div>
            <div className="input-container">
                <label htmlFor="course-name"><Text>Course Name</Text></label>
                <input id="course-name" type="text" value={formCourseName} onChange={(e) => setFormCourseName(e.target.value)} />
            </div>
            <div className="input-container">
                <label htmlFor="course-credits"><Text>Credits</Text></label>
                <input id="course-credits" type="number" value={formCredits} onChange={(e) => setFormCredits(Number(e.target.value))} />
            </div>
            <div className="input-container">
                <label htmlFor="course-type"><Text>Course Type</Text></label>
                <select
                  id="course-type"
                  value={formCourseType}
                  onChange={(e) => setFormCourseType(e.target.value)}
                >
                  {COURSE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
            </div>
            <div className="input-container">
                <label htmlFor="course-grade"><Text>Grade (e.g., A, B+)</Text></label>
                <input id="course-grade" type="text" value={formGrade} onChange={(e) => setFormGrade(e.target.value.toUpperCase())} />
            </div>
            <div className="button-row">
              <Button onClick={handleSaveCourse} color="primary" disabled={!selectedTermId}>{editingCourse ? "Update" : "Add"} Course</Button>
              {editingCourse && <Button onClick={() => { setEditingCourse(null); resetCourseForm(); }}>Cancel</Button>}
            </div>
          </div>
        </div>

        {terms.map(term => (
            <View key={term.id} as="section" margin="medium 0 0 0">
                <div className="term-header">
                  <Heading level="h4">
                    {term.season} {term.year}
                    {term.termGrade ? ` - Grade Level: ${term.termGrade}` : ""}
                  </Heading>
                  <div className="term-actions">
                    <div className="input-container term-grade-inline">
                      <label htmlFor={`term-grade-${term.id}`}><Text>Grade Level (e.g., 9th)</Text></label>
                      <input
                        id={`term-grade-${term.id}`}
                        type="text"
                        value={term.termGrade ?? ""}
                        placeholder="e.g., 11th"
                        onChange={(e) => handleTermGradeChange(term, e.target.value)}
                      />
                    </div>
                    <Button onClick={() => handleDeleteTerm(term.id!)} size="small" color="danger">Delete Term</Button>
                  </div>
                </div>
                <Table caption={`${term.season} ${term.year} Grades`} margin="medium 0 0 0">
                <Table.Head>
                    <Table.Row>
                    <Table.ColHeader id="manual-course-name">Course Name</Table.ColHeader>
                    <Table.ColHeader id="manual-credits">Credits</Table.ColHeader>
          <Table.ColHeader id="manual-course-type">Course Type</Table.ColHeader>
                    <Table.ColHeader id="manual-grade">Grade</Table.ColHeader>
                    <Table.ColHeader id="manual-actions">Actions</Table.ColHeader>
                    </Table.Row>
                </Table.Head>
                <Table.Body>
                    {termCourses.filter(c => c.termId === term.id).map((course) => (
                    <Table.Row key={course.id}>
                        <Table.Cell>{course.courseName}</Table.Cell>
                        <Table.Cell>{course.credits}</Table.Cell>
            <Table.Cell>{COURSE_TYPES.find(type => type.value === (course.courseType ?? "regular"))?.label ?? "Regular"}</Table.Cell>
                        <Table.Cell>{course.grade}</Table.Cell>
                        <Table.Cell>
              <div className="button-row">
                            <Button onClick={() => handleEditCourse(course)} size="small">Edit</Button>
                            <Button onClick={() => handleDeleteCourse(course.id!)} size="small" color="danger">Delete</Button>
              </div>
                        </Table.Cell>
                    </Table.Row>
                    ))}
                </Table.Body>
                </Table>
            </View>
        ))}

        <View as="section" margin="large 0 0 0" className="custom-gpa-section">
          <Heading level="h3">Custom GPA Calculator</Heading>
          <Text size="small" color="secondary">
            Choose which courses to include, customize extra weight by course type, and enforce grade-level or overall caps.
          </Text>

          <View as="div" className="gpa-summary" style={{ marginTop: "0.75rem" }}>
            <Text><strong>Custom GPA:</strong> {customGPA.gpa}</Text>
            <Text><strong>Total Extra Points Used:</strong> {customGPA.extraUsed.toFixed(2)}</Text>
            <Text><strong>Credits Counted:</strong> {customGPA.credits}</Text>
          </View>
          {Object.keys(customGPA.extraByGrade).length > 0 && (
            <div className="custom-extra-summary">
              {Object.entries(customGPA.extraByGrade).map(([grade, value]) => (
                <Text key={grade} size="small" color="secondary">
                  Grade {grade}: {value.toFixed(2)} extra points used
                </Text>
              ))}
            </div>
          )}

          <div className="custom-gpa-config">
            <div className="custom-gpa-card">
              <Heading level="h4">Extra Points by Course Type</Heading>
              <Text size="small" color="secondary">Set the additional weight applied to each selected course type.</Text>
              <div className="custom-grid">
                {(["accelerated", "honors", "ap", "ib", "dual-enrollment", "concurrent-enrollment"] as const).map((typeKey) => (
                  <div key={typeKey} className="input-container">
                    <label htmlFor={`custom-extra-${typeKey}`}><Text>{COURSE_TYPES.find(t => t.value === typeKey)?.label ?? typeKey}</Text></label>
                    <input
                      id={`custom-extra-${typeKey}`}
                      type="number"
                      step="0.1"
                      value={customExtraPoints[typeKey] ?? 0}
                      onChange={(e) => handleCustomExtraPointChange(typeKey, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="custom-gpa-card">
              <Heading level="h4">Extra Point Caps</Heading>
              <Text size="small" color="secondary">Leave blank for no cap. Caps limit the total extra points credited per grade level and overall.</Text>
              <div className="custom-grid">
                {(["9", "10", "11", "12"]).map((gradeKey) => (
                  <div key={gradeKey} className="input-container">
                    <label htmlFor={`custom-cap-${gradeKey}`}><Text>Grade {gradeKey} Cap</Text></label>
                    <input
                      id={`custom-cap-${gradeKey}`}
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="Unlimited"
                      value={customGradeCaps[gradeKey]}
                      onChange={(e) => handleCustomGradeCapChange(gradeKey, e.target.value)}
                    />
                  </div>
                ))}
                <div className="input-container">
                  <label htmlFor="custom-total-cap"><Text>Total Extra Cap</Text></label>
                  <input
                    id="custom-total-cap"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Unlimited"
                    value={customTotalExtraCap}
                    onChange={(e) => handleCustomTotalCapChange(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="custom-actions">
            <Button onClick={handleSelectAllCustomCourses} size="small">Select All</Button>
            <Button onClick={handleClearCustomCourses} size="small">Clear All</Button>
          </div>

          <Table caption="Custom GPA Course Selection" margin="medium 0 0 0">
            <Table.Head>
              <Table.Row>
                <Table.ColHeader id="custom-select">Use</Table.ColHeader>
                <Table.ColHeader id="custom-term">Term</Table.ColHeader>
                <Table.ColHeader id="custom-grade-level">Grade Level</Table.ColHeader>
                <Table.ColHeader id="custom-course">Course</Table.ColHeader>
                <Table.ColHeader id="custom-type">Course Type</Table.ColHeader>
                <Table.ColHeader id="custom-credits">Credits</Table.ColHeader>
                <Table.ColHeader id="custom-grade">Grade</Table.ColHeader>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {manualCoursesWithTerm.map((course) => (
                <Table.Row key={course.id ?? `${course.termId}-${course.courseName}`}>
                  <Table.Cell>
                    {course.id != null && (
                      <input
                        type="checkbox"
                        checked={customSelectedCourses[course.id] ?? false}
                        onChange={(e) => handleToggleCustomCourse(course.id!, e.target.checked)}
                      />
                    )}
                  </Table.Cell>
                  <Table.Cell>{course.termLabel}</Table.Cell>
                  <Table.Cell>{course.term?.termGrade ?? "N/A"}</Table.Cell>
                  <Table.Cell>{course.courseName}</Table.Cell>
                  <Table.Cell>{COURSE_TYPES.find((type) => type.value === (course.courseType ?? "regular"))?.label ?? "Regular"}</Table.Cell>
                  <Table.Cell>{course.credits}</Table.Cell>
                  <Table.Cell>{course.grade}</Table.Cell>
                </Table.Row>
              ))}
              {manualCoursesWithTerm.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={7}>
                    <Text size="small" color="secondary">Add courses above to configure a custom GPA.</Text>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </View>

        <View as="section" margin="large 0 0 0">
          <div className="section-header">
            <Heading level="h3">What-If GPA Scenario</Heading>
            <div className="section-actions">
              <Button onClick={startWhatIfScenario} disabled={coursesWithGrades.length === 0}>
                Copy Current Grades
              </Button>
              {whatIfActive && (
                <Button onClick={resetWhatIfScenario} color="secondary">
                  Clear Scenario
                </Button>
              )}
            </div>
          </div>

          {whatIfActive ? (
            <>
              <View as="div" margin="small 0 medium 0" className="gpa-summary">
                <Text><strong>Unweighted GPA:</strong> {whatIfGPA.unweighted}</Text>
                <Text><strong>Weighted GPA:</strong> {whatIfGPA.weighted}</Text>
              </View>
              <View as="div" className="course-type-hint">
                <Text size="small" color="secondary">
                  Adjust course types or grades below to see how weighted and unweighted GPAs shift.
                </Text>
              </View>

              {whatIfTermLabels.length > 0 && (
                <div className="what-if-term-grades">
                  {whatIfTermLabels.map((label) => {
                    const inputId = `whatif-term-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
                    return (
                      <div key={label} className="input-container">
                        <label htmlFor={inputId}><Text>{label} Term Grade</Text></label>
                        <input
                          id={inputId}
                          type="text"
                          value={whatIfTermGrades[label] ?? ""}
                          onChange={(e) => handleWhatIfTermGradeChange(label, e.target.value)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <Table caption="What-If Courses" margin="medium 0 0 0">
                <Table.Head>
                  <Table.Row>
                    <Table.ColHeader id="whatif-term">Term</Table.ColHeader>
                    <Table.ColHeader id="whatif-course">Course</Table.ColHeader>
                    <Table.ColHeader id="whatif-credits">Credits</Table.ColHeader>
                    <Table.ColHeader id="whatif-type">Course Type</Table.ColHeader>
                    <Table.ColHeader id="whatif-grade">Grade</Table.ColHeader>
                    <Table.ColHeader id="whatif-actions">Actions</Table.ColHeader>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {whatIfCourses.map((course) => (
                    <Table.Row key={course.id}>
                      <Table.Cell>
                        <input
                          className="table-input"
                          type="text"
                          value={course.termLabel}
                          onChange={(e) => handleWhatIfCourseChange(course.id, "termLabel", e.target.value)}
                        />
                      </Table.Cell>
                      <Table.Cell>
                        <input
                          className="table-input"
                          type="text"
                          value={course.courseName}
                          onChange={(e) => handleWhatIfCourseChange(course.id, "courseName", e.target.value)}
                        />
                      </Table.Cell>
                      <Table.Cell>
                        <input
                          className="table-input"
                          type="number"
                          value={course.credits}
                          onChange={(e) => handleWhatIfCourseChange(course.id, "credits", Number(e.target.value))}
                        />
                      </Table.Cell>
                      <Table.Cell>
                        <select
                          className="table-input"
                          value={course.courseType}
                          onChange={(e) => handleWhatIfCourseChange(course.id, "courseType", e.target.value)}
                        >
                          {COURSE_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                      </Table.Cell>
                      <Table.Cell>
                        <input
                          className="table-input"
                          type="text"
                          value={course.grade}
                          onChange={(e) => handleWhatIfCourseChange(course.id, "grade", e.target.value)}
                        />
                      </Table.Cell>
                      <Table.Cell>
                        <Button onClick={() => handleWhatIfCourseDelete(course.id)} size="small" color="danger">
                          Remove
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </>
          ) : (
            <Text>
              Copy your current grades into a sandbox scenario to experiment with grade changes and instantly see updated weighted and unweighted GPAs.
            </Text>
          )}
        </View>
      </View>
    </div>
  );
}
