import type { AgentEvent } from '../runtime'
import { formatTraceEventLabel } from './traceLabels'

export function AgentTrace({ events }: { events: AgentEvent[] }) {
  return (
    <section className="agent-trace" aria-label="Agent Trace">
      <h2 className="section-title">Agent Trace</h2>
      {events.length === 0 ? (
        <p className="agent-trace__empty">No Events yet. Run a Goal to populate the Trace.</p>
      ) : (
        <ol className="agent-trace__list">
          {events.map((event, index) => (
            <li
              key={`${event.type}-${event.at}-${index}`}
              className="agent-trace__item"
              data-event-type={event.type}
            >
              <span className="agent-trace__label">{formatTraceEventLabel(event)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
