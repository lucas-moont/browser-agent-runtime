import { DEMO_GOALS, type DemoGoal } from '../runtime'

export function GoalControls({
  selectedDemoId,
  customGoal,
  running,
  onSelectDemo,
  onCustomGoalChange,
  onRun,
}: {
  selectedDemoId: DemoGoal['id'] | null
  customGoal: string
  running: boolean
  onSelectDemo: (goal: DemoGoal) => void
  onCustomGoalChange: (value: string) => void
  onRun: () => void
}) {
  const canRun = !running && (selectedDemoId !== null || customGoal.trim().length > 0)

  return (
    <section className="goal-controls" aria-label="Goal">
      <h2 className="section-title">Goal</h2>
      <div className="goal-controls__chips" role="group" aria-label="Demo Goals">
        {DEMO_GOALS.map((goal) => {
          const selected = selectedDemoId === goal.id && customGoal.trim().length === 0
          return (
            <button
              key={goal.id}
              type="button"
              className="goal-controls__chip"
              data-selected={selected ? 'true' : 'false'}
              aria-pressed={selected}
              disabled={running}
              onClick={() => onSelectDemo(goal)}
            >
              {goal.label}
            </button>
          )
        })}
      </div>
      <label className="goal-controls__custom">
        <span className="goal-controls__custom-label">Custom Goal</span>
        <textarea
          className="goal-controls__input"
          rows={2}
          value={customGoal}
          disabled={running}
          placeholder="Or type a Goal mapped to a demo Workflow"
          onChange={(event) => onCustomGoalChange(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="goal-controls__run"
        disabled={!canRun}
        onClick={onRun}
      >
        {running ? 'Running…' : 'Run'}
      </button>
    </section>
  )
}
