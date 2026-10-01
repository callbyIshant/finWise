document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const state = {me:null, accounts:[], categories:[], dashboard:null, budgets:[], transactions:null, view:'overview', page:1, editingEntry:null, editingBudget:null, entryKey:null};
  const notice = $('app-message');
  const make = FW.node;
  const amount = value => FW.money(value, state.me.currency);
  const error = err => FW.message(notice, err.message || String(err));
  const success = text => FW.message(notice, text, true);
  function option(select, label, value) { select.add(new Option(label, value)); }
  function setSelect(select, rows, label = row => row.name) { select.replaceChildren(); rows.forEach(row => option(select, label(row), row.id)); }
  function messageLine(text) { return make('p', 'muted-line', text); }
  function showView(view) {
    state.view = view;
    document.querySelectorAll('.app-view').forEach(section => { section.hidden = section.id !== 'view-' + view; });
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
    $('page-heading').textContent = view === 'overview' ? 'Overview' : view[0].toUpperCase() + view.slice(1);
    FW.message(notice, '');
    if (view === 'transactions') loadTransactions();
    if (view === 'budgets') loadBudgets();
  }
  async function reloadBase() {
    [state.accounts, state.categories, state.dashboard] = await Promise.all([
      FW.api('/accounts'), FW.api('/categories'), FW.api('/dashboard')
    ]);
    renderOverview(); renderAccounts(); renderCustomCategories();
    const active = state.accounts.filter(account => !account.archived);
    setSelect($('entry-account'), active);
    const previousFilter = $('filter-account').value;
    $('filter-account').replaceChildren(new Option('All accounts', ''));
    state.accounts.forEach(account => option($('filter-account'), account.name, account.id));
    $('filter-account').value = previousFilter;
    setSelect($('budget-category'), state.categories.filter(category => category.kind === 'expense'));
    updateEntryCategories();
  }
  function renderOverview() {
    const data = state.dashboard;
    $('empty-state').hidden = !data.empty;
    $('overview-data').hidden = data.empty;
    $('greeting').textContent = `Hello, ${state.me.full_name.split(' ')[0]}.`;
    $('total-balance').textContent = amount(data.total_balance);
    $('income-total').textContent = amount(data.income);
    $('expense-total').textContent = amount(data.expenses);
    $('net-total').textContent = amount(data.net_cash_flow);
    $('spending-month').textContent = data.month;
    const chart = $('spending-chart'); chart.replaceChildren();
    const max = Math.max(0, ...data.spending.map(item => Number(item.amount)));
    if (!data.spending.length) chart.append(messageLine('No expenses this month yet.'));
    for (const item of data.spending) {
      const row = make('div','spending-row'); row.append(make('span','',item.category_name));
      const track = make('div','spending-track'); const fill = make('span'); fill.style.width = `${max ? Math.max(3, Number(item.amount)/max*100) : 0}%`; track.append(fill); row.append(track);
      row.append(make('strong','',amount(item.amount))); chart.append(row);
    }
    const budgets = $('overview-budgets'); budgets.replaceChildren();
    if (!data.budgets.length) budgets.append(messageLine('Set a budget to see your plan here.'));
    for (const item of data.budgets.slice(0,4)) budgets.append(budgetProgress(item));
    const recent = $('recent-list'); recent.replaceChildren();
    if (!data.recent.length) recent.append(messageLine('No activity yet.'));
    for (const item of data.recent) {
      const row = make('div','activity-row'); row.append(make('span','activity-symbol', item.kind === 'income' ? '↗' : '↘'));
      const copy = make('div','activity-copy'); copy.append(make('strong','',item.note || item.category_name), make('small','',`${item.category_name} · ${item.occurred_on}`)); row.append(copy);
      row.append(make('span','activity-amount' + (item.kind === 'income' ? ' positive' : ''), `${item.kind === 'income' ? '+' : '−'}${amount(item.amount)}`)); recent.append(row);
    }
  }
  function budgetProgress(item) {
    const box = make('div','budget-row'); const top = make('div'); top.append(make('strong','',item.category_name), make('span','',`${amount(item.spent)} / ${amount(item.amount)}`));
    const track = make('div','progress-track'); const fill = make('span'); fill.style.width = `${Math.min(100, Number(item.spent)/Number(item.amount)*100)}%`;
    if (Number(item.remaining) < 0) fill.style.background = '#d99173';
    track.append(fill); box.append(top, track, make('small','',`${amount(item.remaining)} remaining`)); return box;
  }
  async function loadTransactions() {
    try {
      const params = new URLSearchParams({page:String(state.page), limit:'25'});
      for (const [id,key] of [['filter-kind','kind'],['filter-account','account_id'],['filter-start','start_date'],['filter-end','end_date']]) if ($(id).value) params.set(key,$(id).value);
      state.transactions = await FW.api('/transactions?' + params);
      renderTransactions();
    } catch (err) { error(err); }
  }
  function renderTransactions() {
    const data = state.transactions; if (!data) return;
    $('transaction-count').textContent = `${data.total} entries`;
    $('page-number').textContent = `Page ${data.page} of ${Math.max(1,Math.ceil(data.total/data.limit))}`;
    $('prev-page').disabled = state.page <= 1; $('next-page').disabled = state.page * data.limit >= data.total;
    const tbody = $('transaction-table'); tbody.replaceChildren();
    if (!data.items.length) { const row = make('tr'); const cell = make('td','', 'No transactions match these filters.'); cell.colSpan=5; row.append(cell); tbody.append(row); }
    for (const item of data.items) {
      const row = make('tr'); row.append(make('td','',item.occurred_on));
      const details = make('td'); details.append(make('strong','',item.note || item.category_name), make('small','',item.category_name)); row.append(details);
      row.append(make('td','',state.accounts.find(a => a.id === item.account_id)?.name || 'Account'));
      row.append(make('td',item.kind === 'income' ? 'positive' : '',`${item.kind === 'income' ? '+' : '−'}${amount(item.amount)}`));
      const actions = make('td'); const group = make('div','row-actions'); const edit = make('button','', 'Edit'); edit.type='button'; edit.addEventListener('click', () => openEntry(item));
      const remove = make('button','danger','Delete'); remove.type='button'; remove.addEventListener('click', () => deleteEntry(item)); group.append(edit,remove); actions.append(group); row.append(actions); tbody.append(row);
    }
  }
  async function loadBudgets() {
    try { state.budgets = await FW.api('/budgets?month=' + $('budget-month').value + '-01'); renderBudgets(); }
    catch (err) { error(err); }
  }
  function renderBudgets() {
    const list = $('budget-list'); list.replaceChildren();
    if (!state.budgets.length) list.append(messageLine('No budgets for this month. Add one to set a spending plan.'));
    for (const item of state.budgets) {
      const card = make('article'); card.append(make('h3','',item.category_name), make('p','',`Monthly limit · ${item.month.slice(0,7)}`), make('strong','',amount(item.amount)), budgetProgress(item));
      const actions = make('div','card-buttons'); const edit=make('button','','Edit limit'); edit.addEventListener('click',()=>openBudget(item)); const remove=make('button','danger','Delete'); remove.addEventListener('click',()=>deleteBudget(item)); actions.append(edit,remove); card.append(actions); list.append(card);
    }
  }
  function renderAccounts() {
    const list = $('account-list'); list.replaceChildren();
    if (!state.accounts.length) list.append(messageLine('Add an account to start tracking.'));
    for (const item of state.accounts) {
      const card = make('article'); card.append(make('p','',item.kind === 'bank' ? 'MANUALLY TRACKED BANK' : 'CASH ACCOUNT'), make('h3','',item.name), make('strong','',amount(item.balance)), make('p','',item.archived ? 'Archived' : 'Current balance'));
      const actions=make('div','card-buttons'); const rename=make('button','','Rename'); rename.addEventListener('click',async()=>{const name=prompt('Account name',item.name); if(!name||name===item.name)return; try{await FW.api('/accounts/'+item.id,{method:'PATCH',body:{name}});await reloadBase();success('Account updated.');}catch(err){error(err);}});
      const archive=make('button','',item.archived?'Restore':'Archive'); archive.addEventListener('click',async()=>{try{await FW.api('/accounts/'+item.id,{method:'PATCH',body:{archived:!item.archived}});await reloadBase();success('Account updated.');}catch(err){error(err);}});
      actions.append(rename,archive); card.append(actions); list.append(card);
    }
  }
  function renderCustomCategories() {
    const list = $('custom-categories'); list.replaceChildren();
    for (const item of state.categories.filter(category => !category.is_default)) {
      const row=make('div','custom-cat-row'); row.append(make('span','',`${item.name} · ${item.kind}`));
      const remove=make('button','','Delete'); remove.addEventListener('click',async()=>{if(!confirm(`Delete ${item.name}?`))return;try{await FW.api('/categories/'+item.id,{method:'DELETE'});await reloadBase();success('Category deleted.');}catch(err){error(err);}}); row.append(remove); list.append(row);
    }
  }
  function updateEntryCategories() {
    const kind = document.querySelector('#entry-form input[name=kind]:checked').value;
    setSelect($('entry-category'), state.categories.filter(category=>category.kind===kind));
  }
  function openEntry(item=null) {
    if (!state.accounts.some(a=>!a.archived)) return error(new Error('Add an active account first.'));
    state.editingEntry=item; state.entryKey=null;
    const form=$('entry-form'); form.reset();
    $('entry-dialog-title').textContent=item?'Edit transaction':'Add transaction';
    if (item && !Array.from(form.elements.account_id.options).some(option=>option.value===item.account_id)) option(form.elements.account_id, state.accounts.find(account=>account.id===item.account_id)?.name || 'Archived account', item.account_id);
    form.elements.occurred_on.value=item?.occurred_on||FW.localDate(state.me.timezone);
    form.querySelector(`input[name=kind][value=${item?.kind||'expense'}]`).checked=true;
    updateEntryCategories();
    if(item){form.elements.amount.value=item.amount;form.elements.account_id.value=item.account_id;form.elements.category_id.value=item.category_id;form.elements.note.value=item.note;}
    $('entry-dialog').showModal();
  }
  function openBudget(item=null) {
    state.editingBudget=item; const form=$('budget-form');form.reset();
    $('budget-dialog-title').textContent=item?'Edit budget':'New budget';
    form.elements.month.value=item?.month.slice(0,7)||$('budget-month').value;
    form.elements.category_id.value=item?.category_id||form.elements.category_id.value;
    form.elements.amount.value=item?.amount||'';
    form.elements.month.disabled=Boolean(item);form.elements.category_id.disabled=Boolean(item);
    $('budget-dialog').showModal();
  }
  async function deleteEntry(item) {
    if (!confirm(`Delete this ${item.kind} of ${amount(item.amount)}?`)) return;
    try { await FW.api('/transactions/'+item.id,{method:'DELETE'}); await reloadBase(); await loadTransactions(); success('Transaction deleted.'); }
    catch(err){error(err);}
  }
  async function deleteBudget(item) {
    if(!confirm(`Delete the ${item.category_name} budget?`))return;
    try{await FW.api('/budgets/'+item.id,{method:'DELETE'});await reloadBase();await loadBudgets();success('Budget deleted.');}catch(err){error(err);}
  }
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.view)));
  for(const id of ['overview-add','empty-add','transactions-add']) $(id).addEventListener('click',()=>openEntry());
  $('budgets-add').addEventListener('click',()=>openBudget());
  $('accounts-add').addEventListener('click',()=>$('account-dialog').showModal());
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.close).close()));
  document.querySelectorAll('#entry-form input[name=kind]').forEach(input=>input.addEventListener('change',updateEntryCategories));
  $('entry-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget;const data=FW.fieldData(form);
    if(!state.entryKey)state.entryKey=crypto.randomUUID();
    try{await FW.api(state.editingEntry?'/transactions/'+state.editingEntry.id:'/transactions',{method:state.editingEntry?'PATCH':'POST',body:data,headers:state.editingEntry?{}:{'Idempotency-Key':state.entryKey}});$('entry-dialog').close();state.entryKey=null;await reloadBase();if(state.view==='transactions')await loadTransactions();success('Transaction saved.');}
    catch(err){error(err);}
  });
  $('budget-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget;const data=FW.fieldData(form);data.month+='-01';
    try{await FW.api(state.editingBudget?'/budgets/'+state.editingBudget.id:'/budgets',{method:state.editingBudget?'PATCH':'POST',body:state.editingBudget?{amount:data.amount}:data});$('budget-dialog').close();await reloadBase();await loadBudgets();success('Budget saved.');}catch(err){error(err);}
  });
  $('account-form').addEventListener('submit',async event=>{event.preventDefault();try{await FW.api('/accounts',{method:'POST',body:FW.fieldData(event.currentTarget)});$('account-dialog').close();event.currentTarget.reset();await reloadBase();success('Account added.');}catch(err){error(err);}});
  $('settings-form').addEventListener('submit',async event=>{event.preventDefault();try{state.me=await FW.api('/me/preferences',{method:'PATCH',body:FW.fieldData(event.currentTarget)});await reloadBase();success('Preferences saved.');}catch(err){error(err);}});
  $('category-form').addEventListener('submit',async event=>{event.preventDefault();try{await FW.api('/categories',{method:'POST',body:FW.fieldData(event.currentTarget)});event.currentTarget.reset();await reloadBase();success('Category added.');}catch(err){error(err);}});
  $('logout').addEventListener('click',async()=>{try{await FW.api('/auth/logout',{method:'POST'});}finally{location.assign('/');}});
  $('delete-account').addEventListener('click',async()=>{if(!confirm('Permanently delete your FinWise account and all records?'))return;const password=state.me.is_demo?'':prompt('Enter your current password to confirm deletion');if(password===null)return;try{await FW.api('/me',{method:'DELETE',body:{password}});location.assign('/');}catch(err){error(err);}});
  $('apply-filters').addEventListener('click',()=>{state.page=1;loadTransactions();});
  $('prev-page').addEventListener('click',()=>{state.page=Math.max(1,state.page-1);loadTransactions();});
  $('next-page').addEventListener('click',()=>{state.page++;loadTransactions();});
  $('budget-month').addEventListener('change',loadBudgets);
  try{
    state.me=await FW.api('/me');
    if(!state.me.is_demo){const accounts=await FW.api('/accounts');if(!accounts.length)return location.replace('/onboarding');}
    $('user-avatar').textContent=state.me.full_name.charAt(0).toUpperCase();
    $('demo-pill').hidden=!state.me.is_demo;
    $('current-date').textContent=new Intl.DateTimeFormat(undefined,{timeZone:state.me.timezone,weekday:'long',month:'long',day:'numeric'}).format(new Date());
    $('budget-month').value=FW.localDate(state.me.timezone).slice(0,7);
    $('settings-form').elements.currency.value=state.me.currency;
    $('settings-form').elements.timezone.value=state.me.timezone;
    await reloadBase();showView('overview');
  }catch(err){if(err.status===401)location.replace('/login');else error(err);}
});
