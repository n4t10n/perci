/**
 * Percí v2 - Fullscreen Authentication & Session State Manager
 */

window.AuthModule = {
  isRegisterMode: false,

  init() {
    this.checkSession();
  },

  // VERIFICAR Y CONTROLAR VISIBILIDAD TOTAL DE LA APP
  checkSession() {
    const activeUser = this.getCurrentUser();
    const authScreen = document.getElementById('authScreen');
    const appFrame = document.querySelector('.mobile-app-frame');

    if (activeUser) {
      if (authScreen) authScreen.style.display = 'none';
      if (appFrame) appFrame.style.display = 'flex';

      this.updateProfileName(activeUser);

      // Refrescar vistas con los datos limpios del nuevo usuario
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

    if (this.isRegisterMode) {
      if (nameGroup) nameGroup.style.display = 'block';
      if (submitBtn) submitBtn.innerText = 'Crear Cuenta';
      if (toggleText) toggleText.innerText = '¿Ya tenés cuenta?';
      if (toggleLink) toggleLink.innerText = 'Iniciar Sesión';
      if (subtitle) subtitle.innerText = 'Registrate para guardar tus entrenamientos y hábitos';
    } else {
      if (nameGroup) nameGroup.style.display = 'none';
      if (submitBtn) submitBtn.innerText = 'Iniciar Sesión';
      if (toggleText) toggleText.innerText = '¿No tenés cuenta?';
      if (toggleLink) toggleLink.innerText = 'Crear Cuenta';
      if (subtitle) subtitle.innerText = 'Iniciá sesión para sincronizar tu progreso';
    }
  },

  // MANEJO DE REGISTRO E INICIO DE SESIÓN
  handleSubmit(e) {
    if (e) e.preventDefault();

    const emailInput = document.getElementById('authEmail')?.value.trim().toLowerCase();
    const passwordInput = document.getElementById('authPassword')?.value.trim();
    const nameInput = document.getElementById('authName')?.value.trim();

    if (!emailInput || !passwordInput) {
      if (window.App) App.showToast('Ingresá email/usuario y contraseña', 'error');
      return;
    }

    const users = JSON.parse(localStorage.getItem('perci_users_v2') || '[]');

    if (this.isRegisterMode) {
      // Crear Cuenta
      if (users.some(u => u.email === emailInput)) {
        if (window.App) App.showToast('El usuario/email ya existe', 'error');
        return;
      }

      const newUser = {
        id: 'usr_' + Date.now(),
        name: nameInput || emailInput.split('@')[0],
        email: emailInput,
        password: passwordInput
      };

      users.push(newUser);
      localStorage.setItem('perci_users_v2', JSON.stringify(users));
      localStorage.setItem('perci_session_v2', JSON.stringify(newUser));

      if (window.App) App.showToast(`¡Bienvenido/a, ${newUser.name}!`, 'success');
      this.checkSession();
    } else {
      // Iniciar Sesión
      const user = users.find(u => u.email === emailInput && u.password === passwordInput);

      if (!user) {
        if (window.App) App.showToast('Usuario o contraseña incorrectos', 'error');
        return;
      }

      localStorage.setItem('perci_session_v2', JSON.stringify(user));
      if (window.App) App.showToast(`¡Hola de nuevo, ${user.name}!`, 'success');
      this.checkSession();
    }
  },

  // OBTENER USUARIO LOGUEADO DE STORAGE
  getCurrentUser() {
    const session = localStorage.getItem('perci_session_v2');
    return session ? JSON.parse(session) : null;
  },

  // CERRAR SESIÓN DE FORMA DEFINITIVA
  logout() {
    if (confirm('¿Seguro que querés cerrar sesión?')) {
      localStorage.removeItem('perci_session_v2');
      this.checkSession();
    }
  },

  // ACTUALIZAR SALUDO EN LA HOME
  updateProfileName(user) {
    const greeting = document.getElementById('homeGreeting');
    if (greeting) greeting.innerText = `Hola ${user.name} 👋`;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.AuthModule) window.AuthModule.init();
});