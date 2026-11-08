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
  const [editingVisit,setEditingVisit]=useState(null), [editInAt,setEditInAt]=useState(''), [editOutAt,setEditOutAt]=useState('');
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
    if(!form.reg_no.trim() || !form.driver_name.trim()){
      setNotice('வாகன பதிவு எண் மற்றும் ஓட்டுநர் பெயர் அவசியம்.');
      return;
    }

    setBusy(true);
    try {
      const regNo = form.reg_no.trim().toUpperCase();

      // First check whether this vehicle already exists
      const {data: existing, error: findError} = await supabase
        .from('vehicles')
        .select('*')
        .eq('reg_no', regNo)
        .maybeSingle();

      if(findError) throw findError;

      let vehicle = existing || selected;

      const vehicleFields = {
        reg_no: regNo,
        vehicle_type: form.vehicle_type,
        company: form.company,
        driver_name: form.driver_name,
        driver_mobile: form.driver_mobile,
        updated_at: new Date().toISOString()
      };

      if(vehicle){
        const {data, error} = await supabase
          .from('vehicles')
          .update(vehicleFields)
          .eq('id', vehicle.id)
          .select()
          .single();

        if(error) throw error;
        vehicle = data;
      } else {
        const {data, error} = await supabase
          .from('vehicles')
          .insert(vehicleFields)
          .select()
          .single();

        if(error) throw error;
        vehicle = data;
      }

      const {data: active, error: checkError} = await supabase
        .from('vehicle_visits')
        .select('id')
        .eq('vehicle_id', vehicle.id)
        .is('out_at', null)
        .maybeSingle();

      if(checkError) throw checkError;

      if(active){
        throw new Error('இந்த வாகனம் ஏற்கெனவே IN நிலையில் உள்ளது.');
      }

      const {error} = await supabase
        .from('vehicle_visits')
        .insert({
          vehicle_id: vehicle.id,
          gate_id: 'GDN-GATE-01',
          visit_purpose: form.purpose || null,
          in_by: session.user.id
        });

      if(error) throw error;

      setNotice(vehicle.reg_no + ' – Vehicle IN பதிவு வெற்றிகரமாகச் சேமிக்கப்பட்டது.');
      setForm(emptyForm);
      setSelected(null);
      setMatches([]);
      setSearch('');
      setPage('home');
      await refreshData();

    } catch(e) {
      setNotice('சேமிக்க முடியவில்லை: ' + e.message);
    } finally {
      setBusy(false);
    }
  }
  
