import { useEffect, useState } from 'react'
import { Activity, ArrowRight, Bike, CalendarDays, Check, Clock3, Footprints, LockKeyhole, LogOut, Mail, Plus, UsersRound, Waves, X } from 'lucide-react'
import './dashboard.css'

async function apiRequest(path, { token, ...options } = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const payload = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error || 'Une erreur est survenue. Réessaie.')
  return payload
}

function getInitialSession() {
  try {
    return JSON.parse(localStorage.getItem('triathlon-session') || 'null')
  } catch {
    return null
  }
}

function formatWeek() {
  const monday = new Date()
  const day = monday.getDay() || 7
  monday.setDate(monday.getDate() - day + 1)
  return `Semaine du ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(monday)}`
}

function formatTrainingDate(value) {
  const date = new Date(value)
  return {
    weekday: new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(date).replace('.', ''),
    day: new Intl.DateTimeFormat('fr-FR', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date).replace('.', ''),
    time: new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date),
  }
}

function initialDateTime() {
  const date = new Date(Date.now() + 48 * 60 * 60 * 1000)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function App() {
  const [session, setSession] = useState(getInitialSession)
  const [trainings, setTrainings] = useState([])
  const [rosters, setRosters] = useState({})
  const [selectedTrainingId, setSelectedTrainingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (!session?.token) return undefined
    let active = true

    async function loadDashboard() {
      setLoading(true)
      setDashboardError('')
      try {
        const [profile, trainingData] = await Promise.all([
          apiRequest('/api/me', { token: session.token }),
          apiRequest('/api/trainings', { token: session.token }),
        ])
        if (!active) return
        setTrainings(trainingData.trainings)
        setSession((current) => {
          const updated = { ...current, user: profile.user }
          localStorage.setItem('triathlon-session', JSON.stringify(updated))
          return updated
        })

        if (profile.user.role === 'coach' || profile.user.role === 'admin') {
          const entries = await Promise.all(trainingData.trainings.map(async (training) => {
            const data = await apiRequest(`/api/trainings/${training.id}/attendance`, { token: session.token })
            return [training.id, data]
          }))
          if (active) setRosters(Object.fromEntries(entries))
        }
      } catch (error) {
        if (active) {
          setDashboardError(error.message)
          if (error.message.includes('token') || error.message.includes('Authentication')) {
            localStorage.removeItem('triathlon-session')
            setSession(null)
          }
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDashboard()
    return () => { active = false }
  }, [session?.token, revision])

  function handleLogin(payload) {
    localStorage.setItem('triathlon-session', JSON.stringify(payload))
    setSession(payload)
  }

  function handleLogout() {
    localStorage.removeItem('triathlon-session')
    setSession(null)
    setTrainings([])
    setRosters({})
  }

  if (!session?.token) return <AuthView onLogin={handleLogin} />

  return (
    <Dashboard
      session={session}
      trainings={trainings}
      rosters={rosters}
      selectedTrainingId={selectedTrainingId}
      onSelectTraining={setSelectedTrainingId}
      loading={loading}
      error={dashboardError}
      onRefresh={() => setRevision((value) => value + 1)}
      onLogout={handleLogout}
    />
  )
}

function AuthView({ onLogin }) {
  const query = new URLSearchParams(window.location.search)
  const [mode, setMode] = useState(() => {
    if (window.location.pathname.endsWith('/activate')) return 'activate'
    if (window.location.pathname.endsWith('/reset-password')) return 'reset'
    return 'login'
  })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const token = query.get('token') || ''

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    try {
      if (mode === 'login') {
        onLogin(await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }))
      } else if (mode === 'forgot') {
        const result = await apiRequest('/api/auth/password-reset', { method: 'POST', body: JSON.stringify({ email }) })
        setMessage(result.message)
      } else {
        if (password !== confirmation) throw new Error('Les mots de passe ne correspondent pas.')
        const path = mode === 'activate' ? '/api/auth/activate' : '/api/auth/password-reset/complete'
        const result = await apiRequest(path, { method: 'POST', body: JSON.stringify({ token, password }) })
        if (mode === 'activate') onLogin(result)
        else {
          setMessage('Mot de passe modifié. Tu peux te connecter.')
          setMode('login')
        }
      }
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setBusy(false)
    }
  }

  const title = { login: 'Retrouve ton équipe.', forgot: 'On t’aide à revenir.', activate: 'Bienvenue au club.', reset: 'Choisis un nouveau mot de passe.' }[mode]

  return (
    <main className="auth-page">
      <section className="auth-story">
        <a className="brand brand-light" href="/" aria-label="Club Triathlon, accueil"><span className="brand-mark"><Activity size={21} strokeWidth={2.6} /></span><span>CLUB<span className="brand-dot">.</span>TRIATHLON</span></a>
        <div className="story-copy"><span className="eyebrow eyebrow-light">ENSEMBLE, SUR CHAQUE LIGNE</span><h1>Chaque séance<br />commence ici.</h1><p>Les bons rendez-vous, les bonnes personnes, au bon endroit.</p></div>
        <div className="story-footer"><span className="story-line" /> NATATION · VÉLO · COURSE</div>
      </section>
      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <span className="eyebrow">ESPACE MEMBRES</span><h2>{title}</h2>
          <p className="auth-intro">{mode === 'login' ? 'Connecte-toi pour répondre aux entraînements de la semaine.' : 'Utilise le lien reçu par e-mail pour sécuriser ton compte.'}</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'login' || mode === 'forgot' ? <label>Adresse e-mail<span className="input-wrap"><Mail size={17} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></span></label> : <>
              {!token && <p className="form-message error">Le lien est incomplet. Ouvre le lien reçu par e-mail.</p>}
              <label>Nouveau mot de passe<span className="input-wrap"><LockKeyhole size={17} /><input type="password" minLength="12" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></span><small>12 caractères minimum</small></label>
              <label>Confirmer le mot de passe<span className="input-wrap"><LockKeyhole size={17} /><input type="password" minLength="12" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></span></label>
            </>}
            {mode === 'login' && <label>Mot de passe<span className="input-wrap"><LockKeyhole size={17} /><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></span></label>}
            {error && <p className="form-message error" role="alert">{error}</p>}
            {message && <p className="form-message success" role="status">{message}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={busy || ((mode === 'activate' || mode === 'reset') && !token)}>{busy ? 'Un instant…' : mode === 'login' ? 'Se connecter' : mode === 'forgot' ? 'Recevoir le lien' : mode === 'activate' ? 'Activer mon compte' : 'Changer le mot de passe'}{!busy && <ArrowRight size={17} />}</button>
          </form>
          <div className="auth-switch">{mode === 'login' ? <button type="button" onClick={() => { setMode('forgot'); setError(''); setMessage('') }}>Mot de passe oublié ?</button> : <button type="button" onClick={() => { setMode('login'); setError(''); setMessage('') }}>Retour à la connexion</button>}</div>
        </div>
        <span className="auth-privacy">Accès réservé aux adhérents du club</span>
      </section>
    </main>
  )
}

