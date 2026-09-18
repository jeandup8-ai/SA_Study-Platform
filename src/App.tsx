import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { LandingPage } from '@/pages/marketing/LandingPage'
import { PricingPage } from '@/pages/marketing/PricingPage'
import { PracticeHubPage } from '@/pages/practice/PracticeHubPage'
import { PracticeGradePage } from '@/pages/practice/PracticeGradePage'
import { PracticeSubjectPage } from '@/pages/practice/PracticeSubjectPage'
import { PracticeTestPage } from '@/pages/practice/PracticeTestPage'
import { TermsPage } from '@/pages/legal/TermsPage'
import { PrivacyPage } from '@/pages/legal/PrivacyPage'
import { RefundPolicyPage } from '@/pages/legal/RefundPolicyPage'
import { SubscriptionCancellationPage } from '@/pages/legal/SubscriptionCancellationPage'
import { ContactPage } from '@/pages/legal/ContactPage'
import { SignInPage } from '@/pages/auth/SignInPage'
import { SignUpPage } from '@/pages/auth/SignUpPage'
import { ChildShell } from '@/components/layout/ChildShell'
import { ParentShell } from '@/components/layout/ParentShell'
import { AdminShell } from '@/components/layout/AdminShell'
import {
  RequireAuth,
  RequireLearner,
  RequireAdmin,
  FullScreenLoading,
} from '@/components/layout/Guards'

/**
 * Everything behind a login is loaded on demand.
 *
 * The public routes above -- landing, pricing, the free practice tests and
 * the legal pages -- are what an anonymous visitor and a search crawler
 * actually fetch, and they were paying to download the learner app, the
 * parent dashboard and seven admin review consoles they can never reach.
 * Those now arrive only once someone signs in, and the admin console only
 * once an admin opens it.
 */
