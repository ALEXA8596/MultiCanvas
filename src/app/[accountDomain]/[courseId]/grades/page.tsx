"use client";
import { useEffect, useState } from "react";
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
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { Table } from "@instructure/ui-table";
import { NumberInput } from "@instructure/ui-number-input";
import { Button } from "@instructure/ui-buttons";
import { useParams } from "next/navigation";
import { getCourseSettingId } from "@/lib/db";
import { getCourseDisplay } from "@/lib/courseDisplay";
import { useCourseSettingsMap } from "@/hooks/useCourseSettingsMap";

type AssignmentWithSubmission = Assignment & { submission?: Submission | null };

export default function CourseGradesPage() {
  const params = useParams();
  const { accountDomain, courseId } = params;

  const [account, setAccount] = useState<Account | null>(null);
  const [course, setCourse] = useState<CanvasCourse | null>(null);
  const [assignmentGroups, setAssignmentGroups] = useState<
    (AssignmentGroup & { assignments: AssignmentWithSubmission[] })[]
  >([]);
  const [whatIfScores, setWhatIfScores] = useState<{ [key: number]: number }>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [account, courseId]);

  const handleWhatIfChange = (assignmentId: number, score: number) => {
    setWhatIfScores((prev) => ({ ...prev, [assignmentId]: score }));
  };

  const applyWhatIfScores = async () => {
    if (!account || !courseId) return;
    const currentAccount = account;
    const currentCourseId = Number(courseId);
    setLoading(true);
    try {
      for (const assignmentId in whatIfScores) {
        await getWhatIfGrades(
          currentAccount,
          currentCourseId,
          Number(assignmentId),
          whatIfScores[assignmentId]
        );
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="course-grades-container fade-in">
      <Heading level="h2" margin="0 0 medium 0" className="text-gradient">
        Grades for {courseDisplay?.displayName ?? course?.name ?? "Course"}
      </Heading>
      {courseDisplay?.subtitle && (
        <Text size="small" color="secondary" style={{ marginTop: "-0.75rem", display: "block" }}>
          {courseDisplay.subtitle}
        </Text>
      )}

      <Button onClick={applyWhatIfScores} color="primary" margin="0 0 medium 0">
        Apply What-If Scores
      </Button>

      {assignmentGroups.map((group) => (
        <View as="section" key={group.name} margin="0 0 large 0">
          <Heading level="h3" margin="0 0 medium 0">
            {group.name}
          </Heading>
          <Table caption={group.name}>
            <Table.Head>
              <Table.Row>
                <Table.ColHeader id={`assignment-name-${group.name}`}>Assignment</Table.ColHeader>
                <Table.ColHeader id={`score-${group.name}`}>Score</Table.ColHeader>
                <Table.ColHeader id={`out-of-${group.name}`}>Out Of</Table.ColHeader>
                <Table.ColHeader id={`what-if-${group.name}`}>What-If Score</Table.ColHeader>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {group.assignments.map((assignment: AssignmentWithSubmission) => (
                <Table.Row key={assignment.id}>
                  <Table.Cell>{assignment.name}</Table.Cell>
                  <Table.Cell>
                    {assignment.submission?.score ?? "N/A"}
                  </Table.Cell>
                  <Table.Cell>{assignment.points_possible ?? "N/A"}</Table.Cell>
                  <Table.Cell>
                    <NumberInput
                      renderLabel=""
                      value={whatIfScores[assignment.id] || ""}
                      onChange={(_, value) =>
                        handleWhatIfChange(assignment.id, Number(value))
                      }
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </View>
      ))}
    </div>
  );
}
