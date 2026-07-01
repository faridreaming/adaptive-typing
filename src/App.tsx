import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import TestPage from '#pages/TestPage'
import DashboardPage from '#pages/DashboardPage'

function Nav() {
  return (
    <nav className="flex gap-4 border-b border-border p-4">
      <Link to="/" className="hover:underline">
        Test
      </Link>
      <Link to="/dashboard" className="hover:underline">
        Dashboard
      </Link>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<TestPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  )
}
