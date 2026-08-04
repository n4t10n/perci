/**
 * Percí v2 - Activities & Plans Module (Dynamic & Adaptive)
 * Gestiona la creación, edición y adaptación de Actividades y Planes según categoría.
 */

window.ActivitiesModule = {
  currentActivityId: null,
  currentPlanId: null,

  init() {
    this.bindFormEvents();
    this.renderActivitiesList();
  },

  bindFormEvents() {
    const actForm = document.getElementById('activityForm');
    if (actForm) {
      actForm.onsubmit = (e) => {
        e.preventDefault();
        this.handleActivitySubmit(e);
      };
    }

    const saveBtn = document.getElementById('btnSaveActivity');
    if (saveBtn) {
      saveBtn.onclick = (e) => {
        e.preventDefault();
        this.handleActivitySubmit(e);
      };
    }

    const planForm = document.getElementById('planForm');
    if (planForm) {
      planForm.onsubmit = (e) => {
        e.preventDefault();
        this.handlePlanSubmit(e);
      };
    }
  },

  // RENDER LISTA DE ACTIVIDADES CON BOTONES DE ORDEN ESTILO SPOTIFY
  renderActivitiesList() {
    const container = document.getElementById('activitiesGridList');
    if (!container) return;

    const activities = StorageManager.getActivities();

    if (activities.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 24px; text-align: center; color: var(--text-muted);">
          <p>Aún no tenés actividades creadas.</p>
          <p style="font-size: 0.8rem; margin-top: 4px;">Tocá en "+ Nueva Actividad" para empezar.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = activities.map((act, index) => {
      const plans = StorageManager.getPlansByActivity(act.id);
      const isFirst = index === 0;
      const isLast = index === activities.length - 1;

      return `
        <div class="card flex-between" style="cursor: pointer; padding: 12px 14px;" onclick="ActivitiesModule.openActivityDetail('${act.id}')">
          <div class="action-left" style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
            <div class="activity-icon-badge" style="border-left: 3px solid ${act.color || 'var(--accent-cyan)'}; font-size: 1.3rem;">
              ${act.icon || '🎯'}
            </div>
            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin: 0;">${App.escapeHtml(act.name)}</h4>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${act.category || 'General'} • Meta: ${act.weekly_target || act.weeklyTarget || 3}x/sem</p>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="btn btn-xs btn-outline" type="button" onclick="event.stopPropagation(); ActivitiesModule.openActivityDetail('${act.id}')">Gestionar</button>

            <!-- Spotify-like Order Handle (Arriba / Abajo) -->
            <div class="reorder-actions" onclick="event.stopPropagation();">
              ${!isFirst ? `
                <button class="reorder-btn" title="Subir" onclick="ActivitiesModule.moveActivity('${act.id}', -1)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
              ` : '<span style="height:18px;"></span>'}

              ${!isLast ? `
                <button class="reorder-btn" title="Bajar" onclick="ActivitiesModule.moveActivity('${act.id}', 1)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              ` : '<span style="height:18px;"></span>'}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // REORDENAR ACTIVIDADES Y GUARDAR EN STORAGE
  moveActivity(actId, direction) {
    const activities = StorageManager.getActivities();
    const index = activities.findIndex(a => a.id === actId);
    if (index === -1) return;

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= activities.length) return;

    // Intercambiar posiciones
    const temp = activities[index];
    activities[index] = activities[targetIndex];
    activities[targetIndex] = temp;

    // Guardar lista completa reordenada
    localStorage.setItem(STORAGE_KEYS_V2.ACTIVITIES, JSON.stringify(activities));

    // Refrescar vistas
    this.renderActivitiesList();
    if (window.App) App.refreshAllViews();
  },

  // ABRIR MODAL CREAR / EDITAR ACTIVIDAD (FIX ID SELECCIONADO)
  openActivityModal(actId = null) {
    const modal = document.getElementById('modalActivityForm');
    const form = document.getElementById('activityForm');
    if (!modal || !form) return;

    form.reset();

    // Sincronizar siempre con el ID explícito recibido
    const targetId = actId || this.currentActivityId;

    if (targetId && actId !== null) {
      const activities = StorageManager.getActivities();
      const act = activities.find(a => a.id === targetId);
      if (act) {
        document.getElementById('activityId').value = act.id;
        document.getElementById('activityName').value = act.name;
        document.getElementById('activityIcon').value = act.icon || '';
        document.getElementById('activityCategory').value = act.category || 'Ejercicio';
        document.getElementById('activityWeeklyTarget').value = act.weekly_target || act.weeklyTarget || 3;
        document.getElementById('activityColor').value = act.color || '#00f2fe';
        document.getElementById('activityModalTitle').innerText = 'Editar Actividad';
      }
    } else {
      document.getElementById('activityId').value = '';
      document.getElementById('activityModalTitle').innerText = 'Nueva Actividad';
    }

    modal.classList.add('active');
  },

  // GUARDAR / ACTUALIZAR ACTIVIDAD
  handleActivitySubmit(e) {
    if (e) e.preventDefault();

    const idInput = document.getElementById('activityId');
    const nameInput = document.getElementById('activityName');
    const iconInput = document.getElementById('activityIcon');
    const categoryInput = document.getElementById('activityCategory');
    const targetInput = document.getElementById('activityWeeklyTarget');
    const colorInput = document.getElementById('activityColor');

    const id = (idInput && idInput.value) ? idInput.value : 'act_' + Date.now();
    const name = nameInput ? nameInput.value.trim() : '';
    const icon = (iconInput && iconInput.value.trim()) ? iconInput.value.trim() : '🎯';
    const category = categoryInput ? categoryInput.value : 'Ejercicio';
    const weekly_target = targetInput ? (parseInt(targetInput.value, 10) || 3) : 3;
    const color = colorInput ? colorInput.value : '#00f2fe';

    if (!name) {
      if (window.App) App.showToast('Por favor, ingresá un nombre para la actividad', 'error');
      return;
    }

    const activityData = {
      id,
      name,
      icon,
      category,
      weekly_target,
      weeklyTarget: weekly_target,
      color,
      created_at: new Date().toISOString()
    };

    StorageManager.saveActivity(activityData);

    const modal = document.getElementById('modalActivityForm');
    if (modal) modal.classList.remove('active');

    if (window.App) App.refreshAllViews();
    this.renderActivitiesList();

    // Si estaba abierto el detalle de esta misma actividad, actualizar la cabecera
    if (this.currentActivityId === id) {
      this.openActivityDetail(id);
    }

    if (window.App) {
      App.showToast('¡Actividad guardada exitosamente!', 'success');
    }
  },

  // BORRAR ACTIVIDAD ACTUAL
  deleteCurrentActivity() {
    if (!this.currentActivityId) return;

    const activities = StorageManager.getActivities();
    const act = activities.find(a => a.id === this.currentActivityId);
    if (!act) return;

    if (confirm(`¿Seguro que querés borrar la actividad "${act.name}"? Se eliminarán también sus planes asociados.`)) {
      // 1. Borrar la actividad
      StorageManager.deleteActivity(this.currentActivityId);

      // 2. Borrar los planes asociados a esta actividad
      const plans = StorageManager.getPlansByActivity(this.currentActivityId);
      plans.forEach(p => StorageManager.deletePlan(p.id));

      // 3. Cerrar el modal
      const modal = document.getElementById('modalActivityDetail');
      if (modal) modal.classList.remove('active');

      // 4. Actualizar vistas
      if (window.App) App.refreshAllViews();
      this.renderActivitiesList();

      if (window.App) App.showToast('Actividad eliminada correctamente', 'info');
    }
  },

  // VER / GESTIONAR DETALLE DE ACTIVIDAD
  openActivityDetail(actId) {
    this.currentActivityId = actId;
    const activities = StorageManager.getActivities();
    const act = activities.find(a => a.id === actId);
    if (!act) return;

    document.getElementById('detailActivityId').value = act.id;
    document.getElementById('detailActivityTitle').innerText = `${act.icon || ''} ${act.name}`;
    document.getElementById('detailActivityCategory').innerText = act.category || 'General';

    // Botón dinámico para editar la actividad actual
    let headerEditBtn = document.getElementById('detailHeaderEditBtn');
    if (!headerEditBtn) {
      const headerTitle = document.getElementById('detailActivityTitle');
      if (headerTitle && headerTitle.parentElement) {
        headerEditBtn = document.createElement('button');
        headerEditBtn.id = 'detailHeaderEditBtn';
        headerEditBtn.className = 'btn btn-xs btn-outline';
        headerEditBtn.style.marginTop = '6px';
        headerEditBtn.innerText = '✏️ Editar Actividad';
        headerTitle.parentElement.appendChild(headerEditBtn);
      }
    }

    if (headerEditBtn) {
      headerEditBtn.onclick = () => {
        const detailModal = document.getElementById('modalActivityDetail');
        if (detailModal) detailModal.classList.remove('active');
        this.openActivityModal(act.id);
      };
    }

    this.renderPlansForDetail(act);
    this.renderHistoryForDetail(act.id);

    const modal = document.getElementById('modalActivityDetail');
    if (modal) modal.classList.add('active');
  },

  // RENDER PLANES CON BOTÓN DE EDICIÓN
  renderPlansForDetail(act) {
    const container = document.getElementById('detailActivityPlansList');
    if (!container) return;

    const plans = StorageManager.getPlansByActivity(act.id);

    if (plans.length === 0) {
      container.innerHTML = `<p class="view-subtitle" style="padding: 8px 0;">No tenés planes creados para esta categoría (${act.category}).</p>`;
      return;
    }

    container.innerHTML = plans.map(p => {
      let itemsDetail = '';
      const itemsList = p.items || [];

      if (itemsList.length > 0) {
        itemsDetail = itemsList.map(item => {
          if (typeof item === 'object') {
            if (item.type === 'section') {
              return `
                <div class="plan-section-header">
                  <span>📁 ${App.escapeHtml(item.name)}</span>
                  ${item.link ? `<a href="${App.escapeHtml(item.link)}" target="_blank" class="link-btn-badge">🔗 Ver Link</a>` : ''}
                </div>
              `;
            } else {
              return `
                <div style="display:flex; align-items:center; justify-content:space-between; margin: 4px 0 4px 12px; font-size:0.8rem;">
                  <span>• ${App.escapeHtml(item.name)}</span>
                  ${item.link ? `<a href="${App.escapeHtml(item.link)}" target="_blank" class="link-btn-badge">🔗 Ver Link</a>` : ''}
                </div>
              `;
            }
          } else {
            return `<li style="font-size:0.78rem; color:var(--text-muted); margin-left:14px;">${App.escapeHtml(item)}</li>`;
          }
        }).join('');
      }

      return `
        <div class="card" style="padding: 12px; margin-top: 8px;">
          <div class="flex-between">
            <strong style="font-size: 0.92rem;">${App.escapeHtml(p.name)}</strong>
            <div>
              <span class="badge-tag" style="margin-right: 4px;">${act.category}</span>
              <button class="btn btn-xs btn-outline" onclick="ActivitiesModule.openPlanModal('${p.id}')">✏️ Editar</button>
            </div>
          </div>
          <div style="margin-top:6px;">${itemsDetail}</div>
        </div>
      `;
    }).join('');
  },

  renderHistoryForDetail(actId) {
    const container = document.getElementById('detailActivityHistoryList');
    if (!container) return;

    const sessions = StorageManager.getSessionsByActivity(actId);

    if (sessions.length === 0) {
      container.innerHTML = `<p class="view-subtitle" style="padding: 8px 0;">Aún no realizaste ningún registro para esta actividad.</p>`;
      return;
    }

    container.innerHTML = sessions.slice(-5).reverse().map(s => `
      <div class="timeline-item" style="margin-top: 6px; padding: 8px 10px;">
        <span class="timeline-time" style="font-size: 0.75rem;">${s.date}</span>
        <div class="timeline-content">
          <p style="font-size: 0.8rem; color: var(--text-main);">${s.notes || 'Sesión realizada.'}</p>
        </div>
      </div>
    `).join('');
  },

  // CREAR O EDITAR PLAN / RUTINA
  openPlanModal(planId = null) {
    if (!this.currentActivityId) return;

    const activities = StorageManager.getActivities();
    const act = activities.find(a => a.id === this.currentActivityId);
    if (!act) return;

    const form = document.getElementById('planForm');
    if (form) form.reset();

    const pasteBox = document.getElementById('pasteBoxContainer');
    if (pasteBox) pasteBox.style.display = 'none';

    document.getElementById('planActivityId').value = act.id;
    const container = document.getElementById('planExercisesContainer');
    container.innerHTML = '';

    const planNameInput = document.getElementById('planName');
    if (planNameInput) {
      if (act.category === 'Ejercicio') planNameInput.placeholder = 'Ej: Rutina En Casa / Gym';
      else if (act.category === 'Estudio') planNameInput.placeholder = 'Ej: Idioma Nivel A1 / Programación Web';
      else if (act.category === 'Hábito' || act.category === 'Lectura') planNameInput.placeholder = 'Ej: Lectura Harry Potter';
      else planNameInput.placeholder = 'Ej: Mi Plan de Seguimiento';
    }

    this.currentPlanId = planId;
    const placeholderText = this.getItemPlaceholderByCategory(act.category);

    if (planId) {
      const plans = StorageManager.getPlansByActivity(act.id);
      const plan = plans.find(p => p.id === planId);

      if (plan) {
        if (planNameInput) planNameInput.value = plan.name || '';
        const itemsToLoad = plan.items || [];

        if (itemsToLoad.length > 0) {
          itemsToLoad.forEach(item => {
            if (typeof item === 'object') {
              if (item.type === 'section') this.addSectionRowToPlanModal(item.name, item.link);
              else this.addExerciseRowToPlanModal(placeholderText, item.name, item.link);
            } else {
              this.addExerciseRowToPlanModal(placeholderText, item);
            }
          });
        } else {
          this.addExerciseRowToPlanModal(placeholderText);
        }
      }
    } else {
      this.addExerciseRowToPlanModal(placeholderText);
    }

    const modal = document.getElementById('modalPlanForm');
    if (modal) modal.classList.add('active');
  },  

  // FILA PARA SECCIÓN CON LINK
  addSectionRowToPlanModal(initialName = '', initialLink = '') {
    const container = document.getElementById('planExercisesContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'plan-item-row is-section';
    row.setAttribute('data-item-type', 'section');

    row.innerHTML = `
      <div class="form-row">
        <input type="text" class="form-input plan-item-name" value="${App.escapeHtml(initialName)}" placeholder="📁 Nombre de la Sección (ej: FUERZA / FLEXIBILIDAD)" style="flex: 1; font-weight: 700; color: var(--accent-cyan);" />
        <button type="button" class="btn btn-xs btn-danger-outline" onclick="this.closest('.plan-item-row').remove()">✕</button>
      </div>
      <input type="url" class="form-input plan-item-link" value="${App.escapeHtml(initialLink)}" placeholder="🔗 Link de la sección opcional (ej: TikTok / Youtube)" style="font-size: 0.75rem; padding: 4px 8px;" />
    `;
    container.appendChild(row);
  },

  // MONSTRAR / OCULTAR CAJA DE TEXTO PLANO
  togglePasteBox() {
    const box = document.getElementById('pasteBoxContainer');
    if (!box) return;
    box.style.display = (box.style.display === 'none' || !box.style.display) ? 'block' : 'none';
  },

  // PARSER DE TEXTO PLANO DE BLOC DE NOTAS
  processPastedText() {
    const input = document.getElementById('pasteBoxInput');
    if (!input || !input.value.trim()) return;

    const rawText = input.value;
    const lines = rawText.split('\n');
    const container = document.getElementById('planExercisesContainer');
    if (!container) return;

    container.innerHTML = ''; // Limpiar campos actuales

    const parsedItems = [];
    let currentExerciseName = '';
    let currentTarget = '';

    lines.forEach(line => {
      let trimmed = line.trim();

      // Ignorar separadores, links y notas explicativas
      if (!trimmed || trimmed.startsWith('───') || trimmed.startsWith('//') || trimmed.startsWith('────────────────────────────') || trimmed.startsWith('🔗') || trimmed.startsWith('📌') || trimmed.startsWith('🚫') || trimmed.startsWith('🌬️') || trimmed.startsWith('🔁')) {
        return;
      }

      // 1. SI ES UN EJERCICIO NUMERADO (ej: "1️⃣ ESTIRAMIENTO DE ADUCTORES 🦵")
      if (/^\d+[️⃣\.\)]/.test(trimmed)) {
        // Si ya teníamos un ejercicio armado antes, lo guardamos
        if (currentExerciseName) {
          parsedItems.push(currentTarget ? `${currentExerciseName} (${currentTarget})` : currentExerciseName);
        }

        // Limpiar el número y guardar el nuevo nombre
        currentExerciseName = trimmed.replace(/^\d+[️⃣\.\)]\s*/, '').replace(/^[^\w\sÁÉÍÓÚáéíóúÑñ]+/, '').trim();
        currentTarget = ''; // Resetear objetivo
        return;
      }

      // 2. SI ES UN ÍTEM CON VIÑETA • (ej: "• Flexiones: 3 series x 8-12 reps")
      if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
        let cleanBullet = trimmed.replace(/^[•\-\s]+/, '').trim();

        // Si no estamos dentro de un ejercicio numerado, es un ejercicio suelto
        if (!currentExerciseName) {
          parsedItems.push(cleanBullet);
        }
        return;
      }

      // 3. SI TIENE TIEMPO / REPETICIONES (ej: "⏱️ 12 a 15 repeticiones por pierna")
      if (trimmed.startsWith('⏱️') || trimmed.includes('repeticiones') || trimmed.includes('series') || trimmed.includes('Min')) {
        let cleanTarget = trimmed.replace(/^⏱️\s*/, '').trim();
        if (currentExerciseName) {
          currentTarget = cleanTarget;
        } else if (!parsedItems.includes(cleanTarget)) {
          // Si es una sección general como "⏱️ 20 Min | 🏡 En Casa"
          parsedItems.push(cleanTarget);
        }
      }
    });

    // Guardar el último ejercicio procesado
    if (currentExerciseName) {
      parsedItems.push(currentTarget ? `${currentExerciseName} (${currentTarget})` : currentExerciseName);
    }

    // Cargar los ítems limpios en los inputs de la interfaz
    parsedItems.forEach(itemText => {
      this.addExerciseRowToPlanModal('Ejercicio / Ítem', itemText);
    });

    // Ocultar la caja de texto y notificar
    this.togglePasteBox();
    if (window.App) App.showToast(`¡Se importaron ${parsedItems.length} ejercicios de forma limpia!`, 'success');
  },

  getItemPlaceholderByCategory(category) {
    switch (category) {
      case 'Ejercicio':
        return 'Ej: Press Banca (4 series x 10 repes)';
      case 'Estudio':
        return 'Ej: Módulo 1 / Vocabulario & Gramática (45 min)';
      case 'Hábito':
      case 'Lectura':
        return 'Ej: Cap. 1: El poder de los hábitos (Páginas 1-25)';
      default:
        return 'Ej: Tarea o Ítem medible';
    }
  },

  addExerciseRowToPlanModal(customPlaceholder = null, initialName = '', initialLink = '') {
    const container = document.getElementById('planExercisesContainer');
    if (!container) return;

    const placeholder = customPlaceholder || 'Ej: Ítem de la rutina';
    const row = document.createElement('div');
    row.className = 'plan-item-row';
    row.setAttribute('data-item-type', 'item');

    row.innerHTML = `
      <div class="form-row">
        <input type="text" class="form-input plan-item-name" value="${App.escapeHtml(initialName)}" placeholder="${placeholder}" style="flex: 1;" />
        <button type="button" class="btn btn-xs btn-danger-outline" onclick="this.closest('.plan-item-row').remove()">✕</button>
      </div>
      <input type="url" class="form-input plan-item-link" value="${App.escapeHtml(initialLink)}" placeholder="🔗 Link opcional (ej: TikTok / Youtube)" style="font-size: 0.75rem; padding: 4px 8px;" />
    `;
    container.appendChild(row);
  },

  handlePlanSubmit(e) {
    if (e) e.preventDefault();

    const actId = document.getElementById('planActivityId').value;
    const name = document.getElementById('planName').value.trim();

    const rows = document.querySelectorAll('#planExercisesContainer .plan-item-row');
    const items = [];

    rows.forEach(row => {
      const type = row.getAttribute('data-item-type');
      const nameVal = row.querySelector('.plan-item-name')?.value.trim();
      const linkVal = row.querySelector('.plan-item-link')?.value.trim();

      if (nameVal) {
        items.push({
          type,
          name: nameVal,
          link: linkVal || null
        });
      }
    });

    if (!name) {
      if (window.App) App.showToast('Ingresá el nombre del plan', 'error');
      return;
    }

    StorageManager.savePlan({
      id: this.currentPlanId || ('plan_' + Date.now()),
      activity_id: actId,
      name,
      items
    });

    const modal = document.getElementById('modalPlanForm');
    if (modal) modal.classList.remove('active');

    const activities = StorageManager.getActivities();
    const act = activities.find(a => a.id === actId);
    if (act) this.renderPlansForDetail(act);

    if (window.App) App.showToast('¡Plan guardado con éxito!', 'success');
  },

  // PARSER DE TEXTO PLANO CON SECCIONES Y LINKS
  processPastedText() {
    const input = document.getElementById('pasteBoxInput');
    if (!input || !input.value.trim()) return;

    const rawText = input.value;
    const lines = rawText.split('\n');
    const container = document.getElementById('planExercisesContainer');
    if (!container) return;

    container.innerHTML = ''; // Limpiar campos actuales

    let currentSectionLink = null;
    let currentExerciseName = '';
    let currentTarget = '';

    lines.forEach(line => {
      let trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('───') || trimmed.startsWith('//') || trimmed.startsWith('────────────────────────────') || trimmed.startsWith('📌') || trimmed.startsWith('🚫') || trimmed.startsWith('🌬️') || trimmed.startsWith('🔁')) {
        return;
      }

      // Si encuentra un Link en la sección
      if (trimmed.startsWith('🔗') || trimmed.includes('http://') || trimmed.includes('https://')) {
        const linkMatch = trimmed.match(/(https?:\/\/[^\s]+)/);
        if (linkMatch) {
          currentSectionLink = linkMatch[0];
        }
        return;
      }

      // 1. SI ES UNA CABECERA DE SECCIÓN (ej: "🏋️1. FUERZA" o "🏃‍♂️ 2. RESISTENCIA")
      if (trimmed.includes('FUERZA') || trimmed.includes('RESISTENCIA') || trimmed.includes('FLEXIBILIDAD')) {
        if (currentExerciseName) {
          this.addExerciseRowToPlanModal('Ejercicio', currentTarget ? `${currentExerciseName} (${currentTarget})` : currentExerciseName);
          currentExerciseName = '';
          currentTarget = '';
        }
        const sectionName = trimmed.replace(/^[^\w\sÁÉÍÓÚáéíóúÑñ]+/, '').trim();
        this.addSectionRowToPlanModal(sectionName, currentSectionLink);
        currentSectionLink = null;
        return;
      }

      // 2. SI ES UN EJERCICIO NUMERADO (ej: "1️⃣ ESTIRAMIENTO DE ADUCTORES 🦵")
      if (/^\d+[️⃣\.\)]/.test(trimmed)) {
        if (currentExerciseName) {
          this.addExerciseRowToPlanModal('Ejercicio', currentTarget ? `${currentExerciseName} (${currentTarget})` : currentExerciseName);
        }
        currentExerciseName = trimmed.replace(/^\d+[️⃣\.\)]\s*/, '').replace(/^[^\w\sÁÉÍÓÚáéíóúÑñ]+/, '').trim();
        currentTarget = '';
        return;
      }

      // 3. SI ES UN ÍTEM CON VIÑETA •
      if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
        let cleanBullet = trimmed.replace(/^[•\-\s]+/, '').trim();
        if (!currentExerciseName) {
          this.addExerciseRowToPlanModal('Ejercicio', cleanBullet);
        }
        return;
      }

      // 4. SI TIENE REPETICIONES / TIEMPO
      if (trimmed.startsWith('⏱️') || trimmed.includes('repeticiones') || trimmed.includes('series')) {
        let cleanTarget = trimmed.replace(/^⏱️\s*/, '').trim();
        if (currentExerciseName) {
          currentTarget = cleanTarget;
        }
      }
    });

    if (currentExerciseName) {
      this.addExerciseRowToPlanModal('Ejercicio', currentTarget ? `${currentExerciseName} (${currentTarget})` : currentExerciseName);
    }

    this.togglePasteBox();
    if (window.App) App.showToast('¡Rutina importada con Secciones y Links!', 'success');
  },

  // INICIAR SESIÓN DESDE HOME ("▶ Hacer ahora") O DESDE LA ACTIVIDAD
  startSessionForActivity(activityId) {
    this.currentActivityId = activityId;
    const editIdEl = document.getElementById('editingSessionId');
    if (editIdEl) editIdEl.value = ''; // Reset ID de edición

    const activities = StorageManager.getActivities();
    const act = activities.find(a => a.id === activityId);
    if (!act) return;

    const defaultIconHtml = `<img src="assets/logo-perci-grafico.svg" alt="Percí" style="width:20px; height:20px; vertical-align:middle;" />`;

    document.getElementById('sessionActivityId').value = act.id;
    document.getElementById('sessionLoggerTitle').innerText = `${act.icon || '⚡'} Registrar ${act.name}`;

    const now = new Date();
    document.getElementById('sessionDate').value = StorageManager.getTodayDateString(now);
    document.getElementById('sessionTime').value = now.toTimeString().substring(0, 5);

    // Cargar Planes asociados si existen
    const plans = StorageManager.getPlansByActivity(act.id);
    const planSelectGroup = document.getElementById('sessionPlanSelectGroup');
    const planSelect = document.getElementById('sessionPlanSelect');

    if (plans.length > 0) {
      planSelectGroup.style.display = 'block';
      planSelect.innerHTML = plans.map(p => `<option value="${p.id}">${App.escapeHtml(p.name)}</option>`).join('');
      // Cargar ejercicios del primer plan por defecto
      this.renderSessionMetricsForPlan(plans[0], act);
    } else {
      planSelectGroup.style.display = 'none';
      this.renderSessionMetricsGeneric(act);
    }

    const modal = document.getElementById('modalSessionLogger');
    if (modal) modal.classList.add('active');
  },

  // CAMBIO DE PLAN EN EL REGISTRO DE SESIÓN
  onSessionPlanChange(planId) {
    const plans = StorageManager.getPlans();
    const plan = plans.find(p => p.id === planId);
    const activities = StorageManager.getActivities();
    const act = activities.find(a => a.id === this.currentActivityId);

    if (plan && act) {
      this.renderSessionMetricsForPlan(plan, act);
    }
  },

