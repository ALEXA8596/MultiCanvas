export type Account = {
  id: string;
  domain: string;
  apiKey: string;
};

export type CourseCalendar = {
  ics: string;
};

export type CourseEnrollment = {
  type: string; // e.g. "student", "teacher"
  role: string; // e.g. "StudentEnrollment"
  role_id: number;
  user_id: number;
  enrollment_state: string; // e.g. "active"
  limit_privileges_to_course_section: boolean;
};

export type CanvasCourse = {
  id: number;
  name: string;
  account_id: number;
  uuid: string;
  start_at: string | null;
  grading_standard_id: number | null;
  is_public: boolean;
  created_at: string;
  course_code: string;
  default_view: string; // e.g. "modules", "assignments"
  root_account_id: number;
  enrollment_term_id: number;
  license: string | null; // e.g. "private"
  grade_passback_setting: string | null; // e.g. "nightly_sync"
  end_at: string | null;
  public_syllabus: boolean;
  public_syllabus_to_auth: boolean;
  storage_quota_mb: number;
  is_public_to_auth_users: boolean;
  homeroom_course: boolean;
  course_color: string | null;
  friendly_name: string | null;
  apply_assignment_group_weights: boolean;
  calendar: CourseCalendar;
  time_zone: string | null;
  blueprint: boolean;
  template: boolean;
  enrollments: CourseEnrollment[];
  hide_final_grades: boolean;
  workflow_state: string; // e.g. "available"
  restrict_enrollments_to_course_dates: boolean;
};

export type Grades = {
  html_url: string;
  current_score: number | null;
  current_grade: string | null;
  final_score: number | null;
  final_grade: string | null;
};

export type Enrollment = {
  id: number;
  course_id: number;
  sis_course_id: string | null;
  course_integration_id: string | null;
  course_section_id: number;
  section_integration_id: string | null;
  sis_account_id: string | null;
  sis_section_id: string | null;
  sis_user_id: string | null;
  enrollment_state: string;
  limit_privileges_to_course_section: boolean;
  sis_import_id: number | null;
  root_account_id: number;
  type: string;
  user_id: number;
  associated_user_id: number | null;
  role: string;
  role_id: number;
  created_at: string;
  updated_at: string;
  start_at: string | null;
  end_at: string | null;
  last_activity_at: string | null;
  last_attended_at: string | null;
  total_activity_time: number;
  html_url: string;
  grades: Grades;
  user: {
    id: number;
    name: string;
    sortable_name: string;
    short_name: string;
  };
  override_grade: string | null;
  override_score: number | null;
  unposted_current_grade: string | null;
  unposted_final_grade: string | null;
  unposted_current_score: string | null;
  unposted_final_score: string | null;
  has_grading_periods: boolean | null;
  totals_for_all_grading_periods_option: boolean | null;
  current_grading_period_title: string | null;
  current_grading_period_id: number | null;
  current_period_override_grade: string | null;
  current_period_override_score: number | null;
  current_period_unposted_current_score: number | null;
  current_period_unposted_final_score: number | null;
  current_period_unposted_current_grade: string | null;
  current_period_unposted_final_grade: string | null;
};

export async function fetchCourses(account: Account): Promise<CanvasCourse[]> {
  const res = await canvasFetch(account, `courses?enrollment_state=active`);
  if (!res.ok) throw new Error(`Failed for ${account.domain}`);
  return res.json();
}

export async function fetchCourse(account: Account, courseId: number): Promise<CanvasCourse> {
  const path = `courses/${courseId}`;
  const res = await canvasFetch(account, path);
  if (!res.ok) throw new Error(`Failed to fetch course ${courseId} (${account.domain})`);
  return res.json();
}

export async function fetchAllCourses(accounts: Account[]) {
  return Promise.all(
    accounts.map(async (account) => ({
      account,
      courses: await fetchCourses(account),
    }))
  );
}

export async function fetchUserEnrollments(account: Account): Promise<Enrollment[]> {
  const res = await canvasFetch(account, `users/self/enrollments`);
  if (!res.ok) throw new Error(`Failed for ${account.domain}`);
  return res.json();
}

// https://xyz.instructure.com/api/v1/dashboard/dashboard_cards

