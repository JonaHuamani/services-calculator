import { FormEvent, useMemo, useState } from 'react';

type Service = 'electricity' | 'water';
type Reading = { id: string; date: string; value: number };
type Bill = { id: string; from: string; to: string; consumption: number; total: number };
type Participant = { id: string; name: string; consumption: number };
type Store = Record<Service, { readings: Reading[]; bills: Bill[]; participants: Participant[] }>;

const KEY = 'services-calculator:v1';
const defaults: Store = {
  electricity: {
    readings: [
      { id: 'e1', date: '2026-05-09', value: 876.4 },
      { id: 'e2', date: '2026-06-11', value: 1005.9 },
      { id: 'e3', date: '2026-06-29', value: 1048 }
    ],
    bills: [{ id: 'eb1', from: '2026-05-27', to: '2026-06-26', consumption: 241, total: 218.6 }],
    participants: [
      { id: 'p1', name: 'Bravisima', consumption: 93 },
      { id: 'p2', name: 'Bunket Gym', consumption: 129 },
      { id: 'p3', name: 'Dueña', consumption: 19 }
    ]
  },
  water: {
    readings: [
      { id: 'w1', date: '2026-05-09', value: 171.523 },
      { id: 'w2', date: '2026-06-11', value: 171.927 },
      { id: 'w3', date: '2026-06-29', value: 172.015 }
    ],
    bills: [{ id: 'wb1', from: '2026-05-14', to: '2026-06-13', consumption: 13, total: 34.5 }],
    participants: [
      { id: 'wp1', name: 'Bravisima', consumption: 0.353 },
      { id: 'wp2', name: 'Bunket Gym', consumption: 0 },
      { id: 'wp3', name: 'Dueña', consumption: 12.647 }
    ]
  }
};

function load(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) || '') as Store; } catch { return defaults; }
}

function days(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

export default function App() {
  const [service, setService] = useState<Service>('electricity');
  const [store, setStore] = useState<Store>(load);
  const current = store[service];
  const bill = current.bills.at(-1);

  const persist = (next: Store) => { setStore(next); localStorage.setItem(KEY, JSON.stringify(next)); };
  const updateCurrent = (patch: Partial<Store[Service]>) => persist({ ...store, [service]: { ...current, ...patch } });

  const sortedReadings = useMemo(() => [...current.readings].sort((a,b) => a.date.localeCompare(b.date)), [current.readings]);
  const rates = useMemo(() => sortedReadings.slice(1).map((r, i) => {
    const prev = sortedReadings[i];
    const delta = r.value - prev.value;
    const d = days(prev.date, r.date);
    return { from: prev.date, to: r.date, total: delta, daily: delta / d };
  }), [sortedReadings]);

  const participantTotal = current.participants.reduce((s, p) => s + Number(p.consumption || 0), 0);
  const mismatch = bill ? bill.consumption - participantTotal : 0;

  function addReading(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    updateCurrent({ readings: [...current.readings, { id: crypto.randomUUID(), date: String(fd.get('date')), value: Number(fd.get('value')) }] });
    e.currentTarget.reset();
  }

  function addBill(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    updateCurrent({ bills: [...current.bills, { id: crypto.randomUUID(), from: String(fd.get('from')), to: String(fd.get('to')), consumption: Number(fd.get('consumption')), total: Number(fd.get('total')) }] });
    e.currentTarget.reset();
  }

  function setParticipant(id: string, value: number) {
    updateCurrent({ participants: current.participants.map(p => p.id === id ? { ...p, consumption: value } : p) });
  }

  const unit = service === 'electricity' ? 'kWh' : 'm³';

  return <main className="app">
    <header>
      <div><p className="eyebrow">PWA · datos guardados en este dispositivo</p><h1>Services Calculator</h1></div>
      <nav><button className={service==='electricity'?'active':''} onClick={()=>setService('electricity')}>⚡ Luz</button><button className={service==='water'?'active':''} onClick={()=>setService('water')}>💧 Agua</button></nav>
    </header>

    <section className="grid two">
      <article className="card">
        <h2>Lecturas</h2>
        <form onSubmit={addReading} className="form-row"><input name="date" type="date" required/><input name="value" type="number" step="0.001" placeholder="Lectura" required/><button>Agregar</button></form>
        <div className="list">{sortedReadings.map(r => <div className="row" key={r.id}><span>{r.date}</span><strong>{r.value.toFixed(service==='water'?3:2)} {unit}</strong></div>)}</div>
      </article>

      <article className="card">
        <h2>Consumo entre lecturas</h2>
        <div className="list">{rates.length ? rates.map(r => <div className="row" key={r.from+r.to}><span>{r.from} → {r.to}</span><span><strong>{r.total.toFixed(3)} {unit}</strong><small>{r.daily.toFixed(3)} {unit}/día</small></span></div>) : <p className="muted">Agrega al menos dos lecturas.</p>}</div>
      </article>
    </section>

    <section className="card">
      <h2>Nuevo recibo</h2>
      <form onSubmit={addBill} className="form-grid"><label>Desde<input name="from" type="date" required/></label><label>Hasta<input name="to" type="date" required/></label><label>Consumo total<input name="consumption" type="number" step="0.001" required/></label><label>Total S/<input name="total" type="number" step="0.01" required/></label><button>Guardar recibo</button></form>
    </section>

    {bill && <section className="card">
      <div className="section-head"><div><p className="eyebrow">Último recibo</p><h2>{bill.from} → {bill.to}</h2></div><div className="bill-total"><strong>S/ {bill.total.toFixed(2)}</strong><span>{bill.consumption} {unit}</span></div></div>
      <div className="table-wrap"><table><thead><tr><th>Responsable</th><th>Consumo</th><th>%</th><th>A pagar</th></tr></thead><tbody>{current.participants.map(p => { const share = bill.consumption ? p.consumption / bill.consumption : 0; return <tr key={p.id}><td>{p.name}</td><td><input className="compact" type="number" step="0.001" value={p.consumption} onChange={e=>setParticipant(p.id, Number(e.target.value))}/> {unit}</td><td>{(share*100).toFixed(1)}%</td><td><strong>S/ {(bill.total*share).toFixed(2)}</strong></td></tr> })}</tbody></table></div>
      <div className={Math.abs(mismatch)<0.001?'status ok':'status warn'}>{Math.abs(mismatch)<0.001 ? '✓ El reparto coincide con el consumo del recibo.' : `Diferencia pendiente: ${mismatch.toFixed(3)} ${unit}`}</div>
    </section>}

    <footer>Sin backend. Todo se guarda en localStorage de este dispositivo.</footer>
  </main>;
}
