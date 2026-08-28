const assert = require('assert');
process.env.PORT = '0';
process.env.KALYANA_USE_MEMORY_DB = '1';
const {server} = require('./server');

async function request(base,path,options={}) {
  const response = await fetch(base+path,options);
  const type = response.headers.get('content-type') || '';
  const data = type.includes('json') ? await response.json() : await response.text();
  return {response,data};
}
const authHeaders = token => ({Authorization:'Bearer '+token,'Content-Type':'application/json'});

server.listen(0,async()=>{
  const base='http://127.0.0.1:'+server.address().port;
  try {
    let result=await request(base,'/api/health'); assert.equal(result.response.status,200);
    result=await request(base,'/auth'); assert.equal(result.response.status,200); assert.match(result.data,/Masuk ke Kalyana/);
    result=await request(base,'/dashboard'); assert.equal(result.response.status,200); assert.match(result.data,/Dashboard Kalyana/);

    result=await request(base,'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'umkm@kalyana.test',password:'demo123'})});
    assert.equal(result.response.status,200); const umkmToken=result.data.token;
    result=await request(base,'/api/dashboard',{headers:{Authorization:'Bearer '+umkmToken}});
    assert.equal(result.data.role,'umkm');
    assert.equal(result.data.projects.length,4);
    assert.equal(result.data.stats.spent,4300000);
    assert.equal(result.data.stats.active,2);
    assert.equal(result.data.stats.draft,1);
    assert.equal(result.data.stats.completed,1);

    // UMKM membuat project baru.
    result=await request(base,'/api/projects',{method:'POST',headers:authHeaders(umkmToken),body:JSON.stringify({title:'Project Uji Fungsional',service:'Desain Grafis',talentId:'tal_akila',budget:500000,deadline:'2026-10-01'})});
    assert.equal(result.response.status,201); const newProjectId=result.data.data.id;
    assert.equal(result.data.data.status,'draft');

    result=await request(base,'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'talent@kalyana.test',password:'demo123'})});
    assert.equal(result.response.status,200); const talentToken=result.data.token;
    result=await request(base,'/api/dashboard',{headers:{Authorization:'Bearer '+talentToken}});
    assert.equal(result.data.role,'talent'); assert.ok(result.data.opportunities.length>=1); assert.ok(result.data.portfolio.length>=2);

    // Mahasiswa memperbarui progress project yang ditugaskan.
    result=await request(base,'/api/projects/'+newProjectId,{method:'PATCH',headers:authHeaders(talentToken),body:JSON.stringify({progress:55})});
    assert.equal(result.response.status,200); assert.equal(result.data.data.progress,55); assert.equal(result.data.data.status,'active');

    // Pengajuan peluang project mencegah duplikasi.
    result=await request(base,'/api/opportunities/opp_1/apply',{method:'POST',headers:authHeaders(talentToken),body:JSON.stringify({message:'Saya tertarik.'})});
    assert.equal(result.response.status,201);
    result=await request(base,'/api/opportunities/opp_1/apply',{method:'POST',headers:authHeaders(talentToken),body:JSON.stringify({message:'Saya tertarik lagi.'})});
    assert.equal(result.response.status,409);

    // Portofolio dapat ditambah dan dihapus.
    result=await request(base,'/api/portfolio',{method:'POST',headers:authHeaders(talentToken),body:JSON.stringify({title:'Karya Uji',category:'Branding',description:'Karya pengujian.'})});
    assert.equal(result.response.status,201); const portfolioId=result.data.data.id;
    result=await request(base,'/api/portfolio/'+portfolioId,{method:'DELETE',headers:{Authorization:'Bearer '+talentToken}}); assert.equal(result.response.status,200);

    // Profil tersimpan di backend.
    result=await request(base,'/api/profile',{method:'PATCH',headers:authHeaders(talentToken),body:JSON.stringify({name:'Akila Amelia',detail:'DKV',bio:'Bio uji.'})});
    assert.equal(result.response.status,200); assert.equal(result.data.user.profile.bio,'Bio uji.');

    // UMKM dapat mencatat pembayaran demo.
    result=await request(base,'/api/projects/'+newProjectId+'/payment',{method:'POST',headers:authHeaders(umkmToken),body:'{}'});
    assert.equal(result.response.status,200); assert.equal(result.data.data.paymentStatus,'paid');

    result=await request(base,'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@kalyana.test',password:'admin234'})});
    assert.equal(result.response.status,200); assert.equal(result.data.user.role,'super_admin'); const adminToken=result.data.token;
    result=await request(base,'/api/dashboard',{headers:{Authorization:'Bearer '+adminToken}}); assert.equal(result.data.role,'super_admin'); assert.ok(result.data.users.umkm); assert.ok(result.data.users.students); assert.ok(Array.isArray(result.data.projects)); assert.ok(Array.isArray(result.data.talents));
    result=await request(base,'/api/projects',{headers:{Authorization:'Bearer '+adminToken}}); assert.equal(result.response.status,200); assert.ok(result.data.count>=5);
    result=await request(base,'/api/admin/users',{headers:{Authorization:'Bearer '+adminToken}}); assert.equal(result.response.status,200); assert.ok(result.data.count>=2);

    result=await request(base,'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Talent Uji',email:'talent.uji@kalyana.test',password:'rahasia123',role:'talent',organization:'Universitas Uji',study:'DKV',category:'Desain Grafis'})});
    assert.equal(result.response.status,201); assert.equal(result.data.user.role,'talent');
    result=await request(base,'/api/auth/me',{headers:{Authorization:'Bearer '+result.data.token}}); assert.equal(result.data.user.email,'talent.uji@kalyana.test');

    console.log('Semua pengujian halaman, role, project, progress, peluang, portofolio, profil, pembayaran, dan admin berhasil.');
  } catch(error) {
    console.error(error); process.exitCode=1;
  } finally { server.close(); }
});