export type DashboardCard = {
    longName: string;
    shortName: string;
    originalName: string;
    courseCode: string;
    assetString: string;
    href: string;
    term: string | null;
    subtitle: string;
    enrollmentState: string;
    enrollmentType: string;
    observee: unknown | null;
    id: number;
    isFavorited: boolean;
    isK5Subject: boolean;
    isHomeroom: boolean;
    useClassicFont: boolean;
    canManage: boolean;
    canReadAnnouncements: boolean;
    image: string | null;
    color: string | null;
    position: number | null;
    published: boolean;
    links: any[];
    canChangeCoursePublishState: boolean;
    defaultView: string;
    pagesUrl: string;
    frontPageTitle: string;
};
export async function fetchDashboardCards(account: Account): Promise<DashboardCard[]> {
  const res = await canvasFetch(account, "dashboard/dashboard_cards");
  if (!res.ok) throw new Error(`Failed to fetch dashboard cards for ${account.domain}`);
  return res.json();
}

// --- Announcements / Discussion Topics ---
// Partial type focusing on fields relevant to listing announcements
export type DiscussionTopic = {
  id: number;
  title: string;
  message?: string; // HTML
  posted_at?: string;
  delayed_post_at?: string | null;
  last_reply_at?: string | null;
  discussion_type?: string; // side_comment | threaded
  require_initial_post?: boolean;
  user_name?: string;
  author?: { id: number; display_name: string } | null;
  published?: boolean;
  locked?: boolean;
  lock_at?: string | null;
  unlock_at?: string | null;
  html_url?: string;
  subtype?: string | null; // for announcements, etc.
  permissions?: Record<string, boolean>;
  replies_count?: number;
};

export async function fetchCourseAnnouncements(account: Account, courseId: number): Promise<DiscussionTopic[]> {
  // Canvas docs: /api/v1/announcements?context_codes[]=course_<course_id>
  const path = `announcements?context_codes[]=course_${courseId}`;
  const res = await canvasFetch(account, path);
  if (!res.ok) throw new Error(`Failed to fetch announcements for course ${courseId} (${account.domain})`);
  return res.json();
}

export async function fetchDiscussionTopics(account: Account, courseId: number): Promise<DiscussionTopic[]> {
  const path = `courses/${courseId}/discussion_topics`;
  const res = await canvasFetch(account, path);
  if (!res.ok) throw new Error(`Failed to fetch discussions for course ${courseId} (${account.domain})`);
  return res.json();
}

export async function fetchDiscussionTopic(account: Account, courseId: number, topicId: number): Promise<DiscussionTopic> {
  const path = `courses/${courseId}/discussion_topics/${topicId}`;
  const res = await canvasFetch(account, path);
  if (!res.ok) throw new Error(`Failed to fetch discussion ${topicId} for course ${courseId} (${account.domain})`);
  return res.json();
}

/**
[
 {
   "context_type": "Course",
   "course_id": 1,
   "planner_override": { ... planner override object ... }, // Associated PlannerOverride object if user has toggled visibility for the object on the planner
   "submissions": false, // The statuses of the user's submissions for this object
   "plannable_id": "123",
   "plannable_type": "discussion_topic",
   "plannable": { ... discussion topic object },
   "html_url": "/courses/1/discussion_topics/8"
 },
 {
   "context_type": "Course",
   "course_id": 1,
   "planner_override": {
       "id": 3,
       "plannable_type": "Assignment",
       "plannable_id": 1,
       "user_id": 2,
       "workflow_state": "active",
       "marked_complete": true, // A user-defined setting for marking items complete in the planner
       "dismissed": false, // A user-defined setting for hiding items from the opportunities list
       "deleted_at": null,
       "created_at": "2017-05-18T18:35:55Z",
       "updated_at": "2017-05-18T18:35:55Z"
   },
   "submissions": { // The status as it pertains to the current user
     "excused": false,
     "graded": false,
     "late": false,
     "missing": true,
     "needs_grading": false,
     "with_feedback": false
   },
   "plannable_id": "456",
   "plannable_type": "assignment",
   "plannable": { ... assignment object ...  },
   "html_url": "http://canvas.instructure.com/courses/1/assignments/1#submit"
 },
 {
   "planner_override": null,
   "submissions": false, // false if no associated assignment exists for the plannable item
   "plannable_id": "789",
   "plannable_type": "planner_note",
   "plannable": {
     "id": 1,
     "todo_date": "2017-05-30T06:00:00Z",
     "title": "hello",
     "details": "world",
     "user_id": 2,
     "course_id": null,
     "workflow_state": "active",
     "created_at": "2017-05-30T16:29:04Z",
     "updated_at": "2017-05-30T16:29:15Z"
   },
   "html_url": "http://canvas.instructure.com/api/v1/planner_notes.1"
 }
]
 */

