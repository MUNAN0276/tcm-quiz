import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import questions from '../data/questions.json';
import { getAllRecords, toggleBookmark } from '../db';
import type { Question, UserRecord, QuestionType } from '../types';
import { TYPE_LABELS, TYPE_ORDER } from '../types';

const ALL = questions as Question[];

const qMap = new Map<string, Question>();
for (const q of ALL) {
  qMap.set(q.id, q);
}

type Filter = 'all' | 'weak' | 'bookmarked';

export default function ErrorBook() {
  const [records, setRecords] = useState<UserRecord[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    const all = await getAllRecords();
    setRecords(all);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Filter: all weak + bookmarked (never auto-remove from error book)
  let errorItems = records.filter((r) => {
    return r.isBookmarked || r.status === 'weak';
  });

  // Apply sub-filter
  if (filter === 'weak') {
    errorItems = errorItems.filter((r) => r.status === 'weak');
  } else if (filter === 'bookmarked') {
    errorItems = errorItems.filter((r) => r.isBookmarked);
  }

  // Group by type, sorted by wrongCount desc within each group
  const grouped: Record<QuestionType, UserRecord[]> = { single: [], multiple: [], fill: [], bool: [] };
  for (const r of errorItems) {
    const q = qMap.get(r.questionId);
    if (q && grouped[q.type]) {
      grouped[q.type].push(r);
    }
  }
  for (const t of TYPE_ORDER) {
    grouped[t].sort((a, b) => b.wrongCount - a.wrongCount);
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleBookmark = async (id: string) => {
    await toggleBookmark(id);
    await load();
  };

  if (loading) return <div className="empty-state">加载中...</div>;

  return (
    <div>
      <div className="header">
        <Link to="/" className="header-back">←</Link>
        <h1 className="page-title" style={{ margin: 0, padding: 0, fontSize: 18 }}>错题本</h1>
      </div>

      <div className="filter-tabs">
        {(['all', 'weak', 'bookmarked'] as Filter[]).map((f) => (
          <button
            key={f}
            className={`filter-tab${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {{ all: '全部', weak: '薄弱', bookmarked: '已收藏' }[f]}
          </button>
        ))}
      </div>

      {TYPE_ORDER.map((t) => {
        const items = grouped[t];
        if (items.length === 0) return null;
        return (
          <div key={t} style={{ marginBottom: 24 }}>
            <div className="section-title">{TYPE_LABELS[t]} ({items.length})</div>
            {items.map((r) => {
              const q = qMap.get(r.questionId);
              if (!q) return null;
              const isExp = expanded.has(r.questionId);
              return (
                <div key={r.questionId} className="error-item">
                  <div className="ei-header">
                    <span className="ei-count">错误 {r.wrongCount} 次</span>
                    <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>#{q.order}</span>
                  </div>
                  <div className="ei-title">{q.title}</div>
                  <div className="ei-actions">
                    <button onClick={() => toggleExpand(r.questionId)}>
                      {isExp ? '收起' : '展开详情'}
                    </button>
                    <button onClick={() => handleToggleBookmark(r.questionId)}>
                      {r.isBookmarked ? '取消收藏' : '收藏'}
                    </button>
                  </div>
                  {isExp && (
                    <div className="ei-detail">
                      <p><strong>你的答案：</strong>{r.lastAnswer === 'correct' ? '正确' : '错误'}</p>
                      <p><strong>正确答案：</strong>
                        {q.type === 'fill'
                          ? q.answer
                          : q.answer.split('').map((k) => `${k}. ${q.options[k] || k}`).join('；')}
                      </p>
                      {q.type !== 'fill' && (
                        <p><strong>选项：</strong>
                          {Object.entries(q.options).map(([k, v]) => `${k}. ${v}`).join('；')}
                        </p>
                      )}
                      {q.analysis && <p><strong>解析：</strong>{q.analysis}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {errorItems.length === 0 && (
        <div className="empty-state">暂无错题</div>
      )}

      {errorItems.length > 0 && (
        <button
          className="submit-btn"
          style={{ marginTop: 16 }}
          onClick={() => navigate('/quiz/reinforce/all')}
        >
          重练全部错题
        </button>
      )}
    </div>
  );
}
