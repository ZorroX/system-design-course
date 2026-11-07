import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { Layout } from '@/components/Layout'
import { Loading } from '@/components/ui'
import Home from '@/pages/Home'

const SkillMap = lazy(() => import('@/pages/SkillMap'))
const TopicPage = lazy(() => import('@/pages/TopicPage'))
const LabList = lazy(() => import('@/pages/LabList'))
const LabBuilder = lazy(() => import('@/pages/LabBuilder'))
const InterviewList = lazy(() => import('@/pages/InterviewList'))
const CasePage = lazy(() => import('@/pages/CasePage'))
const MockInterview = lazy(() => import('@/pages/MockInterview'))
const Estimate = lazy(() => import('@/pages/Estimate'))
const Review = lazy(() => import('@/pages/Review'))
const CloudPage = lazy(() => import('@/pages/CloudPage'))
const RealWorld = lazy(() => import('@/pages/RealWorld'))
const Resources = lazy(() => import('@/pages/Resources'))
const Profile = lazy(() => import('@/pages/Profile'))
const More = lazy(() => import('@/pages/More'))
const Glossary = lazy(() => import('@/pages/Glossary'))
const ArticlePage = lazy(() => import('@/pages/ArticlePage'))
const QuestPage = lazy(() => import('@/quest/ui/QuestPage'))
const PathPage = lazy(() => import('@/pages/PathPage'))

// Aplica el tema guardado antes del primer render para evitar parpadeo
try {
  const saved = JSON.parse(localStorage.getItem('sysdesign-quest-v1') ?? '{}')
  document.documentElement.dataset.theme = saved?.state?.settings?.theme ?? 'dark'
} catch {
  document.documentElement.dataset.theme = 'dark'
}


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="quest" element={<QuestPage />} />
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="map" element={<SkillMap />} />
            <Route path="path" element={<PathPage />} />
            <Route path="topic/:id" element={<TopicPage />} />
            <Route path="lab" element={<LabList />} />
            <Route path="lab/:id" element={<LabBuilder />} />
            <Route path="interview" element={<InterviewList />} />
            <Route path="interview/:id" element={<CasePage />} />
            <Route path="interview/:id/mock" element={<MockInterview />} />
            <Route path="estimate" element={<Estimate />} />
            <Route path="review" element={<Review />} />
            <Route path="cloud" element={<CloudPage />} />
            <Route path="real-world" element={<RealWorld />} />
            <Route path="resources" element={<Resources />} />
            <Route path="profile" element={<Profile />} />
            <Route path="more" element={<More />} />
            <Route path="glossary" element={<Glossary />} />
            <Route path="glossary/:id" element={<ArticlePage />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  </StrictMode>,
)