// ?start_date=#{last_year}&order=asc&per_page=100
// ?end_date=#{next_year}&order=desc&per_page=100
// ?start_date=#{beginning_of_week}&end_date=#{end_of_week}&per_page=100


export async function fetchPlannerItems(account: Account, urlSearchParams: string) {
  // /api/v1/planner/items
  const res = await canvasFetch(account, `planner/items${urlSearchParams}`);
  if (!res.ok) throw new Error(`Failed to fetch planner items for ${account.domain}`);
  return res.json();
}

export async function getMissingSubmissions(account: Account) {
  // /api/v1/users/self/missing_submissions?include%5B%5D=planner_overrides&filter%5B%5D=current_grading_period&filter%5B%5D=submittable&per_page=100

  const url = `/api/canvas?domain=${encodeURIComponent(account.domain)}&apiKey=${encodeURIComponent(account.apiKey)}&path=${encodeURIComponent("users/self/missing_submissions?include%5B%5D=planner_overrides&filter%5B%5D=current_grading_period&filter%5B%5D=submittable&per_page=100")}`;
  const res = await canvasFetch(account, "users/self/missing_submissions?include%5B%5D=planner_overrides&filter%5B%5D=current_grading_period&filter%5B%5D=submittable&per_page=100");
  if (!res.ok) throw new Error(`Failed to fetch missing submissions for ${account.domain}`);
  return res.json();
}

// Types for planner items returned by /api/v1/planner/items
export type PlannerOverride = {
  id: number;
  plannable_type: string;
  plannable_id: number;
  user_id: number;
  workflow_state: string;
  marked_complete: boolean;
  dismissed: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SubmissionStatus =
  | {
      submitted: boolean;
      excused: boolean;
      graded: boolean;
      late: boolean;
      missing: boolean;
      needs_grading: boolean;
      with_feedback: boolean;
      has_feedback: boolean;
      posted_at: string | null;
      redo_request: boolean;
    }
  | false;

export type PlannerNote = {
  id: number;
  todo_date: string;
  title: string;
  details?: string;
  user_id: number;
  course_id: number | null;
  workflow_state: string;
  created_at: string;
  updated_at: string;
};

export type PlannerItem = {
  context_type: string; // e.g. "Course"
  course_id: number | null;
  planner_override: PlannerOverride | null;
  submissions: SubmissionStatus;
  plannable_id: string;
  plannable_type: string; // e.g. "assignment" | "discussion_topic" | "planner_note"
  plannable: PlannerNote | Record<string, unknown>;
  html_url: string;
  context_name: string;
};

export type AssignmentOverride = {
  id: number;
  assignment_id: number;
  student_ids?: number[] | null;
  group_id?: number | null;
  course_section_id?: number | null;
  title?: string | null;
  due_at?: string | null;
  all_day?: boolean;
  all_day_date?: string | null;
  lock_at?: string | null;
  unlock_at?: string | null;
};

export type Assignment = {
  id: number;
  name: string;
  description?: string | null; // HTML
  due_at?: string | null;
  lock_at?: string | null;
  unlock_at?: string | null;
  points_possible?: number | null;
  grading_type?: string | null;
  html_url?: string;
  submission_types?: string[];
  has_submitted_submissions?: boolean;
  published?: boolean;
  course_id?: number;
  assignment_group_id?: number;
};

export type AssignmentGroup = {
  id: number;
  name: string;
  position?: number;
  group_weight?: number;
  assignments?: Assignment[];
};

export async function fetchAssignmentGroups(account: Account, courseId: number): Promise<AssignmentGroup[]> {
  const path = `courses/${courseId}/assignment_groups?include[]=assignments`;
  const res = await canvasFetch(account, path);
  if (!res.ok) throw new Error(`Failed to fetch assignment groups for course ${courseId} (${account.domain})`);
  return res.json();
}

export async function fetchAssignment(account: Account, courseId: number, assignmentId: number): Promise<Assignment> {
  const path = `courses/${courseId}/assignments/${assignmentId}`;
  const res = await canvasFetch(account, path);
  if (!res.ok) throw new Error(`Failed to fetch assignment ${assignmentId} for course ${courseId} (${account.domain})`);
  return res.json();
}

export async function getWhatIfGrades(account: Account, courseId: number, assignmentId: number, score: number) {
  const path = `courses/${courseId}/assignments/${assignmentId}/submissions/self`;
  const res = await canvasFetch(account, path, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      submission: {
        posted_grade: score
      }
    })
  });
  if (!res.ok) throw new Error(`Failed to fetch what-if grades for assignment ${assignmentId} (${account.domain})`);
  return res.json();
}

