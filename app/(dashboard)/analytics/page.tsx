import AnalyticsClient from '@/components/analytics/analytics-client'

export default function AnalyticsPage() {
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
