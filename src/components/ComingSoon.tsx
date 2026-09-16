// Stub pages for remaining routes
// Each just shows a "coming soon" placeholder for routes not yet fully implemented

// Shared component
export function ComingSoon({ title, icon }: { title: string; icon: string }) {
  return (
    <div>
      <h1 className="page-title mb-1">{title}</h1>
      <div className="empty-state mt-16">
        <div className="empty-icon text-6xl mb-4">{icon}</div>
        <p className="text-lg font-semibold text-gray-400">Coming Soon</p>
        <p className="text-sm text-gray-600 mt-2">This module is under development</p>
      </div>
    </div>
  )
}
