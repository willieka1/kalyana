const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./store');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const SECRET = process.env.SESSION_SECRET || 'kalyana-local-development-secret';
const LIMIT = 1e6;
const SERVICE_FEE_RATE = 0.18;

const MIME = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.json':'application/json; charset=utf-8'
};

function json(res, status, payload) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(payload));
}

function secure(res) {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; connect-src 'self'");
}

function body(req) {
  if (req.body !== undefined) {
    try { return Promise.resolve(typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}); }
    catch { return Promise.reject(Object.assign(new Error('Format JSON tidak valid'), {status:400})); }
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (Buffer.byteLength(raw) > LIMIT) {
        reject(Object.assign(new Error('Payload terlalu besar'), {status:413}));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(Object.assign(new Error('Format JSON tidak valid'), {status:400})); }
    });
    req.on('error', reject);
  });
}

const clean = (value, max = 160) => String(value || '').trim().replace(/[<>]/g,'').slice(0, max);
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const newId = prefix => prefix + '_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');
const now = () => new Date().toISOString();

function hashPassword(password, salt = crypto.randomBytes(12).toString('hex')) {
  return salt + ':' + crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
}

function passwordMatches(password, user) {
  if (!user.passwordHash) return user.password === password;
  const [salt] = user.passwordHash.split(':');
  const candidate = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(user.passwordHash));
}

function tokenFor(user) {
  const payload = Buffer.from(JSON.stringify({id:user.id, role:user.role, exp:Date.now() + 864e5})).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return payload + '.' + sig;
}

function session(req) {
  const [payload, sig] = String(req.headers.authorization || '').replace(/^Bearer\s+/,'').split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url'));
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}

const publicUser = user => ({id:user.id, name:user.name, email:user.email, role:user.role, profile:user.profile || {}});
const safeStatus = value => ['draft','active','completed'].includes(value) ? value : 'draft';
const projectNet = project => Math.round((Number(project.budget) || 0) * (1 - SERVICE_FEE_RATE));

async function talentForUser(user, talents = null) {
  if (!user) return null;
  const all = talents || await store.list('talents');
  return all.find(t => t.userId === user.id) || all.find(t => t.name === user.name) || null;
}

function projectStats(projects) {
  return {
    active: projects.filter(p => p.status === 'active').length,
    draft: projects.filter(p => p.status === 'draft').length,
    completed: projects.filter(p => p.status === 'completed').length,
    totalValue: projects.reduce((n,p) => n + (Number(p.budget) || 0), 0),
    paidTotal: projects.filter(p => p.paymentStatus === 'paid').reduce((n,p) => n + (Number(p.budget) || 0), 0)
  };
}

async function requireAuth(req, res) {
  const auth = session(req);
  if (!auth) { json(res, 401, {error:'Silakan login terlebih dahulu.'}); return null; }
  const user = await store.get('users', auth.id);
  if (!user) { json(res, 401, {error:'Sesi tidak lagi valid. Silakan login ulang.'}); return null; }
  return {auth, user};
}

