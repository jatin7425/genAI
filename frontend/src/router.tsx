import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
const LoginScreen = lazy(() => import('./screens/LoginScreen').then(module => ({ default: module.LoginScreen })))
const NewChatScreen = lazy(() => import('./screens/NewChatScreen').then(module => ({ default: module.NewChatScreen })))
const ChatConversationScreen = lazy(() => import('./screens/ChatConversationScreen').then(module => ({ default: module.ChatConversationScreen })))
const CompanionScreen = lazy(() => import('./screens/CompanionScreen').then(module => ({ default: module.CompanionScreen })))
const SettingScreen = lazy(() => import('./screens/SettingScreen').then(module => ({ default: module.SettingScreen })))
import { ChatLayout } from './layouts/ChatLayout'
import { useAuth } from './hooks/useAuth'

// ---------------------------------------------------------------------------
// Route guards
// ---------------------------------------------------------------------------

/** Redirects unauthenticated users to /login. */
function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <ChatLayout />
}

/** Redirects authenticated users away from /login. */
function GuestRoute() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/chat" replace />
  return <LoginScreen />
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = createBrowserRouter([
  // Redirect root to /chat
  { path: '/', element: <Navigate to="/chat" replace /> },

  // Guest-only: login
  { path: '/login', element: <GuestRoute /> },

  { path: '/secret-world', element: <CompanionScreen /> },
  { path: '/secret-world/:companionId', element: <CompanionScreen /> },

  // Protected: all app screens nested under ChatLayout (which renders <Outlet />)
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/chat', element: <NewChatScreen /> },
      { path: '/chat/:sessionId', element: <ChatConversationScreen /> },
      { path: '/settings', element: <SettingScreen /> },
      { path: '*', element: <Navigate to="/chat" replace /> },
    ],
  },
])

export function AppRouter() {
  return <Suspense fallback={<div className="min-h-dvh bg-background grid place-items-center text-sm text-on-surface-variant" role="status">Opening your workspace…</div>}><RouterProvider router={router} /></Suspense>
}
