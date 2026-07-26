export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
          <div className="space-y-4 text-gray-600">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
            <h2 className="text-xl font-semibold text-gray-900 mt-6">1. Acceptance of Terms</h2>
            <p>
              By accessing and using our application, you accept and agree to be bound by the terms and 
              provision of this agreement.
            </p>
            <h2 className="text-xl font-semibold text-gray-900 mt-6">2. Description of Service</h2>
            <p>
              We provide an agency management platform that allows users to manage projects, clients, 
              and schedule meetings. We may integrate with third-party services like Google Calendar to 
              enhance this functionality.
            </p>
            <h2 className="text-xl font-semibold text-gray-900 mt-6">3. User Conduct</h2>
            <p>
              You agree to use the service only for lawful purposes. You are solely responsible for the 
              knowledge of and adherence to any and all laws, rules, and regulations pertaining to your use of the services.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
