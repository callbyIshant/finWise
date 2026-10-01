document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, redirect
  if (localStorage.getItem('finwise_token')) {
    window.location.href = 'dashboard.html';
  }

  // Tabs
  const loginTab = document.getElementById('tab-login');
  const registerTab = document.getElementById('tab-register');
  const loginForm = document.getElementById('form-login');
  const registerForm = document.getElementById('form-register');
  const registerLink = document.getElementById('link-register');

  function showLogin() {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
  }

  function showRegister() {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.add('active');
    loginForm.classList.remove('active');
  }

  loginTab.addEventListener('click', showLogin);
  registerTab.addEventListener('click', showRegister);
  if(registerLink) registerLink.addEventListener('click', (e) => {
    e.preventDefault();
    showRegister();
  });

  // Password Strength
  const regPassword = document.getElementById('reg-password');
  const strengthBars = document.querySelectorAll('.password-strength div');
  
  if(regPassword) regPassword.addEventListener('input', (e) => {
    const val = e.target.value;
    let strength = 0;
    if (val.length > 5) strength++;
    if (val.match(/[A-Z]/)) strength++;
    if (val.match(/[0-9]/)) strength++;
    if (val.match(/[^A-Za-z0-9]/)) strength++;

    strengthBars.forEach((bar, index) => {
      if (index < strength) {
        if (strength <= 2) bar.style.backgroundColor = 'var(--color-danger)';
        else if (strength === 3) bar.style.backgroundColor = 'var(--color-warning)';
        else bar.style.backgroundColor = 'var(--color-accent)';
      } else {
        bar.style.backgroundColor = 'var(--color-border)';
      }
    });
  });

  // Login Submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector('button[type="submit"]');
    const errorMsg = document.getElementById('login-error');
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';
    errorMsg.classList.remove('active');

    try {
      const res = await apiLogin(email, password);
      localStorage.setItem('finwise_token', res.access_token);
      
      const user = await apiGetMe();
      localStorage.setItem('finwise_user', JSON.stringify(user));
      
      window.location.href = 'dashboard.html';
    } catch (err) {
      errorMsg.textContent = err.message;
      errorMsg.classList.add('active');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  // Register Submit
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = registerForm.querySelector('button[type="submit"]');
    const errorMsg = document.getElementById('reg-error');
    
    const fullName = document.getElementById('reg-fullname').value;
    const email = document.getElementById('reg-email').value;
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    if (password !== confirmPassword) {
      errorMsg.textContent = 'Passwords do not match';
      errorMsg.classList.add('active');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';
    errorMsg.classList.remove('active');

    try {
      await apiRegister(email, username, fullName, password);
      // Auto login
      const res = await apiLogin(email, password);
      localStorage.setItem('finwise_token', res.access_token);
      
      const user = await apiGetMe();
      localStorage.setItem('finwise_user', JSON.stringify(user));
      
      window.location.href = 'dashboard.html';
    } catch (err) {
      errorMsg.textContent = err.message;
      errorMsg.classList.add('active');
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
});
