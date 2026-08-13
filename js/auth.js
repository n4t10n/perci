/**
 * Percí v2 - Fullscreen Authentication & Session State Manager (Supabase Integrated)
 */

window.AuthModule = {
  isRegisterMode: false,

  async init() {
    // Escuchar cambios de estado en Supabase (Login / Logout / Auto Refresh)
    if (window.supabase) {
      window.supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
          localStorage.setItem('perci_session_v2', JSON.stringify(session.user));
          await StorageManager.syncFromSupabase();
        } else {
          localStorage.removeItem('perci_session_v2');
          StorageManager.clearMemoryCache();
        }
        this.checkSession();
      });
    }

    await this.checkSession();
  },

  // VERIFICAR Y CONTROLAR VISIBILIDAD TOTAL DE LA APP
  async checkSession() {
    let activeUser = this.getCurrentUser();

    // Intentar obtener sesión activa de Supabase si existe
    if (!activeUser && window.supabase) {
      const { data: { session } } = await window.supabase.auth.getSession();
      if (session && session.user) {
        activeUser = session.user;
        localStorage.setItem('perci_session_v2', JSON.stringify(activeUser));
        await StorageManager.syncFromSupabase();
      }
    }

    const authScreen = document.getElementById('authScreen');
    const appFrame = document.querySelector('.mobile-app-frame');

    if (activeUser) {
      if (authScreen) authScreen.style.display = 'none';
      if (appFrame) appFrame.style.display = 'flex';

      this.updateProfileName(activeUser);

      // Refrescar vistas con los datos cargados desde la nube
      if (window.App && typeof window.App.refreshAllViews === 'function') {
        window.App.refreshAllViews();
      }
    } else {
      if (authScreen) authScreen.style.display = 'flex';
      if (appFrame) appFrame.style.display = 'none';
    }
  },

  // ALTERNAR ENTRE INICIAR SESIÓN Y CREAR CUENTA
  toggleMode(e) {
    if (e) e.preventDefault();
    this.isRegisterMode = !this.isRegisterMode;

    const nameGroup = document.getElementById('authNameGroup');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleText = document.getElementById('authToggleText');
    const toggleLink = document.getElementById('authToggleLink');
    const subtitle = document.getElementById('authSubtitle');
    const passHelp = document.getElementById('passwordHelpText');
    const errorBox = document.getElementById('authErrorMessage');

    if (errorBox) errorBox.style.display = 'none';

    if (this.isRegisterMode) {
      if (nameGroup) nameGroup.style.display = 'block';
      if (submitBtn) submitBtn.innerText = 'Crear Cuenta';
      if (toggleText) toggleText.innerText = '¿Ya tenés cuenta?';
      if (toggleLink) toggleLink.innerText = 'Iniciar Sesión';
      if (subtitle) subtitle.innerText = 'Registrate para guardar tus entrenamientos y hábitos';
      if (passHelp) passHelp.style.display = 'block';
    } else {
      if (nameGroup) nameGroup.style.display = 'none';
      if (submitBtn) submitBtn.innerText = 'Iniciar Sesión';
      if (toggleText) toggleText.innerText = '¿No tenés cuenta?';
      if (toggleLink) toggleLink.innerText = 'Crear Cuenta';
      if (subtitle) subtitle.innerText = 'Iniciá sesión para sincronizar tu progreso';
      if (passHelp) passHelp.style.display = 'none';
    }
  },

  // TRADUCIR ERRORES COMUNES DE SUPABASE AL ESPAÑOL
      translateAuthError(error) {
    const msg = error.message || '';
    if (msg.includes('Email not confirmed')) return 'El email/usuario aún no ha sido confirmado en el sistema.';
    if (msg.includes('Password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
    if (msg.includes('User already registered')) return 'Ya existe una cuenta registrada con este email/usuario.';
    if (msg.includes('Invalid login credentials')) return 'Usuario o contraseña incorrectos.';
    if (msg.includes('Unable to validate email address')) return 'Ingresá un formato de email válido.';
    return msg || 'Ocurrió un error de autenticación.';
  },

  // MANEJO DE REGISTRO E INICIO DE SESIÓN
  async handleSubmit(e) {
    if (e) e.preventDefault();

    const errorBox = document.getElementById('authErrorMessage');
    if (errorBox) errorBox.style.display = 'none';

    const emailRaw = document.getElementById('authEmail')?.value.trim().toLowerCase();
    const passwordInput = document.getElementById('authPassword')?.value.trim();
    const nameInput = document.getElementById('authName')?.value.trim();

    if (!emailRaw || !passwordInput) {
      this.showError('Ingresá email/usuario y contraseña');
      return;
    }

    if (this.isRegisterMode && passwordInput.length < 6) {
      this.showError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    const emailInput = emailRaw.includes('@') ? emailRaw : `${emailRaw}@perci.app`;

    try {
      if (this.isRegisterMode) {
        const { data, error } = await window.supabase.auth.signUp({
          email: emailInput,
          password: passwordInput,
          options: {
            data: { display_name: nameInput || emailInput.split('@')[0] }
          }
        });

        if (error) throw error;

        const user = data.user;
        if (user) {
          localStorage.setItem('perci_session_v2', JSON.stringify(user));
          await StorageManager.syncFromSupabase();
          if (window.App) App.showToast(`¡Bienvenido/a, ${nameInput || user.email.split('@')[0]}!`, 'success');
          this.checkSession();
        }
      } else {
        const { data, error } = await window.supabase.auth.signInWithPassword({
          email: emailInput,
          password: passwordInput
        });

        if (error) throw error;

        const user = data.user;
        if (user) {
          localStorage.setItem('perci_session_v2', JSON.stringify(user));
          await StorageManager.syncFromSupabase();
          if (window.App) App.showToast(`¡Hola de nuevo!`, 'success');
          this.checkSession();
        }
      }
    } catch (err) {
      console.error('Error Auth:', err);
      const friendlyMsg = this.translateAuthError(err);
      this.showError(friendlyMsg);
    }
  },

  showError(msg) {
    const errorBox = document.getElementById('authErrorMessage');
    if (errorBox) {
      errorBox.innerText = msg;
      errorBox.style.display = 'block';
    } else if (window.App) {
      App.showToast(msg, 'error');
    }
  },

  // OBTENER USUARIO LOGUEADO DE STORAGE
  getCurrentUser() {
    const session = localStorage.getItem('perci_session_v2');
    return session ? JSON.parse(session) : null;
  },

  // CERRAR SESIÓN DE FORMA DEFINITIVA
async logout() {
    if (confirm('¿Seguro que querés cerrar sesión?')) {
      if (window.supabase && typeof window.supabase.auth?.signOut === 'function') {
        await window.supabase.auth.signOut();
      }
      localStorage.removeItem('perci_session_v2');
      if (window.StorageManager) StorageManager.clearMemoryCache();
      this.checkSession();
    }
  },

  // ACTUALIZAR SALUDO EN LA HOME
  updateProfileName(user) {
    const greeting = document.getElementById('homeGreeting');
    const name = user.user_metadata?.display_name || user.email?.split('@')[0] || user.name || 'Valen';
    if (greeting) greeting.innerText = `Hola ${name} 👋`;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.AuthModule) window.AuthModule.init();
});