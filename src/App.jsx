import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, ArrowLeft, ArrowRight, ArrowUpRight, Award, BookOpen,
  CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Clock3, Cloud, CloudOff, Flame, GraduationCap, LayoutDashboard,
  ListChecks, LockKeyhole, LogOut, Maximize2, Moon, Play, Plus, Search, FileDown,
  Settings, ShieldCheck, Sparkles, Sun, Target, Timer, TrendingUp, UserRound,
  Waves, X, ZoomIn, RotateCcw, Bookmark, BarChart3, Upload
} from 'lucide-react';
import { supabase, cloudEnabled } from './lib/supabase';
import {
  readLocalState, writeLocalState, kolkataDate, formatDate, formatDuration,
  recalculateStreaks, currentStreak, longestStreak, dateDiff
} from './lib/storage';

const TIME_LIMITS = { beginner: 120, intermediate: 60, pro: 30 };
const LEVELS = [
  { id: 'beginner', name: 'Beginner', subtitle: 'Build strong basics', time: '2:00', seconds: 120, tone: 'mint' },
  { id: 'intermediate', name: 'Intermediate', subtitle: 'Improve accuracy & pace', time: '1:00', seconds: 60, tone: 'blue' },
  { id: 'pro', name: 'Pro', subtitle: 'Interview-speed challenge', time: '0:30', seconds: 30, tone: 'violet' },
];
const NAV = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'practice', label: 'Daily practice', icon: ListChecks },
  { id: 'topics', label: 'Topics', icon: GraduationCap },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'book', label: 'Book library', icon: BookOpen },
];
const THEMES = [
  { id: 'light', name: 'Bright', hint: 'Clean & focused', icon: Sun },
  { id: 'dark', name: 'Dark', hint: 'Low-light study', icon: Moon },
  { id: 'ocean', name: 'Ocean', hint: 'Calm blue tones', icon: Waves },
];

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dateLabel(date) {
  return formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' });
}

function getStats(records) {
  const items = records.filter(r => r.completed).flatMap(r => r.items || []);
  const known = items.filter(i => i.answerKnown && typeof i.isCorrect === 'boolean');
  const correct = known.filter(i => i.isCorrect).length;
  const timed = items.filter(i => i.timeLimit > 0);
  const pace = timed.length ? timed.reduce((s, i) => s + Math.max(0, 1 - (i.timeSpent || 0) / i.timeLimit), 0) / timed.length : 0;
  const accuracy = known.length ? correct / known.length : null;
  const index = accuracy === null ? null : Math.round((accuracy * 0.7 + pace * 0.3) * 100);
  const seconds = timed.reduce((s, i) => s + (i.timeSpent || 0), 0);
  return {
    questions: items.length,
    completedDays: records.filter(r => r.completed).length,
    known: known.length,
    correct,
    accuracy,
    pace,
    index,
    seconds,
    averageSeconds: timed.length ? seconds / timed.length : 0,
  };
}

function getLastDates(count = 35) {
  const today = kolkataDate();
  const [y, m, d] = today.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12));
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(base);
    date.setUTCDate(base.getUTCDate() - (count - 1 - i));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  });
}

function IconButton({ children, onClick, title, className = '', disabled = false }) {
  return <button type="button" className={`icon-button ${className}`} onClick={onClick} title={title} disabled={disabled}>{children}</button>;
}

function Pill({ children, tone = 'neutral' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function StatCard({ icon: Icon, label, value, detail, tone = 'blue' }) {
  return <div className="stat-card">
    <div className={`stat-icon ${tone}`}><Icon size={18} strokeWidth={2.1} /></div>
    <div className="stat-copy">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  </div>;
}

function LevelCard({ level, count, attempted, onClick }) {
  const percent = count ? Math.min(100, Math.round(attempted / count * 100)) : 0;
  return <button className={`level-card level-${level.tone}`} type="button" onClick={onClick}>
    <div className="level-card-top"><span className="level-dot" /><span className="level-time"><Timer size={13} /> {level.time} / question</span></div>
    <div className="level-name">{level.name}</div>
    <div className="level-subtitle">{level.subtitle}</div>
    <div className="level-card-foot"><span>{attempted} / {count} practiced</span><ArrowUpRight size={16} /></div>
    <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
  </button>;
}

function AuthScreen({ onReady }) {
  const [mode, setMode] = useState('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: name.trim() } }
        });
        if (authError) throw authError;
        if (data.session) onReady(data.session.user);
        else setMessage('Account created. Check your email for the confirmation link, then sign in here.');
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        onReady(data.user);
      }
    } catch (err) { setError(err.message || 'Unable to authenticate. Check your details and try again.'); }
    finally { setBusy(false); }
  };

  return <div className="auth-screen">
    <div className="auth-panel">
      <BrandMark large />
      <div className="eyebrow">YOUR PERSONAL APTITUDE WORKSPACE</div>
      <h1>Make every day<br /><span>count.</span></h1>
      <p className="auth-intro">Create your private practice account. Your profile, streak and results can sync between your laptop and phone.</p>
      <div className="auth-tabs">
        <button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>Create account</button>
        <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); setMessage(''); }}>Sign in</button>
      </div>
      <form onSubmit={submit} className="form-stack">
        {mode === 'signup' && <label className="field-label">Your name<input required value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" autoComplete="name" /></label>}
        <label className="field-label">Email address<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
        <label className="field-label">Password<input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>
        {error && <div className="form-alert error"><AlertCircle size={15} />{error}</div>}
        {message && <div className="form-alert success"><CheckCircle2 size={15} />{message}</div>}
        <button className="primary-button full-width" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create my account' : 'Sign in'} <ArrowRight size={17} /></button>
      </form>
      <div className="auth-safe"><ShieldCheck size={15} /> Protected by your Supabase project authentication.</div>
    </div>
    <div className="auth-visual">
      <div className="visual-orb orb-one" /><div className="visual-orb orb-two" />
      <div className="visual-stat"><span className="visual-kicker">DAILY RHYTHM</span><strong>04</strong><span>questions a day</span></div>
      <div className="visual-mini-card"><Flame size={17} /><div><b>Build your streak</b><span>One focused session at a time</span></div></div>
      <div className="visual-bottom"><span>BEGINNER</span><span>INTERMEDIATE</span><span>PRO</span></div>
    </div>
  </div>;
}

function BrandMark({ large = false }) {
  return <div className={`brand-mark ${large ? 'brand-large' : ''}`}><span>Σ</span></div>;
}

function Onboarding({ initialName = '', onSave, cloud = false }) {
  const [name, setName] = useState(initialName);
  const [exam, setExam] = useState('Placement interviews');
  const [goal, setGoal] = useState('Build strong quantitative aptitude over the next 2 years.');
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Please enter at least two characters for your name.');
    onSave({ displayName: name.trim(), targetExam: exam.trim(), goal: goal.trim(), dailyGoal: 4, timezone: 'Asia/Kolkata', createdAt: new Date().toISOString() });
  };
  return <div className="onboarding-shell">
    <div className="onboarding-card">
      <div className="onboarding-brand"><BrandMark /><span>QUANT APTITUDE COACH</span></div>
      <Pill tone="green">{cloud ? 'Cloud profile' : 'Private device profile'}</Pill>
      <h1>Set up your<br /><span>study profile.</span></h1>
      <p>Four verified questions each day. Your profile, practice history and streak live in your dashboard.</p>
      <form onSubmit={submit} className="form-stack onboarding-form">
        <label className="field-label">Display name<input value={name} onChange={e => setName(e.target.value)} placeholder="What should we call you?" required /></label>
        <label className="field-label">Your target<select value={exam} onChange={e => setExam(e.target.value)}>
          <option>Placement interviews</option><option>Campus recruitment aptitude tests</option><option>CAT / MBA entrance</option><option>Banking and government exams</option><option>General quantitative aptitude</option><option>Other</option>
        </select></label>
        <label className="field-label">Your 2-year goal<textarea rows="3" value={goal} onChange={e => setGoal(e.target.value)} /></label>
        <div className="setup-summary"><div><span>Daily practice</span><strong>4 questions</strong></div><div><span>Time zone</span><strong>India · IST</strong></div><div><span>Plan horizon</span><strong>2 years</strong></div></div>
        {error && <div className="form-alert error"><AlertCircle size={15} />{error}</div>}
        <button className="primary-button full-width">Save profile & open dashboard <ArrowRight size={17} /></button>
      </form>
      <div className="onboarding-foot"><ShieldCheck size={15} /> Your personal study data is not shown publicly.</div>
    </div>
  </div>;
}

