/**
 * Percí v2 - StorageManager (Hybrid Supabase & Local Cache Model)
 * Mantiene compatibilidad sincrónica total con app.js, activities.js y calendar.js
 */

const STORAGE_KEYS_V2 = {
  ACTIVITIES: 'perci_v2_activities',
  PLANS: 'perci_v2_plans',
  SESSIONS: 'perci_v2_sessions',
  SETTINGS: 'perci_v2_settings'
};

const StorageManager = {
  // Helper para aislar claves de localStorage según el usuario activo
  getUserKey(baseKey) {
    const session = localStorage.getItem('perci_session_v2');
    if (!session) return baseKey;
    try {
      const user = JSON.parse(session);
      return (user && user.id) ? `usr_${user.id}_${baseKey}` : baseKey;
    } catch (e) {
      return baseKey;
    }
  },

  clearMemoryCache() {
    // Método auxiliar al cerrar sesión
  },

  // --- SUPABASE PROXY SYNC ---
  async syncFromSupabase() {
    if (!window.supabase) return;
    const sessionStr = localStorage.getItem('perci_session_v2');
    if (!sessionStr) return;

    try {
      // 1. Cargar Actividades
      const { data: actData } = await window.supabase.from('activities').select('*');
      if (actData) {
        const formattedAct = actData.map(a => ({
          id: a.id,
          name: a.name,
          icon: a.icon,
          category: a.category,
          weekly_target: a.weekly_target,
          color: a.color,
          created_at: a.created_at
        }));
        localStorage.setItem(this.getUserKey(STORAGE_KEYS_V2.ACTIVITIES), JSON.stringify(formattedAct));
      }

      // 2. Cargar Planes
      const { data: planData } = await window.supabase.from('plans').select('*');
      if (planData) {
        const formattedPlans = planData.map(p => ({
          id: p.id,
          activity_id: p.activity_id,
          name: p.name,
          active: true,
          exercises: p.items || []
        }));
        localStorage.setItem(this.getUserKey(STORAGE_KEYS_V2.PLANS), JSON.stringify(formattedPlans));
      }

      // 3. Cargar Sesiones
      const { data: sessData } = await window.supabase.from('sessions').select('*');
      if (sessData) {
        const formattedSess = sessData.map(s => ({
          id: s.id,
          activity_id: s.activity_id,
          plan_id: s.plan_id,
          date: s.date,
          time: s.time,
          energy: s.energy,
          difficulty: s.difficulty,
          notes: s.notes,
          metrics: s.metrics || []
        }));
        localStorage.setItem(this.getUserKey(STORAGE_KEYS_V2.SESSIONS), JSON.stringify(formattedSess));
      }
    } catch (err) {
      console.error('Error sincronizando desde Supabase:', err);
    }
  },

  // --- ACTIVITIES CRUD ---
  getActivities() {
    try {
      const storageKey = this.getUserKey(STORAGE_KEYS_V2.ACTIVITIES);
      const data = localStorage.getItem(storageKey);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  },

  saveActivity(act) {
    const activities = this.getActivities();
    const isNew = !act.id || act.id.startsWith('act_');

    if (!act.id) act.id = 'act_' + Date.now();
    if (!act.created_at) act.created_at = new Date().toISOString();

    const idx = activities.findIndex(a => a.id === act.id);
    if (idx !== -1) activities[idx] = act;
    else activities.push(act);

    const storageKey = this.getUserKey(STORAGE_KEYS_V2.ACTIVITIES);
    localStorage.setItem(storageKey, JSON.stringify(activities));

    // Async save to Supabase
    if (window.supabase) {
      const sessionStr = localStorage.getItem('perci_session_v2');
      if (sessionStr) {
        const user = JSON.parse(sessionStr);
        const payload = {
          user_id: user.id,
          name: act.name,
          icon: act.icon,
          category: act.category,
          weekly_target: parseInt(act.weekly_target || 3),
          color: act.color || '#00f2fe'
        };

        if (isNew) {
          window.supabase.from('activities').insert([payload]).select().then(({ data }) => {
            if (data && data[0]) {
              act.id = data[0].id;
              this.saveActivity(act);
            }
          });
        } else {
          window.supabase.from('activities').update(payload).eq('id', act.id);
        }
      }
    }

    return act;
  },

  getActivityById(id) {
    return this.getActivities().find(a => a.id === id);
  },

  deleteActivity(id) {
    const activities = this.getActivities().filter(a => a.id !== id);
    const storageKey = this.getUserKey(STORAGE_KEYS_V2.ACTIVITIES);
    localStorage.setItem(storageKey, JSON.stringify(activities));

    if (window.supabase) {
      window.supabase.from('activities').delete().eq('id', id);
    }
  },

  // --- PLANS CRUD ---
  getPlans() {
    try {
      const storageKey = this.getUserKey(STORAGE_KEYS_V2.PLANS);
      const data = localStorage.getItem(storageKey);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  },

  getPlansByActivity(activityId) {
    return this.getPlans().filter(p => p.activity_id === activityId);
  },

  savePlan(plan) {
    const plans = this.getPlans();
    const isNew = !plan.id || plan.id.startsWith('plan_');

    if (!plan.id) plan.id = 'plan_' + Date.now();

    const idx = plans.findIndex(p => p.id === plan.id);
    if (idx !== -1) plans[idx] = plan;
    else plans.push(plan);

    const storageKey = this.getUserKey(STORAGE_KEYS_V2.PLANS);
    localStorage.setItem(storageKey, JSON.stringify(plans));

    // Async save to Supabase
    if (window.supabase) {
      const sessionStr = localStorage.getItem('perci_session_v2');
      if (sessionStr) {
        const user = JSON.parse(sessionStr);
        const payload = {
          user_id: user.id,
          activity_id: plan.activity_id,
          name: plan.name,
          items: plan.exercises || []
        };

        if (isNew) {
          window.supabase.from('plans').insert([payload]).select().then(({ data }) => {
            if (data && data[0]) {
              plan.id = data[0].id;
              this.savePlan(plan);
            }
          });
        } else {
          window.supabase.from('plans').update(payload).eq('id', plan.id);
        }
      }
    }

    return plan;
  },

  deletePlan(id) {
    const plans = this.getPlans().filter(p => p.id !== id);
    const storageKey = this.getUserKey(STORAGE_KEYS_V2.PLANS);
    localStorage.setItem(storageKey, JSON.stringify(plans));

    if (window.supabase) {
      window.supabase.from('plans').delete().eq('id', id);
    }
  },

  // --- SESSIONS CRUD ---
  getSessions() {
    try {
      const storageKey = this.getUserKey(STORAGE_KEYS_V2.SESSIONS);
      const data = localStorage.getItem(storageKey);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  },

  saveSession(session) {
    const sessions = this.getSessions();
    const isNew = !session.id || session.id.startsWith('sess_');

    if (!session.id) session.id = 'sess_' + Date.now();
    if (!session.date) session.date = this.getTodayDateString();
    if (!session.time) session.time = new Date().toTimeString().slice(0, 5);

    const idx = sessions.findIndex(s => s.id === session.id);
    if (idx !== -1) sessions[idx] = session;
    else sessions.push(session);

    const storageKey = this.getUserKey(STORAGE_KEYS_V2.SESSIONS);
    localStorage.setItem(storageKey, JSON.stringify(sessions));

    // Async save to Supabase
    if (window.supabase) {
      const sessionStr = localStorage.getItem('perci_session_v2');
      if (sessionStr) {
        const user = JSON.parse(sessionStr);
        const payload = {
          user_id: user.id,
          activity_id: session.activity_id,
          plan_id: session.plan_id || null,
          date: session.date,
          time: session.time,
          energy: parseInt(session.energy || 4),
          difficulty: parseInt(session.difficulty || 3),
          notes: session.notes || '',
          metrics: session.metrics || []
        };

        if (isNew) {
          window.supabase.from('sessions').insert([payload]).select().then(({ data }) => {
            if (data && data[0]) {
              session.id = data[0].id;
              this.saveSession(session);
            }
          });
        } else {
          window.supabase.from('sessions').update(payload).eq('id', session.id);
        }
      }
    }

    return session;
  },

  deleteSession(id) {
    const sessions = this.getSessions().filter(s => s.id !== id);
    const storageKey = this.getUserKey(STORAGE_KEYS_V2.SESSIONS);
    localStorage.setItem(storageKey, JSON.stringify(sessions));

    if (window.supabase) {
      window.supabase.from('sessions').delete().eq('id', id);
    }
  },

  getSessionsByDate(dateStr) {
    const target = this.normalizeDateStr(dateStr);
    return this.getSessions().filter(s => this.normalizeDateStr(s.date) === target);
  },

  getSessionsByActivity(activityId) {
    return this.getSessions().filter(s => s.activity_id === activityId);
  },

  getLastSessionForExercise(exerciseName) {
    const sessions = this.getSessions().sort((a, b) => new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00')));
    for (const sess of sessions) {
      if (!sess.metrics || !Array.isArray(sess.metrics)) continue;
      const m = sess.metrics.find(item => item.exercise_name && item.exercise_name.trim().toLowerCase() === exerciseName.trim().toLowerCase());
      if (m) return { sessionDate: sess.date, metric: m };
    }
    return null;
  },

  // --- STREAK & CALENDAR HELPERS ---
  normalizeDateStr(rawDate) {
    if (!rawDate) return '';
    let str = String(rawDate).split('T')[0].replace(/\//g, '-');
    const parts = str.split('-');
    if (parts.length === 3) {
      const y = parts[0];
      const m = String(parts[1]).padStart(2, '0');
      const d = String(parts[2]).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return str;
  },

  getTodayDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getAllLoggedDatesMap() {
    const dates = {};
    const activitiesMap = {};
    this.getActivities().forEach(a => activitiesMap[a.id] = a);

    this.getSessions().forEach(s => {
      const norm = this.normalizeDateStr(s.date);
      if (norm) {
        if (!dates[norm]) dates[norm] = { count: 0, activities: [] };
        dates[norm].count++;
        const act = activitiesMap[s.activity_id];
        if (act && !dates[norm].activities.some(a => a.id === act.id)) {
          dates[norm].activities.push(act);
        }
      }
    });
    return dates;
  },

  calculateCurrentStreak() {
    const dateMap = this.getAllLoggedDatesMap();
    let currentStreak = 0;
    
    let checkDate = new Date();
    let dateStr = this.getTodayDateString(checkDate);

    if (!dateMap[dateStr]) {
      checkDate.setDate(checkDate.getDate() - 1);
      dateStr = this.getTodayDateString(checkDate);
    }

    while (dateMap[dateStr]) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
      dateStr = this.getTodayDateString(checkDate);
    }

    return currentStreak;
  },

  // --- SETTINGS CRUD ---
  getSettings() {
    try {
      const storageKey = this.getUserKey(STORAGE_KEYS_V2.SETTINGS);
      const data = localStorage.getItem(storageKey);
      const parsed = data ? JSON.parse(data) : {};
      return (parsed && typeof parsed === 'object') ? parsed : { theme: 'dark', userName: 'Valen' };
    } catch (e) {
      return { theme: 'dark', userName: 'Valen' };
    }
  },

  saveSettings(newSettings) {
    const current = this.getSettings();
    const updated = { ...current, ...newSettings };
    const storageKey = this.getUserKey(STORAGE_KEYS_V2.SETTINGS);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    return updated;
  },

  // --- BACKUP & CSV EXPORT/IMPORT ---
  exportBackupJSON() {
    const backup = {
      version: 'v2',
      settings: this.getSettings(),
      activities: this.getActivities(),
      plans: this.getPlans(),
      sessions: this.getSessions(),
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(backup, null, 2);
  },

  importBackupJSON(jsonString) {
    try {
      const backup = JSON.parse(jsonString);
      if (backup.activities && Array.isArray(backup.activities)) {
        const key = this.getUserKey(STORAGE_KEYS_V2.ACTIVITIES);
        localStorage.setItem(key, JSON.stringify(backup.activities));
      }
      if (backup.plans && Array.isArray(backup.plans)) {
        const key = this.getUserKey(STORAGE_KEYS_V2.PLANS);
        localStorage.setItem(key, JSON.stringify(backup.plans));
      }
      if (backup.sessions && Array.isArray(backup.sessions)) {
        const key = this.getUserKey(STORAGE_KEYS_V2.SESSIONS);
        localStorage.setItem(key, JSON.stringify(backup.sessions));
      }
      if (backup.settings) {
        const key = this.getUserKey(STORAGE_KEYS_V2.SETTINGS);
        localStorage.setItem(key, JSON.stringify(backup.settings));
      }
      return true;
    } catch (e) {
      console.error('Backup import error:', e);
      return false;
    }
  },

  clearAllData() {
    localStorage.removeItem(this.getUserKey(STORAGE_KEYS_V2.ACTIVITIES));
    localStorage.removeItem(this.getUserKey(STORAGE_KEYS_V2.PLANS));
    localStorage.removeItem(this.getUserKey(STORAGE_KEYS_V2.SESSIONS));
    localStorage.removeItem(this.getUserKey(STORAGE_KEYS_V2.SETTINGS));
  }
};