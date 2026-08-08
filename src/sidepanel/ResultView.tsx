import type {
  AnalyzePageResult,
  DemoResult,
  LearningPathResult,
  SummarizeInPortugueseResult,
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
    </dl>
  )
}

function SummarizePtResultView({ result }: { result: SummarizeInPortugueseResult }) {
  return (
    <dl className="result-view__fields">
      <div>
        <dt>Detected language</dt>
        <dd>{result.language}</dd>
      </div>
      <div>
        <dt>Summary (Portuguese)</dt>
        <dd>{result.summaryPt || '—'}</dd>
      </div>
      <div>
        <dt>Foundation language</dt>
        <dd>{result.foundationLanguage}</dd>
      </div>
      <div>
        <dt>Translated inbound</dt>
        <dd>{result.translatedInbound ? 'Yes' : 'No'}</dd>
      </div>
    </dl>
  )
}

export function ResultView({
  workflowId,
  result,
}: {
  workflowId?: WorkflowId
  result?: unknown
}) {
  if (!result || !workflowId) {
    return (
      <section className="result-view" aria-label="Result">
        <h2 className="section-title">Result</h2>
        <p className="result-view__empty">No Result yet.</p>
      </section>
    )
  }

  const demoResult = result as DemoResult

  return (
    <section className="result-view" aria-label="Result" data-workflow={workflowId}>
      <h2 className="section-title">Result</h2>
      {workflowId === 'analyzePage' ? (
        <AnalyzeResultView result={demoResult as AnalyzePageResult} />
      ) : null}
      {workflowId === 'learningPath' ? (
        <LearningPathResultView result={demoResult as LearningPathResult} />
      ) : null}
      {workflowId === 'summarizeInPortuguese' ? (
        <SummarizePtResultView result={demoResult as SummarizeInPortugueseResult} />
      ) : null}
    </section>
  )
}
