document.addEventListener('DOMContentLoaded', async () => {
  const loginTab = document.getElementById('login-tab');
  const registerTab = document.getElementById('register-tab');
  const loginPanel = document.getElementById('login-panel');
  const registerPanel = document.getElementById('register-panel');
  const notice = document.getElementById('auth-message');
  function show(mode) {
    const register = mode === 'register';
    loginPanel.hidden = register;
    registerPanel.hidden = !register;
    loginTab.setAttribute('aria-selected', String(!register));
    registerTab.setAttribute('aria-selected', String(register));
    FW.message(notice, '');
  }
  loginTab.addEventListener('click', () => show('login'));
  registerTab.addEventListener('click', () => show('register'));
  show(new URLSearchParams(location.search).get('mode'));
  try { await FW.api('/me'); location.replace('/app'); } catch (_) {}
  for (const [id, endpoint, next] of [
    ['login-form', '/auth/login', '/app'], ['register-form', '/auth/register', '/onboarding']
  ]) {
    document.getElementById(id).addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      FW.message(notice, '');
      try {
        await FW.api(endpoint, {method: 'POST', body: FW.fieldData(form)});
        location.assign(next);
      } catch (err) {
        FW.message(notice, err.message);
        button.disabled = false;
      }
    });
  }
});
