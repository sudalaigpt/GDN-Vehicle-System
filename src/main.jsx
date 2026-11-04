import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import {
  Bike, LogIn, LogOut, Search, History, Truck, Users, FileDown,
  CircleUserRound
} from 'lucide-react';
import './style.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const demoVehicles = [
  { id: 'demo-1', reg_no: 'TN 69 AB 1234', type: 'Truck/Lorry', company: 'ABC Logistics', driver_name: 'Ravi', driver_mobile: '9876543210' },
  { id: 'demo-2', reg_no: 'TN 69 CD 5678', type: 'Tanker', company: 'GDN Supplier', driver_name: 'Kumar', driver_mobile: '9876501234' },
  { id: 'demo-3', reg_no: 'TN 72 EF 1234', type: 'Car/Jeep', company: 'XYZ Services', driver_name: 'Suresh', driver_mobile: '9876512340' }
];

const now = () => new Date().toISOString();

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState('home');

  const [vehicles, setVehicles] = useState([]);
  const [visits, setVisits] = useState([]);
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({
    reg_no: '', type: 'Truck/Lorry', company: '',
    driver_name: '', driver_mobile: '', purpose: ''
  });

  useEffect(() => {
    if (!supabase) {
      setNotice('Supabase is not configured. Check Vercel environment variables.');
      setAuthReady(true);
      return undefined;
    }

    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setNotice('Session check failed: ' + error.message);
      setSession(data?.session ?? null);
      setAuthReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthReady(true);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!session || !supabase) {
      setVehicles([]);
      setVisits([]);
      return;
    }

    async function loadData() {
      const { data: vehicleData, error: vehicleError } =
        await supabase.from('vehicles').select('*');

      const { data: visitData, error: visitError } =
        await supabase.from('visits').select('*');

      if (vehicleError || visitError) {
        setNotice('Database error: ' +
          (vehicleError?.message || visitError?.message));
        return;
      }

      setVehicles((vehicleData || []).map(v => ({
        ...v,
        type: v.vehicle_type
      })));

      setVisits(visitData || []);
    }

    loadData();
  }, [session]);
  const inside = useMemo(
    () => visits.filter(v => v.status === 'IN'),
    [visits]
  );

  function update(key, value) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function login(event) {
    event.preventDefault();
    if (!supabase) {
      setNotice('Supabase is not configured. Check Vercel environment variables.');
      return;
    }
    if (!email.trim() || !password) {
      setNotice('Enter your Admin email and password.');
      return;
    }

    setBusy(true);
    setNotice('');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    setBusy(false);

    if (error) {
      setNotice('Login failed: ' + error.message);
      return;
    }

    setSession(data.session);
    setPassword('');
    setPage('home');
    setNotice('Admin login successful.');
  }

  async function logout() {
    if (!supabase) {
      setSession(null);
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    setBusy(false);

    if (error) {
      setNotice('Logout failed: ' + error.message);
      return;
    }

    setSession(null);
    setEmail('');
    setPassword('');
    setPage('home');
    setNotice('Logged out successfully.');
  }

  function findVehicle() {
    const digits = search.replace(/\D/g, '').slice(-4);
    if (digits.length !== 4) {
      setNotice('Enter the last 4 digits of the registration number.');
      return;
    }
    const found = vehicles.filter(v => v.reg_no.replace(/\D/g, '').endsWith(digits));
    setMatches(found);
    setSelected(found.length === 1 ? found[0] : null);
    if (found.length === 0) {
      setForm(current => ({ ...current, reg_no: '', driver_name: '' }));
      setNotice('No matching vehicle found. Enter the new vehicle details below.');
    } else {
      setNotice(found.length + ' matching vehicle(s) found. Select the correct vehicle.');
    }
  }

  function choose(vehicle) {
    setSelected(vehicle);
    setForm({
      reg_no: vehicle.reg_no,
      type: vehicle.type || 'Truck/Lorry',
      company: vehicle.company || '',
      driver_name: vehicle.driver_name || '',
      driver_mobile: vehicle.driver_mobile || '',
      purpose: ''
    });
  }

  async function saveVehicleAndIn() {
  if (!form.reg_no.trim() || !form.driver_name.trim()) {
    setNotice('Enter registration number and driver name.');
    return;
  }

  if (!supabase || !session) {
    setNotice('Please login first.');
    return;
  }

  setBusy(true);
  setNotice('');

  try {
    let vehicle;

    const vehicleDetails = {
      reg_no: form.reg_no.trim().toUpperCase(),
      vehicle_type: form.type,
      company: form.company,
      driver_name: form.driver_name,
      driver_mobile: form.driver_mobile
    };

    if (selected && selected.id) {
      const { data, error } = await supabase
        .from('vehicles')
        .update(vehicleDetails)
        .eq('id', selected.id)
        .select()
        .single();

      if (error) throw error;
      vehicle = data;
    } else {
      const { data, error } = await supabase
        .from('vehicles')
        .insert(vehicleDetails)
        .select()
        .single();

      if (error) throw error;
      vehicle = data;
    }

    const { data: activeVisit, error: checkError } = await supabase
      .from('visits')
      .select('id')
      .eq('vehicle_id', vehicle.id)
      .eq('status', 'IN')
      .maybeSingle();

    if (checkError) throw checkError;

    if (activeVisit) {
      setNotice('This vehicle is already inside.');
      return;
    }

    const { data: visit, error: visitError } = await supabase
      .from('visits')
      .insert({
        vehicle_id: vehicle.id,
        reg_no: vehicle.reg_no,
        driver_name: vehicle.driver_name,
        company: vehicle.company,
        purpose: form.purpose,
        in_at: now(),
        out_at: null,
        status: 'IN',
        security_user: session.user.email
      })
      .select()
      .single();

    if (visitError) throw visitError;

    setVehicles(current => {
      const exists = current.some(v => v.id === vehicle.id);
      const updated = { ...vehicle, type: vehicle.vehicle_type };

      return exists
        ? current.map(v => v.id === vehicle.id ? updated : v)
        : [updated, ...current];
    });

    setVisits(current => [visit, ...current]);
    setForm({
      reg_no: '',
      type: 'Truck/Lorry',
      company: '',
      driver_name: '',
      driver_mobile: '',
      purpose: ''
    });
    setSelected(null);
    setMatches([]);
    setSearch('');
    setPage('home');
    setNotice('Vehicle IN saved successfully.');

  } catch (error) {
    setNotice('Save failed: ' + error.message);
  } finally {
    setBusy(false);
  }
  }
  async function vehicleOut(vehicleId) {
  const activeVisit = visits.find(
    v => v.vehicle_id === vehicleId && v.status === 'IN'
  );

  if (!activeVisit) {
    setNotice('No active IN record found for this vehicle.');
    return;
  }

  setBusy(true);

  const { data, error } = await supabase
    .from('visits')
    .update({ out_at: now(), status: 'OUT' })
    .eq('id', activeVisit.id)
    .select()
    .single();

  setBusy(false);

  if (error) {
    setNotice('Vehicle OUT failed: ' + error.message);
    return;
  }

  setVisits(current =>
    current.map(v => v.id === activeVisit.id ? data : v)
  );

  setNotice(activeVisit.reg_no + ' marked OUT successfully.');
  }
  
  function exportCsv() {
    const rows = [
      ['Registration', 'Driver', 'Company', 'Purpose', 'IN Time', 'OUT Time', 'Status'],
      ...visits.map(v => [
        v.reg_no, v.driver_name, v.company, v.purpose,
        v.in_at, v.out_at || '', v.status
      ])
    ];
    const csv = rows.map(row =>
      row.map(value => '"' + String(value ?? '').replaceAll('"', '""') + '"').join(',')
    ).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'GDN-vehicle-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!authReady) {
    return <main className="login"><section className="loginbox"><h2>Checking login session...</h2></section></main>;
  }

  if (!session) {
    return (
      <main className="login">
        <div className="brand">
          <div className="logo"><b>GDN</b><Bike size={48} /></div>
          <h1>Vehicle Reporting System</h1>
          <p>Security Gate Management</p>
        </div>
        <section className="loginbox">
          <h2>Admin Login</h2>
          <form onSubmit={login}>
            <label>
              Admin Email
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter Admin email"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </label>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? 'Please wait...' : 'Login'}
            </button>
          </form>
          {notice && <p className="muted">{notice}</p>}
          <p className="muted">Use the Admin Email and Password already created in Supabase Authentication.</p>
          <p className="muted">Security Employee ID / PIN login is not enabled in this version.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="app">
      <header>
        <div className="brandmini">
          <div className="miniLogo"><Bike /></div>
          <div><b>GDN</b><small>Vehicle Reporting System</small></div>
        </div>
        <div className="user">
          <span>Admin · {session.user.email}</span>
          <button className="outline small" onClick={logout} disabled={busy}>
            {busy ? 'Please wait...' : 'Logout'}
          </button>
        </div>
      </header>

      <nav>
        {[
          ['home', 'Dashboard', Truck],
          ['in', 'Vehicle IN', LogIn],
          ['out', 'Vehicle OUT', LogOut],
          ['history', 'History', History],
          ['users', 'User Management', Users]
        ].map(([id, label, Icon]) => (
          <button className={page === id ? 'active' : ''} onClick={() => setPage(id)} key={id}>
            <Icon size={17} /> {label}
          </button>
        ))}
      </nav>

      <main className="content">
        {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}
        <div className="notice">
          Demo data warning: vehicle records and visit history are stored only in this browser in this version.
          They are not yet saved to the Supabase database.
        </div>

        {page === 'home' && (
          <>
            <h2>Admin Dashboard</h2>
            <div className="stats">
              <article><small>Currently Inside</small><strong>{inside.length}</strong></article>
              <article><small>Total IN Entries</small><strong>{visits.length}</strong></article>
              <article><small>Total Registered Vehicles</small><strong>{vehicles.length}</strong></article>
              <article><small>Completed OUT</small><strong>{visits.filter(v => v.status === 'OUT').length}</strong></article>
            </div>
            <div className="quick">
              <button onClick={() => { setPage('in'); setSearch(''); setSelected(null); setMatches([]); }}><LogIn /> Vehicle IN</button>
              <button onClick={() => setPage('out')}><LogOut /> Vehicle OUT</button>
              <button onClick={() => setPage('history')}><History /> Visit History</button>
              <button onClick={exportCsv}><FileDown /> Export CSV</button>
            </div>
            <h3>Vehicles Currently Inside</h3>
            <VehicleTable rows={inside} onOut={vehicleOut} />
          </>
        )}

        {page === 'in' && (
          <>
            <h2>Vehicle IN Entry</h2>
            <section className="panel">
              <label>Enter last 4 digits of registration number</label>
              <div className="searchrow">
                <input
                  value={search}
                  maxLength="4"
                  inputMode="numeric"
                  placeholder="e.g. 1234"
                  onChange={e => setSearch(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
                <button onClick={findVehicle}><Search size={17} /> Search</button>
              </div>
              <p className="muted">If more than one vehicle matches, select the correct full registration number.</p>
            </section>

            {matches.length > 0 && (
              <section className="panel">
                <h3>Matching Vehicles</h3>
                {matches.map(v => (
                  <button className={'match ' + (selected?.id === v.id ? 'chosen' : '')} onClick={() => choose(v)} key={v.id}>
                    {v.reg_no} · {v.type} · {v.company}
                  </button>
                ))}
              </section>
            )}

            {(selected || matches.length === 0) && (
              <section className="panel">
                <h3>{selected ? 'Verify Vehicle Details' : 'New Vehicle / Manual Registration'}</h3>
                <div className="formgrid">
                  <Field label="Full Registration Number" value={form.reg_no} onChange={v => update('reg_no', v.toUpperCase())} />
                  <label>Vehicle Type
                    <select value={form.type} onChange={e => update('type', e.target.value)}>
                      {['Truck/Lorry', 'Tanker', 'Car/Jeep', 'Van', 'Bus', 'Trailer', 'Two Wheeler', 'Other'].map(x => <option key={x}>{x}</option>)}
                    </select>
                  </label>
                  <Field label="Company" value={form.company} onChange={v => update('company', v)} />
                  <Field label="Driver Name *" value={form.driver_name} onChange={v => update('driver_name', v)} />
                  <Field label="Driver Mobile" value={form.driver_mobile} onChange={v => update('driver_mobile', v)} />
                  <Field label="Visit Purpose" value={form.purpose} onChange={v => update('purpose', v)} />
                </div>
                <button className="primary" onClick={saveVehicleAndIn}>Submit this vehicle IN</button>
              </section>
            )}
          </>
        )}

        {page === 'out' && (
          <>
            <h2>Vehicle OUT Entry</h2>
            <section className="panel">
              <label>Vehicles currently inside</label>
              <VehicleTable rows={inside} onOut={vehicleOut} />
            </section>
          </>
        )}

        {page === 'history' && (
          <>
            <div className="headingrow">
              <h2>Vehicle Visit History</h2>
              <button onClick={exportCsv}><FileDown size={17} /> Export CSV</button>
            </div>
            <section className="panel">
              <div className="searchrow">
                <input placeholder="Filter registration number" value={filter} onChange={e => setFilter(e.target.value)} />
                <button className="outline" onClick={() => setFilter('')}>Clear</button>
              </div>
              <VehicleTable
                rows={visits.filter(v => !filter || v.reg_no.toLowerCase().includes(filter.toLowerCase()))}
                history
              />
            </section>
          </>
        )}

        {page === 'users' && (
          <>
            <h2>User Management</h2>
            <section className="panel">
              <p>Security Employee ID / PIN accounts are not configured yet. Admin authentication is handled by Supabase Email and Password.</p>
              <div className="userline"><CircleUserRound /> {session.user.email} · Admin · Active</div>
            </section>
          </>
        )}
      </main>
      <footer>GDN · GDN-GATE-01 · Single Security Gate · Photo capture disabled</footer>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return <label>{label}<input value={value} onChange={e => onChange(e.target.value)} /></label>;
}

function VehicleTable({ rows, onOut, history = false }) {
  return (
    <div className="tablewrap">
      <table>
        <thead><tr>
          <th>Registration</th><th>Driver</th><th>Company</th>
          <th>{history ? 'IN Time' : 'Status'}</th>
          {history && <th>OUT Time</th>}<th></th>
        </tr></thead>
        <tbody>
          {rows.length ? rows.map(v => (
            <tr key={v.id}>
              <td><b>{v.reg_no}</b></td><td>{v.driver_name}</td><td>{v.company}</td>
              <td>{history ? new Date(v.in_at).toLocaleString() : <span className="pill">{v.status}</span>}</td>
              {history && <td>{v.out_at ? new Date(v.out_at).toLocaleString() : '—'}</td>}
              <td>{!history && v.status === 'IN' && onOut && (
                <button className="danger small" onClick={() => onOut(v.vehicle_id)}>Mark OUT</button>
              )}</td>
            </tr>
          )) : <tr><td colSpan={history ? 6 : 5} className="empty">No records yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