// ---- Submissions ----
export type Submission = {
  id?: number;
  user_id?: number;
  workflow_state?: 'unsubmitted' | 'submitted' | 'graded' | string;
  submitted_at?: string | null;
  graded_at?: string | null;
  score?: number | null;
  late?: boolean;
  missing?: boolean;
};

/** Fetch the current user's submission record for an assignment */
export async function fetchSelfSubmission(
  account: Account,
  courseId: number,
  assignmentId: number
): Promise<Submission | null> {
  const path = `courses/${courseId}/assignments/${assignmentId}/submissions/self`;
  const res = await canvasFetch(account, path);
  if (!res.ok) {
    // Some contexts may not allow viewing; treat as no submission
    return null;
  }
  return res.json();
}

export async function fetchAssignmentOverrides(account: Account, courseId: number, assignmentId: number): Promise<AssignmentOverride[]> {
  const path = `courses/${courseId}/assignments/${assignmentId}/overrides`;
  const res = await canvasFetch(account, path);
  if (!res.ok) throw new Error(`Failed to fetch overrides for assignment ${assignmentId} (${account.domain})`);
  return res.json();
}

export type ModuleItem = {
  id: number;
  title: string;
  type: string; // e.g. 'Assignment', 'Discussion', 'File', 'Page'
  html_url?: string;
  content_id?: number;
  position?: number;
  indent?: number;
  published?: boolean;
  module_id?: number;
};

export type CourseModule = {
  id: number;
  name: string;
  position?: number;
  unlock_at?: string | null;
  require_sequential_progress?: boolean;
  state?: string;
  published?: boolean;
  items?: ModuleItem[];
};

export async function fetchCourseModules(account: Account, courseId: number): Promise<CourseModule[]> {
  // include[]=items to get module items
  const path = `courses/${courseId}/modules?include[]=items`;
  const res = await canvasFetch(account, path);
  if (!res.ok) throw new Error(`Failed to fetch modules for course ${courseId} (${account.domain})`);
  return res.json();
}

// --- Pages (WikiPages) ---
// Canvas API: GET /api/v1/courses/:course_id/pages
// Reference: https://canvas.instructure.com/doc/api/pages.html
export type WikiPage = {
  page_id: number; // internal Canvas id
  url: string; // slug used in urls
  title: string;
  created_at?: string;
  updated_at?: string;
  hide_from_students?: boolean;
  editing_roles?: string; // e.g. "teachers,students"
  last_edited_by?: { id: number; display_name?: string } | null;
  body?: string | null; // HTML (returned when including body or fetching single page)
  published?: boolean;
  front_page?: boolean;
  lock_info?: Record<string, unknown> | null;
  locked_for_user?: boolean;
  html_url?: string; // e.g. /courses/:course_id/pages/:url
};

export async function fetchCoursePages(account: Account, courseId: number): Promise<WikiPage[]> {
  const path = `courses/${courseId}/pages`;
  const res = await canvasFetch(account, path);
  if (!res.ok) throw new Error(`Failed to fetch pages for course ${courseId} (${account.domain})`);
  return res.json();
}

export async function fetchCoursePage(account: Account, courseId: number, pageSlug: string): Promise<WikiPage> {
  const path = `courses/${courseId}/pages/${encodeURIComponent(pageSlug)}`;
  const res = await canvasFetch(account, path);
  if (!res.ok) throw new Error(`Failed to fetch page ${pageSlug} for course ${courseId} (${account.domain})`);
  return res.json();
}

