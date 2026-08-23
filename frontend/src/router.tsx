import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { LoginScreen } from './screens/LoginScreen'
import { NewChatScreen } from './screens/NewChatScreen'
import { ChatConversationScreen } from './screens/ChatConversationScreen'
import { SettingScreen } from './screens/SettingScreen'
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

  // Protected: all app screens nested under ChatLayout (which renders <Outlet />)
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/chat', element: <NewChatScreen /> },
      { path: '/chat/:sessionId', element: <ChatConversationScreen /> },
      { path: '/settings', element: <SettingScreen /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
