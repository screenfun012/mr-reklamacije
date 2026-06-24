import type { DashboardChartMonth } from '@mr/shared'
import { m } from '@mr/i18n'
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@mr/ui'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface DashboardClaimsChartProps {
  data: readonly DashboardChartMonth[]
}

function formatMonthLabel(month: string): string {
  const [year, monthPart] = month.split('-')
  if (!year || !monthPart) {
    return month
  }
  return `${monthPart}.${year.slice(2)}`
}

export function DashboardClaimsChart({ data }: DashboardClaimsChartProps) {
  const chartData = data.map((entry) => ({
    ...entry,
    label: formatMonthLabel(entry.month),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.dashboard_chart_title()}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                className="text-xs fill-muted-foreground"
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={32}
                className="text-xs fill-muted-foreground"
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '0.45rem',
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--card)',
                  color: 'var(--card-foreground)',
                }}
              />
              <Legend />
              <Bar
                dataKey="emotive"
                name={m.dashboard_chart_emotive()}
                fill="var(--color-mr-info)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="domace"
                name={m.dashboard_chart_domace()}
                fill="var(--color-mr-brand)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardClaimsChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-72 w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}
