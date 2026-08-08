import type {
  AnalyzePageResult,
  ConversationalResult,
  DemoResult,
  LearningPathResult,
  SummarizePageResult,
  WorkflowId,
} from '../runtime'

function StringList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="result-view__empty-list">None</span>
  }
  return (
    <ul className="result-view__list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function AnalyzeResultView({ result }: { result: AnalyzePageResult }) {
  return (
    <dl className="result-view__fields">
      <div>
        <dt>Language</dt>
        <dd>{result.language}</dd>
      </div>
      <div>
        <dt>Summary</dt>
        <dd>{result.summary || '—'}</dd>
      </div>
      <div>
        <dt>Topics</dt>
        <dd>
          <StringList items={result.topics} />
        </dd>
      </div>
      <div>
        <dt>Concepts</dt>
        <dd>
          <StringList items={result.concepts} />
        </dd>
      </div>
      <div>
        <dt>Preferred language</dt>
        <dd>{result.preferredLanguage}</dd>
      </div>
    </dl>
  )
}

function LearningPathResultView({ result }: { result: LearningPathResult }) {
  return (
    <dl className="result-view__fields">
      <div>
        <dt>Prerequisites</dt>
        <dd>
          <StringList items={result.prerequisites} />
        </dd>
      </div>
      <div>
        <dt>Concepts</dt>
        <dd>
          <StringList items={result.concepts} />
        </dd>
      </div>
      <div>
        <dt>Sequence</dt>
        <dd>
          <StringList items={result.sequence} />
        </dd>
      </div>
      <div>
        <dt>Next topics</dt>
        <dd>
          <StringList items={result.nextTopics} />
        </dd>
      </div>
      <div>
        <dt>Preferred language</dt>
        <dd>{result.preferredLanguage}</dd>
      </div>
    </dl>
  )
}

function SummarizePageResultView({ result }: { result: SummarizePageResult }) {
  return (
    <dl className="result-view__fields">
      <div>
        <dt>Detected language</dt>
        <dd>{result.language}</dd>
      </div>
      <div>
        <dt>Summary</dt>
        <dd>{result.summary || '—'}</dd>
      </div>
      <div>
        <dt>Foundation language</dt>
        <dd>{result.foundationLanguage}</dd>
      </div>
      <div>
        <dt>Preferred language</dt>
        <dd>{result.preferredLanguage}</dd>
      </div>
      <div>
        <dt>Translated inbound</dt>
        <dd>{result.translatedInbound ? 'Yes' : 'No'}</dd>
      </div>
    </dl>
  )
}

function ConversationalResultView({ result }: { result: ConversationalResult }) {
  return (
    <div className="result-view__reply">
      <p className="result-view__reply-text">{result.reply || '—'}</p>
    </div>
  )
}

export function ResultView({
  workflowId,
  result,
  compact = false,
}: {
  workflowId?: WorkflowId
  result?: unknown
  compact?: boolean
}) {
  if (!result || !workflowId) {
    if (compact) {
      return null
    }
    return (
      <section className="result-view" aria-label="Result">
        <h2 className="section-title">Result</h2>
        <p className="result-view__empty">No Result yet.</p>
      </section>
    )
  }

  const demoResult = result as DemoResult

  return (
    <section
      className={compact ? 'result-view result-view--compact' : 'result-view'}
      aria-label="Result"
      data-workflow={workflowId}
    >
      {compact || workflowId === 'conversational' ? null : (
        <h2 className="section-title">Result</h2>
      )}
      {workflowId === 'analyzePage' ? (
        <AnalyzeResultView result={demoResult as AnalyzePageResult} />
      ) : null}
      {workflowId === 'learningPath' ? (
        <LearningPathResultView result={demoResult as LearningPathResult} />
      ) : null}
      {workflowId === 'summarizePage' ? (
        <SummarizePageResultView result={demoResult as SummarizePageResult} />
      ) : null}
      {workflowId === 'conversational' ? (
        <ConversationalResultView result={demoResult as ConversationalResult} />
      ) : null}
    </section>
  )
}