function Sidebar({ tab, setTab, profile, theme, setTheme, cloud, onLogout }) {
  return <aside className="sidebar">
    <div className="sidebar-brand"><BrandMark /><div><b>Quant Aptitude</b><span>COACH / PERSONAL</span></div></div>
    <div className="nav-caption">WORKSPACE</div>
    <nav className="side-nav">
      {NAV.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={tab === id ? 'selected' : ''}><Icon size={18} /><span>{label}</span>{id === 'practice' && <span className="nav-count">04</span>}</button>)}
    </nav>
    <div className="sidebar-divider" />
    <div className="nav-caption">PREFERENCES</div>
    <button className={`side-link ${tab === 'profile' ? 'selected' : ''}`} onClick={() => setTab('profile')}><UserRound size={18} /><span>My profile</span></button>
    <button className={`side-link ${tab === 'settings' ? 'selected' : ''}`} onClick={() => setTab('settings')}><Settings size={18} /><span>Appearance & settings</span></button>
    <div className="sidebar-bottom">
      <div className="sync-status">{cloud ? <Cloud size={15} /> : <CloudOff size={15} />}<span>{cloud ? 'Cloud sync enabled' : 'Saved on this device'}</span></div>
      <div className="sidebar-user"><div className="avatar">{(profile?.displayName || 'S').slice(0, 1).toUpperCase()}</div><div className="user-meta"><b>{profile?.displayName || 'Learner'}</b><span>{profile?.targetExam || 'Personal practice'}</span></div>{cloud && <IconButton title="Sign out" onClick={onLogout}><LogOut size={15} /></IconButton>}</div>
    </div>
  </aside>;
}

function MobileNav({ tab, setTab }) {
  const items = NAV.filter(n => ['dashboard', 'practice', 'topics', 'progress'].includes(n.id));
  return <nav className="mobile-nav">{items.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={19} /><span>{label === 'Daily practice' ? 'Practice' : label}</span></button>)}<button className={tab === 'book' ? 'active' : ''} onClick={() => setTab('book')}><BookOpen size={19} /><span>Book</span></button></nav>;
}

function Topbar({ title, subtitle, profile, theme, setTheme, cloud, actions }) {
  return <header className="topbar">
    <div className="topbar-copy"><div className="topbar-mobile-brand"><BrandMark /><span>QUANT COACH</span></div><div className="topbar-title">{title}</div>{subtitle && <div className="topbar-subtitle">{subtitle}</div>}</div>
    <div className="topbar-actions">
      <div className="quick-theme">
        <button title="Bright mode" className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><Sun size={15} /></button>
        <button title="Dark mode" className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><Moon size={15} /></button>
        <button title="Ocean mode" className={theme === 'ocean' ? 'active' : ''} onClick={() => setTheme('ocean')}><Waves size={15} /></button>
      </div>
      <div className="topbar-avatar" title={profile?.displayName}>{(profile?.displayName || 'S').slice(0, 1).toUpperCase()}</div>
      {actions}
    </div>
  </header>;
}

function Dashboard({ profile, bank, records, attemptedIds, onPractice, onTopics, onBook, onProgress }) {
  const stats = useMemo(() => getStats(records), [records]);
  const streak = currentStreak(records);
  const best = longestStreak(records);
  const today = kolkataDate();
  const todayDone = records.some(r => r.date === today && r.completed);
  const qByLevel = useMemo(() => Object.fromEntries(LEVELS.map(l => [l.id, bank.questions.filter(q => q.level === l.id).length])), [bank]);
  const weekly = useMemo(() => getLastDates(7).map(date => ({ date, count: records.some(r => r.date === date && r.completed) ? 1 : 0 })), [records]);
  const topicPreviews = bank.summary.filter(t => t.questionCount > 0).slice(0, 6);
  const hour = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false });
  const greeting = Number(hour) < 12 ? 'Good morning' : Number(hour) < 17 ? 'Good afternoon' : 'Good evening';
  return <div className="page-stack">
    <section className="welcome-banner">
      <div className="welcome-grid" />
      <div className="welcome-content">
        <Pill tone="glass"><Sparkles size={12} /> YOUR DAILY EDGE</Pill>
        <h1>{greeting}, {profile.displayName.split(' ')[0]}.</h1>
        <p>Small daily practice. Better speed, stronger accuracy, calmer interviews.</p>
        <div className="welcome-actions">
          <button className="welcome-button" onClick={onPractice}>{todayDone ? 'Practice another set' : 'Start today’s 4 questions'} <ArrowRight size={16} /></button>
          <span className="welcome-date"><CalendarDays size={14} /> {dateLabel(today)}</span>
        </div>
      </div>
      <div className="welcome-side">
        <div className="daily-ring"><div><strong>04</strong><span>PER DAY</span></div></div>
        <div className="ring-caption">A focused daily target</div>
      </div>
    </section>

    <div className="section-heading-row"><div><div className="section-kicker">YOUR SNAPSHOT</div><h2>Progress at a glance</h2></div><button className="text-button" onClick={onProgress}>View full progress <ArrowRight size={15} /></button></div>
    <div className="stats-grid">
      <StatCard icon={Flame} label="Current streak" value={`${streak} days`} detail={`${best} days longest streak`} tone="orange" />
      <StatCard icon={CalendarDays} label="Practice days" value={stats.completedDays} detail="Completed 4-question sets" tone="violet" />
      <StatCard icon={Target} label="Questions practiced" value={stats.questions} detail="Across all levels" tone="green" />
      <StatCard icon={Award} label="Aptitude index" value={stats.index === null ? '—' : stats.index} detail={stats.index === null ? 'Build an answer-key sample' : 'Verified answer accuracy + pace'} tone="blue" />
    </div>

    <div className="dashboard-columns">
      <section className="panel levels-panel">
        <div className="panel-heading"><div><div className="section-kicker">CHOOSE YOUR PACE</div><h3>Three levels. One habit.</h3></div><span className="muted-tag">4 questions / set</span></div>
        <div className="level-grid">
          {LEVELS.map(level => <LevelCard key={level.id} level={level} count={qByLevel[level.id]} attempted={attemptedIds.filter(id => bank.questions.some(q => q.id === id && q.level === level.id)).length} onClick={() => onPractice(level.id)} />)}
        </div>
        <div className="panel-footnote"><Clock3 size={14} /> Timer resets for every question: 2 min · 1 min · 30 sec.</div>
      </section>
      <section className="panel week-panel">
        <div className="panel-heading"><div><div className="section-kicker">CONSISTENCY</div><h3>Your last 7 days</h3></div><Pill tone={todayDone ? 'green' : 'neutral'}>{todayDone ? 'Today complete' : 'Today pending'}</Pill></div>
        <div className="week-bars">
          {weekly.map(d => <div className="week-day" key={d.date}><div className={`week-bar ${d.count ? 'filled' : ''}`}><span>{d.count ? '✓' : ''}</span></div><small>{new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(`${d.date}T12:00:00+05:30`))}</small></div>)}
        </div>
        <div className="week-summary"><div><strong>{weekly.filter(d => d.count).length}/7</strong><span>days practiced</span></div><div><strong>{formatDuration(stats.seconds)}</strong><span>total practice time</span></div></div>
        <button className="soft-button full-width" onClick={onProgress}>Open progress calendar <ArrowRight size={15} /></button>
      </section>
    </div>

    <section className="panel topic-panel">
      <div className="panel-heading"><div><div className="section-kicker">39 CHAPTERS IN THE BOOK</div><h3>Pick a topic to strengthen</h3></div><button className="text-button" onClick={onTopics}>Explore all topics <ArrowRight size={15} /></button></div>
      <div className="topic-preview-grid">
        {topicPreviews.map((t, i) => <button className="topic-preview" key={t.id} onClick={() => onPractice('beginner', t.id)}><span className="topic-number">{String(t.id).padStart(2, '0')}</span><span className="topic-preview-title">{t.title}</span><span className="topic-preview-count">{t.questionCount} indexed questions</span><ArrowUpRight className="topic-arrow" size={15} /></button>)}
      </div>
      <div className="book-note"><BookOpen size={15} /><span>21 questions are currently verified for timed practice (Numbers). All 39 source topics are indexed, but the other chapters remain scan-only until their questions and answer keys are manually checked. Load your own PDF in the Book Library to inspect any page.</span><button onClick={onBook}>Open library</button></div>
    </section>
  </div>;
}

