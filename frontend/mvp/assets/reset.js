document.addEventListener('DOMContentLoaded', () => {
  const token = new URLSearchParams(location.search).get('token');
  const requestForm = document.getElementById('request-form');
  const confirmForm = document.getElementById('confirm-form');
  const notice = document.getElementById('reset-message');
  if (token) {
    requestForm.hidden = true;
    confirmForm.hidden = false;
    document.getElementById('reset-intro').textContent = 'Choose a new password with at least 12 characters.';
  }
  requestForm.addEventListener('submit', async event => {
    event.preventDefault();
    try { const result = await FW.api('/auth/password-reset/request', {method: 'POST', body: FW.fieldData(requestForm)}); FW.message(notice, result.message, true); }
    catch (err) { FW.message(notice, err.message); }
  });
  confirmForm.addEventListener('submit', async event => {
    event.preventDefault();
    try { await FW.api('/auth/password-reset/confirm', {method: 'POST', body: {token, ...FW.fieldData(confirmForm)}}); history.replaceState(null, '', '/reset'); FW.message(notice, 'Password updated. You can log in now.', true); confirmForm.hidden = true; }
    catch (err) { FW.message(notice, err.message); }
  });
});
