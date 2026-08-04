/**
 * Module A: Exercise & Training Logic (Routine Creator, Text Import Parser & Smart Auto-Fill Session Logger)
 */

const ExerciseModule = {
  parsedImportedRoutine: null,

  sampleReferenceText: `New Rutina
─── ⋆⋅☆⋅⋆ ───
🏋️1. FUERZA
⏱️ 20 Min | 🏡 En Casa
─── ⋆⋅☆⋅⋆ ───
• Flexiones: 3 series x 8-12 reps
• Sentadillas: 3 series x 12-15 reps
• Dominadas: 3 series x al fallo técnico
• Plancha abdominal: 3 series x 30-45 seg
─── ⋆⋅☆⋅⋆ ───
🏃♂️ 2. RESISTENCIA / CARDIO 🏃♂️
⏱️ 20 - 30 Minutos (2-3x por semana)
─── ⋆⋅☆⋅⋆ ───
• Salir a correr a ritmo constante o trote suave + caminata de recuperación.
─── ⋆⋅☆⋅⋆ ───
🧘♀️ 3. FLEXIBILIDAD Y RECUPERACIÓN 🧘♂️
⏱️ 10 - 12 Minutos | 🏡 En Casa
🔗 https://www.tiktok.com/@nachogst/video/7663215392084495618?is_from_webapp=1&sender_device=pc
📌 REGLAS DE ORO:
• 🚫 No dolor (solo molestia suave)
• 🌬️ Respira profundo (exhala para aflojar)
• 🔁 3 a 5 veces por semana
────────────────────────────
1️⃣ ESTIRAMIENTO DE ADUCTORES 🦵
Movilidad de ingle y aductores
• Ponte de rodillas y estira una pierna hacia el lado en línea recta.
• Apoya los antebrazos en paralelo debajo del pecho.
• Mantén la espalda recta y lleva la cadera hacia atrás y adelante.
⏱️ 12 a 15 repeticiones por pierna
2️⃣ BISAGRA DE CADERA ABIERTA 🦴
Desbloqueo de cadera y movilidad
• Da un salto abriendo piernas al doble del ancho de cadera.
• Apoya manos sobre las rodillas flexionadas.
• Sacando glúteos hacia afuera, baja el torso hasta quedar paralelo al suelo y sube.
⏱️ 10 a 12 repeticiones
3️⃣ PÉNDULO DE ISQUIOTIBIALES ⏳
Elasticidad posterior de piernas
• Piernas separadas un poco más del ancho de cadera.
• Cruza los brazos al pecho y flexiona la cadera dejando caer el torso.
• Balancea el torso de lado a lado como un péndulo con el cuerpo relajado.
⏱️ 18 a 20 repeticiones totales
─── ⋆⋅☆⋅⋆ ───
─── ⋆⋅☆⋅⋆ ───`,

  init() {
    this.bindEvents();
    this.renderRoutines();
    this.renderWorkoutLogs();
  },

  bindEvents() {
    // New Routine Modal button
    const btnNewRoutine = document.getElementById('btnNewRoutine');
    if (btnNewRoutine) {
      btnNewRoutine.addEventListener('click', () => this.openRoutineModal());
    }

    // Import Text Routine Modal button
    const btnImport = document.getElementById('btnImportRoutineText');
    if (btnImport) {
      btnImport.addEventListener('click', () => this.openImportModal());
    }

    // Add exercise row inside routine creator
    const btnAddEx = document.getElementById('btnAddExerciseToRoutine');
    if (btnAddEx) {
      btnAddEx.addEventListener('click', () => this.addExerciseRowToModal());
    }

    // Routine Form Submit
    const routineForm = document.getElementById('routineForm');
    if (routineForm) {
      routineForm.addEventListener('submit', (e) => this.handleRoutineSubmit(e));
    }

    // Workout Session Form Submit
    const workoutSessionForm = document.getElementById('workoutSessionForm');
    if (workoutSessionForm) {
      workoutSessionForm.addEventListener('submit', (e) => this.handleWorkoutSessionSubmit(e));
    }
  },

  renderRoutines() {
    const container = document.getElementById('routinesList');
    if (!container) return;

    const routines = StorageManager.getRoutines();
    if (routines.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🏋️‍♂️</span>
          <p>No tienes rutinas creadas aún.</p>
          <div class="flex-end" style="gap: 8px; margin-top: 12px; justify-content: center;">
            <button class="btn btn-outline btn-sm" onclick="ExerciseModule.openImportModal(true)">📋 Importar de Bloc de Notas</button>
            <button class="btn btn-primary btn-sm" onclick="ExerciseModule.openRoutineModal()">+ Crear Rutina Manual</button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = routines.map(rt => `
      <div class="routine-card">
        <div class="card-title-row">
          <h4>${this.escapeHtml(rt.name)}</h4>
          <span class="badge-tag">${rt.category || 'Entrenamiento'}</span>
        </div>
        
        <div class="routine-summary-bar flex-between" style="font-size: 0.8rem; color: var(--text-muted); margin: 6px 0;">
          <span>💪 ${rt.exercises.length} ejercicios incluidos</span>
          <button type="button" class="btn btn-xs btn-outline" onclick="ExerciseModule.toggleRoutineDetail('${rt.id}')" id="btnToggleRt_${rt.id}" style="padding: 2px 8px; font-size: 0.72rem;">
            ▼ Ver detalle
          </button>
        </div>

        <div class="routine-exercise-preview collapsible-detail" id="rtDetail_${rt.id}" style="display: none; padding-top: 6px; border-top: 1px dashed var(--card-border);">
          ${rt.exercises.map(e => `
            <div style="margin-bottom: 4px;">
              • <strong>${this.escapeHtml(e.name)}</strong> <span class="badge-tag" style="padding: 1px 6px; font-size: 0.65rem;">${this.formatMetricType(e.type)}</span>
              ${e.target ? `<span style="opacity:0.85; font-size:0.78rem;"> - ${this.escapeHtml(e.target)}</span>` : ''}
              ${e.url ? `<a href="${this.escapeHtml(e.url)}" target="_blank" rel="noopener" class="btn btn-xs btn-outline" style="padding: 1px 6px; font-size: 0.7rem; text-decoration: none; margin-left: 4px;">🔗 Link</a>` : ''}
            </div>
          `).join('')}
        </div>

        <div class="card-actions-row" style="margin-top: 8px;">
          <button class="btn btn-primary btn-sm btn-full" onclick="ExerciseModule.startWorkoutSession('${rt.id}')">
            ▶ Iniciar Entrenamiento
          </button>
          <button class="btn btn-outline btn-xs" onclick="ExerciseModule.openRoutineModal('${rt.id}')" title="Editar">
            ✏️
          </button>
          <button class="btn btn-danger-outline btn-xs" onclick="ExerciseModule.deleteRoutine('${rt.id}')" title="Eliminar">
            🗑️
          </button>
        </div>
      </div>
    `).join('');
  },

  toggleRoutineDetail(id) {
    const detail = document.getElementById(`rtDetail_${id}`);
    const btn = document.getElementById(`btnToggleRt_${id}`);
    if (!detail || !btn) return;
    if (detail.style.display === 'none' || !detail.style.display) {
      detail.style.display = 'block';
      btn.innerText = '▲ Ocultar detalle';
    } else {
      detail.style.display = 'none';
      btn.innerText = '▼ Ver detalle';
    }
  },

  formatMetricType(type) {
    if (type === 'fuerza') return 'Fuerza';
    if (type === 'cardio') return 'Cardio';
    if (type === 'flexibilidad') return 'Flexibilidad';
    return 'General';
  },

  // ROUTINE CREATOR MODAL
  openRoutineModal(routineId = null) {
    const modal = document.getElementById('modalRoutineForm');
    const form = document.getElementById('routineForm');
    const title = document.getElementById('routineModalTitle');
    const exContainer = document.getElementById('routineExercisesContainer');

    if (!modal) return;

    if (form) form.reset();
    if (exContainer) exContainer.innerHTML = '';

    if (routineId) {
      const routine = StorageManager.getRoutineById(routineId);
      if (routine) {
        if (title) title.innerText = 'Editar Rutina';
        document.getElementById('routineId').value = routine.id;
        document.getElementById('routineName').value = routine.name;
        document.getElementById('routineCategory').value = routine.category || 'mixto';
        routine.exercises.forEach(ex => this.addExerciseRowToModal(ex));
      }
    } else {
      if (title) title.innerText = 'Nueva Rutina Manual';
      document.getElementById('routineId').value = '';
      this.addExerciseRowToModal();
      this.addExerciseRowToModal();
    }

    modal.classList.add('active');
  },

  addExerciseRowToModal(exData = null) {
    const container = document.getElementById('routineExercisesContainer');
    if (!container) return;

    const card = document.createElement('div');
    card.className = 'exercise-row-item card';
    card.style.padding = '10px';
    card.style.marginBottom = '8px';
    card.style.background = 'var(--input-bg)';

    card.innerHTML = `
      <div class="form-row" style="gap: 6px; align-items: center;">
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <button type="button" class="btn btn-xs btn-outline" onclick="ExerciseModule.moveExerciseRow(this, -1)" title="Mover arriba" style="padding: 2px 6px; font-weight: bold;">▲</button>
          <button type="button" class="btn btn-xs btn-outline" onclick="ExerciseModule.moveExerciseRow(this, 1)" title="Mover abajo" style="padding: 2px 6px; font-weight: bold;">▼</button>
        </div>
        <div class="form-group" style="flex: 2;">
          <input type="text" class="form-input ex-name-input" placeholder="Nombre del Ejercicio (ej: Flexiones)" value="${exData ? this.escapeHtml(exData.name) : ''}" required />
        </div>
        <div class="form-group" style="flex: 1.2;">
          <select class="form-select ex-type-select">
            <option value="fuerza" ${exData && exData.type === 'fuerza' ? 'selected' : ''}>Fuerza</option>
            <option value="cardio" ${exData && exData.type === 'cardio' ? 'selected' : ''}>Cardio</option>
            <option value="flexibilidad" ${exData && exData.type === 'flexibilidad' ? 'selected' : ''}>Flexibilidad</option>
          </select>
        </div>
        <button type="button" class="btn btn-danger-outline btn-xs" onclick="this.closest('.exercise-row-item').remove()" title="Eliminar">&times;</button>
      </div>
      <div class="form-row" style="gap: 6px; margin-top: 6px;">
        <div class="form-group" style="flex: 1;">
          <input type="text" class="form-input ex-target-input" placeholder="Objetivo / Reps (ej: 3 series x 10 reps)" value="${exData && exData.target ? this.escapeHtml(exData.target) : ''}" style="font-size: 0.78rem; padding: 5px 8px;" />
        </div>
        <div class="form-group" style="flex: 1;">
          <input type="text" class="form-input ex-url-input" placeholder="🔗 Link de referencia / video (opcional)" value="${exData && exData.url ? this.escapeHtml(exData.url) : ''}" style="font-size: 0.78rem; padding: 5px 8px;" />
        </div>
      </div>
    `;
    container.appendChild(card);
  },

  moveExerciseRow(btn, direction) {
    const row = btn.closest('.exercise-row-item');
    if (!row) return;
    if (direction === -1 && row.previousElementSibling) {
      row.parentNode.insertBefore(row, row.previousElementSibling);
    } else if (direction === 1 && row.nextElementSibling) {
      row.parentNode.insertBefore(row.nextElementSibling, row);
    }
  },

  handleRoutineSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const idEl = document.getElementById('routineId');
    const nameEl = document.getElementById('routineName');
    const catEl = document.getElementById('routineCategory');

    const id = idEl ? idEl.value : '';
    const name = nameEl ? nameEl.value.trim() : '';
    const category = catEl ? catEl.value : 'mixto';

    if (!name) {
      if (window.App && window.App.showToast) {
        window.App.showToast('Por favor ingresa un nombre para la rutina.', 'error');
      } else {
        alert('Por favor ingresa un nombre para la rutina.');
      }
      if (nameEl) nameEl.focus();
      return;
    }

    const rows = document.querySelectorAll('#routineExercisesContainer .exercise-row-item');
    const exercises = [];

    rows.forEach(row => {
      const exNameInput = row.querySelector('.ex-name-input');
      const exTypeSelect = row.querySelector('.ex-type-select');
      const exTargetInput = row.querySelector('.ex-target-input');
      const exUrlInput = row.querySelector('.ex-url-input');

      if (exNameInput && exNameInput.value.trim()) {
        exercises.push({
          name: exNameInput.value.trim(),
          type: exTypeSelect ? exTypeSelect.value : 'fuerza',
          target: exTargetInput ? exTargetInput.value.trim() : '',
          url: exUrlInput ? exUrlInput.value.trim() : ''
        });
      }
    });

    if (exercises.length === 0) {
      if (window.App && window.App.showToast) {
        window.App.showToast('Debes agregar al menos un ejercicio a la rutina.', 'error');
      } else {
        alert('Debes agregar al menos un ejercicio a la rutina.');
      }
      return;
    }

    const saved = StorageManager.saveRoutine({ id: id || null, name, category, exercises });
    
    const modal = document.getElementById('modalRoutineForm');
    if (modal) modal.classList.remove('active');

    this.renderRoutines();
    if (window.App) window.App.refreshAllViews();

    if (window.App && window.App.showToast) {
      window.App.showToast(`¡Rutina "${saved.name}" guardada con éxito con ${exercises.length} ejercicios!`, 'success');
    }
  },

  // --- TEXT IMPORT PARSER (BLOC DE NOTAS) ---
  openImportModal(autoFillSample = false) {
    const modal = document.getElementById('modalImportTextRoutine');
    const textarea = document.getElementById('routineImportText');
    const previewContainer = document.getElementById('importPreviewContainer');
    const saveBtn = document.getElementById('btnSaveImportedRoutine');

    if (!modal) return;

    if (textarea && autoFillSample && (!textarea.value || !textarea.value.trim())) {
      textarea.value = this.sampleReferenceText;
    }

    if (previewContainer) previewContainer.style.display = 'none';
    if (saveBtn) saveBtn.disabled = true;
    this.parsedImportedRoutine = null;

    modal.classList.add('active');

    if (autoFillSample && textarea && textarea.value) {
      this.parseAndPreviewImportText();
    }
  },

  pasteSampleAndParse() {
    const textarea = document.getElementById('routineImportText');
    if (textarea) {
      textarea.value = this.sampleReferenceText;
      this.parseAndPreviewImportText();
    }
  },

  parseRoutineText(rawText) {
    if (!rawText || !rawText.trim()) return null;

    const lines = rawText.split('\n');
    let routineName = 'Rutina de Entrenamiento';
    let currentCategory = 'mixto';
    let currentSection = 'fuerza';
    let currentSectionUrl = '';
    const exercises = [];
    let pendingNumberedBlock = null;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      // Ignore decorative dividers and rule headers
      if (/^[─\-\*·☆\s📌]+$/.test(line) || line.includes('⋆⋅☆⋅⋆') || line.includes('────────')) continue;
      if (line.startsWith('📌 REGLAS DE ORO') || line.startsWith('🚫') || line.startsWith('🌬️') || line.startsWith('🔁')) continue;

      // Detect URL / Link lines
      if (line.includes('http://') || line.includes('https://')) {
        const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          currentSectionUrl = urlMatch[1];
          if (pendingNumberedBlock) {
            pendingNumberedBlock.url = currentSectionUrl;
          }
        }
        continue;
      }

      // Detect Routine Title
      if ((routineName === 'Rutina de Entrenamiento' || routineName === 'Mi Rutina') && (line.toLowerCase().startsWith('new rutina') || line.toLowerCase().startsWith('rutina:'))) {
        const titleMatch = line.replace(/new rutina/i, '').replace(/rutina/i, '').replace(/^[:\-\s]+/, '').trim();
        if (titleMatch) routineName = titleMatch;
        continue;
      }

      // Detect Section Headers
      const lower = line.toLowerCase();
      if (lower.includes('fuerza')) {
        currentSection = 'fuerza';
        continue;
      } else if (lower.includes('cardio') || lower.includes('resistencia')) {
        currentSection = 'cardio';
        continue;
      } else if (lower.includes('flexibilidad') || lower.includes('recuperación') || lower.includes('movilidad')) {
        currentSection = 'flexibilidad';
        continue;
      }

      // Ignore time header lines like "⏱️ 20 Min | 🏡 En Casa"
      if (line.startsWith('⏱️') && (line.toLowerCase().includes('min') || line.includes('|'))) {
        continue;
      }

      // Detect Numbered Block Exercises like "1️⃣ ESTIRAMIENTO DE ADUCTORES 🦵" or "1. BISAGRA..."
      const numMatch = line.match(/^(?:[1-9]️⃣|[0-9]+\.)\s*(.+)$/u);
      if (numMatch) {
        if (pendingNumberedBlock) {
          exercises.push(pendingNumberedBlock);
          pendingNumberedBlock = null;
        }
        let cleanName = numMatch[1].replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/gu, '').replace(/⏱️.*/, '').trim();
        pendingNumberedBlock = {
          name: cleanName,
          type: 'flexibilidad',
          target: '',
          url: currentSectionUrl || ''
        };
        continue;
      }

      // If we are building a numbered exercise block
      if (pendingNumberedBlock) {
        if (line.startsWith('⏱️')) {
          pendingNumberedBlock.target = line.replace('⏱️', '').trim();
          exercises.push(pendingNumberedBlock);
          pendingNumberedBlock = null;
        } else if (line.startsWith('•')) {
          const detail = line.replace('•', '').trim();
          if (pendingNumberedBlock.target) {
            pendingNumberedBlock.target += ` (${detail})`;
          } else {
            pendingNumberedBlock.target = detail;
          }
        }
        continue;
      }

      // Detect Bullet Line Exercises like "• Flexiones: 3 series x 8-12 reps"
      if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
        let content = line.replace(/^[•\-\*\s]+/, '').trim();
        let exName = content;
        let target = '';

        if (content.includes(':')) {
          const parts = content.split(':');
          exName = parts[0].trim();
          target = parts.slice(1).join(':').trim();
        }

        // Categorize metric type intelligently
        let type = currentSection;
        const checkText = (exName + ' ' + target).toLowerCase();
        if (checkText.includes('correr') || checkText.includes('trote') || checkText.includes('caminata') || checkText.includes('cardio') || checkText.includes('km')) {
          type = 'cardio';
        } else if (checkText.includes('series') && (checkText.includes('reps') || checkText.includes('fallo') || checkText.includes('peso'))) {
          type = 'fuerza';
        } else if (checkText.includes('estiramiento') || checkText.includes('plancha') || checkText.includes('flexibilidad') || checkText.includes('seg')) {
          type = 'flexibilidad';
        }

        exercises.push({
          name: exName,
          type: type,
          target: target || 'Completo',
          url: currentSectionUrl || ''
        });
      }
    }

    if (pendingNumberedBlock) {
      exercises.push(pendingNumberedBlock);
    }

    return {
      name: routineName || 'Rutina de Entrenamiento',
      category: currentCategory,
      exercises
    };
  },

  parseAndPreviewImportText() {
    const textarea = document.getElementById('routineImportText');
    if (!textarea) return;
    const rawText = textarea.value;
    const previewContainer = document.getElementById('importPreviewContainer');
    const previewList = document.getElementById('importPreviewList');
    const previewName = document.getElementById('importPreviewName');
    const previewCount = document.getElementById('importPreviewCount');
    const saveBtn = document.getElementById('btnSaveImportedRoutine');
    const editBtn = document.getElementById('btnLoadImportedIntoEditor');

    const result = this.parseRoutineText(rawText);

    if (!result || !result.exercises || result.exercises.length === 0) {
      if (window.App && window.App.showToast) {
        window.App.showToast('No se pudieron extraer ejercicios del texto ingresado. Asegúrate de incluir viñetas (•) o números.', 'error');
      } else {
        alert('No se pudieron extraer ejercicios del texto ingresado.');
      }
      if (previewContainer) previewContainer.style.display = 'none';
      if (saveBtn) saveBtn.disabled = true;
      if (editBtn) editBtn.disabled = true;
      return;
    }

    this.parsedImportedRoutine = result;
    if (previewName) previewName.innerText = `Rutina: ${result.name}`;
    if (previewCount) previewCount.innerText = `${result.exercises.length} Ejercicios Detectados`;

    if (previewList) {
      previewList.innerHTML = result.exercises.map((e, idx) => `
        <div style="padding: 6px 0; border-bottom: 1px dashed var(--card-border);">
          <strong>${idx + 1}. ${this.escapeHtml(e.name)}</strong> 
          <span class="badge-tag" style="margin-left: 6px;">${e.type}</span>
          ${e.url ? `<a href="${this.escapeHtml(e.url)}" target="_blank" rel="noopener" class="btn btn-xs btn-outline" style="padding: 1px 6px; font-size: 0.7rem; margin-left: 4px; text-decoration: none;">🔗 Video</a>` : ''}<br>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${e.target ? `Objetivo: ${this.escapeHtml(e.target)}` : ''}</span>
        </div>
      `).join('');
    }

    if (previewContainer) previewContainer.style.display = 'block';
    if (saveBtn) saveBtn.disabled = false;
    if (editBtn) editBtn.disabled = false;
  },

  loadImportedIntoEditor() {
    if (!this.parsedImportedRoutine) return;

    // Close import modal
    const importModal = document.getElementById('modalImportTextRoutine');
    if (importModal) importModal.classList.remove('active');

    // Open routine creator modal pre-filled with parsed exercises
    const modal = document.getElementById('modalRoutineForm');
    const form = document.getElementById('routineForm');
    const title = document.getElementById('routineModalTitle');
    const exContainer = document.getElementById('routineExercisesContainer');

    if (form) form.reset();
    if (exContainer) exContainer.innerHTML = '';

    if (title) title.innerText = 'Editar Rutina Importada';
    document.getElementById('routineId').value = '';
    document.getElementById('routineName').value = this.parsedImportedRoutine.name || 'Rutina Importada';
    document.getElementById('routineCategory').value = this.parsedImportedRoutine.category || 'mixto';

    this.parsedImportedRoutine.exercises.forEach(ex => this.addExerciseRowToModal(ex));

    if (modal) modal.classList.add('active');
  },

  saveImportedRoutine() {
    if (!this.parsedImportedRoutine) return;

    StorageManager.saveRoutine(this.parsedImportedRoutine);
    const modal = document.getElementById('modalImportTextRoutine');
    if (modal) modal.classList.remove('active');
    this.renderRoutines();
    if (window.App) window.App.refreshAllViews();

    if (window.App && window.App.showToast) {
      window.App.showToast(`¡Rutina "${this.parsedImportedRoutine.name}" importada con ${this.parsedImportedRoutine.exercises.length} ejercicios!`, 'success');
    }
  },

  deleteRoutine(id) {
    if (confirm('¿Seguro que deseas eliminar esta rutina?')) {
      StorageManager.deleteRoutine(id);
      this.renderRoutines();
    }
  },

  toggleExerciseCardCompleted(chk) {
    const card = chk.closest('.workout-ex-input-card');
    if (!card) return;
    if (chk.checked) {
      card.classList.remove('is-dimmed');
    } else {
      card.classList.add('is-dimmed');
    }
  },

  // WORKOUT SESSION LOGGING (SMART AUTO-FILL & FLEXIBLE METRICS)
  startWorkoutSession(routineId) {
    const routine = StorageManager.getRoutineById(routineId);
    if (!routine) return;

    const modal = document.getElementById('modalWorkoutSession');
    document.getElementById('workoutSessionTitle').innerText = routine.name;
    document.getElementById('workoutSessionSub').innerText = routine.category || 'Rutina';
    document.getElementById('sessionRoutineId').value = routine.id;
    document.getElementById('workoutDate').value = StorageManager.getTodayDateString();
    document.getElementById('workoutNotes').value = '';

    const container = document.getElementById('workoutExercisesList');
    container.innerHTML = '';

    routine.exercises.forEach((ex, idx) => {
      // Query last session values for intelligent auto-fill
      const lastSession = StorageManager.getLastExerciseSession(ex.name);
      let autofillHint = '';
      let defaultWeight = '';
      let defaultReps = '';
      let defaultSets = '3';
      let defaultDist = '';
      let defaultTime = '';

      if (lastSession && lastSession.exerciseData) {
        const prev = lastSession.exerciseData;
        if (ex.type === 'fuerza') {
          defaultWeight = prev.weight !== undefined ? prev.weight : '';
          defaultReps = prev.reps || '';
          defaultSets = prev.sets || '3';
          const weightDisplay = prev.weight && prev.weight > 0 ? ` @ ${prev.weight}kg` : '';
          autofillHint = `<span class="autofill-badge">💡 Previo: ${prev.sets || 3}x${prev.reps || 0}${weightDisplay}</span>`;
        } else if (ex.type === 'cardio') {
          defaultDist = prev.distance || '';
          defaultTime = prev.duration || '';
          autofillHint = `<span class="autofill-badge">💡 Previo: ${prev.distance || 0} km en ${prev.duration || '00:00'}</span>`;
        } else if (ex.type === 'flexibilidad') {
          defaultTime = prev.duration || '';
          defaultReps = prev.reps || '';
          defaultSets = prev.sets || '1';
          autofillHint = `<span class="autofill-badge">💡 Previo: ${prev.duration || prev.reps || 'Completo'}</span>`;
        }
      }

      const card = document.createElement('div');
      card.className = 'card workout-ex-input-card';
      card.style.padding = '12px';
      card.style.marginBottom = '10px';

      const refLinkBtn = ex.url ? `<a href="${this.escapeHtml(ex.url)}" target="_blank" rel="noopener" class="btn btn-xs btn-outline" style="text-decoration:none; margin-left: 6px;">🔗 Referencia</a>` : '';

      const completionCheckbox = `
        <label style="font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; color: var(--accent-study); font-weight: 600; white-space: nowrap;">
          <input type="checkbox" class="ex-completed-chk" checked onchange="ExerciseModule.toggleExerciseCardCompleted(this)" /> ☑️ Completado
        </label>
      `;

      if (ex.type === 'fuerza') {
        card.innerHTML = `
          <div class="flex-between" style="margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
            <div style="flex: 1; min-width: 140px;">
              <strong>${idx + 1}. ${this.escapeHtml(ex.name)}</strong> ${refLinkBtn}
              ${ex.target ? `<div style="font-size:0.75rem; color:var(--text-muted);">${this.escapeHtml(ex.target)}</div>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              ${autofillHint}
              ${completionCheckbox}
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex: 1; min-width: 70px;">
              <label>Series</label>
              <input type="number" class="form-input ex-sets-input" min="1" value="${defaultSets}" />
            </div>
            <div class="form-group" style="flex: 1.5; min-width: 100px;">
              <label>Reps / Tiempo</label>
              <input type="text" class="form-input ex-reps-input" value="${defaultReps || (ex.target ? ex.target : '')}" placeholder="Ej: 10 u 8-12 reps / 30 seg" />
            </div>
            <div class="form-group" style="flex: 1.2; min-width: 90px;">
              <label>Peso (kg)</label>
              <input type="number" step="0.5" class="form-input ex-weight-input" min="0" value="${defaultWeight}" placeholder="Ej: 0 (Opcional)" />
            </div>
          </div>
        `;
      } else if (ex.type === 'cardio') {
        card.innerHTML = `
          <div class="flex-between" style="margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
            <div style="flex: 1; min-width: 140px;">
              <strong>${idx + 1}. ${this.escapeHtml(ex.name)}</strong> ${refLinkBtn}
              ${ex.target ? `<div style="font-size:0.75rem; color:var(--text-muted);">${this.escapeHtml(ex.target)}</div>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              ${autofillHint}
              ${completionCheckbox}
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex: 1; min-width: 100px;">
              <label>Distancia (Km)</label>
              <input type="number" step="0.01" class="form-input ex-dist-input" min="0" value="${defaultDist}" placeholder="Ej: 5.2 (Opcional)" />
            </div>
            <div class="form-group" style="flex: 1.2; min-width: 110px;">
              <label>Tiempo (min/hh:mm)</label>
              <input type="text" class="form-input ex-time-input" value="${defaultTime}" placeholder="Ej: 25 min" />
            </div>
          </div>
        `;
      } else {
        card.innerHTML = `
          <div class="flex-between" style="margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
            <div style="flex: 1; min-width: 140px;">
              <strong>${idx + 1}. ${this.escapeHtml(ex.name)}</strong> ${refLinkBtn}
              ${ex.target ? `<div style="font-size:0.75rem; color:var(--text-muted);">${this.escapeHtml(ex.target)}</div>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              ${autofillHint}
              ${completionCheckbox}
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex: 1.5; min-width: 110px;">
              <label>Reps / Tiempo / Indicación</label>
              <input type="text" class="form-input ex-flex-time" value="${defaultTime || defaultReps || (ex.target ? ex.target : '')}" placeholder="Ej: 12-15 reps / 30 seg" />
            </div>
            <div class="form-group" style="flex: 1; min-width: 70px;">
              <label>Series / Reps</label>
              <input type="number" class="form-input ex-sets-input" min="1" value="${defaultSets || 1}" placeholder="Ej: 1 o 3" />
            </div>
          </div>
        `;
      }

      card.dataset.exName = ex.name;
      card.dataset.exType = ex.type;
      container.appendChild(card);
    });

    modal.classList.add('active');
  },

  handleWorkoutSessionSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const routineId = document.getElementById('sessionRoutineId').value;
    const routine = StorageManager.getRoutineById(routineId);
    const date = document.getElementById('workoutDate').value;
    const notes = document.getElementById('workoutNotes').value.trim();

    const inputCards = document.querySelectorAll('.workout-ex-input-card');
    const loggedExercises = [];

    inputCards.forEach(card => {
      const name = card.dataset.exName;
      const type = card.dataset.exType;
      const chk = card.querySelector('.ex-completed-chk');
      const completed = chk ? chk.checked : true;

      if (type === 'fuerza') {
        const setsInput = card.querySelector('.ex-sets-input');
        const repsInput = card.querySelector('.ex-reps-input');
        const weightInput = card.querySelector('.ex-weight-input');

        const sets = setsInput ? (parseFloat(setsInput.value) || 3) : 3;
        const reps = repsInput ? repsInput.value.trim() : '10';
        const weight = weightInput && weightInput.value !== '' ? (parseFloat(weightInput.value) || 0) : 0;

        loggedExercises.push({ name, type, sets, reps, weight, completed });
      } else if (type === 'cardio') {
        const distInput = card.querySelector('.ex-dist-input');
        const timeInput = card.querySelector('.ex-time-input');

        const distance = distInput && distInput.value !== '' ? (parseFloat(distInput.value) || 0) : 0;
        const duration = timeInput ? timeInput.value.trim() : '';

        loggedExercises.push({ name, type, distance, duration, completed });
      } else {
        const flexTimeInput = card.querySelector('.ex-flex-time');
        const setsInput = card.querySelector('.ex-sets-input');

        const duration = flexTimeInput ? flexTimeInput.value.trim() : '';
        const sets = setsInput ? (parseFloat(setsInput.value) || 1) : 1;

        loggedExercises.push({ name, type, duration, sets, completed });
      }
    });

    StorageManager.saveWorkoutLog({
      routineId,
      routineName: routine ? routine.name : 'Entrenamiento',
      date,
      notes,
      exercises: loggedExercises
    });

    document.getElementById('modalWorkoutSession').classList.remove('active');
    this.renderWorkoutLogs();
    if (window.App) {
      window.App.refreshAllViews();
      window.App.switchTab('tabCalendar');
    }

    if (window.App && window.App.showToast) {
      window.App.showToast('🎉 ¡Entrenamiento registrado! Tu racha, calendario y analíticas han sido actualizados.', 'success');
    }
  },

  renderWorkoutLogs() {
    const container = document.getElementById('exerciseLogsList');
    if (!container) return;

    const logs = StorageManager.getWorkoutLogs().sort((a, b) => new Date(b.date) - new Date(a.date));
    if (logs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Aún no has completado ninguna sesión de ejercicio.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = logs.map(log => `
      <div class="activity-item type-exercise" style="flex-direction: column; align-items: stretch; gap: 6px;">
        <div class="flex-between">
          <div class="activity-info">
            <h4>🏋️‍♂️ ${this.escapeHtml(log.routineName)}</h4>
            <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
              ${log.exercises ? log.exercises.length : 0} ejercicios completados
            </p>
          </div>
          <div class="flex-end" style="gap: 6px;">
            <span class="activity-time">${log.date}</span>
            <button class="btn btn-xs btn-outline" onclick="ExerciseModule.toggleLogDetail('${log.id}')" id="btnToggleLog_${log.id}" style="padding: 2px 6px; font-size: 0.72rem;">
              ▼ Detalle
            </button>
            <button class="btn btn-danger-outline btn-xs" onclick="ExerciseModule.deleteWorkoutLog('${log.id}')">&times;</button>
          </div>
        </div>

        <div class="collapsible-detail" id="logDetail_${log.id}" style="display: none; padding-top: 6px; border-top: 1px dashed var(--card-border); font-size: 0.8rem;">
          ${log.exercises ? log.exercises.map(e => {
            const statusIcon = e.completed ? '✅' : '⏳';
            let metricStr = '';
            if (e.type === 'fuerza') {
              const weightStr = e.weight && e.weight > 0 ? ` @ ${e.weight}kg` : '';
              metricStr = `${e.sets} series x ${e.reps}${weightStr}`;
            } else if (e.type === 'cardio') {
              const distStr = e.distance && e.distance > 0 ? `${e.distance}km ` : '';
              metricStr = `${distStr}(${e.duration || 'Completado'})`;
            } else {
              metricStr = `${e.duration || 'Completado'}`;
            }
            return `<div style="padding: 2px 0;">${statusIcon} <strong>${this.escapeHtml(e.name)}</strong>: ${metricStr}</div>`;
          }).join('') : ''}
          ${log.notes ? `<p style="font-style: italic; opacity: 0.85; margin-top: 4px; color: var(--text-muted);">"${this.escapeHtml(log.notes)}"</p>` : ''}
        </div>
      </div>
    `).join('');
  },

  toggleLogDetail(id) {
    const detail = document.getElementById(`logDetail_${id}`);
    const btn = document.getElementById(`btnToggleLog_${id}`);
    if (!detail || !btn) return;
    if (detail.style.display === 'none' || !detail.style.display) {
      detail.style.display = 'block';
      btn.innerText = '▲ Ocultar';
    } else {
      detail.style.display = 'none';
      btn.innerText = '▼ Detalle';
    }
  },

  deleteWorkoutLog(id) {
    if (confirm('¿Eliminar este registro de entrenamiento?')) {
      StorageManager.deleteWorkoutLog(id);
      this.renderWorkoutLogs();
      if (window.App) window.App.refreshAllViews();
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
};