function PracticeSetup({ bank, selectedLevel, setSelectedLevel, selectedTopic, setSelectedTopic, selectedDate, setSelectedDate, onStart, records, onReadTopic, error }) {
  const today = kolkataDate();
  const currentTopic = bank.summary.find(t => t.id === Number(selectedTopic));
  const pool = bank.questions.filter(q => q.questionVerified && q.answerVerified && q.solutionVerified && q.level === selectedLevel && (!selectedTopic || q.chapter === Number(selectedTopic)));
  const level = LEVELS.find(l => l.id === selectedLevel);
  return <div className="page-stack practice-setup-page">
    <section className="practice-intro panel">
      <div className="practice-intro-copy"><Pill tone="green"><Target size={12} /> DAILY TARGET · 04</Pill><h1>Today’s practice,<br /><span>your pace.</span></h1><p>Choose a level and focus topic. Only checked question text, options, answers and worked solutions can enter a timed set.</p></div>
      <div className="practice-quick-stats"><div><strong>04</strong><span>questions</span></div><div><strong>{level?.time}</strong><span>per question</span></div><div><strong>39</strong><span>book topics</span></div></div>
    </section>

    <section className="panel setup-panel">
      <div className="panel-heading"><div><div className="section-kicker">STEP 01</div><h3>Choose your difficulty</h3></div><span className="muted-tag">Timer applies to every question</span></div>
      <div className="setup-levels">
        {LEVELS.map(l => <button key={l.id} className={`setup-level ${selectedLevel === l.id ? 'active' : ''} ${l.tone}`} onClick={() => setSelectedLevel(l.id)}><span className="setup-level-icon">{l.id === 'beginner' ? '01' : l.id === 'intermediate' ? '02' : '03'}</span><span className="setup-level-name">{l.name}</span><span className="setup-level-sub">{l.subtitle}</span><span className="setup-level-time"><Timer size={14} /> {l.time} each</span>{selectedLevel === l.id && <CheckCircle2 size={17} className="setup-check" />}</button>)}
      </div>
      <div className="panel-heading setup-topic-heading"><div><div className="section-kicker">STEP 02</div><h3>Choose a topic</h3></div><span className="muted-tag">Or mix all topics</span></div>
      <div className="topic-picker-row">
        <div className="topic-picker-wrap"><label className="field-label">Practice focus<select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)}><option value="">All topics · mixed practice</option>{bank.summary.map(t => <option value={t.id} key={t.id}>{String(t.id).padStart(2, '0')} · {t.title} {t.questionCount ? `(${t.questionCount})` : '(scan library)'}</option>)}</select></label></div>
        <div className="topic-pool-info"><span className="pool-number">{pool.length}</span><span>matching cards<br /><small>{currentTopic ? `${currentTopic.title}` : 'Across the whole book'}</small></span></div>
      </div>
      {currentTopic && currentTopic.questionCount === 0 && <div className="form-alert info"><BookOpen size={16} /><span>No manually verified MCQ cards are available for this chapter yet. Load your original PDF to read the exact source pages; no guessed OCR questions will be shown.</span><button onClick={() => onReadTopic(currentTopic.id)}>Open scans <ArrowRight size={14} /></button></div>}
      {currentTopic && currentTopic.questionCount > 0 && pool.length < 4 && <div className="form-alert info"><AlertCircle size={16} /><span>Only {pool.length} questions are indexed for this topic at {level.name} level. Select “All topics” for a full four-question set.</span></div>}
      <div className="setup-bottom-row">
        <label className="field-label date-field">Practice date<input type="date" value={selectedDate} max={today} onChange={e => setSelectedDate(e.target.value)} /></label>
        <div className="setup-date-hint"><CalendarDays size={14} /> Streaks are recorded using this date in Indian Standard Time.</div>
        <button className="primary-button start-button" onClick={onStart} disabled={pool.length < 4 || !selectedDate || selectedDate > today}>Start 4-question set <ArrowRight size={17} /></button>
      </div>
      {error && <div className="form-alert error setup-error"><AlertCircle size={15} />{error}</div>}
    </section>

    <div className="setup-reminder"><ShieldCheck size={16} /><span>Current checked bank: 21 questions from Numbers. Other chapter cards are withheld until manually verified. Answers stay hidden after timeout and appear only when you reveal them. Difficulty bands are curated practice levels.</span></div>
  </div>;
}

function TimerDial({ remaining, total }) {
  const pct = Math.max(0, Math.min(100, remaining / total * 100));
  const urgent = remaining <= Math.min(10, total * 0.2);
  return <div className={`timer-dial ${urgent ? 'urgent' : ''}`} style={{ '--timer-pct': `${pct}%` }}><div className="timer-dial-inner"><Timer size={15} /><strong>{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(Math.floor(remaining % 60)).padStart(2, '0')}</strong><span>LEFT</span></div></div>;
}

function SourceScanModal({ page, onClose, onChangePage, pdfUrl, pdfName, onGoToBook }) {
  if (!page) return null;
  return <div className="modal-backdrop scan-modal-backdrop" onClick={onClose}>
    <div className="scan-modal" onClick={e => e.stopPropagation()}>
      <div className="scan-modal-head"><div><div className="section-kicker">BUNDLED SOURCE PDF</div><h3>PDF page {page} <span>of 737</span></h3></div><div className="scan-tools"><IconButton title="Close PDF viewer" onClick={onClose}><X size={18} /></IconButton></div></div>
      {pdfUrl ? <div className="private-pdf-frame"><iframe title={`Source PDF page ${page}`} src={`${pdfUrl}#page=${page}&zoom=page-width`} /></div> : <div className="pdf-not-loaded"><BookOpen size={30} /><h3>The original source book is included with this app</h3><p>The original PDF is bundled with the app and opens directly without any upload.</p><button className="primary-button" onClick={onGoToBook}>Open Book Library <ArrowRight size={16} /></button></div>}
      <div className="scan-modal-foot"><button className="soft-button" onClick={() => onChangePage(Math.max(1, page - 1))} disabled={page <= 1}><ChevronLeft size={15} /> Previous page</button><span>{pdfName ? `Loaded locally: ${pdfName}` : 'Bundled source book'}</span><button className="soft-button" onClick={() => onChangePage(Math.min(737, page + 1))} disabled={page >= 737}>Next page <ChevronRight size={15} /></button></div>
    </div>
  </div>;
}

