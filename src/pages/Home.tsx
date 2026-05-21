import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import questions from '../data/questions.json';
import { getAllRecords } from '../db';
import type { Question, UserRecord, QuestionType } from '../types';
import { TYPE_LABELS, TYPE_ORDER } from '../types';

const ALL = questions as Question[];

function groupByType(): Record<QuestionType, Question[]> {
  const g: Record<QuestionType, Question[]> = { single: [], multiple: [], fill: [], bool: [] };
  for (const q of ALL) {
    g[q.type].push(q);
  }
  return g;
}

export default function Home() {
  const [records, setRecords] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllRecords().then((r) => {
      setRecords(r);
      setLoading(false);
    });
  }, []);

  const recMap = new Map(records.map((r) => [r.questionId, r]));
  const byType = groupByType();

  const total = ALL.length;
  const practiced = records.length;
  const correct = records.filter((r) => r.lastCorrect).length;
  const wrong = records.filter((r) => r.wrongCount > 0).length;
  const rate = practiced > 0 ? Math.round((correct / practiced) * 100) : 0;

  function typeStats(t: QuestionType) {
    const qs = byType[t];
    const totalT = qs.length;
    const recs = qs
      .map((q) => recMap.get(q.id))
      .filter(Boolean) as UserRecord[];
    const done = recs.length;
    const right = recs.filter((r) => r.lastCorrect).length;
    const rateT = done > 0 ? Math.round((right / done) * 100) : 0;
    const weak = recs.filter((r) => r.wrongCount > 0).length;
    return { total: totalT, done, rate: rateT, weak };
  }

  function errorCount(t: QuestionType) {
    return byType[t].filter((q) => {
      const r = recMap.get(q.id);
      if (!r) return false;
      if (r.status === 'mastered') return false;
      if (r.consecutiveCorrect >= 3) return false;
      return r.isBookmarked || r.status === 'weak';
    }).length;
  }

  if (loading) return <div className="empty-state">加载中...</div>;

  return (
    <div>
      <h1 className="page-title">中医刷题</h1>

      {/* 统计概览 */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="val">{total}</div>
          <div className="lbl">总题量</div>
        </div>
        <div className="stat-card">
          <div className="val">{practiced}</div>
          <div className="lbl">已练习</div>
        </div>
        <div className="stat-card">
          <div className="val">{rate}%</div>
          <div className="lbl">正确率</div>
        </div>
        <div className="stat-card">
          <div className="val" style={{ color: 'var(--danger)' }}>{wrong}</div>
          <div className="lbl">薄弱</div>
        </div>
      </div>

      {/* 快捷入口 */}
      <div className="quick-actions">
        <Link to="/quiz/all" className="quick-btn primary">
          全部刷题
        </Link>
        <Link to="/error-book" className="quick-btn orange">
          错题本
        </Link>
        <Link to="/stats" className="quick-btn teal">
          统计分析
        </Link>
      </div>

      {/* 题型分类 */}
      <div className="section">
        <div className="section-title">题型分类</div>
        <div className="type-grid">
          {TYPE_ORDER.map((t) => {
            const s = typeStats(t);
            return (
              <Link key={t} to={`/quiz/sequential/${t}`} className="type-card">
                <h3>{TYPE_LABELS[t]}</h3>
                <div className="meta">
                  <span>已练 {s.done}/{s.total}</span>
                  <span>正确率 {s.rate}%</span>
                </div>
                <div className="bar">
                  <div
                    className="bar-fill"
                    style={{ width: `${s.total > 0 ? (s.done / s.total) * 100 : 0}%` }}
                  />
                </div>
                <div className="footer-row">
                  <span>薄弱 {s.weak}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 错题强化 */}
      <div className="section">
        <div className="section-title">错题强化</div>
        <div className="error-grid">
          {TYPE_ORDER.map((t) => {
            const cnt = errorCount(t);
            return (
              <Link
                key={t}
                to={`/quiz/reinforce/${t}`}
                className={`error-card${cnt === 0 ? ' disabled' : ''}`}
              >
                <span>{TYPE_LABELS[t]}错题</span>
                <span className="badge">{cnt}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
