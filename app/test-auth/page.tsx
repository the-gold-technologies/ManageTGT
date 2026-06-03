import { auth } from '@/auth'

export default async function TestAuthPage() {
  const session = await auth()
  return (
    <div>
      <h1>Auth Test</h1>
      <pre>{JSON.stringify(session, null, 2)}</pre>
    </div>
  )
}
