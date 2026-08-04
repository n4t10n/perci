/**
 * Module B: Self-Study Projects & Fast Logging Logic
 */

const StudyModule = {
  init() {
    this.bindEvents();
    this.renderStudyProjects();
    this.renderStudyLogs();
  },

  bindEvents() {
    // New Study Project button
    const btnNewProj = document.getElementById('btnNewStudyProject');
    if (btnNewProj) {
      btnNewProj.addEventListener('click', () => this.openStudyProjectModal());
    }

    // Study Project Form Submit
    const studyProjectForm = document.getElementById('studyProjectForm');
    if (studyProjectForm) {
      studyProjectForm.addEventListener('submit', (e) => this.handleStudyProjectSubmit(e));
    }

    // Study Log Form Submit
    const studyLogForm = document.getElementById('studyLogForm');
    if (studyLogForm) {
      studyLogForm.addEventListener('submit', (e) => this.handleStudyLogSubmit(e));
    }
  },

  renderStudyProjects() {
    const container = document.getElementById('studyProjectsList');
    if (!container) return;

    const projects = StorageManager.getStudyProjects();
    if (projects.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📚</span>
          <p>No tienes proyectos de estudio configurados aún.</p>
          <button class="btn btn-secondary btn-sm" style="margin-top: 10px;" onclick="StudyModule.openStudyProjectModal()">+ Crear mi primer proyecto de estudio</button>
        </div>
      `;
      return;
    }

    const logs = StorageManager.getStudyLogs();

    container.innerHTML = projects.map(proj => {
      // Calculate total stats for this project
      const projLogs = logs.filter(l => l.projectId === proj.id);
      const totalMinutes = projLogs.reduce((acc, l) => acc + (parseInt(l.minutes) || 0), 0);
      const totalUnits = projLogs.reduce((acc, l) => acc + (parseInt(l.units) || 0), 0);
      const hoursStr = (totalMinutes / 60).toFixed(1);

      return `
        <div class="project-card" style="border-left: 4px solid ${proj.color || 'var(--accent-study)'};">
          <div class="card-title-row">
            <h4>${this.escapeHtml(proj.title)}</h4>
            <span class="badge-tag tag-study">${this.escapeHtml(proj.unitLabel || 'Ítems')}</span>
          </div>
          <div class="routine-exercise-preview">
            ⏱️ Tiempo acumulado: <strong>${hoursStr} hrs</strong> (${totalMinutes} min)<br>
            📊 Total acumulado: <strong>${totalUnits} ${this.escapeHtml(proj.unitLabel || 'unidades')}</strong>
          </div>
          <div class="card-actions-row">
            <button class="btn btn-secondary btn-sm btn-full" onclick="StudyModule.openStudyLogModal('${proj.id}')">
              + Registrar Avance
            </button>
            <button class="btn btn-outline btn-xs" onclick="StudyModule.openStudyProjectModal('${proj.id}')" title="Editar">
              ✏️
            </button>
            <button class="btn btn-danger-outline btn-xs" onclick="StudyModule.deleteStudyProject('${proj.id}')" title="Eliminar">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  openStudyProjectModal(projectId = null) {
    const modal = document.getElementById('modalStudyProjectForm');
    const form = document.getElementById('studyProjectForm');

    form.reset();

    if (projectId) {
      const proj = StorageManager.getStudyProjectById(projectId);
      if (proj) {
        document.getElementById('studyProjectId').value = proj.id;
        document.getElementById('studyTitle').value = proj.title;
        document.getElementById('studyUnitLabel').value = proj.unitLabel;
        document.getElementById('studyColor').value = proj.color || '#00e676';
      }
    } else {
      document.getElementById('studyProjectId').value = '';
    }

    modal.classList.add('active');
  },

  handleStudyProjectSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('studyProjectId').value;
    const title = document.getElementById('studyTitle').value.trim();
    const unitLabel = document.getElementById('studyUnitLabel').value.trim();
    const color = document.getElementById('studyColor').value;

    const proj = StorageManager.saveStudyProject({ id: id || null, title, unitLabel, color });
    document.getElementById('modalStudyProjectForm').classList.remove('active');
    this.renderStudyProjects();
    if (window.App) {
      window.App.refreshAllViews();
      if (window.App.showToast) {
        window.App.showToast(`📚 Proyecto "${proj.title}" guardado con éxito`, 'success');
      }
    }
  },

  deleteStudyProject(id) {
    if (confirm('¿Eliminar este proyecto de estudio y sus datos?')) {
      StorageManager.deleteStudyProject(id);
      this.renderStudyProjects();
      if (window.App) {
        window.App.refreshAllViews();
        if (window.App.showToast) window.App.showToast('Proyecto eliminado', 'info');
      }
    }
  },

  // FAST STUDY ADVANCE LOGGING
  openStudyLogModal(projectId = null) {
    const projects = StorageManager.getStudyProjects();
    if (projects.length === 0) {
      if (window.App && window.App.showToast) {
        window.App.showToast('Crea un proyecto de estudio antes de registrar un avance.', 'info');
      } else {
        alert('Por favor crea un proyecto de estudio antes de registrar un avance.');
      }
      this.openStudyProjectModal();
      return;
    }

    const modal = document.getElementById('modalStudyLog');
    document.getElementById('studyLogDate').value = StorageManager.getTodayDateString();
    document.getElementById('studyLogMinutes').value = '';
    document.getElementById('studyLogUnits').value = '';
    document.getElementById('studyLogNotes').value = '';

    const targetProj = projectId ? StorageManager.getStudyProjectById(projectId) : projects[0];
    document.getElementById('studyLogProjectId').value = targetProj.id;
    document.getElementById('studyLogProjectName').innerText = targetProj.title;
    document.getElementById('studyLogUnitsLabel').innerText = `${targetProj.unitLabel || 'Ítems'} estudiados`;

    modal.classList.add('active');
  },

  handleStudyLogSubmit(e) {
    e.preventDefault();
    const projectId = document.getElementById('studyLogProjectId').value;
    const project = StorageManager.getStudyProjectById(projectId);
    const date = document.getElementById('studyLogDate').value;
    const minutes = parseInt(document.getElementById('studyLogMinutes').value) || 0;
    const units = parseInt(document.getElementById('studyLogUnits').value) || 0;
    const notes = document.getElementById('studyLogNotes').value.trim();

    StorageManager.saveStudyLog({
      projectId,
      projectTitle: project ? project.title : 'Estudio',
      unitLabel: project ? project.unitLabel : 'unidades',
      date,
      minutes,
      units,
      notes
    });

    document.getElementById('modalStudyLog').classList.remove('active');
    this.renderStudyProjects();
    this.renderStudyLogs();
    if (window.App) {
      window.App.refreshAllViews();
      if (window.App.showToast) {
        window.App.showToast('🎉 ¡Avance de estudio registrado con éxito!', 'success');
      }
    }
  },

  renderStudyLogs() {
    const container = document.getElementById('studyLogsList');
    if (!container) return;

    const logs = StorageManager.getStudyLogs().sort((a, b) => new Date(b.date) - new Date(a.date));
    if (logs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Aún no has registrado ninguna sesión de estudio.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = logs.map(log => `
      <div class="activity-item type-study">
        <div class="activity-info">
          <h4>${this.escapeHtml(log.projectTitle)}</h4>
          <p>⏱️ ${log.minutes} min ${log.units > 0 ? `| 📖 ${log.units} ${this.escapeHtml(log.unitLabel || 'unidades')}` : ''}</p>
          ${log.notes ? `<p style="font-style: italic; opacity: 0.8;">"${this.escapeHtml(log.notes)}"</p>` : ''}
        </div>
        <div class="flex-end" style="gap: 8px;">
          <span class="activity-time">${log.date}</span>
          <button class="btn btn-danger-outline btn-xs" onclick="StudyModule.deleteStudyLog('${log.id}')">&times;</button>
        </div>
      </div>
    `).join('');
  },

  deleteStudyLog(id) {
    if (confirm('¿Eliminar esta sesión de estudio?')) {
      StorageManager.deleteStudyLog(id);
      this.renderStudyLogs();
      if (window.App) window.App.refreshAllViews();
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
};
