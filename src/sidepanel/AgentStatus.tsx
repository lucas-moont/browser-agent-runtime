import type { AgentStatus as Status } from '../runtime'

const STATUS_COPY: Record<Status, string> = {
  idle: 'Idle',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export function AgentStatusView({ status }: { status: Status }) {
  return (
    <section className="agent-status" aria-label="Agent status">
      <h2 className="section-title">Agent status</h2>
      <p className="agent-status__value" data-status={status}>
        {STATUS_COPY[status]}
      </p>
    </section>
  )
}
