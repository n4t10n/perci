/**
 * Percí v2 - StorageManager (Unified Local-First Model con Aislamiento por Usuario)
 * Entity Hierarchy: Activity -> Plan -> Session -> Metric & Evidence
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
    if (!session) return baseKey; // Modo invitado / legacy
    try {
      const user = JSON.parse(session);
      return (user && user.id) ? `usr_${user.id}_${baseKey}` : baseKey;
    } catch (e) {
      return baseKey;
    }
  },

  // --- INITIAL SEED DATA ---
  getInitialSeedActivities() {
    return [
      {
        id: 'act_gym',
        name: 'Gym & Entrenamiento',
        icon: '🏋️‍♂️',
        color: '#00f2fe',
        category: 'Ejercicio',
        weekly_target: 4,
        created_at: new Date().toISOString()
      },
      {
        id: 'act_japanese',
        name: 'Japonés',
        icon: '🇯🇵',
        color: '#00e676',
        category: 'Estudio',
        weekly_target: 5,
        created_at: new Date().toISOString()
      },
      {
        id: 'act_reading',
        name: 'Lectura',
        icon: '📚',
        color: '#7c4dff',
        category: 'Hábito',
        weekly_target: 7,
        created_at: new Date().toISOString()
      }
    ];
  },

  getInitialSeedPlans() {
    return [
      {
        id: 'plan_upper_lower',
        activity_id: 'act_gym',
        name: 'Upper Lower Routine',
        active: true,
        exercises: [
          { id: 'ex_1', name: 'Press Banca', metric_type: 'fuerza', target: '3 series x 8-10 reps' },
          { id: 'ex_2', name: 'Dominadas', metric_type: 'fuerza', target: '3 series x fallo técnico' },
          { id: 'ex_3', name: 'Flexiones', metric_type: 'fuerza', target: '3 series x 12-15 reps' },
          { id: 'ex_4', name: 'Plancha Abdominal', metric_type: 'tiempo', target: '3 series x 45 seg' }
        ]
      },
      {
        id: 'plan_minna',
        activity_id: 'act_japanese',
        name: 'Minna no Nihongo',
        active: true,
        exercises: [
          { id: 'ex_j1', name: 'Vocabulario & Kanji', metric_type: 'items', target: '15 palabras / 45 min' },
          { id: 'ex_j2', name: 'Gramática ~てしまう', metric_type: 'tiempo', target: '30 min' }
        ]
      },
      {
        id: 'plan_reading_book',
        activity_id: 'act_reading',
        name: 'Hábitos Atómicos',
        active: true,
        exercises: [
          { id: 'ex_r1', name: 'Lectura Diaria', metric_type: 'paginas', target: '20 páginas por día' }
        ]
      }
    ];
  },

  // --- ACTIVITIES CRUD ---
  getActivities() {
    try {
      const storageKey = this.getUserKey(STORAGE_KEYS_V2.ACTIVITIES);
      const data = localStorage.getItem(storageKey);
      if (!data) {
        // Si no hay sesión de usuario activa (invitado), carga los datos iniciales
        if (storageKey === STORAGE_KEYS_V2.ACTIVITIES) {
          const seed = this.getInitialSeedActivities();
          localStorage.setItem(STORAGE_KEYS_V2.ACTIVITIES, JSON.stringify(seed));
          return seed;
        }
        // Para usuario con sesión nueva, retorna un arreglo vacío en 0
        return [];
      }
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  },

  saveActivity(act) {
    const activities = this.getActivities();
    if (!act.id) act.id = 'act_' + Date.now();
    if (!act.created_at) act.created_at = new Date().toISOString();

    const idx = activities.findIndex(a => a.id === act.id);
    if (idx !== -1) activities[idx] = act;
    else activities.push(act);

    const storageKey = this.getUserKey(STORAGE_KEYS_V2.ACTIVITIES);
    localStorage.setItem(storageKey, JSON.stringify(activities));
    return act;
  },

  getActivityById(id) {
    return this.getActivities().find(a => a.id === id);
  },

  deleteActivity(id) {
    const activities = this.getActivities().filter(a => a.id !== id);
    const storageKey = this.getUserKey(STORAGE_KEYS_V2.ACTIVITIES);
    localStorage.setItem(storageKey, JSON.stringify(activities));
  },

  // --- PLANS CRUD ---
  getPlans() {
    try {
      const storageKey = this.getUserKey(STORAGE_KEYS_V2.PLANS);
      const data = localStorage.getItem(storageKey);
      if (!data) {
        if (storageKey === STORAGE_KEYS_V2.PLANS) {
          const seed = this.getInitialSeedPlans();
          localStorage.setItem(STORAGE_KEYS_V2.PLANS, JSON.stringify(seed));
          return seed;
        }
        return [];
      }
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
    if (!plan.id) plan.id = 'plan_' + Date.now();

    const idx = plans.findIndex(p => p.id === plan.id);
    if (idx !== -1) plans[idx] = plan;
    else plans.push(plan);

    const storageKey = this.getUserKey(STORAGE_KEYS_V2.PLANS);
    localStorage.setItem(storageKey, JSON.stringify(plans));
    return plan;
  },

  deletePlan(id) {
    const plans = this.getPlans().filter(p => p.id !== id);
    const storageKey = this.getUserKey(STORAGE_KEYS_V2.PLANS);
    localStorage.setItem(storageKey, JSON.stringify(plans));
  },

  // --- SESSIONS & METRICS & EVIDENCES CRUD ---
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
    if (!session.id) session.id = 'sess_' + Date.now();
    if (!session.date) session.date = this.getTodayDateString();
    if (!session.time) session.time = new Date().toTimeString().slice(0, 5);

    const idx = sessions.findIndex(s => s.id === session.id);
    if (idx !== -1) sessions[idx] = session;
    else sessions.push(session);

    const storageKey = this.getUserKey(STORAGE_KEYS_V2.SESSIONS);
    localStorage.setItem(storageKey, JSON.stringify(sessions));
    return session;
  },

  deleteSession(id) {
    const sessions = this.getSessions().filter(s => s.id !== id);
    const storageKey = this.getUserKey(STORAGE_KEYS_V2.SESSIONS);
    localStorage.setItem(storageKey, JSON.stringify(sessions));
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
      if (!sess.metrics) continue;
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

    // If today has no logged session yet, check if yesterday had one to maintain streak
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