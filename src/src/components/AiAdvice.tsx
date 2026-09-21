import { useState, useMemo } from 'react'

type Props = {
  onGetAdvice: () => Promise<void>
  loading: boolean
  advice: string | null
  error: string | null
  lastUpdated: Date | null
}

type SectionType = 'policy' | 'discard' | 'yaku' | 'caution' | 'general'

type AdviceSection = {
  type: SectionType
  badge: string
  title: string
  content: string
}

function stripEmoji(text: string): string {
  return text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}]/gu, '').trim()
}

function parseAdvice(text: string): AdviceSection[] {
  const sections: AdviceSection[] = []
  const rawSections = text.split(/(?=###\s+)/)

  for (const raw of rawSections) {
    const trimmed = raw.trim()
    if (!trimmed) continue

    const match = trimmed.match(/^###\s+([^\n]+)\n([\s\S]*)$/)
    if (match) {
      const header = stripEmoji(match[1].trim())
      const content = match[2].trim()

      let type: SectionType = 'general'
      let badge = '解説'
      let title = header

      if (header.includes('方針')) {
        type = 'policy'
        badge = '方針'
        title = header
      } else if (header.includes('打牌')) {
        type = 'discard'
        badge = '推奨打牌'
        title = header
      } else if (header.includes('役') || header.includes('展開')) {
        type = 'yaku'
        badge = '狙い目'
        title = header
      } else if (header.includes('警戒') || header.includes('注意')) {
        type = 'caution'
        badge = '注意'
        title = header
      }

      sections.push({ type, badge, title, content })
    } else {
      sections.push({ type: 'general', badge: '情報', title: 'アドバイス', content: trimmed })
    }
  }

  return sections
}

export function AiAdvice({ onGetAdvice, loading, advice, error, lastUpdated }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const sections = useMemo(() => advice ? parseAdvice(advice) : [], [advice])

  return (
    <section className="panel ai-advice-panel">
      <div className="panel-heading compact">
        <div className="ai-heading-title">
          <span className="step ai-step">AI</span>
          <div>
            <h2>リアルタイムアドバイス</h2>
            {lastUpdated && (
              <p className="advice-timestamp">
                最終取得: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            )}
          </div>
        </div>
        {advice && (
          <button
            type="button"
            className="text-button"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? '開く' : '閉じる'}
          >
            {collapsed ? '開く ＋' : '閉じる −'}
          </button>
        )}
      </div>

      <div className="ai-actions-bar">
        <button
          type="button"
          className="ai-fetch-button"
          onClick={() => void onGetAdvice()}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="ai-spinner" />
              思考中...
            </>
          ) : (
            'AIアドバイス取得'
          )}
        </button>
      </div>

      {error && (
        <div className="ai-error-box">
          <strong>取得失敗</strong>
          <p>{error}</p>
          <button type="button" className="text-button" onClick={() => void onGetAdvice()}>再試行</button>
        </div>
      )}

      {loading && !advice && (
        <div className="ai-loading-box">
          <div className="ai-pulsing-circle" />
          <p>盤面と牌効率・危険度データをGeminiに送信中...</p>
        </div>
      )}

      {!advice && !loading && !error && (
        <div className="ai-empty-prompt">
          <p>ボタンを押すと、現在の局面（手牌・河・残り山・牌効率・危険度）を総合判断してアドバイスします。</p>
        </div>
      )}

      {advice && !collapsed && (
        <div className={`ai-content-area ${loading ? 'updating' : ''}`}>
          {sections.map((sec, i) => (
            <article key={i} className={`ai-section-card sec-${sec.type}`}>
              <div className="ai-section-header">
                <span className="ai-section-badge">{sec.badge}</span>
                <strong>{sec.title}</strong>
              </div>
              <div className="ai-section-body">
                {sec.content.split('\n').map((line, idx) => {
                  const trimmedLine = line.trim()
                  if (!trimmedLine) return null
                  if (trimmedLine === '---') return <hr key={idx} className="ai-divider" />
                  
                  if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
                    const cleanText = stripEmoji(trimmedLine.replace(/^[*-]\s+/, ''))
                    return (
                      <li key={idx} className="ai-list-item">
                        {renderBoldText(cleanText)}
                      </li>
                    )
                  }
                  
                  return <p key={idx} className="ai-paragraph">{renderBoldText(stripEmoji(trimmedLine))}</p>
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function renderBoldText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}
