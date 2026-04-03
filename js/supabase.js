import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://xecrnuknfxxuowwsyfzx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9b3VzCwWgQyrCrf5FXv2pg_ML_PnuX2';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ─── AUTH HELPERS ─────────────────────────────────────────── */

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();
  return data;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/auth.html';
    return null;
  }
  return user;
}

export async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_admin) {
    window.location.href = '/index.html';
    return null;
  }
  return profile;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/auth.html';
}


/* ─── INVITE CODE HELPERS ──────────────────────────────────── */

export async function validateInviteCode(code) {
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (error || !data) return { valid: false, reason: 'Invalid code.' };
  if (data.used) return { valid: false, reason: 'Already used.' };
  
  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, reason: 'Code expired.' };
  }

  return { valid: true, data };
}

export async function markInviteCodeUsed(code, userId) {
  const { data, error } = await supabase
    .from('invite_codes')
    .update({ used: true, used_by: userId, used_at: new Date().toISOString() })
    .eq('code', code.trim().toUpperCase())
    .select()
    .single();

  return { data, error };
}

/* ─── USER HELPERS ─────────────────────────────────────────── */

export async function updateLastActive(userId) {
  await supabase
    .from('users')
    .update({ last_active: new Date().toISOString() })
    .eq('id', userId);
}

export async function updateBrainHealth(userId, value) {
  await supabase
    .from('users')
    .update({ brain_health: Math.max(0, Math.min(100, value)) })
    .eq('id', userId);
}

export function calcBrainHealth(lastActive) {
  if (!lastActive) return 0;
  const daysSince = (Date.now() - new Date(lastActive)) / (1000 * 60 * 60 * 24);
  if (daysSince <= 2) return 100;
  if (daysSince >= 7) return 0;
  return Math.round(100 - ((daysSince - 2) / 5) * 100);
}

/* ─── MODULE / CHAPTER HELPERS ─────────────────────────────── */

export async function getModules() {
  const { data } = await supabase.from('modules').select('*').order('name');
  return data || [];
}

export async function getChaptersByModule(moduleId) {
  const { data } = await supabase
    .from('chapters')
    .select('*')
    .eq('module_id', moduleId)
    .order('name');
  return data || [];
}

/* ─── QUESTION HELPERS ─────────────────────────────────────── */

export async function getQuestionsByChapters(chapterIds, mode) {
  const { data } = await supabase
    .from('questions')
    .select('*')
    .in('chapter_id', chapterIds);

  if (!data) return [];

  const easy   = data.filter(q => q.difficulty === 'easy');
  const medium = data.filter(q => q.difficulty === 'medium');
  const hard   = data.filter(q => q.difficulty === 'hard');

  const totalTarget = mode === 'hard' ? 38 : 25;

  if (mode === 'easy') {
    const easyCount  = Math.round(totalTarget * 0.9);
    const otherCount = totalTarget - easyCount;
    return shuffle([
      ...sample(easy,          easyCount),
      ...sample([...medium, ...hard], otherCount),
    ]).slice(0, totalTarget);
  } else {
    const hardCount  = Math.round(totalTarget * 0.6);
    const medCount   = Math.round(totalTarget * 0.3);
    const easyCount  = totalTarget - hardCount - medCount;
    return shuffle([
      ...sample(hard,   hardCount),
      ...sample(medium, medCount),
      ...sample(easy,   easyCount),
    ]).slice(0, totalTarget);
  }
}

/* ─── ATTEMPT HELPERS ──────────────────────────────────────── */

export async function saveAttempt(attemptData) {
  const { data, error } = await supabase
    .from('attempts')
    .insert(attemptData)
    .select()
    .single();
  return { data, error };
}

export async function getUserAttempts(userId) {
  const { data } = await supabase
    .from('attempts')
    .select('*, modules(name)')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false });
  return data || [];
}

/* ─── QUESTION PROGRESS HELPERS ────────────────────────────── */

export async function getQuestionProgress(userId, questionId) {
  const { data } = await supabase
    .from('question_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .single();
  return data;
}

export async function upsertQuestionProgress(progressData) {
  await supabase
    .from('question_progress')
    .upsert(progressData, { onConflict: 'user_id,question_id' });
}

/* ─── BADGE HELPERS ────────────────────────────────────────── */

export async function getUserBadges(userId) {
  const { data } = await supabase
    .from('badges')
    .select('*')
    .eq('user_id', userId);
  return data || [];
}

export async function awardBadge(userId, badgeKey) {
  await supabase
    .from('badges')
    .upsert({ user_id: userId, badge_key: badgeKey }, { onConflict: 'user_id,badge_key' });
}

/* ─── UTILITY ──────────────────────────────────────────────── */

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample(arr, n) {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

export function formatScore20(score) {
  return parseFloat(score.toFixed(2));
}

export function getScoreLabel(pct) {
  if (pct >= 90) return 'God Mode';
  if (pct >= 75) return 'Almost There';
  if (pct >= 60) return 'Mid Energy';
  if (pct >= 50) return 'Concerning';
  if (pct >= 30) return 'Rough';
  return 'Nuclear';
}
