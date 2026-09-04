import { Routes, Route } from 'react-router-dom'
import { LandingPage } from '@/pages/marketing/LandingPage'
import { PricingPage } from '@/pages/marketing/PricingPage'
import { TermsPage } from '@/pages/legal/TermsPage'
import { PrivacyPage } from '@/pages/legal/PrivacyPage'
import { RefundPolicyPage } from '@/pages/legal/RefundPolicyPage'
import { SubscriptionCancellationPage } from '@/pages/legal/SubscriptionCancellationPage'
import { ContactPage } from '@/pages/legal/ContactPage'
import { SignInPage } from '@/pages/auth/SignInPage'
import { SignUpPage } from '@/pages/auth/SignUpPage'
import { CreateLearnerPage } from '@/pages/onboarding/CreateLearnerPage'
import { ChildDashboardPage } from '@/pages/dashboard/ChildDashboardPage'
import { SubjectsPage } from '@/pages/subjects/SubjectsPage'
import { TopicListPage } from '@/pages/subjects/TopicListPage'
import { LessonListPage } from '@/pages/subjects/LessonListPage'
import { LessonPage } from '@/pages/lessons/LessonPage'
import { ScanMyWorkPage } from '@/pages/scan/ScanMyWorkPage'
import { LearnerProgressPage } from '@/pages/progress/LearnerProgressPage'
import { ExamPrepPage } from '@/pages/exam/ExamPrepPage'
import { MockTestPage } from '@/pages/exam/MockTestPage'
import { ParentDashboardPage } from '@/pages/parent/ParentDashboardPage'
import { SubscriptionPage } from '@/pages/parent/SubscriptionPage'
import { SettingsPage } from '@/pages/parent/SettingsPage'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { CurriculumSourcesPage } from '@/pages/admin/CurriculumSourcesPage'
import { CurriculumReviewPage } from '@/pages/admin/CurriculumReviewPage'
import { TerminologyReviewPage } from '@/pages/admin/TerminologyReviewPage'
import { TopicIllustrationsPage } from '@/pages/admin/TopicIllustrationsPage'
import { ChildShell } from '@/components/layout/ChildShell'
import { ParentShell } from '@/components/layout/ParentShell'
import { AdminShell } from '@/components/layout/AdminShell'
import { RequireAuth, RequireLearner, RequireAdmin } from '@/components/layout/Guards'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/refund-policy" element={<RefundPolicyPage />} />
      <Route path="/subscription-cancellation" element={<SubscriptionCancellationPage />} />
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
        path="/app/*"
        element={
          <RequireAuth>
            <RequireLearner>
              <ChildShell>
                <Routes>
                  <Route index element={<ChildDashboardPage />} />
                  <Route path="subjects" element={<SubjectsPage />} />
                  <Route path="subjects/:subjectId" element={<TopicListPage />} />
                  <Route path="subjects/:subjectId/topics/:topicId" element={<LessonListPage />} />
                  <Route path="lessons/:lessonId" element={<LessonPage />} />
                  <Route path="scan" element={<ScanMyWorkPage />} />
                  <Route path="progress" element={<LearnerProgressPage />} />
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
              </Routes>
            </AdminShell>
          </RequireAdmin>
        }
      />
    </Routes>
  )
}
