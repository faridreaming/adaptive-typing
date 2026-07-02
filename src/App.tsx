import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { useAuth } from '#hooks/useAuth'
import LoginPage from '#pages/LoginPage'
import TestPage from '#pages/TestPage'
import DashboardPage from '#pages/DashboardPage'
import { supabase } from '#lib/supabase'
import { Button } from '#components/ui/button'

function Nav() {
  return (
    <nav className="flex items-center justify-between border-b border-border p-4">
      <div className="flex gap-4">
        <Link to="/" className="hover:underline">
          Test
        </Link>
        <Link to="/dashboard" className="hover:underline">
          Dashboard
        </Link>
      </div>
      <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
        Keluar
      </Button>
    </nav>
  )
}

/** Redirects to /login if there's no active session. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) return null // avoid flashing the login page during initial check
  if (!session) return <Navigate to="/login" replace />

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Nav />
              <TestPage />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Nav />
              <DashboardPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
