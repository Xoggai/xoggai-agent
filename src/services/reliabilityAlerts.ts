export type ReliabilityCounts = {
  requestsLast5Minutes: number
  failuresLast15Minutes: number
  expiredLast24Hours: number
  idempotentReplaysLast24Hours: number
}

export type ReliabilityAlert = {
  code: 'request_spike' | 'execution_failures'
  severity: 'warning' | 'critical'
  value: number
  threshold: number
}

export function evaluateReliabilityAlerts(
  counts: ReliabilityCounts,
  thresholds: { requestSpike: number; executionFailures: number },
) {
  const alerts: ReliabilityAlert[] = []
  if (counts.requestsLast5Minutes >= thresholds.requestSpike) {
    alerts.push({
      code: 'request_spike',
      severity: 'warning',
      value: counts.requestsLast5Minutes,
      threshold: thresholds.requestSpike,
    })
  }
  if (counts.failuresLast15Minutes >= thresholds.executionFailures) {
    alerts.push({
      code: 'execution_failures',
      severity: 'critical',
      value: counts.failuresLast15Minutes,
      threshold: thresholds.executionFailures,
    })
  }
  return alerts
}
