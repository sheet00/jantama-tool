export function AnalysisRules() {
  return <section className="panel settings-panel">
    <div className="panel-heading compact"><div><span className="step">02</span><div><h2>最適解を確認</h2><p>受け入れ枚数とシャンテン数で比較</p></div></div><span className="live-pill">EXACT</span></div>
    <div className="method-card"><span className="method-icon">↗</span><div><strong>受け入れ最大でランキング</strong><small>同じシャンテン数なら、有効牌の枚数が多い順に表示します。</small></div></div>
    <div className="rule-list"><div><span>1</span><p>シャンテン数を最小化</p></div><div><span>2</span><p>有効牌の枚数を最大化</p></div><div><span>3</span><p>同率なら形の良さで判定</p></div></div>
  </section>
}