// RENDERIZAR EJERCICIOS DEL PLAN CON OPCIÓN DE OMITIR SECCIÓN COMPLETA O EJERCICIO
  renderSessionMetricsForPlan(plan, act) {
    const container = document.getElementById('sessionMetricsContainer');
    if (!container) return;

    const items = plan.items || [];
    if (items.length === 0) {
      this.renderSessionMetricsGeneric(act);
      return;
    }

    let html = '';
    let currentSectionId = null;

    items.forEach((item, idx) => {
      const itemName = (typeof item === 'object') ? item.name : item;
      const isSection = (typeof item === 'object' && item.type === 'section');

      if (isSection) {
        currentSectionId = `section_block_${idx}`;
        html += `
          <div class="plan-section-header flex-between" style="margin-top:14px; margin-bottom:8px; padding: 6px 10px; background: rgba(0, 242, 254, 0.08); border-left: 3px solid var(--accent-cyan); border-radius: var(--radius-sm);">
            <span style="font-weight:700; color:var(--accent-cyan); font-size:0.85rem;">📁 ${App.escapeHtml(itemName)}</span>
            <label style="font-size: 0.72rem; color: var(--accent-cyan); cursor: pointer; display: flex; align-items: center; gap: 4px; font-weight: 600;">
              <input type="checkbox" checked onchange="ActivitiesModule.toggleSectionGroup('${currentSectionId}', this.checked)" />
              Sección Realizada
            </label>
          </div>
        `;
        return;
      }

      const lowerName = itemName.toLowerCase();
      const cardId = `ex_card_${idx}`;
      const sectionClass = currentSectionId ? currentSectionId : 'no_section';

      // ES CARDIO / RESISTENCIA
      if (lowerName.includes('cardio') || lowerName.includes('correr') || lowerName.includes('resistencia') || lowerName.includes('trote') || lowerName.includes('bici')) {
        html += `
          <div class="card workout-ex-input-card ${sectionClass}" id="${cardId}" style="padding: 10px; margin-bottom: 8px; background: rgba(0, 242, 254, 0.04);">
            <div class="flex-between" style="margin-bottom: 6px;">
              <span style="font-size: 0.85rem; font-weight: 700;">🏃‍♂️ ${App.escapeHtml(itemName)}</span>
              <label style="font-size: 0.72rem; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <input type="checkbox" class="ex-item-checkbox" checked onchange="ActivitiesModule.toggleExerciseRow('${cardId}', this.checked)" />
                Realizado
              </label>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label style="font-size:0.75rem;">Tiempo (min)</label>
                <input type="number" class="form-input metric-duration" data-ex-name="${App.escapeHtml(itemName)}" placeholder="Ej: 30" />
              </div>
              <div class="form-group" style="flex: 1;">
                <label style="font-size:0.75rem;">Distancia (km)</label>
                <input type="number" step="0.1" class="form-input metric-distance" data-ex-name="${App.escapeHtml(itemName)}" placeholder="Ej: 5.0" />
              </div>
              <div class="form-group" style="flex: 1.2;">
                <label style="font-size:0.75rem;">Modo</label>
                <select class="form-select metric-mode" data-ex-name="${App.escapeHtml(itemName)}" style="padding: 8px;">
                  <option value="Trote Suave">Trote Suave</option>
                  <option value="Ritmo Constante">Ritmo Constante</option>
                  <option value="Caminata">Caminata / Recup.</option>
                  <option value="Intervalos / Hiit">Intervalos</option>
                </select>
              </div>
            </div>
          </div>
        `;
      } 
      // ES FUERZA / OTROS
      else {
        html += `
          <div class="card workout-ex-input-card ${sectionClass}" id="${cardId}" style="padding: 10px; margin-bottom: 8px;">
            <div class="flex-between" style="margin-bottom: 6px;">
              <span style="font-size: 0.85rem; font-weight: 700;">🏋️ ${App.escapeHtml(itemName)}</span>
              <label style="font-size: 0.72rem; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <input type="checkbox" class="ex-item-checkbox" checked onchange="ActivitiesModule.toggleExerciseRow('${cardId}', this.checked)" />
                Realizado
              </label>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label style="font-size:0.75rem;">Series</label>
                <input type="number" class="form-input metric-sets" data-ex-name="${App.escapeHtml(itemName)}" placeholder="Ej: 3" value="3" />
              </div>
              <div class="form-group" style="flex: 1;">
                <label style="font-size:0.75rem;">Repeticiones</label>
                <input type="text" class="form-input metric-reps" data-ex-name="${App.escapeHtml(itemName)}" placeholder="Ej: 10-12 / fallo" />
              </div>
              <div class="form-group" style="flex: 1;">
                <label style="font-size:0.75rem;">Peso (kg - opcional)</label>
                <input type="number" step="0.5" class="form-input metric-weight" data-ex-name="${App.escapeHtml(itemName)}" placeholder="0" />
              </div>
            </div>
          </div>
        `;
      }
    });

    container.innerHTML = html;
  },

  // TOGGLE PARA HABILITAR O DESHABILITAR UNA SECCIÓN COMPLETA
  toggleSectionGroup(sectionId, isChecked) {
    const cards = document.querySelectorAll(`.${sectionId}`);
    cards.forEach(card => {
      const checkbox = card.querySelector('.ex-item-checkbox');
      if (checkbox) {
        checkbox.checked = isChecked;
        this.toggleExerciseRow(card.id, isChecked);
      }
    });
  },

  // TOGGLE PARA ATENUAR / DESHABILITAR FILAS OMITIDAS
  toggleExerciseRow(cardId, isChecked) {
    const card = document.getElementById(cardId);
    if (!card) return;

    if (isChecked) {
      card.classList.remove('is-dimmed');
      card.querySelectorAll('input, select').forEach(el => {
        if (el.type !== 'checkbox') el.disabled = false;
      });
    } else {
      card.classList.add('is-dimmed');
      card.querySelectorAll('input, select').forEach(el => {
        if (el.type !== 'checkbox') el.disabled = true;
      });
    }
  },

  // RENDERIZAR MÉTRICAS GENÉRICAS SI NO HAY PLAN DEFINIDO
  renderSessionMetricsGeneric(act) {
    const container = document.getElementById('sessionMetricsContainer');
    if (!container) return;

    if (act.category === 'Ejercicio') {
      container.innerHTML = `
        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label>Duración Total (min)</label>
            <input type="number" id="genericDuration" class="form-input" placeholder="45" value="45" />
          </div>
          <div class="form-group" style="flex: 1;">
            <label>Km Recorridos (si aplica)</label>
            <input type="number" step="0.1" id="genericKm" class="form-input" placeholder="5.0" />
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label>Tiempo Invertido (min)</label>
            <input type="number" id="genericDuration" class="form-input" placeholder="60" value="60" />
          </div>
          <div class="form-group" style="flex: 1;">
            <label>Avance (Módulo / Páginas)</label>
            <input type="text" id="genericUnits" class="form-input" placeholder="Ej: Cap 2 / Pág 15-30" />
          </div>
        </div>
      `;
    }
  },

  // GUARDAR SESIÓN
  // GUARDAR SESIÓN (CON SOPORTE PARA OMITIR ÍTEMS Y DESHABILITAR CLIC EXTERNO)
  handleSessionSubmit(e) {
    if (e) e.preventDefault();

    const activityId = document.getElementById('sessionActivityId').value;
    const date = document.getElementById('sessionDate').value;
    const time = document.getElementById('sessionTime').value;
    const energy = document.getElementById('sessionEnergy').value;
    const difficulty = document.getElementById('sessionDifficulty').value;
    const notes = document.getElementById('sessionNotes').value;

    if (!date) {
      if (window.App) App.showToast('Por favor, selecciona una fecha válida', 'error');
      return;
    }

    // 1. Recolectar métricas detalladas omitiendo los inputs deshabilitados (omitidos)
    const metrics = [];

    // Ejercicios de Fuerza / Musculación activos
    const setsInputs = document.querySelectorAll('.metric-sets:not([disabled])');
    setsInputs.forEach(input => {
      const exName = input.getAttribute('data-ex-name');
      const repsEl = document.querySelector(`.metric-reps[data-ex-name="${exName}"]`);
      const weightEl = document.querySelector(`.metric-weight[data-ex-name="${exName}"]`);

      metrics.push({
        exercise_name: exName,
        sets: parseInt(input.value, 10) || 0,
        reps: repsEl ? repsEl.value : '',
        weight: weightEl ? (parseFloat(weightEl.value) || 0) : 0
      });
    });

    // Ejercicios de Cardio / Resistencia activos
    const cardioInputs = document.querySelectorAll('.metric-duration:not([disabled])');
    cardioInputs.forEach(input => {
      const exName = input.getAttribute('data-ex-name');
      const distEl = document.querySelector(`.metric-distance[data-ex-name="${exName}"]`);
      const modeEl = document.querySelector(`.metric-mode[data-ex-name="${exName}"]`);

      metrics.push({
        exercise_name: exName,
        duration: parseInt(input.value, 10) || 0,
        distance_km: distEl ? (parseFloat(distEl.value) || 0) : 0,
        mode: modeEl ? modeEl.value : ''
      });
    });

    // Métricas genéricas (si no había un plan específico)
    const genericDuration = document.getElementById('genericDuration');
    const genericKm = document.getElementById('genericKm');
    const genericUnits = document.getElementById('genericUnits');

    if (metrics.length === 0 && (genericDuration || genericUnits || genericKm)) {
      metrics.push({
        duration: genericDuration ? (parseInt(genericDuration.value, 10) || 0) : 0,
        distance_km: genericKm ? (parseFloat(genericKm.value) || 0) : 0,
        units: genericUnits ? genericUnits.value : ''
      });
    }

    // 2. Determinar si es una EDICIÓN (mantiene ID existente) o NUEVA SESIÓN
    const editingId = document.getElementById('editingSessionId')?.value;
    const sessionId = (editingId && editingId.trim() !== '') ? editingId : ('sess_' + Date.now());

    // 3. Guardar una ÚNICA vez en el StorageManager
    StorageManager.saveSession({
      id: sessionId,
      activity_id: activityId,
      date,
      time,
      energy: parseInt(energy, 10),
      difficulty: parseInt(difficulty, 10),
      notes,
      metrics
    });

    // Resetear el campo oculto de edición
    const editIdEl = document.getElementById('editingSessionId');
    if (editIdEl) editIdEl.value = '';

    // Cerrar el modal
    const modal = document.getElementById('modalSessionLogger');
    if (modal) modal.classList.remove('active');

    // Refrescar todas las pantallas (Home, Calendario, Analytics)
    if (window.App) App.refreshAllViews();

    if (window.App) {
      App.showToast(editingId ? '¡Sesión actualizada correctamente!' : '¡Sesión registrada exitosamente!', 'success');
    }
  }
  
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.ActivitiesModule) {
    window.ActivitiesModule.init();
  }
});