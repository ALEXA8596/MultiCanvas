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
  GpaProfile,
  getTerms,
  addTerm,
  deleteTerm,
  getAllTermCourses,
  addTermCourse,
  updateTermCourse,
  deleteTermCourse,
  getGpaProfiles,
  addGpaProfile,
  updateGpaProfile,
  deleteGpaProfile,
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
  "A+": 4.0, "A": 4.0, "A-": 3.7,
  "B+": 3.3, "B": 3.0, "B-": 2.7,
  "C+": 2.3, "C": 2.0, "C-": 1.7,
  "D+": 1.3, "D": 1.0, "D-": 0.7,
  "F": 0.0,
};

const COURSE_TYPES = [
  { value: "regular", label: "Regular" },
  { value: "academic", label: "Academic" },
  { value: "accelerated", label: "Accelerated" },
  { value: "honors", label: "Honors" },
  { value: "ap", label: "AP" },
  { value: "ib", label: "IB" },
  { value: "dual-enrollment", label: "Dual Enrollment" },
  { value: "concurrent-enrollment", label: "Concurrent Enrollment" },
];

const DEFAULT_WEIGHTS = {
  regular: 0, academic: 0, accelerated: 0, honors: 0,
  ap: 0, ib: 0, dualEnrollment: 0, concurrentEnrollment: 0,
};

// Built-in GPA profile presets
const GPA_PRESETS: Record<string, Omit<GpaProfile, 'id' | 'createdAt'>> = {
  unweighted: {
    name: "Unweighted GPA",
    description: "Standard 4.0 scale GPA with no bonus points for advanced courses",
    includedGradeLevels: [9, 10, 11, 12],
    weights: {
      regular: 0, academic: 0, accelerated: 0, honors: 0,
      ap: 0, ib: 0, dualEnrollment: 0, concurrentEnrollment: 0,
    },
    caps: { perGradeLevel: {}, total: null },
  },
  weighted: {
    name: "Weighted GPA",
    description: "Weighted GPA with +1.0 for Honors/AP/IB/Dual Enrollment courses",
    includedGradeLevels: [9, 10, 11, 12],
    weights: {
      regular: 0, academic: 0, accelerated: 0, honors: 1,
      ap: 1, ib: 1, dualEnrollment: 1, concurrentEnrollment: 1,
    },
    caps: { perGradeLevel: {}, total: null },
  },
  "10-11-weighted": {
    name: "10-11 Weighted GPA",
    description: "Weighted GPA counting only 10th and 11th grade courses",
    includedGradeLevels: [10, 11],
    weights: {
      regular: 0, academic: 0, accelerated: 0, honors: 1,
      ap: 1, ib: 1, dualEnrollment: 1, concurrentEnrollment: 1,
    },
    caps: { perGradeLevel: {}, total: null },
  },
  "uc-capped": {
    name: "UC Capped GPA",
    description: "UC system GPA: 10th-11th grade only, max 4 honors points in 10th, 8 total",
    includedGradeLevels: [10, 11],
    weights: {
      regular: 0, academic: 0, accelerated: 0, honors: 1,
      ap: 1, ib: 1, dualEnrollment: 1, concurrentEnrollment: 1,
    },
    caps: { perGradeLevel: { "10": 4 }, total: 8 },
  },
};

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
  if (!Number.isFinite(value) || value < 6 || value > 14) return null;
  return value;
}