async function api(req, res, url) {
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/health') {
    await store.health();
    return json(res, 200, {ok:true, service:'Kalyana API', database:process.env.VERCEL ? 'Memory (Vercel demo)' : 'Local JSON / memory test', time:now()});
  }

  if (req.method === 'GET' && pathname === '/api/talents') {
    const category = clean(url.searchParams.get('category'), 30);
    const all = await store.list('talents');
    const data = all.filter(t => !category || category === 'all' || t.category === category);
    return json(res, 200, {data, count:data.length});
  }

  if (req.method === 'POST' && pathname === '/api/registrations') {
    const b = await body(req);
    const name = clean(b.name,80), email = clean(b.email,120).toLowerCase(), role = clean(b.role,30);
    if (name.length < 2 || !validEmail(email) || !['UMKM','Talent Mahasiswa'].includes(role)) return json(res,422,{error:'Nama, email, atau peran belum valid.'});
    if (await store.findOne('registrations','email',email)) return json(res,409,{error:'Email ini sudah pernah didaftarkan.'});
    const record = {id:newId('reg'), name, email, role, status:'new', createdAt:now()};
    await store.create('registrations', record);
    return json(res,201,{message:'Pendaftaran berhasil diterima.', data:record});
  }

  if (req.method === 'POST' && pathname === '/api/auth/register') {
    const b = await body(req);
    const name = clean(b.name,80), email = clean(b.email,120).toLowerCase(), role = clean(b.role,20), password = String(b.password || '');
    const organization = clean(b.organization,100), study = clean(b.study,100), category = clean(b.category,60);
    if (name.length < 2 || !validEmail(email) || !['umkm','talent'].includes(role) || password.length < 6) return json(res,422,{error:'Nama, email, role, atau kata sandi belum valid.'});
    if (await store.findOne('users','email',email)) return json(res,409,{error:'Email sudah digunakan.'});
    const profile = role === 'umkm'
      ? {businessName:organization || name, businessCategory:category || 'Belum diatur', detail:organization || name, bio:''}
      : {campus:organization || 'Belum diatur', studyProgram:study || 'Belum diatur', detail:study || 'Belum diatur', skill:category || 'Desain Grafis', bio:''};
    const user = {id:newId('usr'), name, email, role, passwordHash:hashPassword(password), createdAt:now(), profile};
    await store.create('users', user);
    if (role === 'talent') {
      const roleName = category || 'Graphic Designer';
      await store.create('talents', {id:newId('tal'), userId:user.id, name, category:'design', role:roleName, city:'Indonesia', rating:0, reviews:0, price:350000, initials:name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase(), portfolio:'Portofolio belum diisi', verified:false});
    }
    return json(res,201,{message:'Akun berhasil dibuat.', token:tokenFor(user), user:publicUser(user)});
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const b = await body(req), email = clean(b.email,120).toLowerCase();
    let user = await store.findOne('users','email',email);
    if (!user && email === 'admin@kalyana.test') {
      user = {id:'usr_super_admin',name:'Super Admin',email:'admin@kalyana.test',role:'super_admin',password:'admin234',createdAt:now(),profile:{}};
      await store.create('users',user);
    }
    if (!user || !passwordMatches(String(b.password || ''),user)) return json(res,401,{error:'Email atau kata sandi salah.'});
    return json(res,200,{message:'Login berhasil.', token:tokenFor(user), user:publicUser(user)});
  }

  const secured = await requireAuth(req, res);
  if (!secured) return;
  const {auth, user} = secured;

  if (req.method === 'GET' && pathname === '/api/auth/me') return json(res,200,{user:publicUser(user)});

  if (req.method === 'PATCH' && pathname === '/api/profile') {
    if (user.role === 'super_admin') return json(res,403,{error:'Profil Super Admin tidak dapat diubah dari halaman ini.'});
    const b = await body(req);
    const name = clean(b.name,80);
    if (name.length < 2) return json(res,422,{error:'Nama minimal 2 karakter.'});
    const profile = {...(user.profile || {})};
    profile.detail = clean(b.detail,120);
    profile.bio = clean(b.bio,1200);
    if (user.role === 'umkm') profile.businessName = profile.detail || profile.businessName || name;
    else profile.studyProgram = profile.detail || profile.studyProgram || 'Belum diatur';
    const updated = await store.update('users', user.id, {name, profile, updatedAt:now()});
    if (user.role === 'talent') {
      const talent = await talentForUser(user);
      if (talent) await store.update('talents', talent.id, {name});
    }
    return json(res,200,{message:'Profil berhasil disimpan.', user:publicUser(updated)});
  }

  if (req.method === 'GET' && pathname === '/api/dashboard') {
    const [projects, talents, opportunities, applications, portfolio] = await Promise.all([
      store.list('projects'), store.list('talents'), store.list('opportunities'), store.list('applications'), store.list('portfolio')
    ]);

    if (user.role === 'super_admin') {
      const users = await store.list('users');
      const umkm = users.filter(u => u.role === 'umkm'), students = users.filter(u => u.role === 'talent');
      const stats = projectStats(projects);
      return json(res,200,{role:'super_admin',stats:{totalUsers:umkm.length + students.length,umkm:umkm.length,students:students.length,activeProjects:stats.active,totalTransactions:stats.totalValue,paidTransactions:stats.paidTotal},users:{umkm:umkm.map(publicUser),students:students.map(publicUser)},projects,talents});
    }

    if (user.role === 'umkm') {
      const own = projects.filter(p => p.ownerId === user.id).sort((a,b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
      const stats = projectStats(own);
      return json(res,200,{role:'umkm',stats:{active:stats.active,draft:stats.draft,completed:stats.completed,spent:stats.totalValue,paid:stats.paidTotal},projects:own,talents,user:publicUser(user)});
    }

    const talent = await talentForUser(user, talents);
    const assigned = projects.filter(p => p.talentId === talent?.id).sort((a,b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    const stats = projectStats(assigned);
    const appliedIds = new Set(applications.filter(a => a.userId === user.id).map(a => a.opportunityId));
    const openOpps = opportunities.filter(o => o.status !== 'closed').map(o => ({...o, applied:appliedIds.has(o.id)}));
    const ownPortfolio = portfolio.filter(item => item.userId === user.id).sort((a,b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const earnings = assigned.filter(p => p.paymentStatus === 'paid').reduce((sum,p) => sum + projectNet(p), 0);
    return json(res,200,{role:'talent',stats:{active:stats.active,draft:stats.draft,completed:stats.completed,rating:talent?.rating || 0,earnings,workValue:stats.totalValue,paidWorkValue:stats.paidTotal},projects:assigned,opportunities:openOpps,portfolio:ownPortfolio,talent,user:publicUser(user)});
  }

  if (req.method === 'GET' && pathname === '/api/admin/users') {
    if (auth.role !== 'super_admin') return json(res,403,{error:'Akses khusus Super Admin.'});
    const users = await store.list('users');
    const data = users.filter(u => u.role === 'umkm' || u.role === 'talent').map(publicUser);
    return json(res,200,{data,count:data.length});
  }

  if (req.method === 'GET' && pathname === '/api/projects') {
    const [projects,talents] = await Promise.all([store.list('projects'),store.list('talents')]);
    let data = projects;
    if (auth.role === 'umkm') data = projects.filter(p => p.ownerId === auth.id);
    if (auth.role === 'talent') {
      const talent = await talentForUser(user, talents);
      data = projects.filter(p => p.talentId === talent?.id);
    }
    return json(res,200,{data,count:data.length});
  }

  if (req.method === 'POST' && pathname === '/api/projects') {
    if (auth.role !== 'umkm') return json(res,403,{error:'Hanya akun UMKM yang dapat membuat project.'});
    const b = await body(req);
    const title = clean(b.title,120), service = clean(b.service,60), talentId = clean(b.talentId,60), budget = Number(b.budget), deadline = clean(b.deadline,10);
    if (title.length < 5 || !['Desain Grafis','Copywriting','Video Editing'].includes(service) || !await store.get('talents',talentId) || !Number.isFinite(budget) || budget < 300000) return json(res,422,{error:'Data project belum valid.'});
    const record = {id:newId('prj'),ownerId:auth.id,title,service,talentId,budget,status:'draft',progress:0,deadline:deadline || null,paymentStatus:'unpaid',createdAt:now(),updatedAt:now()};
    await store.create('projects',record);
    return json(res,201,{message:'Project berhasil dibuat dan masuk status Menunggu.',data:record});
  }

  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch && req.method === 'PATCH') {
    const id = clean(projectMatch[1],80), project = await store.get('projects',id);
    if (!project) return json(res,404,{error:'Project tidak ditemukan.'});
    const talent = auth.role === 'talent' ? await talentForUser(user) : null;
    const isOwner = auth.role === 'umkm' && project.ownerId === auth.id;
    const isTalent = auth.role === 'talent' && project.talentId === talent?.id;
    if (!isOwner && !isTalent) return json(res,403,{error:'Anda tidak memiliki akses untuk mengubah project ini.'});
    const b = await body(req), patch = {updatedAt:now()};

    if (isTalent) {
      if (b.progress !== undefined) {
        const progress = Number(b.progress);
        if (!Number.isFinite(progress) || progress < 0 || progress > 100) return json(res,422,{error:'Progress harus 0 sampai 100.'});
        patch.progress = Math.round(progress);
        patch.status = progress >= 100 ? 'completed' : progress > 0 ? 'active' : safeStatus(project.status);
      }
      if (b.status !== undefined) patch.status = safeStatus(clean(b.status,20));
      if (patch.status === 'completed') patch.progress = 100;
    }

    if (isOwner) {
      if (b.title !== undefined) { const title=clean(b.title,120); if (title.length<5) return json(res,422,{error:'Judul project terlalu pendek.'}); patch.title=title; }
      if (b.deadline !== undefined) patch.deadline = clean(b.deadline,10) || null;
      if (b.status !== undefined) {
        const requested = safeStatus(clean(b.status,20));
        if (!['draft','active','completed'].includes(requested)) return json(res,422,{error:'Status project tidak valid.'});
        patch.status = requested;
        if (requested === 'completed') patch.progress = 100;
      }
    }

    const updated = await store.update('projects',id,patch);
    return json(res,200,{message:'Project berhasil diperbarui.',data:updated});
  }

  const paymentMatch = pathname.match(/^\/api\/projects\/([^/]+)\/payment$/);
  if (paymentMatch && req.method === 'POST') {
    if (auth.role !== 'umkm') return json(res,403,{error:'Hanya pemilik UMKM yang dapat mencatat pembayaran.'});
    const id = clean(paymentMatch[1],80), project = await store.get('projects',id);
    if (!project || project.ownerId !== auth.id) return json(res,404,{error:'Project tidak ditemukan.'});
    if (project.paymentStatus === 'paid') return json(res,409,{error:'Project ini sudah tercatat lunas.'});
    const updated = await store.update('projects',id,{paymentStatus:'paid',paidAt:now(),updatedAt:now()});
    return json(res,200,{message:'Pembayaran demo berhasil dicatat sebagai lunas.',data:updated});
  }

  if (req.method === 'GET' && pathname === '/api/opportunities') {
    if (auth.role !== 'talent') return json(res,403,{error:'Peluang project hanya tersedia untuk mahasiswa.'});
    const [opportunities,applications] = await Promise.all([store.list('opportunities'),store.list('applications')]);
    const applied = new Set(applications.filter(a => a.userId === auth.id).map(a => a.opportunityId));
    const data = opportunities.filter(o=>o.status!=='closed').map(o=>({...o,applied:applied.has(o.id)}));
    return json(res,200,{data,count:data.length});
  }

  const applyMatch = pathname.match(/^\/api\/opportunities\/([^/]+)\/apply$/);
  if (applyMatch && req.method === 'POST') {
    if (auth.role !== 'talent') return json(res,403,{error:'Hanya mahasiswa yang dapat mengajukan minat.'});
    const opportunityId = clean(applyMatch[1],80), opportunity = await store.get('opportunities',opportunityId);
    if (!opportunity || opportunity.status === 'closed') return json(res,404,{error:'Peluang project tidak tersedia.'});
    const existing = (await store.list('applications')).find(a => a.userId === auth.id && a.opportunityId === opportunityId);
    if (existing) return json(res,409,{error:'Anda sudah mengajukan minat pada project ini.'});
    const b = await body(req);
    const record = {id:newId('app'),opportunityId,userId:auth.id,message:clean(b.message,500),status:'submitted',createdAt:now()};
    await store.create('applications',record);
    return json(res,201,{message:'Minat project berhasil dikirim.',data:record});
  }

  if (req.method === 'GET' && pathname === '/api/portfolio') {
    if (auth.role !== 'talent') return json(res,403,{error:'Portofolio hanya tersedia untuk mahasiswa.'});
    const data = (await store.list('portfolio')).filter(item=>item.userId===auth.id);
    return json(res,200,{data,count:data.length});
  }

  if (req.method === 'POST' && pathname === '/api/portfolio') {
    if (auth.role !== 'talent') return json(res,403,{error:'Portofolio hanya tersedia untuk mahasiswa.'});
    const b = await body(req), title = clean(b.title,120), category = clean(b.category,60), description = clean(b.description,600);
    if (title.length < 3 || category.length < 2) return json(res,422,{error:'Judul dan kategori portofolio wajib diisi.'});
    const record = {id:newId('port'),userId:auth.id,title,category,description,image:'assets/images/kalyana-project-board.png',createdAt:now()};
    await store.create('portfolio',record);
    return json(res,201,{message:'Karya berhasil ditambahkan ke portofolio.',data:record});
  }

  const portfolioMatch = pathname.match(/^\/api\/portfolio\/([^/]+)$/);
  if (portfolioMatch && req.method === 'DELETE') {
    if (auth.role !== 'talent') return json(res,403,{error:'Portofolio hanya tersedia untuk mahasiswa.'});
    const id = clean(portfolioMatch[1],80), item = await store.get('portfolio',id);
    if (!item || item.userId !== auth.id) return json(res,404,{error:'Karya tidak ditemukan.'});
    await store.remove('portfolio',id);
    return json(res,200,{message:'Karya berhasil dihapus.'});
  }

  return json(res,404,{error:'Endpoint tidak ditemukan.'});
}

function staticFile(req,res,url) {
  let name = decodeURIComponent(url.pathname);
  const aliases = {'/auth':'/auth.html','/dashboard':'/dashboard.html'};
  if (aliases[name]) name = aliases[name];
  if (name === '/') name = '/index.html';
  const file = path.resolve(ROOT,'.' + name);
  if (!file.startsWith(ROOT + path.sep)) return json(res,403,{error:'Akses ditolak.'});
  fs.stat(file,(err,stat)=>{
    if (err || !stat.isFile()) return json(res,404,{error:'Halaman tidak ditemukan.'});
    res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()] || 'application/octet-stream','Cache-Control':path.extname(file).toLowerCase()==='.html'?'no-cache':'public, max-age=3600'});
    fs.createReadStream(file).pipe(res);
  });
}

const handler = async (req,res) => {
  secure(res);
  const url = new URL(req.url,'http://' + (req.headers.host || 'localhost'));
  try {
    if (url.pathname.startsWith('/api/')) await api(req,res,url);
    else if (['GET','HEAD'].includes(req.method)) staticFile(req,res,url);
    else json(res,405,{error:'Metode tidak diizinkan.'});
  } catch (error) {
    console.error(error);
    json(res,error.status || 500,{error:error.status ? error.message : 'Terjadi kesalahan pada server.'});
  }
};

const server = http.createServer(handler);
if (require.main === module) server.listen(PORT,()=>console.log('Kalyana berjalan di http://localhost:' + PORT));
module.exports = {server,handler};
