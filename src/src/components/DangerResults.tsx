import type { CSSProperties } from 'react'
import type { DangerAssessment } from '../engine/danger'
import { tileById } from '../domain/tiles'

type Props = { assessments: DangerAssessment[] }

const LEVEL_LABEL = { safe: '安全', caution: '比較的安全', danger: '危険' } as const

/** dangerScore 0〜1 をスコア 0〜100 に換算し、50以上の危険牌に色を付ける */
function cardStyle(assessment: DangerAssessment): CSSProperties | undefined {
  if (assessment.level !== 'danger') return undefined
  const pct = assessment.dangerScore * 100
  if (pct < 50) return undefined
  const hue = Math.max(0, 30 - (pct - 50) * 0.6)
  return {
    borderColor: `hsl(${hue}deg 65% 72%)`,
    backgroundColor: `hsl(${hue}deg 80% 95%)`,
  }
}

function strongStyle(assessment: DangerAssessment): CSSProperties | undefined {
  if (assessment.level !== 'danger') return undefined
  const pct = assessment.dangerScore * 100
  if (pct < 50) return undefined
  const hue = Math.max(0, 30 - (pct - 50) * 0.6)
  return { color: `hsl(${hue}deg 70% 35%)` }
}

function scoreBadgeStyle(assessment: DangerAssessment): CSSProperties | undefined {
  const pct = Math.round(assessment.dangerScore * 100)
  if (assessment.level === 'danger' && pct >= 50) {
    const hue = Math.max(0, 30 - (pct - 50) * 0.6)
    return {
      backgroundColor: `hsl(${hue}deg 75% 45%)`,
      color: '#ffffff',
    }
  }
  if (assessment.level === 'caution') {
    return {
      backgroundColor: '#ead5a8',
      color: '#6b4d13',
    }
  }
  if (assessment.level === 'safe') {
    return {
      backgroundColor: '#b9dcc5',
      color: '#245935',
    }
  }
  return {
    backgroundColor: '#e5b9b5',
    color: '#72251d',
  }
}

export function DangerResults({ assessments }: Props) {
  if (!assessments.length) return null
  return <section className="panel danger-panel">
    <div className="panel-heading compact">
      <div>
        <span className="step danger-step">03</span>
        <div>
          <h2>相手の危険牌</h2>
          <p>リーチ・副露・現物・筋・壁から判定</p>
        </div>
      </div>
      <span className="calculating">{assessments.filter((a) => a.level === 'danger').length}枚が危険</span>
    </div>
    <div className="danger-list">
      {assessments.map((assessment) => {
        const tile = tileById(assessment.tile)
        const score = Math.round(assessment.dangerScore * 100)
        return <article className={`danger-card danger-${assessment.level}`} key={assessment.tile} style={cardStyle(assessment)}>
          <div className={`result-tile tile tile-small suit-${tile.suit}`}>
            <img className="tile-art" src={`/tiles/${tile.asset}`} alt="" />
          </div>
          <div className="danger-main">
            <strong style={strongStyle(assessment)}>{LEVEL_LABEL[assessment.level]}</strong>
            <small>{assessment.reasons.join('・')}</small>
          </div>
          <div className="danger-score-badge" style={scoreBadgeStyle(assessment)}>
            {score}
          </div>
        </article>
      })}
    </div>
    <p className="danger-note">リーチ後に他家が捨てて通った牌は、そのリーチ相手への現物として扱います。筋・壁は完全な安全牌ではありません。</p>
  </section>
}