const CreateLearnerPage = lazy(() =>
  import('@/pages/onboarding/CreateLearnerPage').then((m) => ({
    default: m.CreateLearnerPage,
  })),
)
const StartingPointPage = lazy(() =>
  import('@/pages/onboarding/StartingPointPage').then((m) => ({
    default: m.StartingPointPage,
  })),
)
const ChildDashboardPage = lazy(() =>
  import('@/pages/dashboard/ChildDashboardPage').then((m) => ({
    default: m.ChildDashboardPage,
  })),
)
const SubjectsPage = lazy(() =>
  import('@/pages/subjects/SubjectsPage').then((m) => ({ default: m.SubjectsPage })),
)
const TopicListPage = lazy(() =>
  import('@/pages/subjects/TopicListPage').then((m) => ({ default: m.TopicListPage })),
)
const LessonListPage = lazy(() =>
  import('@/pages/subjects/LessonListPage').then((m) => ({ default: m.LessonListPage })),
)
const LessonPage = lazy(() =>
  import('@/pages/lessons/LessonPage').then((m) => ({ default: m.LessonPage })),
)
const ScanMyWorkPage = lazy(() =>
  import('@/pages/scan/ScanMyWorkPage').then((m) => ({ default: m.ScanMyWorkPage })),
)
const LearnerProgressPage = lazy(() =>
  import('@/pages/progress/LearnerProgressPage').then((m) => ({
    default: m.LearnerProgressPage,
  })),
)
const AchievementsPage = lazy(() =>
  import('@/pages/achievements/AchievementsPage').then((m) => ({
    default: m.AchievementsPage,
  })),
)
const ExamPrepPage = lazy(() =>
  import('@/pages/exam/ExamPrepPage').then((m) => ({ default: m.ExamPrepPage })),
)
const MockTestPage = lazy(() =>
  import('@/pages/exam/MockTestPage').then((m) => ({ default: m.MockTestPage })),
)
const ParentDashboardPage = lazy(() =>
  import('@/pages/parent/ParentDashboardPage').then((m) => ({
    default: m.ParentDashboardPage,
  })),
)
const SubscriptionPage = lazy(() =>
  import('@/pages/parent/SubscriptionPage').then((m) => ({
    default: m.SubscriptionPage,
  })),
)
const SettingsPage = lazy(() =>
  import('@/pages/parent/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const AdminDashboardPage = lazy(() =>
  import('@/pages/admin/AdminDashboardPage').then((m) => ({
    default: m.AdminDashboardPage,
  })),
)
const CurriculumSourcesPage = lazy(() =>
  import('@/pages/admin/CurriculumSourcesPage').then((m) => ({
    default: m.CurriculumSourcesPage,
  })),
)
const CurriculumReviewPage = lazy(() =>
  import('@/pages/admin/CurriculumReviewPage').then((m) => ({
    default: m.CurriculumReviewPage,
  })),
)
const TerminologyReviewPage = lazy(() =>
  import('@/pages/admin/TerminologyReviewPage').then((m) => ({
    default: m.TerminologyReviewPage,
  })),
)
const TopicIllustrationsPage = lazy(() =>
  import('@/pages/admin/TopicIllustrationsPage').then((m) => ({
    default: m.TopicIllustrationsPage,
  })),
)
const VideoSuggestionsReviewPage = lazy(() =>
  import('@/pages/admin/VideoSuggestionsReviewPage').then((m) => ({
    default: m.VideoSuggestionsReviewPage,
  })),
)
const PracticeTestsPage = lazy(() =>
  import('@/pages/admin/PracticeTestsPage').then((m) => ({
    default: m.PracticeTestsPage,
  })),
)

export default function App() {
  return (
    <Suspense fallback={<FullScreenLoading />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />

        {/* Free, ungated practice tests. Crawlable and linkable; no auth guard. */}
        <Route path="/practice" element={<PracticeHubPage />} />
        <Route path="/practice/:gradeSlug" element={<PracticeGradePage />} />
        <Route
          path="/practice/:gradeSlug/:subjectSlug"
          element={<PracticeSubjectPage />}
        />
        <Route
          path="/practice/:gradeSlug/:subjectSlug/:testSlug"
          element={<PracticeTestPage />}
        />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/refund-policy" element={<RefundPolicyPage />} />
        <Route
          path="/subscription-cancellation"
          element={<SubscriptionCancellationPage />}
        />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />

        <Route
          path="/onboarding/learner"
          element={
            <RequireAuth>
              <CreateLearnerPage />
            </RequireAuth>
          }
        />

        <Route
          path="/onboarding/starting-point"
          element={
            <RequireAuth>
              <RequireLearner>
                <StartingPointPage />
              </RequireLearner>
            </RequireAuth>
          }
        />

        <Route
          path="/app/*"
          element={
            <RequireAuth>
              <RequireLearner>
                <ChildShell>
                  <Routes>
                    <Route index element={<ChildDashboardPage />} />
                    <Route path="subjects" element={<SubjectsPage />} />
                    <Route path="subjects/:subjectId" element={<TopicListPage />} />
                    <Route
                      path="subjects/:subjectId/topics/:topicId"
                      element={<LessonListPage />}
                    />
                    <Route path="lessons/:lessonId" element={<LessonPage />} />
                    <Route path="scan" element={<ScanMyWorkPage />} />
                    <Route path="progress" element={<LearnerProgressPage />} />
                    <Route path="achievements" element={<AchievementsPage />} />
                    <Route path="exam" element={<ExamPrepPage />} />
                    <Route path="exam/:subjectId/mock-test" element={<MockTestPage />} />
                  </Routes>
                </ChildShell>
              </RequireLearner>
            </RequireAuth>
          }
        />

        <Route
          path="/parent/*"
          element={
            <RequireAuth>
              <ParentShell>
                <Routes>
                  <Route index element={<ParentDashboardPage />} />
                  <Route path="subscription" element={<SubscriptionPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Routes>
              </ParentShell>
            </RequireAuth>
          }
        />

        <Route
          path="/admin/*"
          element={
            <RequireAdmin>
              <AdminShell>
                <Routes>
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="curriculum-sources" element={<CurriculumSourcesPage />} />
                  <Route path="review-queue" element={<CurriculumReviewPage />} />
                  <Route path="terminology" element={<TerminologyReviewPage />} />
                  <Route path="illustrations" element={<TopicIllustrationsPage />} />
                  <Route
                    path="video-suggestions"
                    element={<VideoSuggestionsReviewPage />}
                  />
                  <Route path="practice-tests" element={<PracticeTestsPage />} />
                </Routes>
              </AdminShell>
            </RequireAdmin>
          }
        />
      </Routes>
    </Suspense>
  )
}
