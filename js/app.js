/**
 * Percí v2 - App Controller
 * Manages Home Screen Actionable Cards, 5-Tab Navigation, Dual Theme, Toast System, & Backup/Restore.
 */

window.App = {
  init() {
    this.setupTheme();
    this.bindTabNavigation();
    this.bindModalsClose();
    this.bindSettingsEvents();

    // Initialize modules safely
    try { if (window.ActivitiesModule) window.ActivitiesModule.init(); } catch (e) { console.error('Error init ActivitiesModule:', e); }
    try { if (window.CalendarModule) window.CalendarModule.init(); } catch (e) { console.error('Error init CalendarModule:', e); }
    try { if (window.AnalyticsModule) window.AnalyticsModule.init(); } catch (e) { console.error('Error init AnalyticsModule:', e); }

    this.renderHomeTodayActions();
  },

  // THEME MANAGEMENT
  setupTheme() {
    const settings = StorageManager.getSettings();
    this.applyTheme(settings.theme || 'dark');

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
        StorageManager.saveSettings({ theme: newTheme });
      });
    }

    const settingsSelect = document.getElementById('settingsThemeSelect');
    if (settingsSelect) {
      settingsSelect.value = settings.theme || 'dark';
      settingsSelect.addEventListener('change', (e) => {
        this.applyTheme(e.target.value);
        StorageManager.saveSettings({ theme: e.target.value });
      });
    }
  },

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const settingsSelect = document.getElementById('settingsThemeSelect');
    if (settingsSelect) settingsSelect.value = theme;
  },

  // TAB NAVIGATION (5 SECTIONS: Inicio, Calendario, Actividades, Analytics, Perfil)
  bindTabNavigation() {
    const navItems = document.querySelectorAll('.app-nav .nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetTabId = item.dataset.tab;
        this.switchTab(targetTabId);
      });
    });
  },

  switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.querySelectorAll('.app-nav .nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll('.app-view').forEach(view => {
      view.classList.remove('active');
      view.style.display = 'none'; // Asegura ocultar otras vistas
    });

    const targetView = document.getElementById(`view-${tabId}`);
    if (targetView) {
      targetView.classList.add('active');
      targetView.style.display = 'block'; // Muestra únicamente la vista actual
    }

    // Si entramos a Analytics, inicializar el módulo
    if (tabId === 'analytics' && window.AnalyticsModule) {
      window.AnalyticsModule.init();
    }

    const targetPane = document.getElementById(tabId);
    const targetNav = document.querySelector(`.app-nav .nav-item[data-tab="${tabId}"]`);

    if (targetPane) targetPane.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    // Refresh views on tab change
    if (tabId === 'tabHome') {
      this.renderHomeTodayActions();
    } else if (tabId === 'tabCalendar' && window.CalendarModule) {
      if (typeof window.CalendarModule.init === 'function') {
        window.CalendarModule.init();
      } else {
        if (typeof window.CalendarModule.renderCalendar === 'function') window.CalendarModule.renderCalendar();
        if (typeof window.CalendarModule.renderTimeline === 'function') window.CalendarModule.renderTimeline();
      }
    } else if (tabId === 'tabActivities' && window.ActivitiesModule) {
      if (typeof window.ActivitiesModule.renderActivitiesList === 'function') window.ActivitiesModule.renderActivitiesList();
    } else if (tabId === 'tabAnalytics' && window.AnalyticsModule) {
      if (typeof window.AnalyticsModule.refreshAnalytics === 'function') window.AnalyticsModule.refreshAnalytics();
    }
  },

  // RENDER HOME TODAY ACTIONS & STATS OVERVIEW
  renderHomeTodayActions() {
    const defaultIconHtml = `<img src="assets/logo-perci-grafico.svg" alt="Percí" style="width:20px; height:20px; vertical-align:middle;" />`;
    const container = document.getElementById('homeTodayActionsList');
    const activities = StorageManager.getActivities();
    const todayStr = StorageManager.getTodayDateString();
    const todaySessions = StorageManager.getSessionsByDate(todayStr);

    // 1. Actualizar Tarjetas de Estadísticas en Home
    this.updateHomeStats(activities, todaySessions);

    // 2. Renderizar lista de Acciones para Hoy
    if (container) {
      if (activities.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <p>No tienes actividades creadas. ¡Empieza creando tu primera actividad abajo!</p>
            <button class="btn btn-primary btn-sm" onclick="ActivitiesModule.openActivityModal()" style="margin-top: 8px;">+ Crear Actividad</button>
          </div>
        `;
      } else {
        container.innerHTML = activities.map(act => {
          const plans = StorageManager.getPlansByActivity(act.id);
          const isCompletedToday = todaySessions.some(s => s.activity_id === act.id);
          const actSessions = StorageManager.getSessionsByActivity(act.id);
          const lastSession = actSessions.length > 0 ? actSessions.sort((a, b) => new Date(b.date) - new Date(a.date))[0] : null;

          let statusBadge = isCompletedToday
            ? `<span class="status-badge-completed">✔ Completado Hoy</span>`
            : `<span class="status-badge-pending">▶ Hacer ahora</span>`;

          let detailSub = 'Toca para registrar sesión';
          if (lastSession) {
            detailSub = `Última vez: ${lastSession.date}`;
          } else if (plans.length > 0) {
            detailSub = `Plan: ${plans[0].name}`;
          }

          return `
            <div class="today-action-card" onclick="App.handleHomeActionClick('${act.id}')">
              <div class="action-left">
                <div class="activity-icon-badge" style="border-left: 3px solid ${act.color || 'var(--accent-cyan)'};">
                  ${act.icon || '📌'}
                </div>
                <div class="action-info">
                  <h4>${this.escapeHtml(act.name)}</h4>
                  <p>${detailSub}</p>
                </div>
              </div>
              <div>
                ${statusBadge}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 3. Renderizar Timeline Creativo de Actividad Reciente
    this.renderRecentActivityTimeline();
  },

  // ACTUALIZAR CARDS DE RESUMEN EN HOME
  updateHomeStats(activities, todaySessions) {
    const statTotalWorkouts = document.getElementById('statTotalWorkouts');
    const statTotalActivities = document.getElementById('statTotalActivities');
    const statCardioKm = document.getElementById('statCardioKm');

    // Sesiones de Hoy
    if (statTotalWorkouts) {
      statTotalWorkouts.innerText = todaySessions.length;
    }

    // Total Actividades Creadas
    if (statTotalActivities) {
      statTotalActivities.innerText = activities.length;
    }

    // Cardio Acumulado
    if (statCardioKm) {
      const allSessions = StorageManager.getSessions();
      let totalKm = 0;
      allSessions.forEach(s => {
        if (s.metrics && Array.isArray(s.metrics)) {
          s.metrics.forEach(m => {
            if (m.distance_km) totalKm += parseFloat(m.distance_km) || 0;
          });
        }
      });
      statCardioKm.innerText = `${totalKm.toFixed(1)} km`;
    }
  },

  // RENDER ACTIVIDAD RECIENTE CREATIVA & DINÁMICA
  renderRecentActivityTimeline() {
    const defaultIconHtml = `<img src="assets/logo-perci-grafico.svg" alt="Percí" style="width:20px; height:20px; vertical-align:middle;" />`;
    const container = document.getElementById('todayActivityList');
    if (!container) return;

    const allSessions = StorageManager.getSessions().sort((a, b) => new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00')));
    const activities = StorageManager.getActivities();

    if (allSessions.length === 0) {
      container.innerHTML = `<p class="view-subtitle" style="padding: 12px 0;">Aún no hay actividad reciente registrada.</p>`;
      return;
    }

    container.innerHTML = allSessions.slice(0, 5).map(sess => {
      const act = activities.find(a => a.id === sess.activity_id) || { name: 'Actividad', icon: '⚡', color: '#00f2fe' };
      
      // Armar Badges Visuales de Logro
      let badgesHtml = '';
      if (sess.metrics && Array.isArray(sess.metrics)) {
        sess.metrics.forEach(m => {
          if (m.weight && m.weight > 0) badgesHtml += `<span class="badge-tag" style="background: rgba(0, 242, 254, 0.15); color: var(--accent-cyan); margin-right:4px;">🏋️ ${m.weight} kg</span>`;
          if (m.distance_km && m.distance_km > 0) badgesHtml += `<span class="badge-tag" style="background: rgba(0, 230, 118, 0.15); color: var(--accent-green); margin-right:4px;">🏃‍♂️ ${m.distance_km} km</span>`;
          if (m.duration && m.duration > 0) badgesHtml += `<span class="badge-tag" style="background: rgba(124, 77, 255, 0.15); color: var(--accent-purple); margin-right:4px;">⏱️ ${m.duration} min</span>`;
        });
      }

      const energyIcons = ['⚡', '⚡⚡', '⚡⚡⚡', '⚡⚡⚡⚡', '⚡⚡⚡⚡⚡'];
      const energyTag = sess.energy ? `<span style="font-size:0.75rem; color:var(--accent-amber);">${energyIcons[sess.energy - 1] || '⚡'}</span>` : '';

      return `
        <div class="card" style="padding: 12px; margin-bottom: 8px; border-left: 3px solid ${act.color || 'var(--accent-cyan)'};">
          <div class="flex-between">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.2rem;">${act.icon}</span>
              <div>
                <strong style="font-size: 0.92rem;">${this.escapeHtml(act.name)}</strong>
                <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">${sess.date} • ${sess.time || '12:00'}</span>
              </div>
            </div>
            ${energyTag}
          </div>
          ${badgesHtml ? `<div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px;">${badgesHtml}</div>` : ''}
          ${sess.notes ? `<p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 6px; font-style: italic;">"${this.escapeHtml(sess.notes)}"</p>` : ''}
        </div>
      `;
    }).join('');
  },

  handleHomeActionClick(activityId) {
    if (window.ActivitiesModule) {
      window.ActivitiesModule.startSessionForActivity(activityId);
    }
  },

  // MODAL BACKDROP & CLOSE BUTTONS
  bindModalsClose() {
    // Solo cerrar si toca el botón con data-close-modal
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-backdrop');
        if (modal) modal.classList.remove('active');
      });
    });


    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.remove('active');
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-backdrop.active');
        if (activeModal) activeModal.classList.remove('active');
      }
    });
  },

  // TOAST NOTIFICATIONS
  showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    let icon = '✨';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '⚠️';
    else if (type === 'info') icon = 'ℹ️';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // SETTINGS & BACKUP EVENTS
  bindSettingsEvents() {
    const btnExport = document.getElementById('btnExportData');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const json = StorageManager.exportBackupJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `perci_v2_respaldo_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('📥 Respaldo de Percí exportado', 'success');
      });
    }

    const importInput = document.getElementById('importFileInput');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const success = StorageManager.importBackupJSON(event.target.result);
          if (success) {
            this.showToast('🚀 Respaldo importado con éxito', 'success');
            this.refreshAllViews();
          } else {
            this.showToast('Error al importar respaldo JSON', 'error');
          }
        };
        reader.readAsText(file);
      });
    }

    const btnClear = document.getElementById('btnClearData');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (confirm('⚠️ ¿Borrar TODOS los datos de Percí?')) {
          StorageManager.clearAllData();
          this.showToast('Todos los datos han sido borrados', 'info');
          this.refreshAllViews();
        }
      });
    }
  },

  refreshAllViews() {
    this.renderHomeTodayActions();
    if (window.ActivitiesModule) window.ActivitiesModule.renderActivitiesList();
    if (window.CalendarModule) {
      if (typeof window.CalendarModule.init === 'function') window.CalendarModule.init();
      if (typeof window.CalendarModule.renderCalendar === 'function') window.CalendarModule.renderCalendar();
      if (typeof window.CalendarModule.renderTimeline === 'function') window.CalendarModule.renderTimeline();
    }
    if (window.AnalyticsModule) window.AnalyticsModule.refreshAnalytics();
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});