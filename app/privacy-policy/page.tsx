export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
          <div className="space-y-4 text-gray-600">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
            <h2 className="text-xl font-semibold text-gray-900 mt-6">1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us, including when you create an account, 
              update your profile, and connect third-party services like Google Calendar.
            </p>
            <h2 className="text-xl font-semibold text-gray-900 mt-6">2. Google Calendar Integration</h2>
            <p>
              Our application uses Google Calendar APIs to sync your events and meetings. We strictly use 
              this access to read and write calendar events on your behalf to keep your dashboard in sync. 
              We do not share your calendar data with unauthorized third parties.
            </p>
            <h2 className="text-xl font-semibold text-gray-900 mt-6">3. Data Security</h2>
            <p>
              We implement appropriate technical and organizational security measures to protect your 
              personal information against accidental or unlawful destruction, loss, alteration, or unauthorized disclosure.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
