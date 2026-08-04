/**
 * Percí v2 - Analytics Module (Clean UI, Contextual Titles & Scroll Padding)
 */

window.AnalyticsModule = {
  init() {
    this.populateActivitySelect();
    this.renderAll();
  },

  renderAll() {
    const sessions = this.getFilteredSessions();
    this.updateTitlesAndHeader();
    this.renderKPIs(sessions);
    this.renderGoalsProgress(); // <--- Nueva función invocada aquí
    this.renderWeightChart(sessions);
    this.renderTimeChart(sessions);
  },

  // RENDERIZAR PROGRESO DE OBJETIVOS SEMANALES
  renderGoalsProgress() {
    const container = document.getElementById('analyticsGoalsContainer');
    const summaryBadge = document.getElementById('analyticsGoalsSummaryBadge');
    if (!container) return;

    const activities = StorageManager.getActivities();

    if (activities.length === 0) {
      container.innerHTML = `<p class="view-subtitle">No tenés actividades creadas aún.</p>`;
      if (summaryBadge) summaryBadge.innerText = '0/0 metas';
      return;
    }

    // Calcular inicio y fin de la semana actual (de Lunes a Domingo)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 es Domingo
    const distanceToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const allSessions = StorageManager.getSessions();
    
    // Sesiones realizadas desde el lunes de esta semana
    const thisWeekSessions = allSessions.filter(s => {
      const sessDate = new Date(s.date + 'T00:00:00');
      return sessDate >= monday;
    });

    let totalGoalsMet = 0;

    container.innerHTML = activities.map(act => {
      const target = parseInt(act.weekly_target || act.weeklyTarget || 3, 10);
      
      // Contar cuantas sesiones se hicieron para esta actividad en esta semana
      const doneCount = thisWeekSessions.filter(s => s.activity_id === act.id).length;
      
      const pct = Math.min(Math.round((doneCount / target) * 100), 100);
      const isCompleted = doneCount >= target;

      if (isCompleted) totalGoalsMet++;

      const remaining = target - doneCount;
      let statusText = '';
      if (remaining > 0) {
        statusText = `Faltan ${remaining} sesió${remaining > 1 ? 'nes' : 'n'}`;
      } else {
        statusText = '🎉 ¡Meta cumplida!';
      }

      const barColor = isCompleted ? 'var(--accent-green)' : (act.color || 'var(--accent-cyan)');

      return `
        <div class="goal-progress-item">
          <div class="goal-progress-header">
            <span class="goal-progress-title">
              <span>${act.icon || '🎯'}</span>
              <span>${App.escapeHtml(act.name)}</span>
            </span>
            <span class="goal-progress-count" style="color: ${isCompleted ? 'var(--accent-green)' : 'var(--text-muted)'};">
              ${doneCount} / ${target} sem (${statusText})
            </span>
          </div>
          <div class="goal-progress-track">
            <div class="goal-progress-bar" style="width: ${pct}%; background: ${barColor};"></div>
          </div>
        </div>
      `;
    }).join('');

    if (summaryBadge) {
      summaryBadge.innerText = `${totalGoalsMet}/${activities.length} metas cumplidas`;
    }
  },

  populateActivitySelect() {
    const actSelect = document.getElementById('analyticsFilterActivity');
    if (!actSelect) return;

    const activities = StorageManager.getActivities();
    actSelect.innerHTML = `
      <option value="all" selected>Todas las Actividades</option>
      ${activities.map(a => `<option value="${a.id}">${a.icon || ''} ${App.escapeHtml(a.name)}</option>`).join('')}
    `;

    this.onActivityFilterChange();
  },

  onActivityFilterChange() {
    const actId = document.getElementById('analyticsFilterActivity')?.value;
    const exSelect = document.getElementById('analyticsFilterExercise');
    if (!exSelect) return;

    if (!actId || actId === 'all') {
      exSelect.innerHTML = `<option value="all">Todas las Secciones / Ejercicios</option>`;
      this.renderAll();
      return;
    }

    const plans = StorageManager.getPlansByActivity(actId);
    const options = ['<option value="all">Todas las Secciones / Ejercicios</option>'];

    plans.forEach(p => {
      (p.items || []).forEach(item => {
        const itemName = (typeof item === 'object') ? item.name : item;
        const isSection = (typeof item === 'object' && item.type === 'section');
        if (isSection) {
          options.push(`<option value="sec_${App.escapeHtml(itemName)}">📁 Sección: ${App.escapeHtml(itemName)}</option>`);
        } else {
          options.push(`<option value="ex_${App.escapeHtml(itemName)}">📌 ${App.escapeHtml(itemName)}</option>`);
        }
      });
    });

    exSelect.innerHTML = options.join('');
    this.renderAll();
  },

  renderAll() {
    const sessions = this.getFilteredSessions();
    this.updateTitlesAndHeader();
    this.renderKPIs(sessions);
    this.renderWeightChart(sessions);
    this.renderTimeChart(sessions);
  },

  // ADAPTAR TÍTULOS E ICONOS SEGÚN ACTIVIDAD
  updateTitlesAndHeader() {
    const actId = document.getElementById('analyticsFilterActivity')?.value;
    const titleEl = document.getElementById('analyticsChartTitle');
    const subEl = document.getElementById('analyticsChartSub');

    if (!titleEl || !subEl) return;

    if (actId && actId !== 'all') {
      const activities = StorageManager.getActivities();
      const act = activities.find(a => a.id === actId);

      if (act && act.category !== 'Ejercicio') {
        titleEl.innerText = `${act.icon || '📚'} Registro de Avance (${act.category})`;
        subEl.innerText = 'Tiempo invertido y módulos completados por sesión';
        return;
      }
    }

    titleEl.innerText = '🏋️ Cargas y Repeticiones Registradas';
    subEl.innerText = 'Desglose de peso máximo y volumen de reps por ejercicio';
  },

  getFilteredSessions() {
    let sessions = StorageManager.getSessions();
    const range = document.getElementById('analyticsFilterRange')?.value || 'all';
    const actId = document.getElementById('analyticsFilterActivity')?.value || 'all';
    const exFilter = document.getElementById('analyticsFilterExercise')?.value || 'all';

    const now = new Date();

    // 1. Filtro por Rango Temporal
    if (range === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      sessions = sessions.filter(s => new Date(s.date) >= oneWeekAgo);
    } else if (range === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(now.getDate() - 30);
      sessions = sessions.filter(s => new Date(s.date) >= oneMonthAgo);
    }

    // 2. Filtro por Actividad
    if (actId !== 'all') {
      sessions = sessions.filter(s => s.activity_id === actId);
    }

    // 3. Filtro Inteligente por Sección o Ejercicio
    if (exFilter !== 'all') {
      const isSectionFilter = exFilter.startsWith('sec_');
      const cleanTarget = exFilter.replace(/^(sec_|ex_)/, '').trim().toLowerCase();

      if (isSectionFilter) {
        // Obtener ejercicios pertenecientes a la sección desde los planes
        const plans = actId !== 'all' ? StorageManager.getPlansByActivity(actId) : StorageManager.getPlans();
        const sectionExercises = new Set();

        plans.forEach(plan => {
          let inTargetSection = false;
          (plan.items || []).forEach(item => {
            const name = (typeof item === 'object') ? item.name : item;
            const isSection = (typeof item === 'object' && item.type === 'section');

            if (isSection) {
              inTargetSection = name.trim().toLowerCase().includes(cleanTarget);
            } else if (inTargetSection) {
              sectionExercises.add(name.trim().toLowerCase());
            }
          });
        });

        // Filtrar sesiones que contengan al menos un ejercicio de esa sección
        sessions = sessions.filter(s => {
          if (!s.metrics || !Array.isArray(s.metrics)) return false;
          return s.metrics.some(m => m.exercise_name && sectionExercises.has(m.exercise_name.trim().toLowerCase()));
        });
      } else {
        // Filtrar por ejercicio específico
        sessions = sessions.filter(s => {
          if (!s.metrics || !Array.isArray(s.metrics)) return false;
          return s.metrics.some(m => m.exercise_name && m.exercise_name.trim().toLowerCase().includes(cleanTarget));
        });
      }
    }

    return sessions;
  },

  renderKPIs(sessions) {
    const kpiSessions = document.getElementById('analyticsTotalSessions');
    const kpiTime = document.getElementById('analyticsTotalTime');

    if (kpiSessions) kpiSessions.innerText = sessions.length;

    let totalMinutes = 0;
    let totalKm = 0;

    sessions.forEach(s => {
      if (s.metrics && Array.isArray(s.metrics)) {
        s.metrics.forEach(m => {
          if (m.duration) totalMinutes += parseFloat(m.duration) || 0;
          if (m.distance_km) totalKm += parseFloat(m.distance_km) || 0;
        });
      }
    });

    if (kpiTime) {
      if (totalKm > 0) kpiTime.innerText = `${totalKm.toFixed(1)} km`;
      else if (totalMinutes > 0) kpiTime.innerText = `${totalMinutes}m`;
      else kpiTime.innerText = `${sessions.length * 30}m`;
    }
  },

  renderWeightChart(sessions) {
    const container = document.getElementById('analyticsWeightChart');
    if (!container) return;

    const logs = [];
    sessions.forEach(s => {
      if (s.metrics) {
        s.metrics.forEach(m => {
          if (m.exercise_name) {
            logs.push({
              date: s.date,
              name: m.exercise_name,
              weight: m.weight || 0,
              reps: m.reps || '',
              sets: m.sets || 0,
              km: m.distance_km || 0,
              duration: m.duration || 0
            });
          }
        });
      }
    });

    if (logs.length === 0) {
      container.innerHTML = `<p class="view-subtitle" style="padding: 12px 0;">No hay registros en este filtro.</p>`;
      return;
    }

    container.innerHTML = logs.slice(-6).map(log => {
      let metricBadge = '';
      if (log.weight > 0) metricBadge += `<span class="reps-stat-badge">🏋️ ${log.weight} kg</span> `;
      if (log.reps) metricBadge += `<span class="reps-stat-badge">🔁 ${log.sets ? log.sets + 'x' : ''}${log.reps}</span> `;
      if (log.km > 0) metricBadge += `<span class="reps-stat-badge">🏃‍♂️ ${log.km} km</span> `;
      if (log.duration > 0) metricBadge += `<span class="reps-stat-badge">⏱️ ${log.duration} min</span>`;

      return `
        <div class="weight-point-row">
          <div>
            <strong style="color:var(--text-main); font-size:0.85rem;">${App.escapeHtml(log.name)}</strong>
            <span style="color:var(--text-muted); font-size:0.72rem; display:block;">${log.date}</span>
          </div>
          <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end;">
            ${metricBadge || '<span style="font-size:0.75rem; color:var(--text-muted);">Realizado</span>'}
          </div>
        </div>
      `;
    }).join('');
  },

  renderTimeChart(sessions) {
    const container = document.getElementById('analyticsTimeChart');
    if (!container) return;

    const activities = StorageManager.getActivities();
    const actMap = {};

    activities.forEach(a => actMap[a.id] = { name: a.name, count: 0 });

    sessions.forEach(s => {
      if (actMap[s.activity_id]) {
        actMap[s.activity_id].count++;
      }
    });

    const maxCount = Math.max(...Object.values(actMap).map(a => a.count), 1);

    container.innerHTML = Object.values(actMap).map(act => {
      const pct = act.count > 0 ? Math.round((act.count / maxCount) * 100) : 0;
      return `
        <div class="analytics-bar-row" style="margin-bottom: 10px;">
          <span class="analytics-bar-label">${App.escapeHtml(act.name)}</span>
          <div class="analytics-bar-track">
            <div class="analytics-bar-fill" style="width: ${pct}%;"></div>
          </div>
          <span class="analytics-bar-val">${act.count} ses.</span>
        </div>
      `;
    }).join('');
  },

  generateAIConclusion() {
    const reportCard = document.getElementById('analyticsReportCard');
    const reportText = document.getElementById('analyticsReportText');
    if (!reportCard || !reportText) return;

    const range = document.getElementById('analyticsFilterRange')?.value || 'week';
    const sessions = this.getFilteredSessions();
    const count = sessions.length;

    let conclusion = '';

    if (count === 0) {
      conclusion = `⚠️ **Sin Actividad Registrada**\nNo se registran datos en el filtro actual (${range === 'week' ? 'esta semana' : 'este período'}). Tip: Selecciona "Todo el Historial" o registra una sesión activa.`;
    } else if (count >= 4) {
      conclusion = `🚀 **Excelente Rendimiento y Frecuencia**\nRegistraste **${count} sesiones** en este período. Mantienes una progresión constante. Tu adherencia al plan es alta. ¡Sigue así!`;
    } else if (count >= 2) {
      conclusion = `📈 **Avance Consistente**\nCompletaste **${count} sesiones**. Tu volumen general se mantiene estable. Procura agendar 1 sesión adicional para maximizar tus resultados.`;
    } else {
      conclusion = `💡 **Frecuencia Baja**\nRegistraste **${count} sesión** en este filtro. Procura no espaciar más de 3 días entre sesiones para no perder ritmo.`;
    }

    reportText.innerText = conclusion;
    reportCard.style.display = 'block';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.AnalyticsModule) {
    window.AnalyticsModule.init();
  }
});