function Dashboard({ session, trainings, rosters, selectedTrainingId, onSelectTraining, loading, error, onRefresh, onLogout }) {
  const isStaff = session.user.role === 'coach' || session.user.role === 'admin'
  const selectedTraining = trainings.find((training) => String(training.id) === String(selectedTrainingId)) || trainings[0]
  const selectedRoster = selectedTraining ? rosters[selectedTraining.id] : null
  const attended = trainings.filter((training) => training.effective_status === 'present').length
  const responded = trainings.filter((training) => training.effective_status !== 'pending').length
  const totalPresent = Object.values(rosters).reduce((sum, roster) => sum + (roster?.counts.present || 0), 0)

  return (
    <div className="dashboard-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Club Triathlon, accueil"><span className="brand-mark"><Activity size={19} strokeWidth={2.6} /></span><span>CLUB<span className="brand-dot">.</span>TRIATHLON</span></a>
        <div className="topbar-right"><span className="role-chip">{isStaff ? 'ÉQUIPE ENCADRANTE' : 'ESPACE ADHÉRENT'}</span><span className="topbar-name">{session.user.full_name}</span><button className="icon-button" type="button" onClick={onLogout} aria-label="Se déconnecter" title="Se déconnecter"><LogOut size={18} /></button></div>
      </header>
      <main className="dashboard-main">
        <div className="week-banner"><div className="week-kicker"><CalendarDays size={15} /> {formatWeek()}</div><div className="week-status"><span className="live-dot" /> SAISON EN COURS</div></div>
        <section className="dashboard-heading">
          <div><span className="eyebrow">LE RENDEZ-VOUS DE LA SEMAINE</span><h1>{isStaff ? 'Le groupe prend forme.' : 'Tu viens cette semaine ?'}</h1><p>{isStaff ? 'Les effectifs en un coup d’œil. La semaine se prépare ici.' : 'Fais connaître ta présence séance par séance.'}</p></div>
          <div className="stat-strip"><div className="stat-item"><span className="stat-value">{String(trainings.length).padStart(2, '0')}</span><span className="stat-label">SÉANCES</span></div><span className="stat-rule" /><div className="stat-item"><span className="stat-value">{String(isStaff ? totalPresent : attended).padStart(2, '0')}</span><span className="stat-label">{isStaff ? 'PRÉSENCES' : 'MES OUI'}</span></div>{!isStaff && <><span className="stat-rule" /><div className="stat-item"><span className="stat-value">{String(Math.max(trainings.length - responded, 0)).padStart(2, '0')}</span><span className="stat-label">À RÉPONDRE</span></div></>}</div>
        </section>
        {error && <div className="dashboard-alert" role="alert">{error}</div>}
        <div className="dashboard-grid">
          <section className="sessions-section">
            <div className="section-heading"><div><span className="eyebrow">AGENDA DU CLUB</span><h2>Les entraînements</h2></div><span className="section-count">{trainings.length} SÉANCE{trainings.length === 1 ? '' : 'S'}</span></div>
            {loading && trainings.length === 0 ? <div className="empty-state">Chargement des entraînements…</div> : trainings.length === 0 ? <div className="empty-state"><CalendarDays size={25} /><strong>La semaine est encore libre.</strong><span>{isStaff ? 'Ajoute les premières séances dans le panneau à droite.' : 'Les entraîneurs publieront bientôt les prochains rendez-vous.'}</span></div> : <div className="training-list">{trainings.map((training, index) => <TrainingRow key={training.id} training={training} index={index} isStaff={isStaff} roster={rosters[training.id]} selected={String(selectedTraining?.id) === String(training.id)} onSelect={() => onSelectTraining(training.id)} token={session.token} onRefresh={onRefresh} />)}</div>}
          </section>
          <aside className="side-column">{isStaff ? <><TrainingForm token={session.token} onCreated={onRefresh} /><MemberForm token={session.token} isAdmin={session.user.role === 'admin'} />{selectedTraining && <RosterPanel training={selectedTraining} roster={selectedRoster} />}</> : <MemberNote trainings={trainings} />}</aside>
        </div>
        <footer className="dashboard-footer"><span>CLUB TRIATHLON</span><span>On se retrouve sur la ligne de départ.</span></footer>
      </main>
    </div>
  )
}

