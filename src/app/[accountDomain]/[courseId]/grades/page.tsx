"use client";
import { useEffect, useState, useMemo } from "react";
import {
  Account,
  Assignment,
  fetchAssignmentGroups,
  fetchCourse,
  getWhatIfGrades,
  Submission,
  fetchSelfSubmission,
  CanvasCourse,
  AssignmentGroup,
} from "@/components/canvasApi";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Table } from "@instructure/ui-table";
import { TextInput } from "@instructure/ui-text-input";
import { Button } from "@instructure/ui-buttons";
import { Checkbox } from "@instructure/ui-checkbox";
import { useParams } from "next/navigation";
import { getCourseSettingId } from "@/lib/db";
import { getCourseDisplay } from "@/lib/courseDisplay";
import { useCourseSettingsMap } from "@/hooks/useCourseSettingsMap";
import "@/app/stylesheets/course-grades.css";

type AssignmentWithSubmission = Assignment & { submission?: Submission | null };

export default function CourseGradesPage() {
  const params = useParams();
  const { accountDomain, courseId } = params;

  const [account, setAccount] = useState<Account | null>(null);
  const [course, setCourse] = useState<CanvasCourse | null>(null);
  const [assignmentGroups, setAssignmentGroups] = useState<
    (AssignmentGroup & { assignments: AssignmentWithSubmission[] })[]
  >([]);
  const [whatIfScores, setWhatIfScores] = useState<{ [key: number]: string }>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyGraded, setOnlyGraded] = useState(true);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const courseSettings = useCourseSettingsMap();

  useEffect(() => {
    const savedAccounts = localStorage.getItem("accounts");
    if (savedAccounts) {
      const accounts = JSON.parse(savedAccounts) as Account[];
      const currentAccount = accounts.find((a) => a.domain === accountDomain);
      if (currentAccount) {
        setAccount(currentAccount);
      } else {
        setError("Account not found");
        setLoading(false);
      }
    } else {
      setError("No accounts configured");
      setLoading(false);
    }
  }, [accountDomain]);

  useEffect(() => {
    if (!account || !courseId) return;
    const currentAccount = account;
    const currentCourseId = Number(courseId);

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const courseData = await fetchCourse(currentAccount, currentCourseId);
        setCourse(courseData);

        const groups = await fetchAssignmentGroups(currentAccount, currentCourseId);
        const assignmentsWithSubmissions = await Promise.all(
          groups.map(
            async (
              group
            ): Promise<AssignmentGroup & { assignments: AssignmentWithSubmission[] }> => {
              const assignments: AssignmentWithSubmission[] = await Promise.all(
                (group.assignments || []).map(
                  async (assignment): Promise<AssignmentWithSubmission> => {
                    const submission = await fetchSelfSubmission(
                      currentAccount,
                      currentCourseId,
                      assignment.id
                    );
                    return { ...assignment, submission };
                  }
                )
              );
              return { ...group, assignments };
            }
          )
        );
        setAssignmentGroups(assignmentsWithSubmissions);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [account, courseId]);

  const handleWhatIfChange = (assignmentId: number, value: string) => {
    setWhatIfScores((prev) => ({ ...prev, [assignmentId]: value }));
  };

  const applyWhatIfScores = async () => {
    if (!account || !courseId) return;
    const currentAccount = account;
    const currentCourseId = Number(courseId);
    setLoading(true);
    try {
      for (const assignmentId in whatIfScores) {
        const score = parseFloat(whatIfScores[assignmentId]);
        if (!isNaN(score)) {
          await getWhatIfGrades(
            currentAccount,
            currentCourseId,
            Number(assignmentId),
            score
          );
        }
      }
      // Refetch data to show updated grades
      const groups = await fetchAssignmentGroups(currentAccount, currentCourseId);
      const assignmentsWithSubmissions = await Promise.all(
        groups.map(
          async (
            group
          ): Promise<AssignmentGroup & { assignments: AssignmentWithSubmission[] }> => {
            const assignments: AssignmentWithSubmission[] = await Promise.all(
              (group.assignments || []).map(
                async (assignment): Promise<AssignmentWithSubmission> => {
                  const submission = await fetchSelfSubmission(
                    currentAccount,
                    currentCourseId,
                    assignment.id
                  );
                  return { ...assignment, submission };
                }
              )
            );
            return { ...group, assignments };
          }
        )
      );
      setAssignmentGroups(assignmentsWithSubmissions);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // Calculate group totals and weights
  const groupStats = useMemo(() => {
    const totalWeight = assignmentGroups.reduce((sum, g) => sum + (g.group_weight || 0), 0);
    
    return assignmentGroups.map((group) => {
      let earnedPoints = 0;
      let possiblePoints = 0;
      
      group.assignments.forEach((assignment: AssignmentWithSubmission) => {
        const score = showWhatIf && whatIfScores[assignment.id] !== undefined && whatIfScores[assignment.id] !== ""
          ? parseFloat(whatIfScores[assignment.id])
          : assignment.submission?.score;
        const possible = assignment.points_possible || 0;
        
        if (score !== null && score !== undefined && !isNaN(Number(score))) {
          if (!onlyGraded || assignment.submission?.score !== null) {
            earnedPoints += Number(score);
            possiblePoints += possible;
          }
        } else if (!onlyGraded) {
          possiblePoints += possible;
        }
      });

      const percentage = possiblePoints > 0 ? (earnedPoints / possiblePoints) * 100 : 0;
      const weight = group.group_weight || 0;
      const normalizedWeight = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
      
      return {
        name: group.name,
        earned: earnedPoints,
        possible: possiblePoints,
        percentage,
        weight,
        normalizedWeight,
      };
    });
  }, [assignmentGroups, whatIfScores, onlyGraded, showWhatIf]);

  // Calculate total grade
  const totalGrade = useMemo(() => {
    const totalWeight = groupStats.reduce((sum, g) => sum + g.weight, 0);
    
    if (totalWeight === 0) {
      // If no weights, calculate simple average
      let totalEarned = 0;
      let totalPossible = 0;
      groupStats.forEach((g) => {
        totalEarned += g.earned;
        totalPossible += g.possible;
      });
      return totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;
    }
    
    // Weighted calculation
    let weightedSum = 0;
    let usedWeight = 0;
    
    groupStats.forEach((g) => {
      if (g.possible > 0) {
        weightedSum += g.percentage * g.weight;
        usedWeight += g.weight;
      }
    });
    
    return usedWeight > 0 ? weightedSum / usedWeight : 0;
  }, [groupStats]);

  const courseDisplay =
    account && course
      ? getCourseDisplay({
          actualName: course.name,
          nickname:
            courseSettings[getCourseSettingId(account.domain, course.id)]?.nickname,
          fallback: course.name,
        })
      : null;

  if (loading) {
    return <Text>Loading course grades...</Text>;
  }

  if (error) {
    return <Text color="danger">Error: {error}</Text>;
  }

  const hasWeights = groupStats.some((g) => g.weight > 0);

  return (
    <div className="course-grades-page">
      <div className="grades-main-content">
        <div className="grades-header">
          <Heading level="h1" margin="0 0 medium 0">
            Grades for {courseDisplay?.displayName ?? course?.name ?? "Student"}
          </Heading>
          {courseDisplay?.subtitle && (
            <Text size="small" color="secondary" as="div" className="grades-subtitle">
              {courseDisplay.subtitle}
            </Text>
          )}
        </div>

        <Table caption="Grades Summary" hover>
          <Table.Head>
            <Table.Row>
              <Table.ColHeader id="name">Name</Table.ColHeader>
              <Table.ColHeader id="due">Due</Table.ColHeader>
              <Table.ColHeader id="status">Status</Table.ColHeader>
              <Table.ColHeader id="score" textAlign="center">Score</Table.ColHeader>
              {showWhatIf && (
                <Table.ColHeader id="whatif" textAlign="center">What-If</Table.ColHeader>
              )}
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {assignmentGroups.map((group, groupIndex) => (
              <>
                {group.assignments.map((assignment: AssignmentWithSubmission) => {
                  const hasScore = assignment.submission?.score !== null && assignment.submission?.score !== undefined;
                  const whatIfValue = whatIfScores[assignment.id] ?? "";
                  const displayScore = showWhatIf && whatIfValue !== "" 
                    ? parseFloat(whatIfValue)
                    : assignment.submission?.score;
                  
                  return (
                    <Table.Row key={assignment.id}>
                      <Table.Cell>
                        <div className="assignment-title">
                          <a href={assignment.html_url} target="_blank" rel="noopener noreferrer">
                            {assignment.name}
                          </a>
                          <div className="assignment-context">{group.name}</div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        {assignment.due_at 
                          ? new Date(assignment.due_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })
                          : "-"}
                      </Table.Cell>
                      <Table.Cell>
                        {hasScore ? (
                          <span className="status-graded">Graded</span>
                        ) : assignment.submission?.submitted_at ? (
                          <span className="status-submitted">Submitted</span>
                        ) : (
                          <span className="status-missing">-</span>
                        )}
                      </Table.Cell>
                      <Table.Cell textAlign="center">
                        <span className="score-display">
                          {displayScore !== null && displayScore !== undefined ? (
                            <>
                              <span className="score-earned">{displayScore}</span>
                              <span className="score-separator"> / </span>
                              <span className="score-possible">{assignment.points_possible ?? 0}</span>
                            </>
                          ) : (
                            <span className="score-none">- / {assignment.points_possible ?? 0}</span>
                          )}
                        </span>
                      </Table.Cell>
                      {showWhatIf && (
                        <Table.Cell textAlign="center">
                          <TextInput
                            renderLabel=""
                            size="small"
                            width="4rem"
                            value={whatIfValue}
                            onChange={(_, value) => handleWhatIfChange(assignment.id, value)}
                            placeholder={String(assignment.submission?.score ?? "")}
                          />
                        </Table.Cell>
                      )}
                    </Table.Row>
                  );
                })}
                {/* Group Total Row */}
                <Table.Row key={`group-${group.name}`}>
                  <Table.Cell colSpan={showWhatIf ? 5 : 4}>
                    <div className="group-total-row">
                      <span className="group-total-name">{group.name}</span>
                      <span className="group-total-score">
                        {groupStats[groupIndex]?.percentage.toFixed(2)}%
                        <span className="group-total-points">
                          ({groupStats[groupIndex]?.earned.toFixed(2)} / {groupStats[groupIndex]?.possible.toFixed(2)})
                        </span>
                      </span>
                    </div>
                  </Table.Cell>
                </Table.Row>
              </>
            ))}
            {/* Final Grade Row */}
            <Table.Row>
              <Table.Cell colSpan={showWhatIf ? 5 : 4}>
                <div className="final-grade-row">
                  <span className="final-grade-label">Total</span>
                  <span className="final-grade-score">{totalGrade.toFixed(2)}%</span>
                </div>
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      </div>

      <aside className="grades-sidebar">
        <div className="sidebar-section total-grade-section">
          <div className="total-grade-display">
            <span className="total-label">Total:</span>
            <span className="total-value">{totalGrade.toFixed(2)}%</span>
          </div>
        </div>

        <div className="sidebar-section">
          <Button
            onClick={() => setShowWhatIf(!showWhatIf)}
            display="block"
            margin="0 0 small 0"
          >
            {showWhatIf ? "Hide What-If Scores" : "Show What-If Scores"}
          </Button>
          
          {showWhatIf && (
            <>
              <Button
                onClick={applyWhatIfScores}
                color="primary"
                display="block"
                margin="0 0 small 0"
              >
                Apply What-If Scores
              </Button>
              <Button
                onClick={() => setWhatIfScores({})}
                display="block"
                margin="0 0 medium 0"
              >
                Clear What-If Scores
              </Button>
              <Text size="small" color="secondary" as="p" className="whatif-note">
                *NOTE*: What-If scores are for testing only and are NOT your official grade.
              </Text>
            </>
          )}
        </div>

        {hasWeights && (
          <div className="sidebar-section">
            <Heading level="h3" margin="0 0 small 0">
              Assignment Weights
            </Heading>
            <table className="weights-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {groupStats.map((group) => (
                  <tr key={group.name}>
                    <td>{group.name}</td>
                    <td>{group.normalizedWeight.toFixed(2)}%</td>
                  </tr>
                ))}
                <tr className="weights-total">
                  <td>Total</td>
                  <td>{groupStats.reduce((sum, g) => sum + g.normalizedWeight, 0).toFixed(2)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="sidebar-section">
          <Checkbox
            label="Calculate based only on graded assignments"
            checked={onlyGraded}
            onChange={() => setOnlyGraded(!onlyGraded)}
          />
        </div>

        <div className="sidebar-section">
          <Text size="small" color="secondary" as="p">
            You can view your grades based on What-If scores so that you know how grades 
            will be affected by upcoming or resubmitted assignments.
          </Text>
        </div>
      </aside>
    </div>
  );
}
