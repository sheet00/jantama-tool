import type { DangerAssessment } from '../engine/danger'
import { tileById } from '../domain/tiles'

type Props = { assessments: DangerAssessment[] }

const LEVEL_LABEL = { safe: '安全', caution: '比較的安全', danger: '危険' } as const

export function DangerResults({ assessments }: Props) {
  if (!assessments.length) return null
  return <section className="panel danger-panel">
    <div className="panel-heading compact"><div><span className="step danger-step">03</span><div><h2>相手の危険牌</h2><p>リーチ・副露・現物・筋・壁から判定</p></div></div><span className="calculating">{assessments.filter((assessment) => assessment.level === 'danger').length}枚が危険</span></div>
    <div className="danger-list">{assessments.map((assessment) => { const tile = tileById(assessment.tile); return <article className={`danger-card danger-${assessment.level}`} key={assessment.tile}><div className={`result-tile tile tile-small suit-${tile.suit}`}><img className="tile-art" src={`/tiles/${tile.asset}`} alt="" /></div><div className="danger-main"><strong>{LEVEL_LABEL[assessment.level]}</strong><small>{assessment.reasons.join('・')}</small></div></article> })}</div>
    <p className="danger-note">リーチ後に他家が捨てて通った牌は、そのリーチ相手への現物として扱います。筋・壁は完全な安全牌ではありません。</p>
  </section>
}
