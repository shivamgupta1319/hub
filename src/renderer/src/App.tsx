import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'

export function App(): React.JSX.Element {
  return (
    <div className="shell">
      <Sidebar />
      <main className="content" id="content">
        <Dashboard />
      </main>
    </div>
  )
}