function TrainingRow({ training, index, isStaff, roster, selected, onSelect, token, onRefresh }) {
  const date = formatTrainingDate(training.starts_at)
  const responseExists = Boolean(training.response_status)
  const isLocked = !training.response_editable
  const kind = training.discipline?.toLowerCase() || ''
  const DisciplineIcon = kind.includes('nat') ? Waves : kind.includes('vélo') || kind.includes('velo') ? Bike : Footprints
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function answer(status) {
    setSaving(true)
    setError('')
    try {
      await apiRequest(`/api/trainings/${training.id}/attendance`, { token, method: 'PUT', body: JSON.stringify({ status }) })
      onRefresh()
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className={`training-row ${selected && isStaff ? 'training-row-selected' : ''}`} onClick={isStaff ? onSelect : undefined}>
      <div className="date-block"><span>{date.weekday}</span><strong>{date.day}</strong><span>{date.month}</span></div>
      <div className="training-content"><div className="training-title-line"><span className={`sport-icon sport-${index % 3}`}><DisciplineIcon size={17} /></span><div><h3>{training.title}</h3><p>{training.discipline || 'Entraînement club'}</p></div></div><div className="training-meta"><span><Clock3 size={14} /> {date.time}</span>{training.location && <span><UsersRound size={14} /> {training.location}</span>}</div>{training.notes && <p className="training-notes">{training.notes}</p>}{error && <p className="inline-error" role="alert">{error}</p>}</div>
      {isStaff ? <div className="row-response staff-count"><span className="status-label">{roster ? `${roster.counts.present} présent${roster.counts.present > 1 ? 's' : ''}` : 'Calcul…'}</span><span className="response-sub">{roster ? `${roster.counts.absent} absent${roster.counts.absent > 1 ? 's' : ''} · ${roster.counts.pending} en attente` : 'Effectifs'}</span></div> : <div className="row-response"><span className={`status-label status-${training.effective_status}`}>{training.effective_status === 'present' ? 'Je viens' : training.effective_status === 'absent' ? responseExists ? 'Absent' : 'Absent · sans réponse' : 'À confirmer'}</span>{isLocked ? <span className="response-sub locked-note"><LockKeyhole size={12} /> Réponse figée</span> : <div className="answer-buttons" aria-label={`Réponse pour ${training.title}`}><button className={`answer-button answer-yes ${training.effective_status === 'present' ? 'active' : ''}`} type="button" disabled={saving} onClick={(event) => { event.stopPropagation(); answer('present') }} aria-label="Confirmer ma présence" title="Présent"><Check size={16} /></button><button className={`answer-button answer-no ${training.effective_status === 'absent' && responseExists ? 'active' : ''}`} type="button" disabled={saving} onClick={(event) => { event.stopPropagation(); answer('absent') }} aria-label="Indiquer mon absence" title="Absent"><X size={16} /></button></div>}</div>}
      {isStaff && <span className="row-chevron"><ArrowRight size={17} /></span>}
    </article>
  )
}

function TrainingForm({ token, onCreated }) {
  const [form, setForm] = useState({ title: '', discipline: 'Natation', startsAt: initialDateTime(), location: '', notes: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })) }

  async function submit(event) {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      await apiRequest('/api/trainings', { token, method: 'POST', body: JSON.stringify({ ...form, startsAt: new Date(form.startsAt).toISOString() }) })
      setMessage('Séance ajoutée à la semaine.')
      setForm((current) => ({ ...current, title: '', location: '', notes: '' }))
      onCreated()
    } catch (submitError) { setError(submitError.message) } finally { setBusy(false) }
  }

  return <section className="tool-panel schedule-panel"><div className="panel-title"><span className="panel-icon"><Plus size={17} /></span><div><span className="eyebrow">ORGANISATION</span><h2>Ajouter une séance</h2></div></div><form className="compact-form" onSubmit={submit}><label>Nom de la séance<input value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Ex. Sortie vélo endurance" required /></label><div className="form-two-columns"><label>Discipline<select value={form.discipline} onChange={(event) => update('discipline', event.target.value)}><option>Natation</option><option>Vélo</option><option>Course à pied</option><option>Renforcement</option><option>Triathlon</option></select></label><label>Date et heure<input type="datetime-local" value={form.startsAt} onChange={(event) => update('startsAt', event.target.value)} required /></label></div><label>Lieu<input value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="Ex. Piscine municipale" /></label><label>Informations pratiques<textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} rows="2" placeholder="Matériel, niveau, point de rendez-vous…" /></label>{error && <p className="form-message error" role="alert">{error}</p>}{message && <p className="form-message success" role="status">{message}</p>}<button className="primary-button full-button" type="submit" disabled={busy}><Plus size={16} /> {busy ? 'Ajout…' : 'Publier la séance'}</button></form></section>
}

