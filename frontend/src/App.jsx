import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ScreenFallback } from './components/ui/PageFallback'
import { AppLayout } from './layouts/AppLayout'
import { JobLayout } from './layouts/JobLayout'
import { ProtectedRoute } from './layouts/ProtectedRoute'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ExtractorsPage = lazy(() => import('./pages/ExtractorsPage'))
const ExtractorDetailPage = lazy(() => import('./pages/ExtractorDetailPage'))
const NewJobUploadPage = lazy(() => import('./pages/NewJobUploadPage'))
const NewJobConfigurePage = lazy(() => import('./pages/NewJobConfigurePage'))
const JobRunPage = lazy(() => import('./pages/JobRunPage'))
const JobResultsPage = lazy(() => import('./pages/JobResultsPage'))
const JobComparePage = lazy(() => import('./pages/JobComparePage'))
const JobReportPage = lazy(() => import('./pages/JobReportPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

export default function App() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/extractors" element={<ExtractorsPage />} />
            <Route path="/extractors/:sdk" element={<ExtractorDetailPage />} />
            <Route path="/jobs/new" element={<NewJobUploadPage />} />
            <Route path="/jobs/new/configure" element={<NewJobConfigurePage />} />
            <Route path="/jobs/:id" element={<JobLayout />}>
              <Route index element={<JobRunPage />} />
              <Route path="results" element={<JobResultsPage />} />
              <Route path="compare" element={<JobComparePage />} />
              <Route path="report" element={<JobReportPage />} />
            </Route>
            <Route path="/history" element={<HistoryPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
