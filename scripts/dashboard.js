(() => {
  const token = localStorage.getItem('kalyana_token');
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem('kalyana_user') || 'null'); } catch { stored = null; }
  if (!token || !stored) { location.replace('auth.html?mode=login'); return; }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const content = $('#dashboardContent');
  const sideNav = $('#sideNav');
  let dashboardData = null;
  let pendingHeaderQuery = '';

  const rupiah = value => 'Rp' + new Intl.NumberFormat('id-ID').format(Number(value) || 0);
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const initials = name => String(name || 'K').trim().split(/\s+/).map(x => x[0]).slice(0,2).join('').toUpperCase() || 'K';
  const roleLabel = stored.role === 'super_admin' ? 'Super Admin' : stored.role === 'umkm' ? 'Pemilik UMKM' : 'Mahasiswa';

  const icons = {
    home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6"/></svg>',
    users:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.5 2.4-5.3 5.5-5.3s5 1.8 5.5 5.3M16 5.5a3 3 0 0 1 0 5.8M16.5 14c2.3.3 3.6 2 4 5"/></svg>',
    project:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2M3 11h18M10 11v2h4v-2"/></svg>',
    search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>',
    payment:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/></svg>',
    profile:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-4 3.1-6 7-6s6.3 2 7 6"/></svg>',
    opportunity:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3"/></svg>',
    portfolio:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    income:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/></svg>',
    check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5"/></svg>',
    star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
    trash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>'
  };
  const icon = name => icons[name] || icons.home;

  const menus = {
    super_admin:[
      {icon:'home',label:'Ringkasan',view:'summary'},
      {icon:'users',label:'Pengguna',view:'monitoring'},
      {icon:'project',label:'Project',view:'projects'},
      {icon:'payment',label:'Transaksi',view:'payments'}
    ],
    umkm:[
      {icon:'home',label:'Ringkasan',view:'summary'},
      {icon:'project',label:'Project Saya',view:'projects'},
      {icon:'search',label:'Cari Mahasiswa',view:'talents'},
      {icon:'payment',label:'Pembayaran',view:'payments'},
      {icon:'profile',label:'Profil Usaha',view:'profile'}
    ],
    talent:[
      {icon:'home',label:'Ringkasan',view:'summary'},
      {icon:'opportunity',label:'Peluang Project',view:'opportunities'},
      {icon:'project',label:'Pekerjaan Saya',view:'projects'},
      {icon:'portfolio',label:'Portofolio',view:'portfolio'},
      {icon:'income',label:'Pendapatan',view:'earnings'},
      {icon:'profile',label:'Profil Mahasiswa',view:'profile'}
    ]
  };

  function updateUserChip() {
    $('#userName').textContent = stored.name || 'Pengguna';
    $('#userRole').textContent = roleLabel;
    $('#userAvatar').textContent = initials(stored.name);
  }
  updateUserChip();

  sideNav.innerHTML = (menus[stored.role] || menus.umkm).map((item,i) =>
    `<button type="button" class="${i===0?'active':''}" data-view="${item.view}" aria-pressed="${i===0}"><span class="nav-icon">${icon(item.icon)}</span><span>${item.label}</span></button>`
  ).join('');

  const statusText = status => status === 'completed' ? 'Selesai' : status === 'active' ? 'Berjalan' : 'Menunggu';
  const statusClass = status => status === 'completed' ? 'is-done' : status === 'active' ? 'is-active' : 'is-waiting';
  const paymentText = status => status === 'paid' ? 'Lunas' : 'Belum lunas';

  async function api(path, options = {}) {
    const headers = {...(options.headers || {}), Authorization:'Bearer ' + token};
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const response = await fetch(path,{...options,headers});
    const data = await response.json().catch(()=>({}));
    if (response.status === 401) {
      localStorage.removeItem('kalyana_token');
      localStorage.removeItem('kalyana_user');
      location.replace('auth.html?mode=login');
      throw new Error('Sesi berakhir.');
    }
    if (!response.ok) throw new Error(data.error || 'Permintaan gagal diproses.');
    return data;
  }

  const toTitleCase = str => String(str || '').replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());

  function heading(label,title,description) {
    return `<section class="view-heading"><div><span>${escapeHTML(toTitleCase(label))}</span><h2>${escapeHTML(toTitleCase(title))}</h2><p>${escapeHTML(description)}</p></div></section>`;
  }
  function pageIntro(title,desc,action='') {
    return `<section class="k-page-intro"><div><h2>${escapeHTML(toTitleCase(title))}</h2><p>${escapeHTML(desc)}</p></div>${action}</section>`;
  }
  function stat(label,value,hint,iconName) {
    return `<article class="k-stat"><span class="k-stat__icon">${icon(iconName)}</span><div><span class="k-stat__label">${escapeHTML(label)}</span><strong class="k-stat__value">${value}</strong><span class="k-stat__hint">${escapeHTML(hint)}</span></div></article>`;
  }
  function nativeProgress(value,className,label='Progress') {
    const safe = Math.max(0,Math.min(100,Number(value)||0));
    return `<progress class="${escapeHTML(className)}" max="100" value="${safe}" aria-label="${escapeHTML(label)} ${safe}%">${safe}%</progress>`;
  }
  function divProgress(value,className) {
    const safe = Math.max(0,Math.min(100,Number(value)||0));
    return `<div class="${escapeHTML(className)} ${safe===0 ? 'is-zero' : ''}"><i style="width:${safe}%"></i></div>`;
  }
  function progressStat(label,value,progress,iconName) {
    return `<article class="k-stat project-progress-stat"><span class="k-stat__icon">${icon(iconName)}</span><div><span class="k-stat__label">${escapeHTML(label)}</span><strong class="k-stat__value">${escapeHTML(value)}</strong>${nativeProgress(progress,'project-stat-native-progress',label)}</div></article>`;
  }
  function activities(items) {
    return `<div class="k-activity">${items.map(x=>`<div class="k-activity-item"><span class="k-activity-icon ${x.tone||''}">${icon(x.icon)}</span><div><b>${escapeHTML(x.title)}</b><small>${escapeHTML(x.detail)}</small></div><span class="time">${escapeHTML(x.time||'Terbaru')}</span></div>`).join('')}</div>`;
  }
  function setContent(html) {
    content.innerHTML = html;
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function projectStatusBucket(status) {
    const s = String(status || '').toLowerCase();
    if (['completed','done','finished','selesai'].includes(s)) return 'completed';
    if (['active','ongoing','berjalan','in_progress','in-progress'].includes(s)) return 'active';
    return 'waiting';
  }
  function buildProjectDonut(projects=[]) {
    const counts = {waiting:0,active:0,completed:0};
    projects.forEach(p=>counts[projectStatusBucket(p.status)]++);
    const total = counts.waiting + counts.active + counts.completed;
    const pct = n => total ? n/total*100 : 0;
    const waitingPct = pct(counts.waiting), activePct = pct(counts.active);
    return {...counts,total,segments:[
      {key:'waiting',value:waitingPct,offset:0},
      {key:'active',value:activePct,offset:waitingPct},
      {key:'completed',value:Math.max(0,100-waitingPct-activePct),offset:waitingPct+activePct}
    ]};
  }
  function projectDonutMarkup(donut,label) {
    const segment = item => {
      const value=Math.max(0,Math.min(100,Number(item.value)||0)), offset=Math.max(0,Math.min(100,Number(item.offset)||0));
      return `<circle class="project-status-donut__segment project-status-donut__segment--${item.key}" cx="60" cy="60" r="46" pathLength="100" stroke-dasharray="${value.toFixed(4)} ${(100-value).toFixed(4)}" stroke-dashoffset="${(-offset).toFixed(4)}" transform="rotate(-90 60 60)"/>`;
    };
    return `<div class="project-status-donut" role="img" aria-label="${donut.waiting} menunggu, ${donut.active} berjalan, ${donut.completed} selesai"><svg class="project-status-donut__svg" viewBox="0 0 120 120" aria-hidden="true"><circle class="project-status-donut__track" cx="60" cy="60" r="46" pathLength="100"/>${donut.segments.map(segment).join('')}</svg><div class="project-status-donut__center"><span>${donut.total}</span><small>${escapeHTML(label)}</small></div></div>`;
  }

  function projectRows(projects=[],interactive=false) {
    if (!projects.length) return `<div class="empty-state"><b>Belum ada project</b><span>Data project akan muncul setelah ada aktivitas.</span></div>`;
    const rank = p => projectStatusBucket(p.status)==='active' ? 0 : projectStatusBucket(p.status)==='waiting' ? 1 : 2;
    const displayProjects = interactive ? [...projects].sort((a,b)=>rank(a)-rank(b)) : projects;
    return displayProjects.map(p=>{
      const progress=Math.max(0,Math.min(100,Number(p.progress)||0));
      const canUpdate = interactive && stored.role === 'talent' && p.status !== 'completed';
      const rowAttrs = canUpdate ? ` data-focus-progress="${escapeHTML(p.id)}" role="button" tabindex="0" title="Klik untuk update progress"` : '';
      const status = interactive && stored.role === 'umkm' && p.status === 'draft'
        ? `<button class="status-pill ${statusClass(p.status)}" type="button" data-start-project="${escapeHTML(p.id)}" title="Mulai project">${statusText(p.status)}</button>`
        : `<span class="status-pill ${statusClass(p.status)}">${statusText(p.status)}</span>`;
      return `<div class="project-row${canUpdate?' is-interactive':''}"${rowAttrs}><span class="project-icon">${icon('project')}</span><div><b>${escapeHTML(p.title)}</b><small>${escapeHTML(p.service||'Project')} · ${progress}% selesai</small>${divProgress(progress,'project-row-progress-track')}</div><div class="project-row-tail">${status}</div></div>`;
    }).join('');
  }

  function projectOverview(projects,donut,label) {
    const overviewProjects = [...projects].sort((a,b)=>(Number(b.progress)||0)-(Number(a.progress)||0));
    const rows = overviewProjects.length ? overviewProjects.map(p=>{
      const progress=Math.max(0,Math.min(100,Number(p.progress)||0));
      return `<div class="project-overview-row"><div class="project-overview-copy"><b>${escapeHTML(p.title)}</b><small>${escapeHTML(p.service||'Project')} · ${rupiah(p.budget)}</small></div><div class="project-overview-progress">${divProgress(progress,'overview-progress-track')}<strong>${progress}%</strong></div></div>`;
    }).join('') : `<div class="empty-state project-overview-empty"><b>Belum ada project</b><span>Project aktif akan tampil di sini.</span></div>`;
    return `<section class="k-card project-overview-card"><div class="k-card__head"><div><h3>Grafik ${stored.role==='umkm'?'project':'pekerjaan'}</h3><small>Distribusi status dan progress per ${stored.role==='umkm'?'project':'pekerjaan'}</small></div></div><div class="project-overview-body"><div class="project-overview-summary">${projectDonutMarkup(donut,label)}<div class="project-status-legend"><div><span><i class="k-dot waiting"></i>Menunggu</span><b>${donut.waiting}</b></div><div><span><i class="k-dot active"></i>Berjalan</span><b>${donut.active}</b></div><div><span><i class="k-dot done"></i>Selesai</span><b>${donut.completed}</b></div></div></div><div class="project-overview-list">${rows}</div></div></section>`;
  }

  function renderSummary() {
    const d=dashboardData || {};
    if (stored.role === 'umkm') {
      const projects=d.projects||[], donut=buildProjectDonut(projects), talents=d.talents||[];
      setContent(`${pageIntro(`Selamat datang, ${stored.name||'Pemilik UMKM'}`,'Kelola project dan temukan mahasiswa yang tepat untuk kebutuhan usaha Anda.','<button class="k-primary" data-go="projects">Buat project</button>')}
        <section class="k-stats">${stat('Total project',projects.length,'Semua project','project')}${stat('Project aktif',donut.active,'Sedang berjalan','arrow')}${stat('Project selesai',donut.completed,'Sudah diselesaikan','check')}${stat('Total anggaran',rupiah(d.stats?.spent||0),'Akumulasi nilai project','payment')}</section>
        <section class="k-grid-2"><article class="k-card"><div class="k-card__head"><div><h3>Status project</h3><small>Komposisi project usaha Anda</small></div><button class="k-link" data-go="projects">Lihat project</button></div><div class="k-chart">${projectDonutMarkup(donut,'Project')}<div class="project-status-legend"><div><span><i class="k-dot waiting"></i>Menunggu</span><b>${donut.waiting}</b></div><div><span><i class="k-dot active"></i>Berjalan</span><b>${donut.active}</b></div><div><span><i class="k-dot done"></i>Selesai</span><b>${donut.completed}</b></div></div></div></article><article class="k-card"><div class="k-card__head"><div><h3>Aktivitas akun</h3><small>Informasi usaha terbaru</small></div></div>${activities([{icon:'arrow',tone:'tone-purple',title:`${donut.active} project sedang berjalan`,detail:'Pantau progres dari menu Project Saya.',time:'Aktif'},{icon:'payment',tone:'tone-gold',title:`${rupiah(d.stats?.paid||0)} sudah dibayar`,detail:'Pembayaran demo yang sudah tercatat.',time:'Pembayaran'},{icon:'users',tone:'tone-neutral',title:`${talents.length} mahasiswa tersedia`,detail:'Pilih mahasiswa saat membuat project.',time:'Talent'}])}</article></section>
        <section class="k-card"><div class="k-card__head"><div><h3>Project terbaru</h3><small>${projects.length} project tercatat</small></div><button class="k-link" data-go="projects">Lihat semua</button></div><div class="summary-project-list">${projectRows(projects.slice(0,4))}</div></section>`);
      return;
    }

    if (stored.role === 'talent') {
      const projects=d.projects||[], donut=buildProjectDonut(projects), opps=d.opportunities||[];
      setContent(`${pageIntro(`Halo, ${stored.name||'Mahasiswa'}`,'Pantau pekerjaan aktif, peluang baru, portofolio, dan pendapatan Anda.','<button class="k-primary" data-go="opportunities">Cari peluang</button>')}
        <section class="k-stats">${stat('Total pekerjaan',projects.length,`${donut.active} sedang berjalan`,'project')}${stat('Peluang tersedia',opps.filter(x=>!x.applied).length,'Belum diajukan','opportunity')}${stat('Rating',d.stats?.rating||'-','Profil mahasiswa','star')}${stat('Pendapatan',rupiah(d.stats?.earnings||0),'Pembayaran yang sudah masuk','income')}</section>
        <section class="k-grid-2"><article class="k-card"><div class="k-card__head"><div><h3>Status pekerjaan</h3><small>Progress project yang Anda tangani</small></div><button class="k-link" data-go="projects">Lihat pekerjaan</button></div><div class="k-chart">${projectDonutMarkup(donut,'Kerja')}<div class="project-status-legend"><div><span><i class="k-dot waiting"></i>Menunggu</span><b>${donut.waiting}</b></div><div><span><i class="k-dot active"></i>Berjalan</span><b>${donut.active}</b></div><div><span><i class="k-dot done"></i>Selesai</span><b>${donut.completed}</b></div></div></div></article><article class="k-card"><div class="k-card__head"><div><h3>Aktivitas akun</h3><small>Yang perlu Anda perhatikan</small></div></div>${activities([{icon:'opportunity',tone:'tone-purple',title:`${opps.length} peluang tersedia`,detail:'Ajukan minat dari menu Peluang Project.',time:'Peluang'},{icon:'check',tone:'tone-green',title:`${donut.completed} pekerjaan selesai`,detail:'Hasil selesai tetap tercatat.',time:'Riwayat'},{icon:'income',tone:'tone-gold',title:`${rupiah(d.stats?.earnings||0)} pendapatan`,detail:'Nilai bersih dari project yang sudah dibayar.',time:'Saat ini'}])}</article></section>
        <section class="k-card"><div class="k-card__head"><div><h3>Pekerjaan terbaru</h3><small>${projects.length} pekerjaan tercatat</small></div><button class="k-link" data-go="projects">Lihat semua</button></div><div class="summary-project-list">${projectRows(projects.slice(0,4))}</div></section>`);
      return;
    }

    const users=d.users||{umkm:[],students:[]}, projects=d.projects||[], donut=buildProjectDonut(projects);
    setContent(`${pageIntro('Ringkasan platform','Pantau pengguna, project, dan transaksi Kalyana dalam satu dashboard.')}
      <section class="k-stats">${stat('UMKM',users.umkm.length,'Akun usaha','users')}${stat('Mahasiswa',users.students.length,'Akun mahasiswa','profile')}${stat('Project aktif',donut.active,'Sedang berjalan','project')}${stat('Nilai project',rupiah(d.stats?.totalTransactions||0),'Akumulasi anggaran','payment')}</section>
      <section class="k-grid-2"><article class="k-card"><div class="k-card__head"><div><h3>Status project</h3><small>Distribusi seluruh project</small></div></div><div class="k-chart">${projectDonutMarkup(donut,'Project')}<div class="project-status-legend"><div><span><i class="k-dot waiting"></i>Menunggu</span><b>${donut.waiting}</b></div><div><span><i class="k-dot active"></i>Berjalan</span><b>${donut.active}</b></div><div><span><i class="k-dot done"></i>Selesai</span><b>${donut.completed}</b></div></div></div></article><article class="k-card"><div class="k-card__head"><div><h3>Platform</h3><small>Ringkasan aktivitas</small></div></div>${activities([{icon:'users',tone:'tone-purple',title:`${users.umkm.length+users.students.length} akun pengguna`,detail:`${users.umkm.length} UMKM dan ${users.students.length} mahasiswa.`,time:'Akun'},{icon:'project',tone:'tone-neutral',title:`${projects.length} project tercatat`,detail:`${donut.active} sedang berjalan.`,time:'Project'},{icon:'payment',tone:'tone-gold',title:rupiah(d.stats?.paidTransactions||0),detail:'Nilai pembayaran yang sudah tercatat.',time:'Transaksi'}])}</article></section>`);
  }

  function renderProjects() {
    if (stored.role === 'super_admin') { renderAdminProjects(); return; }
    const umkm=stored.role==='umkm', projects=dashboardData.projects||[], donut=buildProjectDonut(projects), total=projects.length;
    const avg=total?Math.round(projects.reduce((s,p)=>s+Math.max(0,Math.min(100,Number(p.progress)||0)),0)/total):0;
    const totalBudget=projects.reduce((s,p)=>s+(Number(p.budget)||0),0);

    let side='';
    if (umkm) {
      const options=(dashboardData.talents||[]).map(t=>`<option value="${escapeHTML(t.id)}">${escapeHTML(t.name)} · ${escapeHTML(t.role)}</option>`).join('');
      side=`<aside class="panel project-form-panel"><div class="panel-head"><div><h3>Buat project baru</h3><small>Isi kebutuhan project secara ringkas.</small></div></div><form id="projectForm"><label>Judul project<input name="title" required minlength="5" placeholder="Contoh: Branding produk kopi"></label><label>Layanan<select name="service"><option>Desain Grafis</option><option>Copywriting</option><option>Video Editing</option></select></label><label>Pilih mahasiswa<select name="talentId" required>${options}</select></label><div class="field-grid"><label>Anggaran<input name="budget" type="number" min="300000" step="50000" required value="500000"></label><label>Deadline<input name="deadline" type="date"></label></div><button class="primary-button" type="submit">Simpan project</button><p class="form-status" role="status"></p></form></aside>`;
    } else {
      const activeProjects=projects.filter(p=>p.status!=='completed');
      const options=activeProjects.map(p=>`<option value="${escapeHTML(p.id)}" data-progress="${Number(p.progress)||0}">${escapeHTML(p.title)}</option>`).join('');
      side=`<aside class="panel action-panel"><span class="mini-label">Pekerjaan aktif</span><h3>Progress tersimpan dalam satu ruang kerja.</h3><p>Brief, progres, dan hasil akhir dapat dipantau dari daftar pekerjaan Anda.</p></aside>${activeProjects.length?`<dialog class="project-progress-dialog" id="projectProgressDialog"><div class="project-progress-dialog__body"><div class="project-progress-dialog__head"><div><h3>Update progress pekerjaan</h3><p>Pilih project dan simpan perkembangan terbaru.</p></div><button class="project-progress-dialog__close" type="button" data-close-progress-dialog aria-label="Tutup">×</button></div><form id="progressForm"><label>Pilih project<select name="projectId" id="progressProjectSelect">${options}</select></label><label>Progress (%)<input name="progress" id="progressValue" type="number" min="0" max="100" required value="${Number(activeProjects[0]?.progress)||0}"></label><div class="dialog-actions"><button class="dialog-cancel" type="button" data-close-progress-dialog>Batal</button><button class="primary-button" type="submit">Simpan progress</button></div><p class="form-status" role="status"></p></form></div></dialog>`:''}`;
    }

    setContent(`${heading('Manajemen project',umkm?'Project usaha':'Pekerjaan saya',umkm?'Buat brief dan pantau progres project secara terpusat.':'Pantau deadline dan progres seluruh pekerjaan aktif.')}
      <section class="k-stats project-stats">${stat(umkm?'Total project':'Total pekerjaan',total,`${donut.active} sedang berjalan`,'project')}${progressStat('Progress rata-rata',`${avg}%`,avg,'check')}${stat(umkm?'Total anggaran':'Total nilai kerja',rupiah(totalBudget),`${donut.completed} sudah selesai`,'payment')}</section>
      ${projectOverview(projects,donut,umkm?'Project':'Kerja')}
      <section class="workspace-grid project-workspace-grid"><article class="panel project-list-panel"><div class="panel-head"><div><h3>Daftar project</h3><small>${projects.length} project tercatat</small></div></div>${projectRows(projects,true)}</article>${side}</section>`);

    $('#projectForm')?.addEventListener('submit',async e=>{
      e.preventDefault(); const form=e.currentTarget, status=$('.form-status',form); status.textContent='Menyimpan project...';
      try {
        const payload=Object.fromEntries(new FormData(form));
        const data=await api('/api/projects',{method:'POST',body:JSON.stringify(payload)});
        showToast(data.message); await refreshDashboard('projects');
      } catch(err) { status.textContent=err.message; status.classList.add('is-error'); }
    });

    const select=$('#progressProjectSelect');
    select?.addEventListener('change',()=>{
      const opt=select.selectedOptions[0];
      if ($('#progressValue')) $('#progressValue').value=opt?.dataset.progress||0;
    });
    $('#progressForm')?.addEventListener('submit',async e=>{
      e.preventDefault(); const form=e.currentTarget,status=$('.form-status',form),fd=new FormData(form); status.textContent='Menyimpan progress...';
      try {
        const id=fd.get('projectId');
        const data=await api('/api/projects/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({progress:Number(fd.get('progress'))})});
        showToast(data.message); await refreshDashboard('projects');
      } catch(err) { status.textContent=err.message; status.classList.add('is-error'); }
    });
  }

  function renderTalents() {
    const query=(pendingHeaderQuery||'').trim().toLowerCase();
    const cards=(dashboardData.talents||[]).map(t=>{
      const key=[t.name,t.role,t.city,t.portfolio,t.category].filter(Boolean).join(' ').toLowerCase();
      const hidden=query&&!key.includes(query)?' hidden':'';
      return `<article class="talent-result" data-search-key="${escapeHTML(key)}"${hidden}><span class="talent-avatar">${escapeHTML(t.initials||initials(t.name))}</span><div><b>${escapeHTML(t.name)}</b><small>${escapeHTML(t.role)} · ${escapeHTML(t.city||'Indonesia')} · ${t.rating||0} / 5</small><strong>Mulai ${rupiah(t.price)}</strong></div><button type="button" data-toast="${escapeHTML(t.name)} siap dipilih saat membuat project.">Lihat profil</button></article>`;
    }).join('');
    setContent(`${heading('Mahasiswa terverifikasi','Cari mahasiswa','Cari berdasarkan nama, keahlian, kota, atau kategori project.')}<section class="panel"><label class="dashboard-search">${icon('search')}<input id="talentSearch" type="search" placeholder="Cari nama, keahlian, atau kota" value="${escapeHTML(pendingHeaderQuery)}" autocomplete="off"></label><div id="talentResults" class="talent-result-grid">${cards||'<div class="empty-state">Belum ada mahasiswa tersedia.</div>'}</div><div id="talentEmpty" class="empty-state" hidden>Tidak ada mahasiswa yang cocok.</div></section>`);
    $('#talentSearch')?.addEventListener('input',e=>{ pendingHeaderQuery=e.target.value; syncHeaderSearch(e.target.value); filterSearchCards('.talent-result','#talentEmpty',e.target.value); });
    filterSearchCards('.talent-result','#talentEmpty',pendingHeaderQuery);
  }

  function renderOpportunities() {
    const items=dashboardData.opportunities||[], query=(pendingHeaderQuery||'').trim().toLowerCase();
    const cards=items.map(i=>{
      const key=[i.title,i.service,i.ownerName,i.description,i.deadline,i.budget].filter(Boolean).join(' ').toLowerCase();
      const hidden=query&&!key.includes(query)?' hidden':'';
      return `<article class="opportunity-card" data-search-key="${escapeHTML(key)}"${hidden}><span class="opportunity-type">${escapeHTML(i.service)}</span><h3>${escapeHTML(i.title)}</h3><p>${escapeHTML(i.ownerName||'UMKM Kalyana')} · Deadline ${escapeHTML(i.deadline)}</p><p class="opportunity-desc">${escapeHTML(i.description||'')}</p><strong>${rupiah(i.budget)}</strong><button type="button" data-apply-opportunity="${escapeHTML(i.id)}" ${i.applied?'disabled':''}>${i.applied?'Sudah diajukan':'Ajukan minat'}</button></article>`;
    }).join('');
    setContent(`${heading('Project terbuka','Peluang project','Pilih project yang sesuai dengan keahlian, jadwal, dan target pendapatan Anda.')}<section class="opportunity-grid">${cards||'<div class="empty-state">Belum ada peluang project tersedia.</div>'}</section><div id="opportunitySearchEmpty" class="empty-state" hidden>Tidak ada peluang project yang cocok.</div>`);
    filterSearchCards('.opportunity-card','#opportunitySearchEmpty',pendingHeaderQuery);
  }

  function renderPortfolio() {
    const items=dashboardData.portfolio||[];
    const cards=items.map(item=>`<article class="portfolio-item"><img src="${escapeHTML(item.image||'assets/images/kalyana-project-board.png')}" alt="${escapeHTML(item.title)}"><div><span>${escapeHTML(item.category)}</span><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description||'')}</p><button class="portfolio-delete" type="button" data-delete-portfolio="${escapeHTML(item.id)}">${icon('trash')} Hapus</button></div></article>`).join('');
    setContent(`${heading('Karya pilihan','Portofolio mahasiswa','Tampilkan hasil kerja yang paling relevan agar lebih mudah dipilih UMKM.')}<section class="workspace-grid portfolio-workspace"><div class="portfolio-dashboard">${cards||'<div class="empty-state">Belum ada karya.</div>'}</div><aside class="panel project-form-panel"><div class="panel-head"><div><h3>Tambah karya</h3><small>Tambahkan ringkasan portofolio baru.</small></div></div><form id="portfolioForm"><label>Judul karya<input name="title" required minlength="3" placeholder="Contoh: Branding Kedai Kopi"></label><label>Kategori<input name="category" required placeholder="Contoh: Brand Identity"></label><label>Deskripsi<textarea name="description" rows="5" placeholder="Jelaskan kontribusi dan hasil karya."></textarea></label><button class="primary-button" type="submit">Tambah ke portofolio</button><p class="form-status" role="status"></p></form></aside></section>`);
    $('#portfolioForm')?.addEventListener('submit',async e=>{
      e.preventDefault(); const form=e.currentTarget,status=$('.form-status',form); status.textContent='Menambahkan karya...';
      try { const payload=Object.fromEntries(new FormData(form)); const data=await api('/api/portfolio',{method:'POST',body:JSON.stringify(payload)}); showToast(data.message); await refreshDashboard('portfolio'); }
      catch(err){status.textContent=err.message;status.classList.add('is-error');}
    });
  }

  function renderFinance(type) {
    if (stored.role==='super_admin') { renderAdminTransactions(); return; }
    const income=type==='earnings', projects=dashboardData.projects||[];
    if (income) {
      const total=Number(dashboardData.stats?.earnings)||0;
      const rows=projects.map(p=>{
        const paid=p.paymentStatus==='paid', net=paid?Math.round((Number(p.budget)||0)*.82):0;
        return `<tr><td><strong>${escapeHTML(p.title)}</strong><small>${escapeHTML(p.service||'Project')}</small></td><td>${rupiah(p.budget)}</td><td>${paid?rupiah(net):'-'}</td><td><span class="k-badge ${paid?'is-done':'is-waiting'}">${paid?'Dibayar':'Menunggu'}</span></td></tr>`;
      }).join('')||'<tr><td colspan="4"><div class="empty-state">Belum ada pekerjaan.</div></td></tr>';
      setContent(`${heading('Pendapatan mahasiswa','Ringkasan pendapatan','Pendapatan bersih dihitung 82% dari nilai project yang sudah tercatat dibayar.')}<section class="finance-layout"><article class="finance-total"><span>Total pendapatan</span><b>${rupiah(total)}</b><small>Project yang sudah dibayar</small></article><article class="k-card k-table-card"><div class="k-card__head"><div><h3>Riwayat pendapatan</h3><small>Fee platform demo 18%</small></div></div><div class="table-scroll"><table class="k-table"><thead><tr><th>Project</th><th>Nilai kerja</th><th>Pendapatan bersih</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></article></section>`);
      return;
    }

    const total=projects.reduce((s,p)=>s+(Number(p.budget)||0),0), paid=projects.filter(p=>p.paymentStatus==='paid').reduce((s,p)=>s+(Number(p.budget)||0),0);
    const rows=projects.map(p=>`<tr><td><strong>${escapeHTML(p.title)}</strong><small>${escapeHTML(p.service||'Project')}</small></td><td>${rupiah(p.budget)}</td><td><span class="k-badge ${p.paymentStatus==='paid'?'is-done':'is-waiting'}">${paymentText(p.paymentStatus)}</span></td><td>${p.paymentStatus==='paid'?'<span class="payment-done">Tercatat</span>':`<button class="table-action" type="button" data-pay-project="${escapeHTML(p.id)}">Catat lunas</button>`}</td></tr>`).join('')||'<tr><td colspan="4"><div class="empty-state">Belum ada project.</div></td></tr>';
    setContent(`${heading('Pembayaran project','Nilai pembayaran','Pantau nilai project dan catat pembayaran demo untuk menguji alur sistem.')}<section class="finance-layout"><article class="finance-total"><span>Total nilai project</span><b>${rupiah(total)}</b><small>${rupiah(paid)} sudah tercatat lunas</small></article><article class="k-card k-table-card"><div class="k-card__head"><div><h3>Riwayat pembayaran</h3><small>Mode demo — belum terhubung payment gateway</small></div></div><div class="table-scroll"><table class="k-table"><thead><tr><th>Project</th><th>Nilai</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div></article></section>`);
  }

  function renderProfile() {
    const business=stored.role==='umkm', profile=stored.profile||{};
    setContent(`${heading('Pengaturan akun',business?'Profil usaha':'Profil mahasiswa','Pastikan informasi profil tetap lengkap dan mudah dipercaya.')}<section class="panel profile-panel"><div class="profile-avatar-large">${initials(stored.name)}</div><form id="profileForm"><div class="field-grid"><label>Nama<input name="name" value="${escapeHTML(stored.name||'')}" required></label><label>Email<input type="email" value="${escapeHTML(stored.email||'')}" disabled></label></div><label>${business?'Nama usaha':'Program studi'}<input name="detail" value="${escapeHTML(profile.detail||profile.businessName||profile.studyProgram||'')}" placeholder="Lengkapi informasi ${business?'usaha':'pendidikan'}"></label><label>${business?'Deskripsi usaha':'Keahlian dan bio'}<textarea name="bio" rows="5" placeholder="Tulis informasi singkat yang membantu pengguna lain mengenal Anda">${escapeHTML(profile.bio||'')}</textarea></label><button class="primary-button" type="submit">Simpan perubahan</button><p class="form-status" role="status"></p></form></section>`);
    $('#profileForm')?.addEventListener('submit',async e=>{
      e.preventDefault(); const form=e.currentTarget,status=$('.form-status',form); status.textContent='Menyimpan profil...';
      try {
        const payload=Object.fromEntries(new FormData(form)); const data=await api('/api/profile',{method:'PATCH',body:JSON.stringify(payload)});
        stored=data.user; localStorage.setItem('kalyana_user',JSON.stringify(stored)); updateUserChip(); dashboardData.user=data.user; status.textContent=data.message; showToast(data.message);
      } catch(err){status.textContent=err.message;status.classList.add('is-error');}
    });
  }

  function renderMonitoring() {
    const users=dashboardData.users||{umkm:[],students:[]};
    const rows=[...users.umkm.map(u=>({...u,label:'UMKM'})),...users.students.map(u=>({...u,label:'Mahasiswa'}))].map(u=>{
      const key=[u.name,u.email,u.label].join(' ').toLowerCase();
      return `<tr class="admin-user-row" data-search-key="${escapeHTML(key)}"><td><strong>${escapeHTML(u.name)}</strong><small>${escapeHTML(u.email)}</small></td><td>${u.label}</td><td><span class="k-badge is-active">Aktif</span></td></tr>`;
    }).join('')||'<tr><td colspan="3"><div class="empty-state">Belum ada pengguna.</div></td></tr>';
    setContent(`${heading('Super Admin','Pengguna platform','Pantau akun UMKM dan mahasiswa yang terdaftar di Kalyana.')}<section class="k-stats compact-stats">${stat('Total pengguna',users.umkm.length+users.students.length,'UMKM dan mahasiswa','users')}${stat('UMKM',users.umkm.length,'Akun usaha','project')}${stat('Mahasiswa',users.students.length,'Akun mahasiswa','profile')}</section><section class="k-card k-table-card"><div class="k-card__head"><div><h3>Semua pengguna</h3><small>Data akun aktif</small></div></div><div class="table-scroll"><table class="k-table"><thead><tr><th>Pengguna</th><th>Role</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></section><div id="adminSearchEmpty" class="empty-state" hidden>Tidak ada pengguna yang cocok.</div>`);
    filterSearchCards('.admin-user-row','#adminSearchEmpty',pendingHeaderQuery);
  }

  function renderAdminProjects() {
    const projects=dashboardData.projects||[], users=dashboardData.users||{umkm:[]}, talents=dashboardData.talents||[];
    const rows=projects.map(p=>{const owner=users.umkm.find(u=>u.id===p.ownerId),talent=talents.find(t=>t.id===p.talentId),progress=Math.max(0,Math.min(100,Number(p.progress)||0)); return `<tr><td><strong>${escapeHTML(p.title)}</strong><small>${escapeHTML(p.service||'Project')}</small></td><td>${escapeHTML(owner?.name||'-')}</td><td>${escapeHTML(talent?.name||'-')}</td><td>${rupiah(p.budget)}</td><td><div class="progress-cell">${nativeProgress(progress,'project-overview-native-progress',`Progress ${p.title}`)}<small>${progress}%</small></div></td><td><span class="k-badge ${statusClass(p.status)}">${statusText(p.status)}</span></td></tr>`;}).join('')||'<tr><td colspan="6"><div class="empty-state">Belum ada project.</div></td></tr>';
    setContent(`${heading('Super Admin','Project platform','Pantau project yang dibuat UMKM dan dikerjakan mahasiswa.')}<section class="k-card k-table-card"><div class="k-card__head"><div><h3>Semua project</h3><small>${projects.length} project tercatat</small></div></div><div class="table-scroll"><table class="k-table"><thead><tr><th>Project</th><th>UMKM</th><th>Mahasiswa</th><th>Nilai</th><th>Progress</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></section>`);
  }

  function renderAdminTransactions() {
    const projects=dashboardData.projects||[], users=dashboardData.users||{umkm:[]};
    const total=projects.reduce((s,p)=>s+(Number(p.budget)||0),0),paid=projects.filter(p=>p.paymentStatus==='paid').reduce((s,p)=>s+(Number(p.budget)||0),0);
    const rows=projects.map(p=>{const owner=users.umkm.find(u=>u.id===p.ownerId);return `<tr><td><strong>${escapeHTML(p.title)}</strong><small>${escapeHTML(owner?.name||'UMKM')}</small></td><td>${rupiah(p.budget)}</td><td><span class="k-badge ${p.paymentStatus==='paid'?'is-done':'is-waiting'}">${paymentText(p.paymentStatus)}</span></td><td><span class="k-badge ${statusClass(p.status)}">${statusText(p.status)}</span></td></tr>`;}).join('')||'<tr><td colspan="4"><div class="empty-state">Belum ada transaksi.</div></td></tr>';
    setContent(`${heading('Super Admin','Transaksi platform','Pantau nilai project dan status pembayaran demo.')}<section class="finance-layout admin-finance"><article class="finance-total"><span>Total nilai project</span><b>${rupiah(total)}</b><small>${rupiah(paid)} sudah lunas</small></article><article class="k-card k-table-card"><div class="k-card__head"><div><h3>Rincian transaksi</h3><small>Read-only untuk Super Admin</small></div></div><div class="table-scroll"><table class="k-table"><thead><tr><th>Project</th><th>Nilai</th><th>Pembayaran</th><th>Status project</th></tr></thead><tbody>${rows}</tbody></table></div></article></section>`);
  }

  function filterSearchCards(selector,emptySelector,rawQuery) {
    const q=String(rawQuery||'').trim().toLowerCase(); let visible=0;
    $$(selector).forEach(el=>{ const match=!q||String(el.dataset.searchKey||'').includes(q); el.hidden=!match; if(match)visible++; });
    const empty=$(emptySelector); if(empty) empty.hidden=visible!==0 || $$(selector).length===0;
  }
  function syncHeaderSearch(value) { const input=$('#headerSearchInput'); if(input&&input.value!==value) input.value=value; }

  async function refreshDashboard(view) {
    dashboardData=await api('/api/dashboard');
    if (dashboardData.user) {
      stored={...stored,...dashboardData.user};
      localStorage.setItem('kalyana_user',JSON.stringify(stored));
      updateUserChip();
    }
    openView(view||location.hash.slice(1)||'summary',false);
  }

  function showToast(msg) {
    let toast=$('.dashboard-toast');
    if(!toast){toast=document.createElement('div');toast.className='dashboard-toast';document.body.appendChild(toast);}
    toast.textContent=msg;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),2600);
  }
  function closeSidebar(){ $('.app-sidebar').classList.remove('open'); document.body.classList.remove('sidebar-open'); }

  function openView(view='summary',updateHash=true) {
    const renderers={summary:renderSummary,monitoring:renderMonitoring,projects:renderProjects,talents:renderTalents,payments:()=>renderFinance('payments'),opportunities:renderOpportunities,portfolio:renderPortfolio,earnings:()=>renderFinance('earnings'),profile:renderProfile};
    const allowed=(menus[stored.role]||[]).some(item=>item.view===view);
    if(!renderers[view]||!allowed)view='summary';
    $$('button[data-view]',sideNav).forEach(btn=>{const active=btn.dataset.view===view;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));});
    const selected=$(`[data-view="${view}"] span:last-child`,sideNav);
    const titleText = toTitleCase(selected?.textContent || 'Ringkasan');
    $('#pageTitle').textContent = titleText;
    $('#breadcrumbText').textContent = titleText;
    renderers[view](); if(updateHash)history.replaceState(null,'','#'+view); closeSidebar();
  }

  sideNav.addEventListener('click',e=>{const btn=e.target.closest('button[data-view]');if(btn)openView(btn.dataset.view);});
  $('#logoutButton').addEventListener('click',()=>{localStorage.removeItem('kalyana_token');localStorage.removeItem('kalyana_user');location.replace('auth.html?mode=login');});
  $('#sidebarToggle')?.addEventListener('click',()=>{$('.app-sidebar').classList.toggle('open');document.body.classList.toggle('sidebar-open');});
  $('#mobileOverlay')?.addEventListener('click',closeSidebar);
  $('#profileQuickButton')?.addEventListener('click',()=>openView(stored.role==='super_admin'?'monitoring':'profile'));
  $('.notification')?.addEventListener('click',()=>{
    const count=stored.role==='umkm'?(dashboardData?.projects||[]).filter(p=>p.status==='active').length:stored.role==='talent'?(dashboardData?.opportunities||[]).filter(o=>!o.applied).length:0;
    showToast(count?`${count} item masih membutuhkan perhatian.`:'Tidak ada notifikasi baru.');
  });

  content.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ')&&e.target.matches('.project-row[data-focus-progress]')){
      e.preventDefault();
      e.target.click();
    }
  });

  content.addEventListener('click',async e=>{
    const go=e.target.closest('[data-go]'); if(go){openView(go.dataset.go);return;}
    const toast=e.target.closest('[data-toast]'); if(toast){showToast(toast.dataset.toast);return;}
    const apply=e.target.closest('[data-apply-opportunity]');
    if(apply){
      apply.disabled=true;apply.textContent='Mengirim...';
      try{const data=await api('/api/opportunities/'+encodeURIComponent(apply.dataset.applyOpportunity)+'/apply',{method:'POST',body:JSON.stringify({message:'Saya tertarik mengerjakan project ini.'})});showToast(data.message);await refreshDashboard('opportunities');}
      catch(err){showToast(err.message);apply.disabled=false;apply.textContent='Ajukan minat';}
      return;
    }
    const pay=e.target.closest('[data-pay-project]');
    if(pay){
      pay.disabled=true;pay.textContent='Mencatat...';
      try{const data=await api('/api/projects/'+encodeURIComponent(pay.dataset.payProject)+'/payment',{method:'POST',body:'{}'});showToast(data.message);await refreshDashboard('payments');}
      catch(err){showToast(err.message);pay.disabled=false;pay.textContent='Catat lunas';}
      return;
    }
    const start=e.target.closest('[data-start-project]');
    if(start){
      try{const data=await api('/api/projects/'+encodeURIComponent(start.dataset.startProject),{method:'PATCH',body:JSON.stringify({status:'active'})});showToast(data.message);await refreshDashboard('projects');}
      catch(err){showToast(err.message);} return;
    }
    const closeProgress=e.target.closest('[data-close-progress-dialog]');
    if(closeProgress){ $('#projectProgressDialog')?.close(); return; }
    const focus=e.target.closest('[data-focus-progress]');
    if(focus){
      const select=$('#progressProjectSelect'), dialog=$('#projectProgressDialog');
      if(select&&dialog){select.value=focus.dataset.focusProgress;select.dispatchEvent(new Event('change'));dialog.showModal();setTimeout(()=>$('#progressValue')?.focus(),0);} return;
    }
    const del=e.target.closest('[data-delete-portfolio]');
    if(del){
      if(!confirm('Hapus karya ini dari portofolio?'))return;
      try{const data=await api('/api/portfolio/'+encodeURIComponent(del.dataset.deletePortfolio),{method:'DELETE'});showToast(data.message);await refreshDashboard('portfolio');}
      catch(err){showToast(err.message);} return;
    }
  });

  const headerSearchInput=$('#headerSearchInput');
  const searchTargetByRole={umkm:'talents',talent:'opportunities',super_admin:'monitoring'};
  function applyHeaderSearch(value){
    pendingHeaderQuery=value;
    const current=location.hash.slice(1)||'summary', target=searchTargetByRole[stored.role];
    if(current!==target){openView(target);syncHeaderSearch(value);}
    if(stored.role==='umkm'){const input=$('#talentSearch');if(input)input.value=value;filterSearchCards('.talent-result','#talentEmpty',value);}
    if(stored.role==='talent')filterSearchCards('.opportunity-card','#opportunitySearchEmpty',value);
    if(stored.role==='super_admin')filterSearchCards('.admin-user-row','#adminSearchEmpty',value);
  }
  headerSearchInput?.addEventListener('input',e=>applyHeaderSearch(e.target.value));
  headerSearchInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyHeaderSearch(e.target.value.trim());}});
  window.addEventListener('hashchange',()=>{if(dashboardData)openView(location.hash.slice(1)||'summary',false);});

  content.innerHTML='<section class="loading-card"><b>Menyiapkan dashboard Anda...</b><p class="muted">Memuat data akun dan aktivitas terbaru.</p></section>';
  api('/api/dashboard').then(data=>{dashboardData=data;if(data.user){stored={...stored,...data.user};localStorage.setItem('kalyana_user',JSON.stringify(stored));updateUserChip();}openView(location.hash.slice(1)||'summary');}).catch(err=>{content.innerHTML=`<section class="loading-card"><b>Dashboard gagal dimuat</b><p class="muted">${escapeHTML(err.message)}</p></section>`;showToast(err.message);});
})();
