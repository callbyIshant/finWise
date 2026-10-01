document.addEventListener('DOMContentLoaded', () => {
  const error = document.getElementById('demo-error');
  async function startDemo(event) {
    const button = event.currentTarget;
    button.disabled = true;
    FW.message(error, 'Preparing your private demo…', true);
    try {
      await FW.api('/demo/session', {method: 'POST'});
      window.location.assign('/app');
    } catch (err) {
      FW.message(error, err.message);
      button.disabled = false;
    }
  }
  document.getElementById('try-demo').addEventListener('click', startDemo);
  document.getElementById('try-demo-bottom').addEventListener('click', startDemo);
});