function MemberForm({ token, isAdmin }) {
  const [form, setForm] = useState({ fullName: '', email: '', role: 'member' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      await apiRequest('/api/members', { token, method: 'POST', body: JSON.stringify(form) })
      setMessage('Invitation envoyée par e-mail.')
      setForm({ fullName: '', email: '', role: 'member' })
    } catch (submitError) { setError(submitError.message) } finally { setBusy(false) }
  }

  return <section className="tool-panel member-panel"><div className="panel-title"><span className="panel-icon panel-icon-coral"><Mail size={17} /></span><div><span className="eyebrow">ACCÈS AU CLUB</span><h2>Inviter un membre</h2></div></div><form className="compact-form" onSubmit={submit}><label>Nom et prénom<input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} required /></label><label>Adresse e-mail<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required /></label>{isAdmin && <label>Rôle<select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}><option value="member">Adhérent</option><option value="coach">Entraîneur</option></select></label>}{error && <p className="form-message error" role="alert">{error}</p>}{message && <p className="form-message success" role="status">{message}</p>}<button className="secondary-button full-button" type="submit" disabled={busy}><Mail size={16} /> {busy ? 'Envoi…' : 'Créer et envoyer l’invitation'}</button></form></section>
}

function RosterPanel({ training, roster }) {
  return <section className="roster-panel"><div className="roster-heading"><div><span className="eyebrow">EFFECTIFS</span><h2>{training.title}</h2></div><UsersRound size={19} /></div>{!roster ? <p className="roster-empty">Chargement des réponses…</p> : roster.members.length === 0 ? <p className="roster-empty">Aucun compte adhérent actif.</p> : <><div className="roster-counts"><span><i className="count-dot dot-present" /> {roster.counts.present} présent{roster.counts.present > 1 ? 's' : ''}</span><span><i className="count-dot dot-absent" /> {roster.counts.absent} absent{roster.counts.absent > 1 ? 's' : ''}</span></div><div className="roster-list">{roster.members.map((member) => <div className="roster-person" key={member.id}><span className="person-initials">{member.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="person-name">{member.full_name}</span><span className={`person-status person-${member.effective_status}`}>{member.effective_status === 'present' ? 'Présent' : member.effective_status === 'pending' ? 'En attente' : member.response ? 'Absent' : 'Sans réponse'}</span></div>)}</div></>}</section>
}

function MemberNote({ trainings }) {
  const nextDeadline = trainings.find((training) => training.effective_status === 'pending')
  return <section className="member-note"><span className="note-symbol"><Clock3 size={19} /></span><span className="eyebrow">À GARDER EN TÊTE</span><h2>Un changement de programme ?</h2><p>Tu peux modifier ta réponse jusqu’à 24 h avant chaque séance. Après, l’effectif est transmis aux entraîneurs.</p>{nextDeadline ? <div className="note-next"><CalendarDays size={15} /><span>Prochaine réponse à donner :<strong>{nextDeadline.title}</strong></span></div> : <div className="note-complete"><Check size={15} /> Tes réponses sont à jour</div>}<div className="note-sports"><span><Waves size={14} /> Natation</span><span><Bike size={14} /> Vélo</span><span><Footprints size={14} /> Course</span></div></section>
}

export default App
