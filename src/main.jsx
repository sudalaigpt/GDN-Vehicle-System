import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import {Bike, ShieldCheck, MonitorCog, LogIn, LogOut, Search, History, Truck, FileDown, RefreshCw, CircleUserRound} from 'lucide-react';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;
const TYPES = ['Truck/Lorry','Tanker','Car/Jeep','Van','Bus','Trailer','Two Wheeler','Other'];
const emptyForm = {reg_no:'', vehicle_type:'Truck/Lorry', company:'', driver_name:'', driver_mobile:'', purpose:''};

function App(){
  const [session,setSession]=useState(null), [profile,setProfile]=useState(null);
  const [email,setEmail]=useState(''), [password,setPassword]=useState('');
  const [page,setPage]=useState('home'), [busy,setBusy]=useState(false), [notice,setNotice]=useState('');
  const [vehicles,setVehicles]=useState([]), [visits,setVisits]=useState([]);
  const [search,setSearch]=useState(''), [matches,setMatches]=useState([]), [selected,setSelected]=useState(null);
  const [form,setForm]=useState(emptyForm), [filter,setFilter]=useState('');
  const role=profile?.role || '';
  const inside=useMemo(()=>visits.filter(v=>!v.out_at),[visits]);

  useEffect(()=>{
    if(!supabase){setNotice('Supabase configuration is missing. Check .env.local and restart the app.');return;}
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));
    return ()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{ if(session?.user) loadProfile(); else {setProfile(null);setVehicles([]);setVisits([]);} },[session?.user?.id]);
  useEffect(()=>{ if(profile?.active) refreshData(); },[profile?.id,profile?.active]);

  async function loadProfile(){
    const {data,error}=await supabase.from('profiles').select('id,employee_id,display_name,role,active').eq('id',session.user.id).maybeSingle();
    if(error){setNotice('Profile read failed: '+error.message);return;}
    if(!data || !data.active){await supabase.auth.signOut();setNotice('இந்தக் கணக்கிற்கு செயலில் உள்ள GDN profile இல்லை. Admin-ஐ தொடர்புகொள்ளவும்.');return;}
    setProfile(data);
  }
  async function refreshData(){
    setBusy(true);
    const [v,r]=await Promise.all([
      supabase.from('vehicles').select('*').order('updated_at',{ascending:false}),
      supabase.from('vehicle_visits').select('*, vehicles(id,reg_no,vehicle_type,company,driver_name,driver_mobile)').order('in_at',{ascending:false}).limit(1000)
    ]);
    setBusy(false);
    if(v.error || r.error){setNotice('Database load error: '+(v.error?.message||r.error?.message));return;}
    setVehicles(v.data||[]);
    setVisits((r.data||[]).map(x=>({...x,reg_no:x.vehicles?.reg_no||'—',vehicle_type:x.vehicles?.vehicle_type||'',company:x.vehicles?.company||'',driver_name:x.vehicles?.driver_name||'',driver_mobile:x.vehicles?.driver_mobile||'',status:x.out_at?'OUT':'IN'})));
  }
  async function login(e){
    e.preventDefault(); if(!supabase){setNotice('Supabase configuration missing.');return;}
    setBusy(true); const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password}); setBusy(false);
    if(error)setNotice('Login failed: '+error.message); else {setPassword('');setNotice('Login successful. Loading GDN profile…');}
  }
  async function logout(){await supabase.auth.signOut();setPage('home');setNotice('Logged out.');}
  const upd=(k,v)=>setForm(f=>({...f,[k]:v}));
  function findVehicle(){
    const q=search.replace(/\D/g,'');
    if(q.length!==4){setNotice('கடைசி 4 இலக்கங்களை உள்ளிடுங்கள்.');return;}
    const found=vehicles.filter(v=>v.reg_no.replace(/\D/g,'').endsWith(q));
    setMatches(found);setSelected(found.length===1?found[0]:null);
    if(found.length===1) setForm({...emptyForm,...found,purpose:''});
    else setForm({...emptyForm});
    setNotice(found.length?`${found.length} பொருத்தங்கள் கிடைத்தன. முழு பதிவு எண்ணைத் தேர்வு செய்யவும்.`:'பதிவு இல்லை. புதிய வாகனமாக உள்ளிடலாம்.');
  }
  function choose(v){setSelected(v);setForm({reg_no:v.reg_no,vehicle_type:v.vehicle_type,company:v.company||'',driver_name:v.driver_name||'',driver_mobile:v.driver_mobile||'',purpose:''});}
  async function saveIn(){
    if(!form.reg_no.trim()||!form.driver_name.trim()){setNotice('வாகன பதிவு எண் மற்றும் ஓட்டுநர் பெயர் அவசியம்.');return;}
    setBusy(true);
    try{
      let vehicle=selected;
      if(vehicle){
        const {data,error}=await supabase.from('vehicles').update({reg_no:form.reg_no.trim().toUpperCase(),vehicle_type:form.vehicle_type,company:form.company,driver_name:form.driver_name,driver_mobile:form.driver_mobile,updated_at:new Date().toISOString()}).eq('id',vehicle.id).select().single();
        if(error)throw error; vehicle=data;
      } else {
        const {data,error}=await supabase.from('vehicles').insert({reg_no:form.reg_no.trim().toUpperCase(),vehicle_type:form.vehicle_type,company:form.company,driver_name:form.driver_name,driver_mobile:form.driver_mobile}).select().single();
        if(error)throw error; vehicle=data;
      }
      const {data:active,error:checkError}=await supabase.from('vehicle_visits').select('id').eq('vehicle_id',vehicle.id).is('out_at',null).maybeSingle();
      if(checkError)throw checkError;
      if(active)throw new Error('இந்த வாகனம் ஏற்கெனவே IN நிலையில் உள்ளது.');
      const {error}=await supabase.from('vehicle_visits').insert({vehicle_id:vehicle.id,gate_id:'GDN-GATE-01',visit_purpose:form.purpose||null,in_by:session.user.id});
      if(error)throw error;
      setNotice(vehicle.reg_no+' – Vehicle IN பதிவு வெற்றிகரமாகச் சேமிக்கப்பட்டது.');
      setForm(emptyForm);setSelected(null);setMatches([]);setSearch('');setPage('home');await refreshData();
    }catch(e){setNotice('சேமிக்க முடியவில்லை: '+e.message);}
    finally{setBusy(false);}
  }
  async function vehicleOut(v){
    if(!confirm(`${v.reg_no} வாகனத்தை OUT செய்யவா?`))return;
    setBusy(true);
    const {data:active,error:findError}=await supabase.from('vehicle_visits').select('id').eq('vehicle_id',v.id).is('out_at',null).maybeSingle();
    if(findError||!active){setBusy(false);setNotice(findError?.message||'இந்த வாகனத்திற்கு Active IN பதிவு இல்லை.');return;}
    const {error}=await supabase.from('vehicle_visits').update({out_at:new Date().toISOString(),out_by:session.user.id}).eq('id',active.id);
    setBusy(false);if(error)setNotice('OUT பதிவு தோல்வி: '+error.message);else{setNotice(v.reg_no+' – OUT பதிவு செய்யப்பட்டது.');await refreshData();}
  }
  function exportCsv(){
    const rows=[['Registration','Vehicle Type','Driver','Mobile','Company','Purpose','IN Time','OUT Time','Status'],...visits.map(v=>[v.reg_no,v.vehicle_type,v.driver_name,v.driver_mobile,v.company,v.visit_purpose,v.in_at,v.out_at||'',v.status])];
    const csv='\ufeff'+rows.map(r=>r.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(',')).join('\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='GDN-vehicle-report.csv';a.click();URL.revokeObjectURL(a.href);
  }
  if(!supabase)return <main className="login"><section className="loginbox"><h2>Supabase configuration missing</h2><p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then restart.</p></section></main>;
  if(!session)return <main className="login"><div className="brand"><div className="logo"><b>GDN</b><Bike size={44}/></div><h1>Vehicle Reporting System</h1><p>GDN-GATE-01 · Security Gate</p></div><form className="loginbox" onSubmit={login}><h2>Secure Login</h2><label>Email address<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button className="primary" disabled={busy}><LogIn size={17}/>{busy?'Please wait…':'Sign in'}</button><p className="muted">Use the email and password of an existing Supabase Auth user. Security PIN login needs a separate secure Edge Function and is not enabled in this build.</p>{notice&&<p className="notice">{notice}</p>}</form></main>;
  if(!profile)return <main className="login"><section className="loginbox"><h2>Checking GDN access…</h2><p>{notice||'Loading your profile and role.'}</p><button className="outline" onClick={logout}>Cancel / Logout</button></section></main>;
  if(!['admin','security'].includes(role))return <main className="login"><section className="loginbox"><h2>Access denied</h2><p>This profile does not have an allowed GDN role.</p><button className="outline" onClick={logout}>Logout</button></section></main>;

  const visibleVisits=visits.filter(v=>!filter||v.reg_no.toLowerCase().includes(filter.toLowerCase()));
  return <div className="app"><header><div className="brandmini"><div className="miniLogo"><Bike/></div><div><b>GDN</b><small>Vehicle Reporting System</small></div></div><div className="user"><span>{profile.display_name} · {role.toUpperCase()}</span><button className="outline small" onClick={logout}>Logout</button></div></header>
    <nav>{[['home','Dashboard',Truck],['in','Vehicle IN',LogIn],['out','Vehicle OUT',LogOut],['history','History',History]].map(([id,label,Icon])=><button className={page===id?'active':''} onClick={()=>setPage(id)} key={id}><Icon size={17}/>{label}</button>)}</nav>
    <main className="content">{notice&&<div className="notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
      {page==='home'&&<><h2>{role==='admin'?'Admin Dashboard':'Security Dashboard'}</h2><div className="stats"><article><small>Currently Inside</small><strong>{inside.length}</strong></article><article><small>Total Visit Records</small><strong>{visits.length}</strong></article><article><small>Registered Vehicles</small><strong>{vehicles.length}</strong></article><article><small>Completed OUT</small><strong>{visits.filter(v=>v.out_at).length}</strong></article></div><div className="quick"><button onClick={()=>{setPage('in');setSearch('');setSelected(null);setMatches([]);setForm(emptyForm)}}><LogIn/> Vehicle IN</button><button onClick={()=>setPage('out')}><LogOut/> Vehicle OUT</button><button onClick={()=>setPage('history')}><History/> Visit History</button>{role==='admin'&&<button onClick={exportCsv}><FileDown/> Export CSV</button>}<button className="outline" onClick={refreshData}><RefreshCw/> Refresh</button></div><h3>Vehicles Currently Inside</h3><VehicleTable rows={inside} onOut={vehicleOut}/></>}
      {page==='in'&&<><h2>Vehicle IN Entry</h2><section className="panel"><label>Enter last 4 digits of registration number</label><div className="searchrow"><input value={search} maxLength="4" inputMode="numeric" placeholder="e.g. 1234" onChange={e=>setSearch(e.target.value.replace(/\D/g,'').slice(0,4))}/><button onClick={findVehicle}><Search size={17}/> Search</button></div><p className="muted">If multiple vehicles match, select the correct full registration number.</p></section>{matches.length>0&&<section className="panel"><h3>Matching Vehicles</h3>{matches.map(v=><button className={'match '+(selected?.id===v.id?'chosen':'')} onClick={()=>choose(v)} key={v.id}>{v.reg_no} · {v.vehicle_type} · {v.company||'—'}</button>)}</section>}{(selected||matches.length===0)&&<section className="panel"><h3>{selected?'Verify Vehicle Details':'New Vehicle / Manual Registration'}</h3><div className="formgrid"><Field label="Full Registration Number" value={form.reg_no} onChange={v=>upd('reg_no',v.toUpperCase())}/><label>Vehicle Type<select value={form.vehicle_type} onChange={e=>upd('vehicle_type',e.target.value)}>{TYPES.map(x=><option key={x}>{x}</option>)}</select></label><Field label="Company" value={form.company} onChange={v=>upd('company',v)}/><Field label="Driver Name *" value={form.driver_name} onChange={v=>upd('driver_name',v)}/><Field label="Driver Mobile" value={form.driver_mobile} onChange={v=>upd('driver_mobile',v)}/><Field label="Visit Purpose" value={form.purpose} onChange={v=>upd('purpose',v)}/></div><button className="primary" disabled={busy} onClick={saveIn}>{busy?'Saving…':'Submit this vehicle IN'}</button></section>}</>}
      {page==='out'&&<><h2>Vehicle OUT Entry</h2><section className="panel"><label>Vehicles currently inside</label><VehicleTable rows={inside} onOut={vehicleOut}/></section></>}
      {page==='history'&&<><div className="headingrow"><h2>Vehicle Visit History</h2>{role==='admin'&&<button onClick={exportCsv}><FileDown size={17}/> Export CSV</button>}</div><section className="panel"><div className="searchrow"><input placeholder="Filter registration number" value={filter} onChange={e=>setFilter(e.target.value)}/><button className="outline" onClick={()=>setFilter('')}><RefreshCw size={16}/> Clear</button></div><VehicleTable rows={visibleVisits} history/></section></>}
    </main><footer>GDN · GDN-GATE-01 · Single Security Gate · Photo capture disabled · {busy?'Working…':'Connected'}</footer>
  </div>;
}
function Field({label,value,onChange}){return <label>{label}<input value={value||''} onChange={e=>onChange(e.target.value)}/></label>}
function VehicleTable({rows,onOut,history=false}){return <div className="tablewrap"><table><thead><tr><th>Registration</th><th>Driver</th><th>Company</th><th>{history?'IN Time':'Status'}</th>{history&&<th>OUT Time</th>}<th></th></tr></thead><tbody>{rows.length?rows.map(v=><tr key={v.id}><td><b>{v.reg_no}</b></td><td>{v.driver_name}</td><td>{v.company||'—'}</td><td>{history?new Date(v.in_at).toLocaleString():<span className="pill">IN</span>}</td>{history&&<td>{v.out_at?new Date(v.out_at).toLocaleString():'—'}</td>}<td>{!history&&onOut&&<button className="danger small" onClick={()=>onOut({id:v.vehicle_id,reg_no:v.reg_no})}>Mark OUT</button>}</td></tr>):<tr><td colSpan={history?6:5} className="empty">No records yet</td></tr>}</tbody></table></div>}
createRoot(document.getElementById('root')).render(<App/>);
