import DashboardClient from '@/components/dashboard/dashboard-client'
import { getDashboardData } from '@/app/actions/dashboard'

export const metadata = {
  title: 'Dashboard | TGT',
}

export default async function DashboardPage() {
  const data = await getDashboardData()
  return <DashboardClient data={data} />
}
