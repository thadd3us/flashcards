import { defineStore } from 'pinia';
import type { AnswerEvent, SpeedTier } from '../types/answerEvent';
import { classifyTier } from '../types/answerEvent';
import { computeProficiency } from '../utils/scoring';
import * as ipc from '../utils/ipc';
import { v4 as uuidv4 } from 'uuid';

export const APP_VERSION = '0.1.0';

type Phase =
  | 'boot'
  | 'needs-user'
  | 'needs-db'
  | 'ready';

interface State {
  phase: Phase;
  username: string | null;
  sessionStart: string | null;
  history: AnswerEvent[]; // session events, appended newest-last
  allTimeHistory: AnswerEvent[]; // full history for current user loaded at startup
  combo: number;
  bestCombo: number;
  lastTier: SpeedTier | null;
  lastFlashKey: number;
  comboMilestone: number;
  comboMilestoneKey: number;
  personalRecords: Record<string, number>;
  scoreHistory: number[];
  panic: boolean;
  dbPath: string | null;
  users: string[];
  tab: 'play' | 'stats';
  showSessionSummary: boolean;
  lastPr: { questionUuid: string; ms: number; key: number } | null;
}

function nowIso(): string {
  const d = new Date();
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? '+' : '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  const hh = pad(Math.floor(Math.abs(tz) / 60));
  const mm = pad(Math.abs(tz) % 60);
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes()) +
    ':' +
    pad(d.getSeconds()) +
    sign +
    hh +
    ':' +
    mm
  );
}

export const useSessionStore = defineStore('session', {
  state: (): State => ({
    phase: 'boot',
    username: null,
    sessionStart: null,
    history: [],
    allTimeHistory: [],
    combo: 0,
    bestCombo: 0,
    lastTier: null,
    lastFlashKey: 0,
    comboMilestone: 0,
    comboMilestoneKey: 0,
    personalRecords: {},
    scoreHistory: [],
    panic: false,
    dbPath: null,
    users: [],
    tab: 'play',
    showSessionSummary: false,
    lastPr: null,
  }),
  getters: {
    combinedHistory(state): AnswerEvent[] {
      return [...state.allTimeHistory, ...state.history];
    },
    currentProficiency(state): number {
      const combined = [...state.allTimeHistory, ...state.history];
      return computeProficiency(combined);
    },
  },
  actions: {
    async boot() {
      const prefs = await ipc.getPrefs();
      this.dbPath = prefs.db_path;
      if (prefs.db_path) {
        try {
          await ipc.openDb(prefs.db_path);
        } catch (e) {
          console.warn('Could not open stored db', e);
          this.dbPath = null;
        }
      }
      if (!this.dbPath) {
        this.phase = 'needs-db';
        return;
      }
      const users = await ipc.listUsers();
      this.users = users.map((u) => u.username);
      this.phase = 'needs-user';
    },
    async openExistingDb() {
      const path = await ipc.pickExistingDb();
      if (!path) return;
      await ipc.openDb(path);
      await ipc.setPref('db_path', path);
      this.dbPath = path;
      const users = await ipc.listUsers();
      this.users = users.map((u) => u.username);
      this.phase = 'needs-user';
    },
    async createNewDb() {
      const path = await ipc.chooseDbPath();
      if (!path) return;
      await ipc.openDb(path);
      await ipc.setPref('db_path', path);
      this.dbPath = path;
      const users = await ipc.listUsers();
      this.users = users.map((u) => u.username);
      this.phase = 'needs-user';
    },
    async selectUser(name: string, isNew: boolean) {
      if (isNew) {
        await ipc.createUser({
          username: name,
          created_at: nowIso(),
          app_version: APP_VERSION,
        });
        if (!this.users.includes(name)) this.users.push(name);
      }
      await ipc.setPref('last_username', name);
      this.username = name;
      this.sessionStart = nowIso();
      this.history = [];
      this.combo = 0;
      this.bestCombo = 0;
      this.scoreHistory = [];
      this.personalRecords = {};
      this.allTimeHistory = await ipc.getAnswerHistory(name);
      // seed PRs from history
      for (const e of this.allTimeHistory) {
        if (e.is_correct && !e.is_timeout) {
          const cur = this.personalRecords[e.question_uuid];
          if (cur === undefined || e.response_time_ms < cur) {
            this.personalRecords[e.question_uuid] = e.response_time_ms;
          }
        }
      }
      this.scoreHistory.push(this.currentProficiency);
      this.phase = 'ready';
    },
    async recordAnswer(input: {
      question: AnswerEvent['question'];
      responseMs: number;
      isCorrect: boolean;
      isTimeout: boolean;
      answerSubmitted: number | null;
    }) {
      if (!this.username) return;
      const event: AnswerEvent = {
        uuid: uuidv4(),
        question_uuid: input.question.uuid,
        question: input.question,
        username: this.username,
        timestamp: nowIso(),
        response_time_ms: input.responseMs,
        is_correct: input.isCorrect,
        is_timeout: input.isTimeout,
        answer_submitted: input.answerSubmitted,
        app_version: APP_VERSION,
      };
      this.history.push(event);
      try {
        await ipc.logAnswerEvent(event);
      } catch (e) {
        console.warn('Could not log event', e);
      }
      const tier = classifyTier(event);
      this.lastTier = tier;
      this.lastFlashKey++;
      if (event.is_correct && !event.is_timeout) {
        this.combo += 1;
        if (this.combo > this.bestCombo) this.bestCombo = this.combo;
        if (this.combo > 0 && this.combo % 5 === 0) {
          this.comboMilestone = this.combo;
          this.comboMilestoneKey++;
        }
        const prior = this.personalRecords[event.question_uuid];
        if (prior === undefined || event.response_time_ms < prior) {
          this.personalRecords[event.question_uuid] = event.response_time_ms;
          if (prior !== undefined) {
            this.lastPr = {
              questionUuid: event.question_uuid,
              ms: event.response_time_ms,
              key: this.lastFlashKey,
            };
          }
        }
      } else {
        this.combo = 0;
      }
      this.scoreHistory.push(this.currentProficiency);
      if (this.scoreHistory.length > 500) this.scoreHistory.shift();
    },
    setPanic(on: boolean) {
      this.panic = on;
    },
    async endSession() {
      try {
        await ipc.checkpointDb();
      } catch {
        /* ignore */
      }
      this.showSessionSummary = true;
    },
    dismissSessionSummary() {
      this.showSessionSummary = false;
    },
    setTab(t: 'play' | 'stats') {
      this.tab = t;
    },
  },
});