function SolutionPanel({ question, selectedOption, onOpenScan }) {
  const correct = String(question.answer).toLowerCase();
  const options = question.options || [];
  const correctOption = options.find(o => String(o.label).toLowerCase() === correct);
  const yourOption = selectedOption ? options.find(o => o.label === selectedOption) : null;
  const gotIt = Boolean(selectedOption && selectedOption.toLowerCase() === correct);
  return <div className="solution-panel">
    <div className={`solution-title ${gotIt ? 'solution-correct' : 'solution-incorrect'}`}>
      {gotIt ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      <div><strong>{gotIt ? 'Correct answer' : selectedOption ? 'Not quite - review the method' : 'Answer revealed'}</strong><span>{gotIt ? 'Your selected option matches the verified answer.' : 'The correct option is highlighted in green; your incorrect choice is marked red.'}</span></div>
    </div>
    <div className="answer-line verified-answer"><span>Verified correct answer</span><strong>{correct.toUpperCase()}{correctOption ? ` · ${correctOption.text}` : ''}</strong><Pill tone="green">Checked</Pill></div>
    {yourOption && <div className={`your-answer-line ${gotIt ? 'your-answer-correct' : 'your-answer-wrong'}`}><span>Your choice</span><b>{yourOption.label.toUpperCase()} · {yourOption.text}</b><Pill tone={gotIt ? 'green' : 'rose'}>{gotIt ? 'Correct' : 'Incorrect'}</Pill></div>}
    {!yourOption && <div className="your-answer-line"><span>Your choice</span><b>No option selected before reveal / time ended.</b></div>}
    <div className="solution-text-block"><div className="solution-subtitle">STEP-BY-STEP WORKED SOLUTION</div><p>{question.solution}</p><div className="solution-source-note">This worked solution was independently recalculated and checked against the verified answer key.</div></div>
    <div className="solution-actions">
      <button className="soft-button" onClick={() => onOpenScan(question.page)}><BookOpen size={15} /> Original question PDF · p.{question.page}</button>
      <button className="soft-button" onClick={() => onOpenScan(question.answerSourcePage)}><CheckCircle2 size={15} /> Printed answer key · p.{question.answerSourcePage}</button>
      <a className="soft-button link-button" href={`/verified-solutions.pdf#page=${question.solutionPdfPage}`} target="_blank" rel="noreferrer"><FileDown size={15} /> Open solution PDF</a>
    </div>
  </div>;
}

function PracticeSession({ session, bank, onUpdateItem, onNext, onSave, onExit, onOpenScan }) {
  const current = session.items[session.index];
  const question = bank.questions.find(q => q.id === current.questionId);
  const [remaining, setRemaining] = useState(TIME_LIMITS[session.level]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const total = TIME_LIMITS[session.level];
  const elapsedSeconds = () => current.startedAt ? Math.max(0, (Date.now() - current.startedAt) / 1000) : (current.timeSpent || 0);

  useEffect(() => {
    if (!current || current.revealed || current.locked || current.timedOut || !current.startedAt) {
      setRemaining(Math.max(0, total - (current?.timeSpent || 0)));
      return;
    }
    const tick = () => {
      const elapsed = (Date.now() - current.startedAt) / 1000;
      const left = Math.max(0, total - elapsed);
      setRemaining(left);
      if (left <= 0) onUpdateItem(session.index, { timedOut: true, startedAt: null, timeSpent: total, locked: true });
    };
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [current?.startedAt, current?.locked, current?.revealed, current?.timedOut, session.index, total]);

  const lockChoice = () => {
    if (!current.selectedOption || current.revealed || current.locked || current.timedOut) return;
    const spent = Math.min(total, elapsedSeconds());
    onUpdateItem(session.index, { locked: true, startedAt: null, timeSpent: Number(spent.toFixed(1)) });
  };
  const reveal = () => {
    if (current.revealed) return;
    const spent = current.startedAt ? Math.min(total, elapsedSeconds()) : (current.timeSpent || (current.timedOut ? total : 0));
    const expired = current.timedOut || spent >= total;
    onUpdateItem(session.index, { revealed: true, locked: true, startedAt: null, timeSpent: Number(spent.toFixed(1)), timedOut: expired });
  };

  if (session.finished) {
    const correct = session.items.filter(item => {
      const q = bank.questions.find(x => x.id === item.questionId);
      return q?.answer && item.selectedOption === q.answer;
    }).length;
    const known = session.items.filter(item => bank.questions.find(x => x.id === item.questionId)?.answer).length;
    return <div className="page-stack">
      <section className="completion-panel panel">
        <div className="completion-icon"><Award size={32} /></div><Pill tone="green">SET COMPLETE</Pill><h1>Four questions.<br /><span>Done for today.</span></h1><p>You have reviewed all four answers. Save this practice day to record it in your streak and progress dashboard.</p>
        <div className="completion-stats"><div><strong>04 / 04</strong><span>questions reviewed</span></div><div><strong>{known ? `${correct}/${known}` : '—'}</strong><span>verified answer matches</span></div><div><strong>{formatDuration(session.items.reduce((s, i) => s + (i.timeSpent || 0), 0))}</strong><span>time used</span></div></div>
        <div className="completion-date"><CalendarDays size={16} /> Saving against <b>{dateLabel(session.date)}</b></div>
        <button className="primary-button save-day-button" onClick={onSave}>Save practice day & update streak <Check size={17} /></button>
        <button className="text-button" onClick={onExit}>Return without saving</button>
      </section>
    </div>;
  }

  const progress = (session.index / 4) * 100;
  const timerExpired = current.timedOut || (remaining <= 0 && !current.locked);
  const isLocked = current.locked || current.revealed || timerExpired;
  return <div className="page-stack session-page">
    <div className="session-top-row"><button className="back-button" onClick={() => setShowExitConfirm(true)}><ArrowLeft size={16} /> Practice setup</button><div className="session-meta"><Pill tone="neutral">{LEVELS.find(l => l.id === session.level)?.name}</Pill><span><CalendarDays size={14} /> {dateLabel(session.date)}</span></div></div>
    <div className="session-progress"><div className="session-progress-label"><span>QUESTION {session.index + 1} <em>OF 4</em></span><span>{Math.round((session.index + (current.revealed ? 1 : 0)) / 4 * 100)}% reviewed</span></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>
    <section className="question-card panel">
      <div className="question-card-head"><div><div className="question-topic-line"><span className="q-number">Q{session.index + 1}</span><span>{question.topic}</span><span className="q-separator">·</span><span>Book Q{question.number}</span><span className="q-separator">·</span><span>PDF p.{question.page}</span></div><h2>Take your time. Think clearly.</h2></div><TimerDial remaining={remaining} total={total} /></div>
      <div className="question-body">
        <div className="question-stem">{question.stem}</div>
        <div className="option-list">
          {(question.options || []).map((option, i) => {
            const selected = current.selectedOption === option.label;
            const right = current.revealed && question.answer && option.label === question.answer;
            const wrong = current.revealed && selected && question.answer && option.label !== question.answer;
            return <button key={`${option.label}-${i}`} className={`option-button ${selected ? 'selected' : ''} ${right ? 'is-correct' : ''} ${wrong ? 'is-wrong' : ''}`} onClick={() => !isLocked && onUpdateItem(session.index, { selectedOption: option.label })} disabled={isLocked}>
              <span className="option-letter">{String(option.label).toUpperCase()}</span><span className="option-text">{option.text || '—'}</span>{right && <CheckCircle2 size={17} className="option-status" />}{wrong && <X size={17} className="option-status" />}
            </button>;
          })}
        </div>
      </div>
      {timerExpired && !current.revealed && <div className="timer-expired-note"><Clock3 size={16} /><span>Time is up. Your answer is still hidden. Choose <b>Reveal answer</b> when you are ready.</span></div>}
      {current.locked && !current.revealed && !current.timedOut && <div className="locked-note"><LockKeyhole size={15} /> Choice locked. The correct answer is still hidden until you reveal it.</div>}
      {current.revealed && <SolutionPanel question={question} selectedOption={current.selectedOption} onOpenScan={onOpenScan} />}
      {!current.revealed && <div className="question-action-row">
        <div className="action-left"><button className="scan-link" onClick={() => onOpenScan(question.page)}><BookOpen size={15} /> Original PDF page <ArrowUpRight size={13} /></button></div>
        <div className="question-actions">{!current.locked && !timerExpired && <button className="soft-button" onClick={lockChoice} disabled={!current.selectedOption}><LockKeyhole size={15} /> Lock choice</button>}<button className="primary-button reveal-button" onClick={reveal}>Reveal answer <EyeSymbol /></button></div>
      </div>}
      {current.revealed && <div className="question-action-row revealed-action-row"><span className="reviewed-indicator"><CheckCircle2 size={15} /> Answer reviewed</span><button className="primary-button" onClick={onNext}>{session.index === 3 ? 'Finish set' : 'Next question'} <ArrowRight size={16} /></button></div>}
    </section>
    <div className="session-bottom-hint"><ShieldCheck size={15} /> Timer resets for each new question. Answers never appear automatically when time expires.</div>
    {showExitConfirm && <div className="modal-backdrop" onClick={() => setShowExitConfirm(false)}><div className="confirm-modal" onClick={e => e.stopPropagation()}><div className="confirm-icon"><AlertCircle size={20} /></div><h3>Leave this practice set?</h3><p>Your in-progress answers are saved on this device. You can return to this set later, but the streak is updated only after you complete and save all four questions.</p><div className="confirm-actions"><button className="soft-button" onClick={() => setShowExitConfirm(false)}>Stay here</button><button className="primary-button" onClick={onExit}>Leave set</button></div></div></div>}
  </div>;
}

function EyeSymbol() { return <span className="eye-symbol">↗</span>; }

function TopicsPage({ bank, onPractice, onBook }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const topics = bank.summary.filter(t => {
    const text = `${t.title} ${t.id}`.toLowerCase();
    const matches = text.includes(query.toLowerCase());
    const category = t.id >= 36 ? 'di' : t.id === 35 ? 'series' : 'arithmetic';
    return matches && (filter === 'all' || category === filter);
  });
  return <div className="page-stack">
    <section className="topics-hero panel"><div><Pill tone="blue">39 TOPICS · 737 PAGES</Pill><h1>Build mastery,<br /><span>one concept at a time.</span></h1><p>Move between arithmetic, series and data interpretation. Each topic is linked to its original book pages.</p></div><div className="topics-hero-stat"><strong>39</strong><span>chapters indexed</span><div className="topic-stack-dots"><i /><i /><i /><i /><i /></div></div></section>
    <div className="topic-toolbar"><div className="search-field"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a topic…" /></div><div className="filter-pills">{[{id:'all',label:'All topics'},{id:'arithmetic',label:'Arithmetic'},{id:'series',label:'Series'},{id:'di',label:'Data interpretation'}].map(f => <button key={f.id} className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>{f.label}</button>)}</div></div>
    <div className="topics-grid">
      {topics.map(topic => <article className="topic-card panel" key={topic.id}><div className="topic-card-top"><span className="topic-number large">{String(topic.id).padStart(2, '0')}</span><span className="topic-page">PDF p.{topic.startPage}–{topic.endPage}</span></div><h3>{topic.title}</h3><p>{topic.questionCount ? `${topic.questionCount} indexed MCQ cards · source scan included` : 'Timed questions pending manual verification · source pages indexed'}</p><div className="topic-card-bottom"><div className="topic-level-pills">{topic.questionCount ? <><span>{topic.beginnerCount} beginner</span><span>{topic.intermediateCount} intermediate</span><span>{topic.proCount} pro</span></> : <span className="scan-only-label"><BookOpen size={12} /> Scan library</span>}</div><div className="topic-card-actions"><button className="topic-read-button" onClick={() => onBook(topic.startPage)}>Read <BookOpen size={14} /></button>{topic.questionCount >= 4 && <button className="topic-practice-button" onClick={() => onPractice('beginner', topic.id)}>Practice <ArrowRight size={14} /></button>}</div></div></article>)}
    </div>
    <div className="topic-source-note"><BookOpen size={16} /><span>Current checked bank: 21 questions from Numbers. Other chapters remain scan-only until manually checked. Load your original PDF privately to inspect their pages.</span><button className="text-button" onClick={() => onBook(1)}>Open all pages <ArrowRight size={14} /></button></div>
  </div>;
}

function BookLibrary({ bank, initialPage = 1, onPageChange, pdfUrl, pdfName, onPdfLoad }) {
  const [page, setPage] = useState(initialPage || 1);
  const [topicId, setTopicId] = useState('');
  const [jump, setJump] = useState(String(initialPage || 1));
  const currentTopic = bank.summary.find(t => Number(topicId) === t.id);
  const go = (n) => { const p = Math.min(737, Math.max(1, Number(n) || 1)); setPage(p); setJump(String(p)); onPageChange?.(p); };
  useEffect(() => { if (initialPage && initialPage !== page) go(initialPage); }, [initialPage]);
  useEffect(() => { if (currentTopic) go(currentTopic.startPage); }, [topicId]);
  return <div className="page-stack book-page">
    <section className="book-hero panel"><div><Pill tone="blue"><BookOpen size={12} /> ORIGINAL SOURCE LIBRARY</Pill><h1>Your complete<br /><span>737-page source book.</span></h1><p>The original PDF is included with this app. Browse the exact printed questions, options, answer tables and solutions without uploading a file.</p></div><div className="book-page-counter"><strong>737</strong><span>source pages</span><small>Private local viewer</small></div></section>
    <section className="panel book-viewer-panel">
      <div className="local-pdf-load-row"><div><b>Original source PDF included</b><span>R.S. Agarwal Quantitative Aptitude · bundled with the app</span></div><a className="primary-button local-pdf-button" href="/source-book.pdf" target="_blank" rel="noreferrer"><BookOpen size={15} /> Open included PDF <ArrowUpRight size={14} /></a></div>
      <div className="book-controls"><div className="book-controls-left"><label className="field-label">Jump to chapter<select value={topicId} onChange={e => setTopicId(e.target.value)}><option value="">Select a topic…</option>{bank.summary.map(t => <option key={t.id} value={t.id}>{String(t.id).padStart(2, '0')} · {t.title}</option>)}</select></label><label className="field-label page-jump">PDF page<input type="number" min="1" max="737" value={jump} onChange={e => setJump(e.target.value)} onBlur={() => { if (jump !== '') setJump(String(Math.min(737, Math.max(1, Number(jump) || 1)))); }} onKeyDown={e => e.key === 'Enter' && go(jump)} /><button className="soft-button" onClick={() => go(jump)}>Go</button></label></div></div>
      {currentTopic && <div className="chapter-jump-note"><Bookmark size={14} /><span>Chapter {currentTopic.id}: <b>{currentTopic.title}</b> · PDF pages {currentTopic.startPage}–{currentTopic.endPage}</span><button onClick={() => go(currentTopic.startPage)}>Go to chapter start</button></div>}
      {pdfUrl ? <><div className="pdf-open-new-tab"><a className="soft-button link-button" href={pdfUrl} target="_blank" rel="noreferrer">Open source PDF in a new tab <ArrowUpRight size={14} /></a></div><div className="private-pdf-frame book-pdf-frame"><iframe key={`book-pdf-page-${page}`} title={`Your local quantitative aptitude source PDF — page ${page}`} src={`${pdfUrl}#page=${page}&zoom=page-width`} loading="eager" /></div></> : <div className="pdf-not-loaded book-empty"><BookOpen size={34} /><h3>The source book is included with this website</h3><p>The original PDF is bundled with the app and is available to every user after deployment.</p></div>}
      <div className="book-pagination"><button className="soft-button" onClick={() => go(page - 1)} disabled={page <= 1}><ChevronLeft size={16} /> Previous</button><div className="book-pagination-center"><strong>{page}</strong><span> / 737 pages</span><input type="range" min="1" max="737" value={page} onChange={e => go(e.target.value)} /></div><button className="soft-button" onClick={() => go(page + 1)} disabled={page >= 737}>Next <ChevronRight size={16} /></button></div>
    </section>
    <p className="book-integrity-note"><ShieldCheck size={15} /> Only the 21 manually verified Numbers questions are timed right now. The other chapter ranges remain indexed, and their original pages can be opened from the included PDF. Malformed OCR text is never used as a question.</p>
  </div>;
}

function ProgressPage({ bank, records, attemptedIds }) {
  const stats = useMemo(() => getStats(records), [records]);
  const streak = currentStreak(records);
  const best = longestStreak(records);
  const completed = new Set(records.filter(r => r.completed).map(r => r.date));
  const last35 = getLastDates(35);
  const completedLast35 = last35.filter(date => completed.has(date)).length;
  const levelRows = LEVELS.map(level => {
    const done = records.flatMap(r => r.items || []).filter(i => i.level === level.id).length;
    const total = bank.questions.filter(q => q.level === level.id && q.questionVerified && q.answerVerified && q.solutionVerified).length;
    return { ...level, done, total };
  });
  const recent = [...records].filter(r => r.completed).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const topicStats = bank.summary.map(t => ({ ...t, done: records.flatMap(r => r.items || []).filter(i => i.chapter === t.id).length })).filter(t => t.done > 0).sort((a, b) => b.done - a.done).slice(0, 5);
  return <div className="page-stack">
    <section className="progress-hero panel"><div><Pill tone="violet"><BarChart3 size={12} /> PERFORMANCE REVIEW</Pill><h1>Your progress,<br /><span>made visible.</span></h1><p>Track consistency, question speed and accuracy signals as your practice history grows.</p></div><div className="index-orb"><span>APTITUDE INDEX</span><strong>{stats.index === null ? '—' : stats.index}</strong><small>{stats.index === null ? 'Need answer keys' : 'out of 100'}</small></div></section>
    <div className="stats-grid progress-stats"><StatCard icon={Flame} label="Current streak" value={`${streak} days`} detail="Gaps reset the streak" tone="orange" /><StatCard icon={Award} label="Longest streak" value={`${best} days`} detail="Your personal best" tone="violet" /><StatCard icon={CheckCircle2} label="Verified answer accuracy" value={stats.accuracy === null ? '—' : `${Math.round(stats.accuracy * 100)}%`} detail={`${stats.known} verified answer keys`} tone="green" /><StatCard icon={Clock3} label="Average time" value={stats.averageSeconds ? `${stats.averageSeconds.toFixed(1)}s` : '—'} detail={`${formatDuration(stats.seconds)} total`} tone="blue" /></div>
    <section className="panel streak-panel"><div className="panel-heading"><div><div className="section-kicker">CONSISTENCY MAP</div><h3>Last 35 days</h3></div><Pill tone="green">{completedLast35} completed days</Pill></div><div className="streak-grid">{last35.map(date => <div key={date} className={`streak-cell ${completed.has(date) ? 'complete' : ''}`} title={`${dateLabel(date)} · ${completed.has(date) ? 'Practised' : 'No session'}`}>{completed.has(date) ? '✓' : ''}</div>)}</div><div className="streak-legend"><span><i className="streak-cell sample" /> Practised</span><span><i className="streak-cell" /> Rest / missed</span><span className="streak-note">A missed calendar day breaks the current run.</span></div></section>
    <div className="dashboard-columns">
      <section className="panel level-progress-panel"><div className="panel-heading"><div><div className="section-kicker">LEVEL BREAKDOWN</div><h3>Practice by difficulty</h3></div></div>{levelRows.map(l => <div className="level-progress-row" key={l.id}><div className="level-progress-copy"><b>{l.name}</b><span>{l.done} attempted · {l.total} in bank</span></div><div className="progress-track"><span style={{ width: `${l.total ? Math.min(100, l.done / l.total * 100) : 0}%` }} /></div></div>)}<div className="progress-footnote">Aptitude Index combines accuracy against verified answer keys (70%) and pace (30%). It is a practice metric, not an IQ score.</div></section>
      <section className="panel topic-progress-panel"><div className="panel-heading"><div><div className="section-kicker">YOUR FOCUS</div><h3>Most-practised topics</h3></div></div>{topicStats.length ? topicStats.map(t => <div className="topic-progress-row" key={t.id}><div><b>{t.title}</b><span>{t.done} questions</span></div><Pill tone="neutral">{t.questionCount} available</Pill></div>) : <div className="empty-progress"><BookOpen size={22} /><span>Your topic breakdown will appear after your first saved practice day.</span></div>}</section>
    </div>
    <section className="panel recent-panel"><div className="panel-heading"><div><div className="section-kicker">PRACTICE HISTORY</div><h3>Recent saved days</h3></div></div>{recent.length ? <div className="recent-table">{recent.map(r => <div className="recent-row" key={r.date}><div className="recent-date"><CalendarDays size={15} /><b>{dateLabel(r.date)}</b></div><div className="recent-meta"><span>{LEVELS.find(l => l.id === r.level)?.name || r.level}</span><span>{r.questionCount || r.items?.length || 4} questions</span><span>{formatDuration(r.totalSeconds || 0)}</span></div><div className="recent-streak"><Flame size={14} /> {r.streakValue || 0} streak</div></div>)}</div> : <div className="empty-progress history-empty">No saved days yet. Complete four questions and save your first practice day.</div>}</section>
  </div>;
}

function ProfilePage({ profile, onSave, onLogout, cloud, theme, setTheme, records, onExport }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.displayName || '');
  const [exam, setExam] = useState(profile.targetExam || '');
  const [goal, setGoal] = useState(profile.goal || '');
  useEffect(() => { setName(profile.displayName || ''); setExam(profile.targetExam || ''); setGoal(profile.goal || ''); }, [profile]);
  const save = e => { e.preventDefault(); if (name.trim().length >= 2) { onSave({ ...profile, displayName: name.trim(), targetExam: exam.trim(), goal: goal.trim() }); setEditing(false); } };
  return <div className="page-stack">
    <section className="profile-hero panel"><div className="profile-avatar-large">{(profile.displayName || 'L').slice(0, 1).toUpperCase()}</div><div><Pill tone={cloud ? 'green' : 'neutral'}>{cloud ? 'Cloud account' : 'Local profile'}</Pill><h1>{profile.displayName}</h1><p>{profile.targetExam || 'Personal quantitative aptitude practice'}</p></div><button className="soft-button profile-edit-top" onClick={() => setEditing(v => !v)}>{editing ? 'Cancel edit' : 'Edit profile'}</button></section>
    <div className="dashboard-columns">
      <section className="panel profile-details"><div className="panel-heading"><div><div className="section-kicker">PROFILE DETAILS</div><h3>Your learning setup</h3></div></div>
        {editing ? <form className="form-stack" onSubmit={save}><label className="field-label">Display name<input value={name} onChange={e => setName(e.target.value)} required /></label><label className="field-label">Target exam / goal<select value={exam} onChange={e => setExam(e.target.value)}><option>Placement interviews</option><option>Campus recruitment aptitude tests</option><option>CAT / MBA entrance</option><option>Banking and government exams</option><option>General quantitative aptitude</option><option>Other</option></select></label><label className="field-label">Two-year goal<textarea rows="3" value={goal} onChange={e => setGoal(e.target.value)} /></label><button className="primary-button">Save changes <Check size={15} /></button></form> : <div className="profile-detail-list"><div><span>Display name</span><b>{profile.displayName}</b></div><div><span>Target</span><b>{profile.targetExam}</b></div><div><span>Long-term goal</span><b>{profile.goal}</b></div><div><span>Daily target</span><b>4 questions</b></div><div><span>Time zone</span><b>Asia/Kolkata · IST</b></div><div><span>Plan</span><b>2-year growth plan</b></div></div>}
      </section>
      <section className="panel preferences-panel"><div className="panel-heading"><div><div className="section-kicker">LOOK & FEEL</div><h3>Choose your theme</h3></div></div><div className="theme-choice-list">{THEMES.map(t => { const Icon=t.icon; return <button key={t.id} className={`theme-choice ${theme === t.id ? 'active' : ''}`} onClick={() => setTheme(t.id)}><span className={`theme-swatch ${t.id}`}><Icon size={17} /></span><span><b>{t.name}</b><small>{t.hint}</small></span>{theme === t.id && <CheckCircle2 size={17} />}</button>; })}</div><div className="profile-divider" /><div className="account-row"><div className="account-icon">{cloud ? <Cloud size={17} /> : <CloudOff size={17} />}</div><div><b>{cloud ? 'Cross-device sync' : 'Device-only storage'}</b><span>{cloud ? 'Your records are connected to your Supabase account.' : 'Data is stored in this browser. Configure Supabase to sync phone and laptop.'}</span></div></div><div className="profile-actions"><button className="soft-button" onClick={onExport}>Export my practice data <ArrowUpRight size={14} /></button>{cloud && <button className="danger-soft-button" onClick={onLogout}><LogOut size={15} /> Sign out</button>}</div></section>
    </div>
    <section className="panel account-note"><ShieldCheck size={17} /><span>Your practice history contains only your profile, selected options, response times, streak dates and progress summaries. Do not share your Supabase credentials or service-role key.</span></section>
  </div>;
}

function SettingsPage({ theme, setTheme, onExport, cloud }) {
  return <div className="page-stack"><section className="settings-header panel"><Pill tone="blue">PREFERENCES</Pill><h1>Make the workspace<br /><span>feel right.</span></h1><p>Choose a study environment, manage your data and review the setup needed for cross-device sync.</p></section><section className="panel settings-panel"><div className="panel-heading"><div><div className="section-kicker">COLOR MODE</div><h3>Appearance</h3></div></div><div className="theme-grid">{THEMES.map(t => { const Icon=t.icon; return <button key={t.id} className={`theme-card ${t.id} ${theme===t.id?'active':''}`} onClick={() => setTheme(t.id)}><div className="theme-card-art"><Icon size={25} /></div><b>{t.name}</b><span>{t.hint}</span>{theme===t.id && <Pill tone="green">Active</Pill>}</button>; })}</div></section><section className="panel settings-panel"><div className="panel-heading"><div><div className="section-kicker">DATA & SYNC</div><h3>Storage settings</h3></div><Pill tone={cloud?'green':'amber'}>{cloud?'Cloud connected':'Local only'}</Pill></div><p className="settings-help">{cloud ? 'Your account is connected to Supabase. New saved practice days and profile updates sync to the database.' : 'This build is ready for Supabase. Without project credentials, the profile and streak are saved only in the current browser. To sync between mobile and laptop, follow the Supabase setup steps in README.md.'}</p><div className="settings-buttons"><button className="soft-button" onClick={onExport}>Export data backup <ArrowUpRight size={14} /></button><a className="soft-button link-button" href="/question-bank.json" target="_blank" rel="noreferrer">View extracted question bank <ArrowUpRight size={14} /></a></div></section></div>;
}

function Toast({ message, type = 'success', onClose }) {
  if (!message) return null;
  return <div className={`toast toast-${type}`}><CheckCircle2 size={16} /><span>{message}</span><button onClick={onClose}><X size={14} /></button></div>;
}

export default function App() {
  const [bank, setBank] = useState(null);
  const [bankError, setBankError] = useState('');
  const [appState, setAppState] = useState(() => readLocalState());
  const [tab, setTab] = useState('dashboard');
  const [selectedLevel, setSelectedLevel] = useState('beginner');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedDate, setSelectedDate] = useState(kolkataDate());
  const [setupError, setSetupError] = useState('');
  const [bookStartPage, setBookStartPage] = useState(1);
  const [scanPage, setScanPage] = useState(null);
  const sourcePdf = { url: '/source-book.pdf', name: 'R.S. Agarwal Quantitative Aptitude.pdf' };
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [cloudUser, setCloudUser] = useState(null);
  const [cloudReady, setCloudReady] = useState(!cloudEnabled);
  const [cloudError, setCloudError] = useState('');

  useEffect(() => {
    fetch('/question-bank.json').then(r => { if (!r.ok) throw new Error('Question bank could not be loaded.'); return r.json(); }).then(data => { const invalid = (data.questions || []).filter(q => !q.questionVerified || !q.answerVerified || !q.solutionVerified || !q.answer || (q.options || []).length !== 4 || !(q.options || []).some(o => o.label === q.answer)); if (invalid.length) throw new Error(`Question bank safety check failed: ${invalid.length} unverified or incomplete cards were found. They have been blocked from practice.`); setBank(data); }).catch(e => setBankError(e.message));
  }, []);

  useEffect(() => { writeLocalState(appState); }, [appState]);
  useEffect(() => { document.documentElement.dataset.theme = appState.theme || 'light'; }, [appState.theme]);

  const hydrateCloud = async (user) => {
    if (!supabase || !user) { setCloudReady(true); return; }
    setCloudReady(false); setCloudError('');
    try {
      const [profileRes, daysRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('practice_days').select('*').eq('user_id', user.id).order('practice_date', { ascending: true })
      ]);
      if (profileRes.error) throw profileRes.error;
      if (daysRes.error) throw daysRes.error;
      const records = (daysRes.data || []).map(row => row.session_json || ({ date: row.practice_date, completed: true, items: [], level: row.level, topicId: row.topic_id, questionCount: row.question_count, correctCount: row.correct_count, knownCount: row.known_count, totalSeconds: row.total_seconds, streakValue: row.streak_value }));
      setAppState(prev => ({
        ...prev,
        profile: profileRes.data ? { displayName: profileRes.data.display_name || user.user_metadata?.full_name || 'Learner', targetExam: profileRes.data.target_exam || 'Placement interviews', goal: profileRes.data.goal || 'Build strong quantitative aptitude over the next 2 years.', dailyGoal: 4, timezone: 'Asia/Kolkata' } : null,
        records: recalculateStreaks(records),
        attemptedIds: records.flatMap(r => (r.items || []).map(i => i.questionId)).filter(Boolean),
      }));
    } catch (e) { setCloudError(e.message || 'Could not sync your account data.'); }
    finally { setCloudReady(true); }
  };

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const user = data.session?.user || null;
      setCloudUser(user);
      if (user) hydrateCloud(user); else setCloudReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      setCloudUser(user);
      if (user) hydrateCloud(user); else { setCloudReady(true); setAppState(prev => ({ ...prev, profile: null, records: [], attemptedIds: [], activeSession: null })); }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  const notify = (message, type = 'success') => setToast({ message, type });
  const updateLocal = (updater) => setAppState(prev => typeof updater === 'function' ? updater(prev) : ({ ...prev, ...updater }));

  const saveProfile = async (profile) => {
    setAppState(prev => ({ ...prev, profile }));
    if (supabase && cloudUser) {
      const { error } = await supabase.from('profiles').upsert({ id: cloudUser.id, display_name: profile.displayName, target_exam: profile.targetExam, goal: profile.goal, updated_at: new Date().toISOString() });
      if (error) notify(`Profile saved locally; cloud sync issue: ${error.message}`, 'warning');
      else notify('Profile saved and synced.');
    } else notify('Profile saved on this device.');
    setTab('dashboard');
  };

  const setTheme = (theme) => updateLocal(prev => ({ ...prev, theme }));

  const startPractice = (level = selectedLevel, topicId = selectedTopic) => {
    setSetupError('');
    const pool = bank.questions.filter(q => q.questionVerified && q.answerVerified && q.solutionVerified && q.level === level && (!topicId || q.chapter === Number(topicId)) && (q.options || []).length === 4);
    const topic = topicId ? bank.summary.find(t => t.id === Number(topicId)) : null;
    if (pool.length < 4) {
      setSetupError(topic ? `${topic.title} has ${pool.length} cleanly indexed ${LEVELS.find(l => l.id === level)?.name} cards. Choose All topics to make a complete four-question set, or use the Book Library for the full chapter scan.` : `There are only ${pool.length} questions in this level. Choose another level.`);
      return;
    }
    const already = appState.records.find(r => r.date === selectedDate && r.completed);
    if (already) { setSetupError(`A completed four-question set is already saved for ${dateLabel(selectedDate)}. Choose another date to keep your daily history clear.`); return; }
    const seen = new Set(appState.attemptedIds || []);
    let available = shuffle(pool.filter(q => !seen.has(q.id)));
    if (available.length < 4) available = available.concat(shuffle(pool.filter(q => seen.has(q.id))));
    const chosen = available.slice(0, 4);
    if (chosen.length !== 4) { setSetupError('Could not prepare four unique questions. Please change the topic or level.'); return; }
    const session = {
      sessionId: `${selectedDate}-${Date.now()}`,
      date: selectedDate,
      level,
      topicId: topicId ? Number(topicId) : null,
      index: 0,
      finished: false,
      items: chosen.map((q, i) => ({ questionId: q.id, selectedOption: null, locked: false, revealed: false, startedAt: i === 0 ? Date.now() : null, timeSpent: 0, timeLimit: TIME_LIMITS[level], timedOut: false })),
    };
    setSelectedLevel(level); setSelectedTopic(topicId || '');
    updateLocal(prev => ({ ...prev, activeSession: session }));
    setTab('practice');
  };

  const updateSessionItem = (index, patch) => {
    updateLocal(prev => {
      if (!prev.activeSession) return prev;
      const items = [...prev.activeSession.items];
      items[index] = { ...items[index], ...patch };
      return { ...prev, activeSession: { ...prev.activeSession, items } };
    });
  };

  const nextQuestion = () => {
    updateLocal(prev => {
      const session = prev.activeSession;
      if (!session) return prev;
      if (session.index >= 3) return { ...prev, activeSession: { ...session, finished: true } };
      const nextIndex = session.index + 1;
      const items = [...session.items];
      items[nextIndex] = { ...items[nextIndex], startedAt: Date.now() };
      return { ...prev, activeSession: { ...session, index: nextIndex, items } };
    });
  };

  const savePracticeDay = async () => {
    const session = appState.activeSession;
    if (!session || !session.finished) return;
    const items = session.items.map(item => {
      const q = bank.questions.find(x => x.id === item.questionId);
      const answerKnown = Boolean(q?.answer);
      const isCorrect = answerKnown && item.selectedOption ? item.selectedOption.toLowerCase() === String(q.answer).toLowerCase() : (answerKnown ? false : null);
      return {
        questionId: item.questionId, chapter: q?.chapter, topic: q?.topic, selectedOption: item.selectedOption,
        correctOption: q?.answer || null, answerKnown, isCorrect, timeSpent: Number(item.timeSpent || 0),
        timeLimit: item.timeLimit, timedOut: Boolean(item.timedOut), revealed: Boolean(item.revealed), level: session.level,
        sourcePage: q?.page,
      };
    });
    const known = items.filter(i => i.answerKnown);
    const totalSeconds = items.reduce((s, i) => s + i.timeSpent, 0);
    const record = {
      date: session.date, completed: true, level: session.level, topicId: session.topicId,
      questionCount: 4, correctCount: known.filter(i => i.isCorrect).length, knownCount: known.length,
      totalSeconds, items, savedAt: new Date().toISOString(), streakValue: 0,
    };
    const existing = appState.records.filter(r => r.date !== session.date);
    const records = recalculateStreaks([...existing, record]);
    const savedRecord = records.find(r => r.date === session.date);
    const attempted = [...new Set([...(appState.attemptedIds || []), ...items.map(i => i.questionId)])];
    setAppState(prev => ({ ...prev, records, attemptedIds: attempted, activeSession: null }));
    setTab('dashboard');
    notify(`Practice day saved · streak ${savedRecord?.streakValue ?? 0}.`);
    if (supabase && cloudUser) {
      const { error } = await supabase.from('practice_days').upsert({
        user_id: cloudUser.id, practice_date: record.date, level: record.level, topic_id: record.topicId,
        question_count: 4, correct_count: record.correctCount, known_count: record.knownCount,
        total_seconds: record.totalSeconds, streak_value: savedRecord?.streakValue ?? 0,
        longest_streak: longestStreak(records), session_json: savedRecord,
      }, { onConflict: 'user_id,practice_date' });
      if (error) notify(`Day saved locally; cloud sync issue: ${error.message}`, 'warning');
    }
  };

  const openBook = (page = 1) => { setBookStartPage(Math.min(737, Math.max(1, Number(page) || 1))); setTab('book'); };
  const exportData = () => {
    const payload = { exportedAt: new Date().toISOString(), profile: appState.profile, records: appState.records, attemptedIds: appState.attemptedIds, theme: appState.theme };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'quant-aptitude-practice-backup.json'; a.click(); URL.revokeObjectURL(url);
    notify('Practice backup downloaded.');
  };
  const logout = async () => { if (supabase) await supabase.auth.signOut(); setCloudUser(null); setAppState(prev => ({ ...prev, profile: null, records: [], attemptedIds: [], activeSession: null })); };

  if (bankError) return <div className="loading-screen"><AlertCircle size={20} /><h2>Could not load the question bank</h2><p>{bankError}</p></div>;
  if (!bank) return <div className="loading-screen"><div className="loading-mark"><BrandMark /></div><strong>Preparing your aptitude workspace…</strong><span>Loading the question bank and source pages.</span></div>;
  if (cloudEnabled && !cloudReady) return <div className="loading-screen"><div className="loading-mark"><BrandMark /></div><strong>Connecting your study account…</strong><span>Syncing your practice history.</span></div>;
  if (cloudEnabled && !cloudUser) return <AuthScreen onReady={user => { setCloudUser(user); hydrateCloud(user); }} />;
  if (!appState.profile) return <Onboarding initialName={cloudUser?.user_metadata?.full_name || ''} cloud={cloudEnabled} onSave={saveProfile} />;

  const profile = appState.profile;
  const sidebarLogout = cloudEnabled ? logout : undefined;
  return <div className="app-shell">
    <Sidebar tab={tab} setTab={setTab} profile={profile} theme={appState.theme} setTheme={setTheme} cloud={cloudEnabled} onLogout={sidebarLogout} />
    <main className="main-area">
      <Topbar title={{dashboard:'Overview',practice:'Daily practice',topics:'Topic library',progress:'Your progress',book:'Book library',profile:'My profile',settings:'Settings'}[tab] || 'Quant Aptitude Coach'} subtitle={{dashboard:'Your personal aptitude training plan',practice:'Four questions. One focused session.',topics:'All 39 chapters from your source book',progress:'Consistency and performance insights',book:'Read every page of the original scan',profile:'Your learning profile and preferences',settings:'Customize your study environment'}[tab]} profile={profile} theme={appState.theme} setTheme={setTheme} cloud={cloudEnabled} />
      <div className="content-area">
        {tab === 'dashboard' && <Dashboard profile={profile} bank={bank} records={appState.records} attemptedIds={appState.attemptedIds} onPractice={(level) => { setSelectedLevel(level || 'beginner'); setSelectedTopic(''); setSetupError(''); setTab('practice'); }} onTopics={() => setTab('topics')} onBook={() => openBook(1)} onProgress={() => setTab('progress')} />}
        {tab === 'practice' && (appState.activeSession ? <PracticeSession session={appState.activeSession} bank={bank} onUpdateItem={updateSessionItem} onNext={nextQuestion} onSave={savePracticeDay} onExit={() => { updateLocal(prev => ({ ...prev, activeSession: null })); }} onOpenScan={setScanPage} /> : <PracticeSetup bank={bank} selectedLevel={selectedLevel} setSelectedLevel={setSelectedLevel} selectedTopic={selectedTopic} setSelectedTopic={setSelectedTopic} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onStart={() => startPractice(selectedLevel, selectedTopic)} records={appState.records} onReadTopic={id => { const t=bank.summary.find(x=>x.id===id); openBook(t?.startPage || 1); }} error={setupError} />)}
        {tab === 'topics' && <TopicsPage bank={bank} onPractice={(level, topic) => { setSelectedLevel(level); setSelectedTopic(String(topic)); setSetupError(''); setTab('practice'); }} onBook={openBook} />}
        {tab === 'progress' && <ProgressPage bank={bank} records={appState.records} attemptedIds={appState.attemptedIds} />}
        {tab === 'book' && <BookLibrary bank={bank} initialPage={bookStartPage} onPageChange={setBookStartPage} pdfUrl={sourcePdf.url} pdfName={sourcePdf.name} />}
        {tab === 'profile' && <ProfilePage profile={profile} onSave={saveProfile} onLogout={sidebarLogout} cloud={cloudEnabled} theme={appState.theme} setTheme={setTheme} records={appState.records} onExport={exportData} />}
        {tab === 'settings' && <SettingsPage theme={appState.theme} setTheme={setTheme} onExport={exportData} cloud={cloudEnabled} />}
      </div>
      <footer className="app-footer"><span>QUANT APTITUDE COACH</span><span>Personal practice · 39 topics · 737 source pages</span></footer>
    </main>
    <MobileNav tab={tab} setTab={setTab} />
    {scanPage && <SourceScanModal page={scanPage} onClose={() => setScanPage(null)} onChangePage={setScanPage} pdfUrl={sourcePdf.url} pdfName={sourcePdf.name} onGoToBook={() => { setBookStartPage(scanPage); setScanPage(null); setTab('book'); }} />}
    <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
  </div>;
}
