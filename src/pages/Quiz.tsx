import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import questions from '../data/questions.json';
import { recordAnswer, getAllRecords } from '../db';
import type { Question, QuestionType, UserRecord } from '../types';
import { TYPE_LABELS, TYPE_ORDER } from '../types';

const ALL = questions as Question[];

const byType: Record<QuestionType, Question[]> = { single: [], multiple: [], fill: [], bool: [] };
for (const q of ALL) {
  byType[q.type].push(q);
}

interface QuizState {
  answered: boolean;
  selected: string[];
  fillText: string;
  showAnswer: boolean;
  showAnalysis: boolean;
  isCorrect: boolean | null;
}

export default function Quiz() {
  const { mode, type: typeParam } = useParams<{ mode: string; type?: string }>();
  const navigate = useNavigate();

  const [questionList, setQuestionList] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [state, setState] = useState<QuizState>({
    answered: false,
    selected: [],
    fillText: '',
    showAnswer: false,
    showAnalysis: false,
    isCorrect: null,
  });
  const [records, setRecords] = useState<Map<string, UserRecord>>(new Map());
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ total: 0, correct: 0 });
  const [loaded, setLoaded] = useState(false);
  const jumpRef = useRef<HTMLInputElement>(null);

  // Build question list
  useEffect(() => {
    let list: Question[] = [];

    if (mode === 'all') {
      for (const t of TYPE_ORDER) {
        for (const q of byType[t]) {
          list.push(q);
        }
      }
    } else if (mode === 'sequential' && typeParam) {
      const t = typeParam as QuestionType;
      list = [...byType[t]];
    } else if (mode === 'reinforce' && typeParam) {
      getAllRecords().then((recs) => {
        const recMap = new Map(recs.map((r) => [r.questionId, r]));
        setRecords(recMap);
        const types =
          typeParam === 'all'
            ? TYPE_ORDER
            : [typeParam as QuestionType];
        const pool: Question[] = [];
        for (const t of types) {
          for (const q of byType[t]) {
            const r = recMap.get(q.id);
            if (!r) continue;
            if (r.status === 'mastered') continue;
            if (r.consecutiveCorrect >= 3) continue;
            if (r.isBookmarked || r.status === 'weak') {
              pool.push(q);
            }
          }
        }
        // Random shuffle for reinforce mode
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        setQuestionList(pool);
        setLoaded(true);
      });
      return;
    }

    setQuestionList(list);
    setLoaded(true);

    getAllRecords().then((recs) => {
      setRecords(new Map(recs.map((r) => [r.questionId, r])));
    });
  }, [mode, typeParam]);

  const current = questionList[currentIndex];
  const total = questionList.length;

  const resetState = useCallback(() => {
    setState({
      answered: false,
      selected: [],
      fillText: '',
      showAnswer: false,
      showAnalysis: false,
      isCorrect: null,
    });
  }, []);

  const goTo = useCallback(
    (idx: number) => {
      if (idx >= 0 && idx < total) {
        setCurrentIndex(idx);
        resetState();
      }
    },
    [total, resetState]
  );

  const handleJump = () => {
    const val = parseInt(jumpRef.current?.value || '', 10);
    if (!isNaN(val)) {
      const idx = questionList.findIndex((q) => q.order === val);
      if (idx >= 0) goTo(idx);
      if (jumpRef.current) jumpRef.current.value = '';
    }
  };

  const checkAnswer = (userAnswer: string): boolean => {
    const ca = current.answer;
    if (current.type === 'fill') {
      // Split correct answer by ；or ；, check each part loosely
      const parts = ca.split(/[；;]/).map((p) => p.trim().replace(/\s+/g, '')).filter(Boolean);
      const normalized = userAnswer.trim().replace(/\s+/g, '');
      if (parts.length <= 1) {
        return normalized === parts[0] || normalized.includes(parts[0] || '');
      }
      // Multi-part: all parts must appear in the user answer
      return parts.every((p) => normalized.includes(p));
    }
    // For single/multiple/bool, compare sorted answers
    const user = userAnswer.split('').sort().join('');
    const correct = ca.split('').sort().join('');
    return user === correct;
  };

  const submitAnswer = async (userAnswer: string) => {
    const ok = checkAnswer(userAnswer);
    setState((s) => ({ ...s, answered: true, isCorrect: ok }));
    await recordAnswer(current.id, ok);
    const newStats = { total: stats.total + 1, correct: stats.correct + (ok ? 1 : 0) };
    setStats(newStats);
    // Refresh records
    const recs = await getAllRecords();
    setRecords(new Map(recs.map((r) => [r.questionId, r])));
  };

  const handleSingle = (opt: string) => {
    if (state.answered) return;
    setState((s) => ({ ...s, selected: [opt] }));
    submitAnswer(opt);
  };

  const handleMultiSelect = (opt: string) => {
    if (state.answered) return;
    setState((s) => {
      const sel = s.selected.includes(opt)
        ? s.selected.filter((x) => x !== opt)
        : [...s.selected, opt].sort();
      return { ...s, selected: sel };
    });
  };

  const handleMultiSubmit = () => {
    if (state.answered || state.selected.length === 0) return;
    submitAnswer(state.selected.join(''));
  };

  const handleFillSubmit = () => {
    if (state.answered || !state.fillText.trim()) return;
    submitAnswer(state.fillText.trim());
  };

  const handleBool = (opt: string) => {
    if (state.answered) return;
    setState((s) => ({ ...s, selected: [opt] }));
    submitAnswer(opt);
  };

  const handleDone = () => {
    setDone(true);
  };

  if (!loaded) return <div className="empty-state">加载中...</div>;

  if (done) {
    const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    return (
      <div className="completion">
        <div className="score">{pct}%</div>
        <p style={{ color: 'var(--gray-500)', marginTop: 8 }}>正确率</p>
        <div className="stats">
          <div>
            <div className="num">{stats.total}</div>
            <div className="lbl">总答题</div>
          </div>
          <div>
            <div className="num" style={{ color: 'var(--success)' }}>{stats.correct}</div>
            <div className="lbl">正确</div>
          </div>
          <div>
            <div className="num" style={{ color: 'var(--danger)' }}>{stats.total - stats.correct}</div>
            <div className="lbl">错误</div>
          </div>
        </div>
        <div className="actions">
          <Link to="/" className="btn-outline">返回首页</Link>
          <button className="btn-primary" onClick={() => { setDone(false); setCurrentIndex(0); resetState(); setStats({ total: 0, correct: 0 }); }}>
            再来一次
          </button>
        </div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div>
        <div className="header">
          <Link to="/" className="header-back">←</Link>
          <span style={{ flex: 1 }} />
        </div>
        <div className="empty-state">暂无题目</div>
      </div>
    );
  }

  const rec = records.get(current.id);
  const typeLabel = TYPE_LABELS[current.type];

  return (
    <div>
      {/* Top bar */}
      <div className="header">
        <Link to="/" className="header-back">←</Link>
        <div className="header-info">
          <strong>{currentIndex + 1}</strong> / {total}
          <span style={{ marginLeft: 8, color: 'var(--gray-400)' }}>表序 #{current.order}</span>
        </div>
        <span className="type-tag">{typeLabel}</span>
        <div className="quiz-jump">
          <input ref={jumpRef} placeholder="序号" onKeyDown={(e) => e.key === 'Enter' && handleJump()} />
          <button onClick={handleJump}>跳转</button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="quiz-progress" style={{ marginBottom: 16 }}>
        <div
          className="quiz-progress-fill"
          style={{ width: `${total > 0 ? ((currentIndex + 1) / total) * 100 : 0}%` }}
        />
      </div>

      {/* Question */}
      <div className="question-box">
        <h2>{current.title}</h2>
      </div>

      {/* View answer button (before submitting) */}
      {!state.answered && (
        <button
          className="view-answer-btn"
          onClick={() => setState((s) => ({ ...s, showAnswer: !s.showAnswer }))}
        >
          {state.showAnswer ? '隐藏答案' : '查看答案'}
        </button>
      )}

      {/* Show answer preview */}
      {state.showAnswer && !state.answered && (
        <div className="feedback correct">
          <div className="fb-header">正确答案</div>
          <div className="fb-row">
            {current.type === 'fill'
              ? current.answer
              : current.type === 'bool'
                ? current.options[current.answer] || current.answer
                : current.answer.split('').map((k) => `${k}. ${current.options[k] || k}`).join('；')}
          </div>
        </div>
      )}

      {/* Options - Single choice */}
      {current.type === 'single' &&
        Object.entries(current.options).map(([k, v]) => {
          let cls = 'opt-btn';
          if (state.answered) {
            if (k === current.answer) cls += ' correct';
            else if (state.selected.includes(k) && !state.isCorrect) cls += ' wrong';
          } else if (state.selected.includes(k)) {
            cls += ' selected';
          }
          return (
            <div key={k} className={cls} onClick={() => handleSingle(k)}>
              <span className="opt-label">{k}</span>
              <span>{v}</span>
            </div>
          );
        })}

      {/* Options - Multiple choice */}
      {current.type === 'multiple' && (
        <>
          <div className="options-list">
            {Object.entries(current.options).map(([k, v]) => {
              let cls = 'opt-btn';
              if (state.answered) {
                if (current.answer.includes(k)) cls += ' correct';
                else if (state.selected.includes(k)) cls += ' wrong';
              } else if (state.selected.includes(k)) {
                cls += ' selected';
              }
              return (
                <div key={k} className={cls} onClick={() => handleMultiSelect(k)}>
                  <span className="opt-label">{k}</span>
                  <span>{v}</span>
                </div>
              );
            })}
          </div>
          {!state.answered && (
            <button
              className="submit-btn"
              disabled={state.selected.length === 0}
              onClick={handleMultiSubmit}
            >
              确认提交
            </button>
          )}
        </>
      )}

      {/* Fill input */}
      {current.type === 'fill' && !state.answered && (
        <div>
          <input
            className="fill-input"
            placeholder="请输入答案..."
            value={state.fillText}
            onChange={(e) => setState((s) => ({ ...s, fillText: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleFillSubmit()}
          />
          <button className="submit-btn" disabled={!state.fillText.trim()} onClick={handleFillSubmit}>
            确认提交
          </button>
        </div>
      )}

      {/* Bool buttons */}
      {current.type === 'bool' && (
        <div className="bool-btns">
          {Object.entries(current.options).map(([k, v]) => {
            let cls = 'bool-btn';
            if (state.answered) {
              if (k === current.answer) cls += ' correct';
              else if (state.selected.includes(k) && !state.isCorrect) cls += ' wrong';
            }
            return (
              <button key={k} className={cls} onClick={() => handleBool(k)}>
                {v}
              </button>
            );
          })}
        </div>
      )}

      {/* Feedback */}
      {state.answered && (
        <div className={`feedback ${state.isCorrect ? 'correct' : 'wrong'}`}>
          <div className="fb-header">
            {state.isCorrect ? '回答正确' : '回答错误'}
          </div>
          <div className="fb-row">
            <strong>正确答案：</strong>
            {current.type === 'fill'
              ? current.answer
              : current.type === 'bool'
                ? current.options[current.answer] || current.answer
                : current.answer.split('').map((k) => `${k}. ${current.options[k] || k}`).join('；')}
          </div>
          {rec && (
            <div className="fb-row" style={{ fontSize: 13, color: 'var(--gray-500)' }}>
              累计错误 {rec.wrongCount} 次
            </div>
          )}
          {current.analysis && (
            <>
              <button
                className="toggle-analysis"
                onClick={() => setState((s) => ({ ...s, showAnalysis: !s.showAnalysis }))}
              >
                {state.showAnalysis ? '收起解析' : '展开解析'}
              </button>
              {state.showAnalysis && <div className="analysis-text">{current.analysis}</div>}
            </>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="nav-btns">
        <button
          className="nav-prev"
          disabled={currentIndex === 0}
          onClick={() => goTo(currentIndex - 1)}
        >
          上一题
        </button>
        {currentIndex < total - 1 ? (
          <button className="nav-next" onClick={() => goTo(currentIndex + 1)}>
            下一题
          </button>
        ) : (
          <button className="nav-next" onClick={handleDone}>
            查看结果
          </button>
        )}
      </div>
    </div>
  );
}
