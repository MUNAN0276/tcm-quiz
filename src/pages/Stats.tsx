import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import questions from '../data/questions.json';
import { getAllRecords, getDailyStats } from '../db';
import type { Question, UserRecord, DailyStat, QuestionType } from '../types';
import { TYPE_LABELS, TYPE_ORDER } from '../types';

const ALL = questions as Question[];

const byType: Record<QuestionType, Question[]> = { single: [], multiple: [], fill: [], bool: [] };
for (const q of ALL) {
  byType[q.type].push(q);
}

// Simulated knowledge points based on question index ranges
const KNOWLEDGE_POINTS = [
  { name: '基础理论', range: [0, 150] },
  { name: '诊断', range: [150, 280] },
  { name: '中药', range: [280, 410] },
  { name: '方剂', range: [410, 540] },
  { name: '内科', range: [540, 670] },
  { name: '针灸', range: [670, 780] },
  { name: '妇科', range: [780, 880] },
  { name: '儿科', range: [880, 982] },
];

export default function Stats() {
  const [records, setRecords] = useState<UserRecord[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllRecords(), getDailyStats(7)]).then(([recs, ds]) => {
      setRecords(recs);
      setDailyStats(ds);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="empty-state">加载中...</div>;

  const recMap = new Map(records.map((r) => [r.questionId, r]));
  const practiced = records.length;
  const total = ALL.length;
  const correct = records.filter((r) => r.lastCorrect).length;
  const rate = practiced > 0 ? Math.round((correct / practiced) * 100) : 0;
  const mastered = records.filter((r) => r.status === 'mastered').length;

  // Last 7 days chart
  const days: { label: string; total: number; correct: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const found = dailyStats.find((s) => s.date === key);
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    days.push({
      label: `${d.getMonth() + 1}/${d.getDate()} 周${dayNames[d.getDay()]}`,
      total: found?.total || 0,
      correct: found?.correct || 0,
    });
  }
  const maxTotal = Math.max(...days.map((d) => d.total), 1);

  // Knowledge mastery
  const knowledge = KNOWLEDGE_POINTS.map((kp) => {
    const qs = ALL.slice(kp.range[0], kp.range[1]);
    const recs = qs
      .map((q) => recMap.get(q.id))
      .filter(Boolean) as UserRecord[];
    const done = recs.length;
    const right = recs.filter((r) => r.lastCorrect).length;
    const pct = done > 0 ? Math.round((right / done) * 100) : 0;
    return { name: kp.name, done, total: qs.length, pct };
  });

  // Type accuracy
  const typeAcc = TYPE_ORDER.map((t) => {
    const qs = byType[t];
    const recs = qs
      .map((q) => recMap.get(q.id))
      .filter(Boolean) as UserRecord[];
    const done = recs.length;
    const right = recs.filter((r) => r.lastCorrect).length;
    const pct = done > 0 ? Math.round((right / done) * 100) : 0;
    return { type: t, label: TYPE_LABELS[t], done, total: qs.length, pct };
  });

  return (
    <div>
      <div className="header">
        <Link to="/" className="header-back">←</Link>
        <h1 className="page-title" style={{ margin: 0, padding: 0, fontSize: 18 }}>统计分析</h1>
      </div>

      {/* Overview */}
      <div className="stats-page">
        <div className="section-title">总览</div>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)' }}>{practiced}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>已练习 / {total}</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>{rate}%</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>正确率</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--warning)' }}>{mastered}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>已掌握</div>
          </div>
        </div>
      </div>

      {/* 7-day chart */}
      <div className="stats-page">
        <div className="section-title">近 7 天练习</div>
        <div className="chart-bar-row">
          {days.map((d) => (
            <div key={d.label} className="chart-bar-col">
              <div
                className="chart-bar"
                style={{ height: `${(d.total / maxTotal) * 140}px` }}
              >
                {d.total > 0 && <span className="cnt">{d.total}</span>}
              </div>
              <span className="chart-label">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge mastery */}
      <div className="stats-page">
        <div className="section-title">知识点掌握度</div>
        {knowledge.map((k) => (
          <div key={k.name} className="skill-row">
            <span className="skill-name">{k.name}</span>
            <div className="skill-bar">
              <div
                className="skill-bar-fill"
                style={{ width: `${k.pct}%` }}
              />
            </div>
            <span className="skill-pct">{k.pct}%</span>
          </div>
        ))}
      </div>

      {/* Type accuracy */}
      <div className="stats-page">
        <div className="section-title">题型正确率</div>
        {typeAcc.map((t) => (
          <div key={t.type} className="skill-row">
            <span className="skill-name">{t.label}</span>
            <div className="skill-bar">
              <div
                className="skill-bar-fill"
                style={{ width: `${t.pct}%` }}
              />
            </div>
            <span className="skill-pct">{t.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