// Shared helper for Canvas API fetches using Authorization header
async function canvasFetch(account: Account, path: string, init?: RequestInit) {
  const url = `/api/canvas?domain=${encodeURIComponent(account.domain)}&path=${encodeURIComponent(path)}`;
  return fetch(url, {
    method: init?.method || 'GET',
    body: init?.body,
    headers: {
      Authorization: `Bearer ${account.apiKey}`,
      ...(init?.headers || {})
    }
  });
}

export async function fetchAnnouncements(account: Account, courseId: number): Promise<Announcement[]> {
  const res = await canvasFetch(account, `courses/${courseId}/announcements`);
  if (!res.ok) throw new Error(`Failed to fetch announcements for course ${courseId} on ${account.domain}`);
  return res.json();
}

export type Announcement = {
  id: string;
  title: string;
  message: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  published: boolean;
  attachments?: Array<{
    id: string;
    filename: string;
    content_type: string;
    url: string;
  }>; // Optional property for attachments
};

// ---- File Upload & Assignment Submission ----
// Canvas multi-step upload then submit assignment with file_ids

export type UploadedFile = {
  id: number;
  display_name?: string;
  filename?: string;
  size?: number;
  content_type?: string;
  url?: string;
};

type UploadInitResponse = {
  upload_url: string;
  upload_params: Record<string, string>;
  file_param: string; // usually 'file'
};

/**
 * Step 1 & 2: initiate upload & send binary. Returns Canvas file record (with id) on success.
 */
export async function uploadAssignmentFile(
  account: Account,
  courseId: number,
  assignmentId: number,
  file: File
): Promise<UploadedFile> {
  // Step 1: ask Canvas for an upload URL
  const initRes = await canvasFetch(
    account,
    `courses/${courseId}/assignments/${assignmentId}/submissions/self/files`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        content_type: file.type || 'application/octet-stream'
      })
    }
  );
  if (!initRes.ok) {
    throw new Error(`Failed to initiate file upload (${initRes.status})`);
  }
  const initJson: any = await initRes.json();
  // Some Canvas instances wrap differently; attempt to normalize
  const uploadInfo: UploadInitResponse = {
    upload_url: initJson.upload_url || initJson.uploadUrl || initJson.url,
    upload_params: initJson.upload_params || initJson.uploadParams || {},
    file_param: initJson.file_param || 'file'
  };
  if (!uploadInfo.upload_url) {
    throw new Error('Upload URL missing from Canvas response');
  }

  // Step 2: POST the file binary to the returned upload_url
  const form = new FormData();
  Object.entries(uploadInfo.upload_params).forEach(([k, v]) => form.append(k, v));
  form.append(uploadInfo.file_param, file, file.name);

  const uploadRes = await fetch(uploadInfo.upload_url, { method: 'POST', body: form });

  // Canvas may 3xx redirect after successful upload; follow if needed
  let finalRes = uploadRes;
  if (uploadRes.status >= 300 && uploadRes.status < 400 && uploadRes.headers.get('location')) {
    const loc = uploadRes.headers.get('location')!;
    finalRes = await fetch(loc, { headers: { Authorization: `Bearer ${account.apiKey}` } });
  }

  let fileJson: any;
  const text = await finalRes.text();
  try { fileJson = JSON.parse(text); } catch { throw new Error('Invalid file upload response'); }

  if (!finalRes.ok) {
    throw new Error(`File upload failed (${finalRes.status})`);
  }
  return {
    id: fileJson.id,
    display_name: fileJson.display_name || fileJson.filename,
    filename: fileJson.filename,
    size: fileJson.size,
    content_type: fileJson.content_type,
    url: fileJson.url || fileJson.preview_url
  };
}

/**
 * Final submission for an assignment with uploaded file IDs.
 */
export async function submitAssignmentFiles(
  account: Account,
  courseId: number,
  assignmentId: number,
  fileIds: number[]
): Promise<any> {
  if (fileIds.length === 0) throw new Error('No files to submit');
  const body = new URLSearchParams();
  body.append('submission[submission_type]', 'online_upload');
  fileIds.forEach((id) => body.append('submission[file_ids][]', String(id)));
  const res = await canvasFetch(
    account,
    `courses/${courseId}/assignments/${assignmentId}/submissions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to submit assignment (${res.status})`);
  }
  return res.json();
}