export default function GradesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [coursesWithGrades, setCoursesWithGrades] = useState<CourseWithGrade[]>([]);
  const courseSettings = useCourseSettingsMap();
  const [terms, setTerms] = useState<Term[]>([]);
  const [termCourses, setTermCourses] = useState<TermCourse[]>([]);
  const [gpaProfiles, setGpaProfiles] = useState<GpaProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'current' | 'manual' | 'calculator'>('current');
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [editingProfile, setEditingProfile] = useState<GpaProfile | null>(null);

  // Term form state
  const [termYear, setTermYear] = useState(new Date().getFullYear());
  const [termSeason, setTermSeason] = useState("Fall");
  const [termGradeLevel, setTermGradeLevel] = useState("");

  // Course form state
  const [editingCourse, setEditingCourse] = useState<TermCourse | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);
  const [formCourseName, setFormCourseName] = useState("");
  const [formCredits, setFormCredits] = useState(5);
  const [formGrade, setFormGrade] = useState("A");
  const [formCourseType, setFormCourseType] = useState("regular");

  // Profile editor state
  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [profileGradeLevels, setProfileGradeLevels] = useState<number[]>([9, 10, 11, 12]);
  const [profileWeights, setProfileWeights] = useState({ ...DEFAULT_WEIGHTS });
  const [profileCaps, setProfileCaps] = useState<{ perGradeLevel: Record<string, number | null>; total: number | null }>({
    perGradeLevel: {}, total: null
  });

  useEffect(() => {
    const saved = localStorage.getItem("accounts");
    if (saved) {
      try { setAccounts(JSON.parse(saved)); } catch { /* ignore */ }
    }
    loadData();
  }, []);

  async function loadData() {
    const [termsData, coursesData, profilesData] = await Promise.all([
      getTerms(), getAllTermCourses(), getGpaProfiles()
    ]);
    
    const seasonOrder: Record<string, number> = { Fall: 3, Summer: 2, Spring: 1, Winter: 0 };
    setTerms(termsData.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return (seasonOrder[b.season] ?? -1) - (seasonOrder[a.season] ?? -1);
    }));
    setTermCourses(coursesData);
    setGpaProfiles(profilesData);
    
    if (profilesData.length > 0 && !selectedProfileId) {
      setSelectedProfileId(profilesData[0].id ?? null);
    }
  }

  useEffect(() => {
    if (accounts.length === 0) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    
    Promise.all([fetchAllCourses(accounts), ...accounts.map(fetchUserEnrollments)])
      .then((results) => {
        if (cancelled) return;
        const courseResults = results[0] as { account: Account; courses: CanvasCourse[] }[];
        const enrollmentResults = results.slice(1) as Enrollment[][];
        const allCourses = courseResults.flatMap(({ account, courses }) =>
          courses.map((course) => ({ account, course }))
        );
        const allEnrollments = enrollmentResults.flatMap((enrollments, index) =>
          enrollments.map(e => ({ ...e, account: accounts[index] }))
        );
        const merged: CourseWithGrade[] = [];
        allEnrollments.forEach((enrollment) => {
          if (enrollment.type === 'StudentEnrollment') {
            const courseInfo = allCourses.find(
              (c) => c.course.id === enrollment.course_id && c.account.id === enrollment.account.id
            );
            if (courseInfo) {
              merged.push({ course: courseInfo.course, enrollment, account: courseInfo.account });
            }
          }
        });
        setCoursesWithGrades(merged);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [accounts]);

  const manualCoursesWithTerm = useMemo<ManualCourseWithTerm[]>(() => {
    return termCourses.map((course) => {
      const term = terms.find((t) => t.id === course.termId);
      return {
        ...course,
        term,
        termLabel: term ? `${term.season} ${term.year}` : "Unknown",
        gradeLevel: term ? extractGradeLevel(term.termGrade) : null,
      };
    });
  }, [termCourses, terms]);

  const selectedProfile = gpaProfiles.find(p => p.id === selectedProfileId) || null;

  const calculateGPA = useMemo(() => {
    if (!selectedProfile) return { gpa: "N/A", credits: 0, basePoints: 0, extraPoints: 0 };
    
    const { includedGradeLevels, weights, caps } = selectedProfile;
    let totalCredits = 0;
    let basePoints = 0;
    let extraPoints = 0;
    let extraUsedTotal = 0;
    const extraUsedByGrade: Record<number, number> = {};

    const totalCapValue = caps.total ?? Infinity;

    manualCoursesWithTerm.forEach((course) => {
      if (course.gradeLevel && !includedGradeLevels.includes(course.gradeLevel)) return;
      
      const normalizedGrade = (course.grade || "").trim().toUpperCase();
      const base = GRADE_POINT_MAP[normalizedGrade];
      if (base === undefined) return;
      
      const credits = Number(course.credits) || 0;
      if (credits <= 0) return;

      totalCredits += credits;
      basePoints += base * credits;

      // Calculate weight bonus
      const courseType = course.courseType ?? "regular";
      const weightKey = courseType.replace(/-/g, '') as keyof typeof weights;
      const mappedKey = courseType === 'dual-enrollment' ? 'dualEnrollment' 
        : courseType === 'concurrent-enrollment' ? 'concurrentEnrollment' 
        : weightKey;
      const extraPerCredit = weights[mappedKey as keyof typeof weights] ?? 0;
      const candidate = extraPerCredit * credits;
      if (candidate <= 0) return;

      const availableTotal = totalCapValue - extraUsedTotal;
      if (availableTotal <= 0) return;

      let availableForGrade = Infinity;
      if (course.gradeLevel) {
        const gradeCap = caps.perGradeLevel[course.gradeLevel.toString()];
        if (gradeCap !== null && gradeCap !== undefined) {
          const alreadyUsed = extraUsedByGrade[course.gradeLevel] ?? 0;
          availableForGrade = gradeCap - alreadyUsed;
          if (availableForGrade <= 0) return;
        }
      }

      const applied = Math.min(candidate, availableTotal, availableForGrade);
      extraPoints += applied;
      extraUsedTotal += applied;
      if (course.gradeLevel) {
        extraUsedByGrade[course.gradeLevel] = (extraUsedByGrade[course.gradeLevel] ?? 0) + applied;
      }
    });

    if (totalCredits === 0) return { gpa: "N/A", credits: 0, basePoints: 0, extraPoints: 0 };
    
    return {
      gpa: ((basePoints + extraPoints) / totalCredits).toFixed(3),
      credits: totalCredits,
      basePoints: Number((basePoints / totalCredits).toFixed(3)),
      extraPoints: Number(extraPoints.toFixed(2)),
    };
  }, [selectedProfile, manualCoursesWithTerm]);

  // Handlers
  const handleAddTerm = async () => {
    if (!termGradeLevel.trim()) {
      alert("Please enter a grade level (e.g., 9th, 10th).");
      return;
    }
    await addTerm({ year: termYear, season: termSeason, termGrade: termGradeLevel.trim() });
    await loadData();
    setTermGradeLevel("");
  };

  const handleDeleteTerm = async (id: number) => {
    if (confirm("Delete this term and all its courses?")) {
      await deleteTerm(id);
      await loadData();
    }
  };

  const handleSaveCourse = async () => {
    if (!selectedTermId || !formCourseName.trim()) return;
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
    setFormCourseName("");
    setFormCredits(5);
    setFormGrade("A");
    setFormCourseType("regular");
    await loadData();
  };

  const handleEditCourse = (course: TermCourse) => {
    setEditingCourse(course);
    setSelectedTermId(course.termId);
    setFormCourseName(course.courseName);
    setFormCredits(course.credits);
    setFormGrade(course.grade?.toUpperCase() ?? "");
    setFormCourseType(course.courseType ?? "regular");
  };

  const handleSyncCourse = async (cg: CourseWithGrade) => {
    if (!selectedTermId) {
      alert("Please select a term first.");
      return;
    }
    const grade = cg.enrollment.grades.current_grade ?? cg.enrollment.grades.final_grade ?? "";
    await addTermCourse({
      termId: selectedTermId,
      courseName: cg.course.name,
      credits: 5,
      grade: grade.trim().toUpperCase(),
      courseType: "regular",
    });
    await loadData();
  };

  const openProfileEditor = (profile?: GpaProfile) => {
    if (profile) {
      setEditingProfile(profile);
      setProfileName(profile.name);
      setProfileDescription(profile.description ?? "");
      setProfileGradeLevels([...profile.includedGradeLevels]);
      setProfileWeights({ ...profile.weights });
      setProfileCaps({ ...profile.caps });
    } else {
      setEditingProfile(null);
      setProfileName("");
      setProfileDescription("");
      setProfileGradeLevels([9, 10, 11, 12]);
      setProfileWeights({ ...DEFAULT_WEIGHTS });
      setProfileCaps({ perGradeLevel: {}, total: null });
    }
    setShowProfileEditor(true);
  };

  const loadPreset = (presetKey: string) => {
    const preset = GPA_PRESETS[presetKey];
    if (!preset) return;
    setProfileName(preset.name);
    setProfileDescription(preset.description ?? "");
    setProfileGradeLevels([...preset.includedGradeLevels]);
    setProfileWeights({ ...preset.weights });
    setProfileCaps({ perGradeLevel: { ...preset.caps.perGradeLevel }, total: preset.caps.total });
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      alert("Please enter a profile name.");
      return;
    }
    const profile: GpaProfile = {
      id: editingProfile?.id,
      name: profileName.trim(),
      description: profileDescription.trim(),
      includedGradeLevels: profileGradeLevels,
      weights: profileWeights,
      caps: profileCaps,
    };
    if (editingProfile?.id) {
      await updateGpaProfile(profile);
    } else {
      const newId = await addGpaProfile(profile);
      setSelectedProfileId(newId);
    }
    setShowProfileEditor(false);
    await loadData();
  };

  const handleDeleteProfile = async (id: number) => {
    if (confirm("Delete this GPA profile?")) {
      await deleteGpaProfile(id);
      if (selectedProfileId === id) setSelectedProfileId(null);
      await loadData();
    }
  };

  const toggleGradeLevel = (level: number) => {
    setProfileGradeLevels(prev => 
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level].sort()
    );
  };

  return (
    <div className="grades-container fade-in">
      <div className="grades-header">
        <Heading level="h2" margin="0">Grades</Heading>
      </div>

      {/* Tab Navigation */}
      <div className="grades-tabs">
        <button 
          className={`tab-button ${activeTab === 'current' ? 'active' : ''}`}
          onClick={() => setActiveTab('current')}
        >
          Current Grades
        </button>
        <button 
          className={`tab-button ${activeTab === 'manual' ? 'active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          Manual Entry
        </button>
        <button 
          className={`tab-button ${activeTab === 'calculator' ? 'active' : ''}`}
          onClick={() => setActiveTab('calculator')}
        >
          GPA Calculator
        </button>
      </div>

      {/* Current Grades Tab */}
      {activeTab === 'current' && (
        <div className="tab-content">
          {loading && <Text>Loading grades...</Text>}
          {error && <Text color="danger">Error: {error}</Text>}
          
          {!loading && !error && coursesWithGrades.length === 0 && (
            <View as="div" textAlign="center" padding="large" className="empty-state">
              <Heading level="h3" margin="0 0 small 0">No Grades Available</Heading>
              <Text>No active student enrollments found, or grades are not yet available.</Text>
            </View>
          )}

          {!loading && !error && coursesWithGrades.length > 0 && (
            <>
              <div className="sync-controls">
                <label>Sync to term:</label>
                <select 
                  value={selectedTermId ?? ''} 
                  onChange={(e) => setSelectedTermId(Number(e.target.value) || null)}
                >
                  <option value="">Select a term...</option>
                  {terms.map(t => (
                    <option key={t.id} value={t.id}>{t.season} {t.year} ({t.termGrade})</option>
                  ))}
                </select>
              </div>
              
              <Table caption="Current Course Grades">
                <Table.Head>
                  <Table.Row>
                    <Table.ColHeader id="course">Course</Table.ColHeader>
                    <Table.ColHeader id="score">Score</Table.ColHeader>
                    <Table.ColHeader id="grade">Grade</Table.ColHeader>
                    <Table.ColHeader id="actions">Actions</Table.ColHeader>
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
                          <Link href={`/${account.domain}/${course.id}`}>{displayName}</Link>
                          {subtitle && <><br /><Text size="x-small" color="secondary">{subtitle}</Text></>}
                          <br /><Text size="small" color="secondary">{account.domain}</Text>
                        </Table.Cell>
                        <Table.Cell>{enrollment.grades.current_score ?? enrollment.grades.final_score ?? 'N/A'}</Table.Cell>
                        <Table.Cell>{enrollment.grades.current_grade ?? enrollment.grades.final_grade ?? 'N/A'}</Table.Cell>
                        <Table.Cell>
                          <div className="action-buttons">
                            <Link href={`/${account.domain}/${course.id}/grades`}>What-If</Link>
                            <Button size="small" onClick={() => handleSyncCourse({ course, enrollment, account })} disabled={!selectedTermId}>
                              Sync
                            </Button>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table>
            </>
          )}
        </div>
      )}

      {/* Manual Entry Tab */}
      {activeTab === 'manual' && (
        <div className="tab-content">
          {/* Add Term Section */}
          <div className="section-card">
            <h3>Add Term</h3>
            <div className="form-row compact">
              <div className="input-group">
                <label>Year</label>
                <input type="number" value={termYear} onChange={(e) => setTermYear(Number(e.target.value))} />
              </div>
              <div className="input-group">
                <label>Season</label>
                <select value={termSeason} onChange={(e) => setTermSeason(e.target.value)}>
                  <option>Fall</option>
                  <option>Spring</option>
                  <option>Summer</option>
                  <option>Winter</option>
                </select>
              </div>
              <div className="input-group">
                <label>Grade Level</label>
                <input 
                  type="text" 
                  placeholder="e.g., 10th" 
                  value={termGradeLevel} 
                  onChange={(e) => setTermGradeLevel(e.target.value)} 
                />
              </div>
              <button className="btn-primary" onClick={handleAddTerm}>Add Term</button>
            </div>
          </div>

          {/* Add/Edit Course Section */}
          <div className="section-card">
            <h3>{editingCourse ? 'Edit Course' : 'Add Course'}</h3>
            <div className="form-grid compact">
              <div className="input-group">
                <label>Term</label>
                <select 
                  value={selectedTermId ?? ''} 
                  onChange={(e) => setSelectedTermId(Number(e.target.value) || null)}
                >
                  <option value="">Select term...</option>
                  {terms.map(t => <option key={t.id} value={t.id}>{t.season} {t.year}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Course Name</label>
                <input type="text" value={formCourseName} onChange={(e) => setFormCourseName(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Credits</label>
                <input type="number" value={formCredits} onChange={(e) => setFormCredits(Number(e.target.value))} />
              </div>
              <div className="input-group">
                <label>Course Type</label>
                <select value={formCourseType} onChange={(e) => setFormCourseType(e.target.value)}>
                  {COURSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Grade</label>
                <input type="text" value={formGrade} onChange={(e) => setFormGrade(e.target.value.toUpperCase())} placeholder="A, B+, etc." />
              </div>
            </div>
            <div className="button-row">
              <button className="btn-primary" onClick={handleSaveCourse} disabled={!selectedTermId}>
                {editingCourse ? 'Update' : 'Add'} Course
              </button>
              {editingCourse && (
                <button className="btn-secondary" onClick={() => { setEditingCourse(null); setFormCourseName(""); }}>
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Terms and Courses List */}
          {terms.map(term => (
            <div key={term.id} className="section-card term-card">
              <div className="term-header">
                <h4>{term.season} {term.year} <span className="grade-badge">{term.termGrade}</span></h4>
                <button className="btn-danger btn-sm" onClick={() => handleDeleteTerm(term.id!)}>Delete</button>
              </div>
              
              {termCourses.filter(c => c.termId === term.id).length > 0 ? (
                <table className="simple-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Type</th>
                      <th>Credits</th>
                      <th>Grade</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {termCourses.filter(c => c.termId === term.id).map(course => (
                      <tr key={course.id}>
                        <td>{course.courseName}</td>
                        <td>{COURSE_TYPES.find(t => t.value === course.courseType)?.label ?? 'Regular'}</td>
                        <td>{course.credits}</td>
                        <td>{course.grade}</td>
                        <td>
                          <button className="btn-link" onClick={() => handleEditCourse(course)}>Edit</button>
                          <button className="btn-link danger" onClick={() => deleteTermCourse(course.id!).then(loadData)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Text size="small" color="secondary">No courses in this term yet.</Text>
              )}
            </div>
          ))}
          
          {terms.length === 0 && (
            <div className="empty-state">
              <Text>Add a term above to start entering your courses.</Text>
            </div>
          )}
        </div>
      )}

      {/* GPA Calculator Tab */}
      {activeTab === 'calculator' && (
        <div className="tab-content">
          {/* Profile Selector */}
          <div className="section-card calculator-header">
            <div className="profile-selector">
              <label>GPA Profile:</label>
              <select 
                value={selectedProfileId ?? ''} 
                onChange={(e) => setSelectedProfileId(Number(e.target.value) || null)}
              >
                <option value="">Select a profile...</option>
                {gpaProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn-primary" onClick={() => openProfileEditor()}>New Profile</button>
              {selectedProfile && (
                <>
                  <button className="btn-secondary" onClick={() => openProfileEditor(selectedProfile)}>Edit</button>
                  <button className="btn-danger" onClick={() => handleDeleteProfile(selectedProfile.id!)}>Delete</button>
                </>
              )}
            </div>

            {selectedProfile && (
              <div className="gpa-display">
                <div className="gpa-main">
                  <span className="gpa-label">Calculated GPA</span>
                  <span className="gpa-value">{calculateGPA.gpa}</span>
                </div>
                <div className="gpa-details">
                  <div><span>Credits:</span> {calculateGPA.credits}</div>
                  <div><span>Base GPA:</span> {calculateGPA.basePoints}</div>
                  <div><span>Bonus Points:</span> {calculateGPA.extraPoints}</div>
                </div>
              </div>
            )}
          </div>

          {selectedProfile && (
            <div className="section-card">
              <h4>Profile Settings</h4>
              <Text size="small" color="secondary">{selectedProfile.description || 'No description'}</Text>
              
              <div className="profile-summary">
                <div className="summary-item">
                  <strong>Grade Levels:</strong> {selectedProfile.includedGradeLevels.join(', ') || 'All'}
                </div>
                <div className="summary-item">
                  <strong>Weights:</strong>
                  <ul className="weight-list">
                    {Object.entries(selectedProfile.weights).filter(([, v]) => v > 0).map(([k, v]) => (
                      <li key={k}>{k.replace(/([A-Z])/g, ' $1').trim()}: +{v}</li>
                    ))}
                    {Object.values(selectedProfile.weights).every(v => v === 0) && <li>None (Unweighted)</li>}
                  </ul>
                </div>
                {selectedProfile.caps.total !== null && (
                  <div className="summary-item"><strong>Total Cap:</strong> {selectedProfile.caps.total} points</div>
                )}
              </div>

              <h4 style={{ marginTop: '1.5rem' }}>Included Courses</h4>
              {manualCoursesWithTerm.filter(c => 
                !c.gradeLevel || selectedProfile.includedGradeLevels.includes(c.gradeLevel)
              ).length > 0 ? (
                <table className="simple-table">
                  <thead>
                    <tr>
                      <th>Term</th>
                      <th>Grade</th>
                      <th>Course</th>
                      <th>Type</th>
                      <th>Credits</th>
                      <th>Letter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualCoursesWithTerm
                      .filter(c => !c.gradeLevel || selectedProfile.includedGradeLevels.includes(c.gradeLevel))
                      .map(c => (
                        <tr key={c.id}>
                          <td>{c.termLabel}</td>
                          <td>{c.term?.termGrade ?? 'N/A'}</td>
                          <td>{c.courseName}</td>
                          <td>{COURSE_TYPES.find(t => t.value === c.courseType)?.label ?? 'Regular'}</td>
                          <td>{c.credits}</td>
                          <td>{c.grade}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <Text>No courses match the selected grade levels. Add courses in the Manual Entry tab.</Text>
                </div>
              )}
            </div>
          )}

          {!selectedProfile && gpaProfiles.length === 0 && (
            <div className="empty-state">
              <Heading level="h3">Create Your First GPA Profile</Heading>
              <Text>Click "New Profile" to set up a custom GPA calculation with your preferred weights and grade levels.</Text>
            </div>
          )}
        </div>
      )}

      {/* Profile Editor Modal */}
      {showProfileEditor && (
        <div className="modal-overlay" onClick={() => setShowProfileEditor(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingProfile ? 'Edit' : 'Create'} GPA Profile</h2>
            
            {!editingProfile && (
              <div className="input-group">
                <label>Start from Preset</label>
                <select onChange={(e) => e.target.value && loadPreset(e.target.value)} defaultValue="">
                  <option value="">-- Select a preset (optional) --</option>
                  <option value="unweighted">Unweighted GPA</option>
                  <option value="weighted">Weighted GPA</option>
                  <option value="10-11-weighted">10-11 Weighted GPA</option>
                  <option value="uc-capped">UC Capped GPA</option>
                </select>
              </div>
            )}

            <div className="input-group">
              <label>Profile Name *</label>
              <input 
                type="text" 
                value={profileName} 
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="e.g., UC Capped GPA"
              />
            </div>
            
            <div className="input-group">
              <label>Description</label>
              <input 
                type="text" 
                value={profileDescription} 
                onChange={(e) => setProfileDescription(e.target.value)}
                placeholder="e.g., UC system weighted GPA with 8-point cap"
              />
            </div>

            <div className="input-group">
              <label>Include Grade Levels</label>
              <div className="checkbox-group">
                {[9, 10, 11, 12].map(level => (
                  <label key={level} className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={profileGradeLevels.includes(level)}
                      onChange={() => toggleGradeLevel(level)}
                    />
                    {level}th
                  </label>
                ))}
              </div>
            </div>

            <h3>Course Type Weights</h3>
            <Text size="small" color="secondary">Additional points added per credit for each course type</Text>
            <div className="weights-grid">
              {[
                { key: 'accelerated', label: 'Accelerated' },
                { key: 'honors', label: 'Honors' },
                { key: 'ap', label: 'AP' },
                { key: 'ib', label: 'IB' },
                { key: 'dualEnrollment', label: 'Dual Enrollment' },
                { key: 'concurrentEnrollment', label: 'Concurrent Enrollment' },
              ].map(({ key, label }) => (
                <div key={key} className="input-group compact">
                  <label>{label}</label>
                  <input 
                    type="number" 
                    step="0.5" 
                    min="0" 
                    max="2"
                    value={profileWeights[key as keyof typeof profileWeights]}
                    onChange={(e) => setProfileWeights(prev => ({ 
                      ...prev, 
                      [key]: Number(e.target.value) || 0 
                    }))}
                  />
                </div>
              ))}
            </div>

            <h3>Bonus Point Caps</h3>
            <Text size="small" color="secondary">Leave blank for no limit</Text>
            <div className="caps-grid">
              {[9, 10, 11, 12].map(level => (
                <div key={level} className="input-group compact">
                  <label>Grade {level} Cap</label>
                  <input 
                    type="number" 
                    min="0"
                    placeholder="Unlimited"
                    value={profileCaps.perGradeLevel[level.toString()] ?? ''}
                    onChange={(e) => setProfileCaps(prev => ({
                      ...prev,
                      perGradeLevel: {
                        ...prev.perGradeLevel,
                        [level.toString()]: e.target.value ? Number(e.target.value) : null
                      }
                    }))}
                  />
                </div>
              ))}
              <div className="input-group compact">
                <label>Total Cap</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder="Unlimited"
                  value={profileCaps.total ?? ''}
                  onChange={(e) => setProfileCaps(prev => ({
                    ...prev,
                    total: e.target.value ? Number(e.target.value) : null
                  }))}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowProfileEditor(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveProfile}>Save Profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
