export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white shadow-sm py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">AgencyOS</h1>
          <a href="/login" className="text-blue-600 hover:text-blue-800 font-medium">Log In</a>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-6">
            The Complete Operating System for Your Agency
          </h2>
          <p className="text-xl text-gray-600 mb-10">
            AgencyOS helps you manage projects, track clients, and streamline your entire workflow in one place.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold mb-4">Project Management</h3>
            <p className="text-gray-600">Track milestones, deliverables, and deadlines with our intuitive project boards.</p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold mb-4">Google Calendar Sync</h3>
            <p className="text-gray-600">Seamlessly sync your client meetings and deadlines directly with your Google Calendar.</p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold mb-4">Client CRM</h3>
            <p className="text-gray-600">Keep all your client communications and details organized and accessible.</p>
          </div>
        </div>
      </main>
    </div>
  )
}
