import { useAuth } from './contexts/AuthContext'
import AuthScreen from './components/AuthScreen'
import Planner from './components/Planner'

export default function App() {
  const { session } = useAuth()

  // Still loading session
  if (session === undefined) {
    return (
      <div style={{
        background: '#0f0f14', height: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: '#555',
        fontFamily: 'DM Sans, sans-serif', fontSize: 14,
      }}>
        Loading…
      </div>
    )
  }

  // Not logged in
  if (!session) return <AuthScreen />

  // Logged in
  return <Planner />
}
