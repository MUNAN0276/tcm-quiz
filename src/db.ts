import { openDB, type IDBPDatabase } from 'idb';
import type { UserRecord, DailyStat } from './types';

let db: IDBPDatabase | null = null;

async function getDB() {
  if (!db) {
    db = await openDB('tcm-quiz', 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('records')) {
          d.createObjectStore('records', { keyPath: 'questionId' });
        }
        if (!d.objectStoreNames.contains('dailyStats')) {
          d.createObjectStore('dailyStats', { keyPath: 'date' });
        }
      },
    });
  }
  return db;
}

export async function getRecord(questionId: string): Promise<UserRecord | undefined> {
  const d = await getDB();
  return d.get('records', questionId);
}

export async function getAllRecords(): Promise<UserRecord[]> {
  const d = await getDB();
  return d.getAll('records');
}

export async function saveRecord(record: UserRecord): Promise<void> {
  const d = await getDB();
  await d.put('records', record);
}

export async function getDailyStats(days: number): Promise<DailyStat[]> {
  const d = await getDB();
  const all = await d.getAll('dailyStats');
  const since = new Date();
  since.setDate(since.getDate() - days);
  const cutoff = since.toISOString().slice(0, 10);
  return all.filter((s) => s.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
}

export async function recordAnswer(questionId: string, isCorrect: boolean): Promise<void> {
  const d = await getDB();
  const existing = await d.get('records', questionId);
  const now = Date.now();

  const record: UserRecord = existing
    ? { ...existing }
    : {
        questionId,
        wrongCount: 0,
        consecutiveCorrect: 0,
        isBookmarked: false,
        status: 'learning' as const,
        lastAnswer: '',
        lastCorrect: false,
        updatedAt: now,
      };

  if (isCorrect) {
    record.consecutiveCorrect += 1;
    if (record.consecutiveCorrect >= 3) {
      record.status = 'mastered';
    }
    record.lastCorrect = true;
    record.lastAnswer = 'correct';
  } else {
    record.consecutiveCorrect = 0;
    record.wrongCount += 1;
    record.isBookmarked = true;
    record.lastCorrect = false;
    record.lastAnswer = 'wrong';
    if (record.wrongCount >= 2) {
      record.status = 'weak';
    } else {
      record.status = 'learning';
    }
  }
  record.updatedAt = now;
  await d.put('records', record);

  const today = new Date().toISOString().slice(0, 10);
  const ds = await d.get('dailyStats', today);
  if (ds) {
    ds.total += 1;
    if (isCorrect) ds.correct += 1;
    await d.put('dailyStats', ds);
  } else {
    await d.put('dailyStats', { date: today, total: 1, correct: isCorrect ? 1 : 0 });
  }
}

export async function toggleBookmark(questionId: string): Promise<void> {
  const d = await getDB();
  const record = await d.get('records', questionId);
  if (record) {
    record.isBookmarked = !record.isBookmarked;
    await d.put('records', record);
  }
}

export async function clearAllRecords(): Promise<void> {
  const d = await getDB();
  await d.clear('records');
  await d.clear('dailyStats');
}
