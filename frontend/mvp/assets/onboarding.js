document.addEventListener('DOMContentLoaded', async () => {
  const steps = ['preferences', 'account', 'budget', 'entry'];
  const notice = document.getElementById('onboarding-message');
  let step = 0;
  let accountId = null;
  let categories = [];
  let currentUser = null;
  function show(index) {
    step = index;
    steps.forEach((name, i) => { document.getElementById('step-' + name).hidden = i !== index; });
    document.getElementById('step-count').textContent = `STEP ${index + 1} OF 4`;
    document.getElementById('progress-fill').style.width = `${(index + 1) * 25}%`;
    FW.message(notice, '');
  }
  function fillCategories() {
    const budget = document.getElementById('budget-category');
    const first = document.getElementById('first-category');
    budget.replaceChildren(); first.replaceChildren();
    for (const category of categories) {
      if (category.kind === 'expense') budget.add(new Option(category.name, category.id));
    }
    selectEntryCategories();
  }
  function selectEntryCategories() {
    const first = document.getElementById('first-category');
    const kind = document.getElementById('first-kind').value;
    first.replaceChildren();
    for (const category of categories.filter(item => item.kind === kind)) first.add(new Option(category.name, category.id));
  }
  try {
    currentUser = await FW.api('/me');
    if (currentUser.is_demo) return location.replace('/app');
    const accounts = await FW.api('/accounts');
    if (accounts.length) return location.replace('/app');
  } catch (_) { return location.replace('/login'); }
  document.getElementById('first-kind').addEventListener('change', selectEntryCategories);
  document.getElementById('preferences-form').addEventListener('submit', async event => {
    event.preventDefault();
    try { currentUser = await FW.api('/me/preferences', {method:'PATCH', body:FW.fieldData(event.currentTarget)}); show(1); }
    catch (err) { FW.message(notice, err.message); }
  });
  document.getElementById('account-form').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const account = await FW.api('/accounts', {method:'POST', body:FW.fieldData(event.currentTarget)});
      accountId = account.id;
      categories = await FW.api('/categories');
      fillCategories(); show(2);
    } catch (err) { FW.message(notice, err.message); }
  });
  document.getElementById('budget-form').addEventListener('submit', async event => {
    event.preventDefault();
    const data = FW.fieldData(event.currentTarget);
    data.month = FW.localDate(currentUser.timezone).slice(0,7) + '-01';
    try { await FW.api('/budgets', {method:'POST', body:data}); show(3); }
    catch (err) { FW.message(notice, err.message); }
  });
  document.getElementById('entry-form').addEventListener('submit', async event => {
    event.preventDefault();
    const data = FW.fieldData(event.currentTarget);
    data.account_id = accountId; data.occurred_on = FW.localDate(currentUser.timezone);
    try { await FW.api('/transactions', {method:'POST', body:data, headers:{'Idempotency-Key':crypto.randomUUID()}}); location.assign('/app'); }
    catch (err) { FW.message(notice, err.message); }
  });
  document.querySelectorAll('.skip-step').forEach(button => button.addEventListener('click', () => {
    if (step === 2) show(3); else location.assign('/app');
  }));
});
