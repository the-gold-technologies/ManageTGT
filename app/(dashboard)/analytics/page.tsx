import AnalyticsClient from '@/components/analytics/analytics-client'
import { verifyModuleAccess } from '@/app/actions/access'

export default async function AnalyticsPage() {
  await verifyModuleAccess('analytics')
  return (
    <AnalyticsClient 
      monthlyData={[]}
      serviceData={[]}
      projects={[]}
      tasks={[]}
      prospects={[]}
    />
  )
}
