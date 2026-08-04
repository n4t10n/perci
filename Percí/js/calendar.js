/**
 * Percí v2 - Calendar Module (Interactive Accordion, Session Editor & Deletion)
 */

window.CalendarModule = {
  currentDate: new Date(),

  init() {
    this.bindEvents();
    this.renderCalendar();
    this.renderTimeline();
  },

  bindEvents() {
    const prevBtn = document.getElementById('calPrevMonth');
    const nextBtn = document.getElementById('calNextMonth');

    if (prevBtn) {
      prevBtn.onclick = (e) => {
        e.preventDefault();
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.renderCalendar();
      };
    }

    if (nextBtn) {
      nextBtn.onclick = (e) => {
        e.preventDefault();
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.renderCalendar();
      };
    }
  },

  renderCalendar() {
    const grid = document.getElementById('calendarDaysGrid');
    const monthTitle = document.getElementById('calMonthYearTitle');
    if (!grid || !monthTitle) return;

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    monthTitle.innerText = `${monthNames[month]} ${year}`;
    grid.innerHTML = '';

    const sessions = StorageManager.getSessions();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = StorageManager.getTodayDateString();

    // Celdas vacías previas
    for (let i = 0; i < firstDayIndex; i++) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'cal-day empty';
      grid.appendChild(emptyDiv);
    }

    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayDiv = document.createElement('div');
      dayDiv.className = 'cal-day';

      if (dayStr === todayStr) {
        dayDiv.classList.add('today');
      }

      const daySessions = sessions.filter(s => (s.date || '').startsWith(dayStr));
      let dotsHtml = '';

      if (daySessions.length > 0) {
        dotsHtml = '<div class="cal-day-badges"><span class="badge-dot"></span></div>';
      }

      dayDiv.innerHTML = `<span>${day}</span>${dotsHtml}`;
      dayDiv.addEventListener('click', () => {
        document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
        dayDiv.classList.add('selected');
        this.renderTimeline(dayStr);
      });

      grid.appendChild(dayDiv);
    }
  },

  // RENDER TIMELINE CON EDITAR, DESPLEGAR Y BORRAR
  renderTimeline(selectedDateStr = null) {
    const timelineList = document.getElementById('calendarTimelineList');
    const timelineTitle = document.getElementById('calendarTimelineTitle');
    if (!timelineList) return;

    const dateStr = selectedDateStr || StorageManager.getTodayDateString();

    if (timelineTitle) {
      timelineTitle.innerText = `Sesiones (${dateStr})`;
    }

    const sessions = StorageManager.getSessions();
    const activities = StorageManager.getActivities();
    const daySessions = sessions.filter(s => (s.date || '').startsWith(dateStr));

    if (daySessions.length === 0) {
      timelineList.innerHTML = `<p class="view-subtitle" style="padding: 12px 0;">No hay sesiones registradas en esta fecha.</p>`;
      return;
    }

    timelineList.innerHTML = daySessions.map((sess, idx) => {
      const act = activities.find(a => a.id === sess.activity_id) || { name: 'Actividad', icon: '⚡' };
      const detailsId = `sess_details_${idx}`;
      const defaultGraphIcon = `<img src="assets/logo-perci-grafico.svg" style="width:18px; height:18px; vertical-align:middle; margin-right:4px;" />`;
      const actIcon = act.icon ? act.icon : defaultGraphIcon;
      // Armar lista de métricas/ejercicios para el desplegable
      let metricsHtml = '';
      if (sess.metrics && Array.isArray(sess.metrics) && sess.metrics.length > 0) {
        metricsHtml = sess.metrics.map(m => {
          if (m.exercise_name) {
            let info = [];
            if (m.sets) info.push(`${m.sets} series`);
            if (m.reps) info.push(`${m.reps} reps`);
            if (m.weight) info.push(`${m.weight} kg`);
            if (m.duration) info.push(`${m.duration} min`);
            if (m.distance_km) info.push(`${m.distance_km} km`);
            return `<li style="font-size:0.78rem; color:var(--text-muted); margin-left:14px;"><strong>${App.escapeHtml(m.exercise_name)}</strong>: ${info.join(' • ')}</li>`;
          }
          return '';
        }).join('');
      }

      return `
        <div class="timeline-item" style="flex-direction: column; align-items: stretch; gap: 6px;">
          <div class="flex-between">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="timeline-time">${sess.time || '12:00'}</span>
              <h4 style="margin: 0; font-size: 0.95rem;">${act.icon} ${App.escapeHtml(act.name)}</h4>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <button class="btn btn-xs btn-outline" title="Editar" onclick="CalendarModule.editSession('${sess.id}')">✏️ Editar</button>
              ${metricsHtml ? `<button class="btn btn-xs btn-outline" onclick="CalendarModule.toggleDetails('${detailsId}')">▼ Detalle</button>` : ''}
              <button class="btn btn-xs btn-danger-outline" title="Borrar Sesión" onclick="CalendarModule.deleteSession('${sess.id}', '${dateStr}')">🗑️</button>
            </div>
          </div>

          <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">${App.escapeHtml(sess.notes || 'Sin notas adicionadas.')}</p>

          ${metricsHtml ? `
            <div id="${detailsId}" style="display: none; margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--card-border);">
              <ul style="margin: 0;">${metricsHtml}</ul>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  },

  // ACCORDION TOGGLE
  toggleDetails(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = (el.style.display === 'none' || !el.style.display) ? 'block' : 'none';
  },

  // EDITAR SESIÓN DE REGISTRO
  editSession(sessionId) {
    const sessions = StorageManager.getSessions();
    const sess = sessions.find(s => s.id === sessionId);
    if (!sess) return;

    if (window.ActivitiesModule) {
      ActivitiesModule.startSessionForActivity(sess.activity_id);

      setTimeout(() => {
        const editIdEl = document.getElementById('editingSessionId');
        const dateEl = document.getElementById('sessionDate');
        const timeEl = document.getElementById('sessionTime');
        const notesEl = document.getElementById('sessionNotes');
        const energyEl = document.getElementById('sessionEnergy');
        const titleEl = document.getElementById('sessionLoggerTitle');

        if (editIdEl) editIdEl.value = sess.id;
        if (dateEl) dateEl.value = sess.date;
        if (timeEl) timeEl.value = sess.time || '12:00';
        if (notesEl) notesEl.value = sess.notes || '';
        if (energyEl && sess.energy) energyEl.value = sess.energy;
        if (titleEl) titleEl.innerText = `✏️ Editar Sesión (${sess.date})`;
      }, 50);
    }
  },

  // BORRAR SESIÓN REGISTRADA EN EL CALENDARIO
  deleteSession(sessionId, dateStr) {
    if (confirm('¿Seguro que querés borrar este registro de sesión del historial?')) {
      StorageManager.deleteSession(sessionId);
      
      // Refrescar calendario y línea de tiempo
      this.renderCalendar();
      this.renderTimeline(dateStr);

      if (window.App) {
        App.refreshAllViews();
        App.showToast('Sesión eliminada correctamente', 'info');
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.CalendarModule) {
    window.CalendarModule.init();
  }
});