// ---- Conversations (Inbox) ----
// Reference: https://canvas.instructure.com/doc/api/conversations.html

export type ConversationParticipant = {
  id: number;
  name?: string;
  short_name?: string;
  avatar_url?: string;
};

export type Conversation = {
  id: number;
  subject?: string | null;
  workflow_state?: 'unread' | 'read' | 'archived';
  last_message?: string | null;
  last_message_at?: string | null;
  message_count?: number;
  participants?: ConversationParticipant[];
  properties?: string[]; // e.g. ["starred"]
  context_name?: string;
  account?: Account; // attached client-side for multi-account aggregation
};

export interface FetchConversationsOptions {
  scope?: 'unread' | 'starred' | 'archived' | 'sent';
  per_page?: number;
  includeMessages?: boolean; // if true adds include[]=messages
}

export async function fetchConversations(
  account: Account,
  opts: FetchConversationsOptions = {}
): Promise<Conversation[]> {
  const params = new URLSearchParams();
  if (opts.scope) params.append('scope', opts.scope);
  params.append('per_page', String(opts.per_page ?? 20));
  if (opts.includeMessages) params.append('include[]', 'messages');
  const path = `conversations?${params.toString()}`;
  const res = await canvasFetch(account, path);
  if (!res.ok) throw new Error(`Failed to fetch conversations (${account.domain})`);
  const json = await res.json();
  if (!Array.isArray(json)) return [];
  return json.map((c: any) => ({ ...c, account }));
}

export async function updateConversationState(
  account: Account,
  conversationId: number,
  workflow_state: 'read' | 'unread' | 'archived'
): Promise<Conversation> {
  const form = new URLSearchParams();
  form.append('conversation[workflow_state]', workflow_state);
  const res = await canvasFetch(
    account,
    `conversations/${conversationId}`,
    {
      method: 'POST', // proxy POST with override
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    }
  );
  if (!res.ok) throw new Error(`Failed to update conversation ${conversationId}`);
  return res.json();
}

export async function markAllConversationsRead(account: Account): Promise<void> {
  const res = await canvasFetch(
    account,
    `conversations/mark_all_as_read`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('Failed to mark all as read');
}

// ---- Files ----
// Reference: https://developerdocs.instructure.com/services/canvas/resources/files#method.files.api_index
export interface CanvasFile {
  id: number;
  uuid?: string;
  display_name?: string;
  filename?: string;
  size?: number;
  content_type?: string;
  url?: string; // download url
  html_url?: string; // canvas page url
  created_at?: string;
  updated_at?: string;
  unlock_at?: string | null;
  locked?: boolean;
  hidden?: boolean;
  lock_at?: string | null;
  hidden_for_user?: boolean;
  thumbnail_url?: string | null;
  modified_at?: string;
  mime_class?: string;
  media_entry_id?: string | null;
  folder_id?: number;
  display?: string | null;
  preview_url?: string | null;
  account?: Account; // client-side convenience
}

/** Fetch all course files (basic pagination support via Link header) */
export async function fetchCourseFiles(account: Account, courseId: number, perPage = 100, maxPages = 5): Promise<CanvasFile[]> {
  let pageUrl: string | null = `courses/${courseId}/files?per_page=${perPage}&sort=updated_at&order=desc`;
  const all: CanvasFile[] = [];
  let pages = 0;
  while (pageUrl && pages < maxPages) {
    pages++;
    const res = await canvasFetch(account, pageUrl);
    if (!res.ok) throw new Error(`Failed to fetch files for course ${courseId}`);
    const batch = await res.json();
    if (Array.isArray(batch)) all.push(...batch.map(f => ({ ...f, account })));
    // Parse Link header for rel="next"
    const link = res.headers.get('Link') || res.headers.get('link');
    if (link) {
      const m = link.split(',').map(s => s.trim()).find(s => /rel="next"/.test(s));
      if (m) {
        const urlMatch = m.match(/<([^>]+)>/);
        if (urlMatch) {
          const absolute = urlMatch[1];
          const pathIdx = absolute.indexOf('/api/v1/');
            if (pathIdx >= 0) {
              pageUrl = absolute.substring(pathIdx + '/api/v1/'.length);
            } else {
              pageUrl = null;
            }
        } else pageUrl = null;
      } else pageUrl = null;
    } else pageUrl = null;
  }
  return all;
}

/** Fetch a single file (courseId not required by endpoint, but kept for consistency) */
export async function fetchCourseFile(account: Account, fileId: number): Promise<CanvasFile> {
  const res = await canvasFetch(account, `files/${fileId}`);
  if (!res.ok) throw new Error(`Failed to fetch file ${fileId}`);
  const f = await res.json();
  return { ...f, account };
}

// ---- Account Calendars ----
// Reference: https://developerdocs.instructure.com/services/canvas/resources/account_calendars#method.account_calendars_api.index
export interface AccountCalendarInfo {
  id: number;
  name?: string;
  parent_account_id?: number | null;
  root_account_id?: number | null;
  visible?: boolean;
  auto_subscribe?: boolean;
  sub_account_count?: number;
  asset_string?: string; // e.g., "account_4"
  type?: string; // 'account'
}

export async function fetchAccountCalendars(account: Account): Promise<AccountCalendarInfo[]> {
  const res = await canvasFetch(account, `account_calendars`);
  if (!res.ok) throw new Error(`Failed to fetch account calendars for ${account.domain}`);
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

// ---- Calendar Events ----
// There is a Calendar Events API (GET /api/v1/calendar_events) that supports
// start_date, end_date, and context_codes[]=account_#|course_#|group_#|user_#.
// We query via the proxy canvasFetch to avoid CORS.
export interface CalendarEvent {
  id: number;
  title?: string;
  description?: string | null; // HTML
  start_at?: string; // ISO
  end_at?: string | null; // ISO
  all_day?: boolean;
  all_day_date?: string | null; // for all-day
  location_name?: string | null;
  location_address?: string | null;
  context_code?: string; // e.g., course_123, account_4
  context_name?: string;
  child_events_count?: number;
  html_url?: string;
  // For type=assignment calendar events, Canvas often includes a partial assignment object
  assignment?: {
    id?: number;
    course_id?: number;
    user_submitted?: boolean; // true if the current user has submitted
    has_submitted_submissions?: boolean; // aggregate flag
    html_url?: string;
  };
}

export interface FetchCalendarEventsOptions {
  startDateISO: string; // YYYY-MM-DD or ISO timestamp
  endDateISO: string;   // YYYY-MM-DD or ISO timestamp
  contextCodes?: string[]; // e.g., ["course_123", "account_4"]
  /** Optional Canvas calendar event type filter, e.g. 'assignment' or 'event' */
  type?: string;
  perPage?: number; // default 100
  maxPages?: number; // default 5
}

export async function fetchCalendarEvents(
  account: Account,
  opts: FetchCalendarEventsOptions
): Promise<CalendarEvent[]> {
  const perPage = opts.perPage ?? 100;
  const maxPages = opts.maxPages ?? 5;

  const baseParams = new URLSearchParams();
  baseParams.set('start_date', opts.startDateISO);
  baseParams.set('end_date', opts.endDateISO);
  baseParams.set('per_page', String(perPage));
  // If context codes are provided, include all
  (opts.contextCodes || []).forEach((cc) => baseParams.append('context_codes[]', cc));
  if (opts.type) baseParams.set('type', opts.type);

  let pagePath: string | null = `calendar_events?${baseParams.toString()}`;
  const all: CalendarEvent[] = [];
  let pages = 0;
  while (pagePath && pages < maxPages) {
    pages++;
    const res = await canvasFetch(account, pagePath);
    if (!res.ok) throw new Error(`Failed to fetch calendar events for ${account.domain}`);
    const batch = await res.json();
    if (Array.isArray(batch)) all.push(...batch);
    // Parse Link header for rel="next"
    const link = res.headers.get('Link') || res.headers.get('link');
    if (link) {
      const m = link.split(',').map(s => s.trim()).find(s => /rel="next"/i.test(s));
      if (m) {
        const urlMatch = m.match(/<([^>]+)>/);
        if (urlMatch) {
          const absolute = urlMatch[1];
          const idx = absolute.indexOf('/api/v1/');
          pagePath = idx >= 0 ? absolute.substring(idx + '/api/v1/'.length) : null;
        } else pagePath = null;
      } else pagePath = null;
    } else pagePath = null;
  }
  return all;
}