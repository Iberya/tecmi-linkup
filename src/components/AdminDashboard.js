import {useCallback,useEffect,useMemo,useState} from "react";
import axios from "axios";
import {Activity,ArrowUpRight,BarChart3,CalendarDays,Check,CheckCircle2,ChevronRight,EyeOff,GraduationCap,KeyRound,MapPin,MessageCircle,Pencil,Plus,Search,ShieldAlert,ShieldCheck,Trophy,UserCheck,UserX,Users,ImageOff} from "lucide-react";
import {toast} from "sonner";
import {certTheme,API,Avatar,Badge,EmptyState,Modal,PageTitle,dateParts,errMsg,fullName,timeAgo} from "@/components/common";
import {Messages,Profile} from "@/components/StudentPages";
import {MexicoMap,TECMI_CAMPUS_URL} from "@/components/LinkUpHub";

const ROLES={lider:'Líder',docente:'Docente',ejecutivo:'Ejecutivo',administrador:'Administrador'};
function AdminStat({icon:Icon,label,value,color='green',note}){return <div className="stat" data-testid={`admin-stat-${label.toLowerCase().replaceAll(' ','-')}`}><span className={`stat-icon ${color}`}><Icon size={20}/></span><span><small>{label}</small><strong>{typeof value==='number'?value.toLocaleString('es-MX'):value??'—'}</strong>{note&&<em>{note}</em>}</span></div>}
const useLoad=(url)=>{const [d,setD]=useState(null);const load=useCallback(()=>axios.get(`${API}${url}`).then(r=>setD(r.data)).catch(e=>toast.error(errMsg(e))),[url]);useEffect(()=>{load()},[load]);return [d,load]};

function Trend({rows}){
  const max=Math.max(1,...rows.map(r=>r.mensajes+r.conexiones+r.publicaciones));
  const ticks=[0,Math.round(max/2),max];
  return <div className="trend"><div className="trend-legend"><span><i className="sw s1"/> Mensajes</span><span><i className="sw s2"/> Conexiones</span><span><i className="sw s3"/> Publicaciones</span></div><div className="trend-chart" role="img" aria-label="Actividad diaria de los últimos 14 días"><div className="trend-axis">{ticks.slice().reverse().map(t=><span key={t}>{t}</span>)}</div><div className="trend-bars">{rows.map(r=>{const tot=r.mensajes+r.conexiones+r.publicaciones;return <div key={r.dia} className="trend-col" title={`${dateParts(r.dia).long}: ${tot} interacciones`}><div className="trend-stack" style={{height:`${tot/max*100}%`}}>{[['s1',r.mensajes],['s2',r.conexiones],['s3',r.publicaciones]].map(([k,v])=>v>0&&<i key={k} className={k} style={{flex:v}}/>)}</div><small>{dateParts(r.dia).day}</small></div>})}</div></div></div>
}

function AdminOverview({data,user,go}){
  const [metrics]=useLoad('/admin/metrics');const [ov,reload]=useLoad('/admin/overview');
  const [state,setState]=useState(null);
  const rol=ROLES[user.tipo_admin]||'Administrador';
  const counts=useMemo(()=>(ov?.top_campus||[]),[ov]);
  return <main className="content"><section className="admin-hero"><div><span className="eyebrow light">Centro de control · {rol}</span><h1>Hola, {user.nombre}</h1><p>Así está evolucionando la comunidad Tecmi Link-Up.</p></div><button className="lime-btn" data-testid="admin-refresh-metrics" onClick={reload}>Actualizar datos</button></section>
    <div className="stats-grid five"><AdminStat icon={Users} label="Estudiantes activos" value={metrics?.usuarios_activos}/><AdminStat icon={MapPin} label="Campus" value={metrics?.campus_conectados} note={metrics&&`${metrics.espacios_connect} Espacios Connect`} color="purple"/><AdminStat icon={GraduationCap} label="Certificados" value={metrics?.certificados_activos} color="blue"/><AdminStat icon={UserCheck} label="Conexiones" value={metrics?.conexiones_realizadas} color="pink"/><AdminStat icon={Trophy} label="Retos completados" value={metrics?.retos_completados} color="gold"/></div>
    <div className="admin-grid"><section className="panel"><div className="panel-title"><div><span className="eyebrow">Panorama nacional</span><h2>Mapa de la comunidad</h2></div></div><MexicoMap campuses={data.campuses} selectedState={state} onState={s=>setState(st=>st===s?null:s)}/><div className="campus-ranking">{counts.length===0?<small className="muted">Aún no hay estudiantes con campus registrado.</small>:counts.map(([c,n],i)=><div key={c} data-testid={`campus-activity-${c}`}><i className={`dot d${i%5}`}/><span>{c}</span><b>{n}</b></div>)}</div></section>
      <section className="panel"><div className="panel-title"><div><span className="eyebrow">Últimos 14 días</span><h2>Cómo participa la comunidad</h2></div><BarChart3 size={19}/></div>{ov?<Trend rows={ov.trend}/>:<div className="skeleton-list"><i/><i/></div>}</section></div>
    <div className="admin-lower-grid">
      <section className="panel"><div className="panel-title"><div><span className="eyebrow">Participación por carrera</span><h2>Dónde está la comunidad</h2></div></div>{!ov?<div className="skeleton-list"><i/></div>:ov.top_carreras.length===0?<EmptyState icon={GraduationCap} title="Sin carreras registradas aún"/>:ov.top_carreras.map(([n,v],i)=>{const max=ov.top_carreras[0][1];return <div className="participation-row" key={n}><b>{i+1}</b><span className="grow"><strong>{n}</strong><span className="bar"><i style={{width:`${v/max*100}%`}}/></span></span><em>{v}</em></div>})}</section>
      <section className="panel"><div className="panel-title"><div><span className="eyebrow">Impacto</span><h2>Señales de crecimiento</h2></div><ArrowUpRight size={18}/></div>{ov&&<div className="impact-grid"><div><b>{ov.impact.aceptacion}%</b><small>Invitaciones aceptadas</small><i style={{width:`${ov.impact.aceptacion}%`}}/></div><div><b>{ov.impact.entre_campus}%</b><small>Conexiones entre campus</small><i style={{width:`${ov.impact.entre_campus}%`}}/></div><div><b>{ov.impact.entre_carreras}%</b><small>Conexiones entre carreras</small><i style={{width:`${ov.impact.entre_carreras}%`}}/></div><div><b>{ov.impact.publicaciones_semana}</b><small>Publicaciones esta semana</small><i style={{width:`${Math.min(100,ov.impact.publicaciones_semana*5)}%`}}/></div></div>}</section>
      <section className="panel"><div className="panel-title"><div><span className="eyebrow">Agenda</span><h2>Próximos eventos</h2></div><button data-testid="admin-events-shortcut" className="text-btn" onClick={()=>go('Eventos')}>Ver todos <ChevronRight size={14}/></button></div>{data.events.slice(0,4).map(e=>{const d=dateParts(e.fecha_inicio);return <div className="list-row" key={e.id}><span className="event-thumb"><b>{d.day}</b><small>{d.month}</small></span><span className="grow"><b>{e.titulo}</b><small>{e.tipo==='nacional'?'Nacional':'Local'} · {e.modalidad==='en_linea'?'En línea':'Presencial'} · {e.attendees} inscritos</small></span></div>})}</section>
    </div>
    <section className="panel"><div className="panel-title"><div><span className="eyebrow">Actividad reciente</span><h2>Lo que está pasando</h2></div><span className="live"><i/> Actualizado</span></div>{!ov?<div className="skeleton-list"><i/><i/></div>:ov.activity.length===0?<EmptyState icon={Activity} title="Sin actividad todavía"/>:<div className="activity-list">{ov.activity.map((a,i)=><div className="list-row" key={i}><Avatar src={a.avatar} alt={a.texto||""} size={36}/><span className="grow"><b>{a.texto}</b><small>{timeAgo(a.at)}</small></span></div>)}</div>}</section>
  </main>
}

function AdminUsers({user}){
  const [rows,reload]=useLoad('/admin/students');const [q,setQ]=useState('');const [filter,setFilter]=useState('Estudiantes');const [confirm,setConfirm]=useState(null);
  const shown=(rows||[]).filter(s=>(filter==='Estudiantes'?s.rol!=='administrador':filter==='Docentes'?s.rol==='administrador':s.active===false)&&[fullName(s),s.email,s.campus].join(' ').toLowerCase().includes(q.toLowerCase()));
  const toggle=async s=>{try{await axios.patch(`${API}/admin/students/${s.id}/status`,{activo:!s.active});toast.success(s.active?`${s.nombre} ya no puede entrar`:`${s.nombre} puede entrar de nuevo`);reload()}catch(e){toast.error(errMsg(e))}};
  const reset=async s=>{try{await axios.post(`${API}/admin/students/${s.id}/reset-password`);toast.success(`Contraseña de ${s.nombre} restablecida a la temporal`);setConfirm(null)}catch(e){toast.error(errMsg(e))}};
  return <main className="content"><PageTitle eyebrow="Comunidad" title="Usuarios y perfiles" text="Consulta, activa o desactiva cuentas y restablece contraseñas."/>
    <section className="panel"><div className="toolbar"><div className="search small grow"><Search size={15}/><input data-testid="admin-users-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por nombre, correo o campus" aria-label="Buscar usuario"/></div><div className="seg-row tight">{['Estudiantes','Docentes','Inactivos'].map(f=><button key={f} data-testid={`users-filter-${f.toLowerCase()}`} className={filter===f?'selected':''} onClick={()=>setFilter(f)}>{f}<i>{(rows||[]).filter(s=>f==='Estudiantes'?s.rol!=='administrador':f==='Docentes'?s.rol==='administrador':s.active===false).length}</i></button>)}</div></div>
      {rows===null?<div className="skeleton-list"><i/><i/><i/></div>:shown.length===0?<EmptyState icon={Users} title="Nadie coincide con la búsqueda"/>:<div className="data-table">{shown.map(s=><div className="data-row" key={s.id}><Avatar src={s.avatar} alt={s.nombre} size={40}/><span className="grow"><b>{fullName(s)}{s.id===user.id&&' (tú)'}</b><small>{s.email} · {s.campus||'Sin campus'}</small></span><span className="hide-sm">{s.rol==='administrador'?<Badge color="purple">{ROLES[s.tipo_admin]||'Docente'}</Badge>:<small>{s.carrera||'—'}</small>}</span><Badge color={s.active!==false?'lime':'gray'}>{s.active!==false?'Activo':'Inactivo'}</Badge><span className="row-actions">{s.id!==user.id&&<><button data-testid={`admin-reset-${s.id}`} className="icon-btn" onClick={()=>setConfirm(s)} title="Restablecer contraseña" aria-label={`Restablecer contraseña de ${s.nombre}`}><KeyRound size={16}/></button><button data-testid={`admin-toggle-user-${s.id}`} className={s.active!==false?'ghost-btn':'outline-btn'} onClick={()=>toggle(s)}>{s.active!==false?<><UserX size={15}/> Desactivar</>:<><UserCheck size={15}/> Activar</>}</button></>}</span></div>)}</div>}</section>
    {confirm&&<Modal eyebrow="Seguridad" title={`Restablecer la contraseña de ${confirm.nombre}`} onClose={()=>setConfirm(null)}><p className="muted">Su contraseña cambiará a la temporal <b>UTMtorres</b>, se cerrarán sus sesiones abiertas y la app le pedirá elegir una nueva al entrar.</p><div className="row-actions end"><button className="ghost-btn" onClick={()=>setConfirm(null)}>Cancelar</button><button data-testid="confirm-reset" className="primary-btn" onClick={()=>reset(confirm)}>Restablecer</button></div></Modal>}
  </main>
}

function AdminReports({go}){
  const [metrics]=useLoad('/admin/metrics');const [reports,reload]=useLoad('/admin/reports');
  const resolve=async(r,accion)=>{try{await axios.post(`${API}/admin/reports/${r.id}`,{accion});toast.success(accion==='ocultar'?'Publicación ocultada del feed':'Reporte descartado');reload()}catch(e){toast.error(errMsg(e))}};
  return <main className="content"><PageTitle eyebrow="Análisis y moderación" title="Reportes" text="Indicadores de participación y publicaciones que la comunidad reportó."/>
    <div className="stats-grid"><AdminStat icon={UserCheck} label="Conexiones" value={metrics?.conexiones_realizadas}/><AdminStat icon={Users} label="Comunidades" value={metrics?.comunidades} color="purple"/><AdminStat icon={CalendarDays} label="Eventos" value={metrics?.eventos} color="blue"/><AdminStat icon={MessageCircle} label="Publicaciones" value={metrics?.publicaciones} color="gold"/></div>
    <section className="panel" data-testid="moderation-queue"><div className="panel-title"><div><span className="eyebrow">Moderación</span><h2>Reportes pendientes</h2></div><Badge color={reports?.length?'pink':'lime'}>{reports?.length||0} pendientes</Badge></div>
      {reports===null?<div className="skeleton-list"><i/></div>:reports.length===0?<EmptyState icon={ShieldCheck} title="Todo en orden" text="No hay reportes por revisar."/>:reports.map(r=><article className="report-card" key={r.id}><div className="report-meta"><Badge color="pink">{r.motivo}</Badge><small>{timeAgo(r.created_at)}</small></div>{r.post?<blockquote><b>{r.post.author}</b> · {r.post.categoria}<br/>{r.post.contenido}</blockquote>:<small className="muted">La publicación ya no existe.</small>}{r.detalle&&<p className="muted">Detalle: {r.detalle}</p>}<div className="row-actions"><button data-testid={`report-hide-${r.id}`} className="primary-btn" onClick={()=>resolve(r,'ocultar')}><EyeOff size={15}/> Ocultar publicación</button><button data-testid={`report-dismiss-${r.id}`} className="ghost-btn" onClick={()=>resolve(r,'descartar')}>Descartar reporte</button></div></article>)}
    </section>
  </main>
}

function AdminCommunities({data,openProfile}){
  const [view,setView]=useState(null);const [members,setMembers]=useState(null);
  const open=async c=>{setView(c);setMembers(null);try{setMembers((await axios.get(`${API}/communities/${c.id}/members`)).data)}catch(e){toast.error(errMsg(e))}};
  return <main className="content"><PageTitle eyebrow="Supervisión" title="Comunidades y miembros" text="Revisa los espacios de participación de la red."/>
    <div className="community-grid">{data.communities.map(c=><article className="community-card" key={c.id}><div className="community-art" style={{'--c':c.color}}><Users size={26}/><span>{c.categoria}</span></div><div className="community-copy"><b>{c.nombre}</b><small>{c.descripcion}</small><div className="community-meta"><span>{c.members} miembros</span></div><div className="row-actions"><button data-testid={`admin-community-view-${c.id}`} className="outline-btn" onClick={()=>open(c)}>Ver integrantes</button></div></div></article>)}</div>
    {view&&<Modal eyebrow="Integrantes" title={view.nombre} onClose={()=>setView(null)}>{members===null?<div className="skeleton-list"><i/><i/></div>:members.length===0?<EmptyState icon={Users} title="Nadie se ha unido desde que existen las membresías" text="Los miembros aparecerán aquí al unirse."/>:<div className="member-list">{members.map(m=><button key={m.id} className="inbox-row" onClick={()=>openProfile(m)}><Avatar src={m.avatar} alt={m.nombre||m.author||""} size={38}/><span><b>{fullName(m)}</b><small>{m.email} · {m.campus}</small></span></button>)}</div>}</Modal>}
  </main>
}

function AdminEvents({data,refresh}){
  const today=new Date().toISOString().slice(0,10);
  const blank={titulo:'',descripcion:'',tipo:'nacional',modalidad:'en_linea',fecha_inicio:today,fecha_fin:today,campus:'Todos'};
  const [form,setForm]=useState(blank);const [view,setView]=useState(null);const [regs,setRegs]=useState(null);
  const set=k=>e=>setForm({...form,[k]:e.target.value});
  const create=async e=>{e.preventDefault();try{await axios.post(`${API}/admin/events`,{...form,campus:form.tipo==='local'||form.modalidad==='presencial'?form.campus:'Todos'});toast.success('Evento publicado');setForm(blank);refresh()}catch(err){toast.error(errMsg(err))}};
  const openRegs=async ev=>{setView(ev);setRegs(null);try{setRegs((await axios.get(`${API}/admin/events/${ev.id}/registrations`)).data)}catch(e){toast.error(errMsg(e))}};
  const attendance=async ev=>{try{await axios.post(`${API}/admin/events/${ev.id}/attendance`);toast.success('Asistencia registrada');refresh()}catch(e){toast.error(errMsg(e))}};
  return <main className="content"><PageTitle eyebrow="Operación" title="Eventos e inscripciones" text="Publica actividades, revisa quién se inscribió y registra asistencia."/>
    <div className="catalog-layout"><form className="panel stack" onSubmit={create}><span className="eyebrow">Nuevo evento</span><h2>Publicar actividad</h2><label className="field">Título<input data-testid="admin-event-titulo" required value={form.titulo} onChange={set('titulo')}/></label><label className="field">Descripción<textarea data-testid="admin-event-descripcion" required value={form.descripcion} onChange={set('descripcion')}/></label><div className="two-col"><label className="field">Inicio<input data-testid="admin-event-fecha_inicio" type="date" required value={form.fecha_inicio} onChange={set('fecha_inicio')}/></label><label className="field">Fin<input data-testid="admin-event-fecha_fin" type="date" required min={form.fecha_inicio} value={form.fecha_fin} onChange={set('fecha_fin')}/></label></div><div className="two-col"><label className="field">Ámbito<select data-testid="admin-event-type" value={form.tipo} onChange={set('tipo')}><option value="nacional">Nacional</option><option value="local">Local</option></select></label><label className="field">Modalidad<select data-testid="admin-event-mode" value={form.modalidad} onChange={set('modalidad')}><option value="en_linea">En línea</option><option value="presencial">Presencial</option></select></label></div>{(form.tipo==='local'||form.modalidad==='presencial')&&<label className="field">Campus<select data-testid="admin-event-campus" value={form.campus} onChange={set('campus')}><option value="Todos">Todos los campus</option>{data.campuses.map(c=><option key={c.id} value={c.nombre}>{c.nombre}</option>)}</select></label>}<button data-testid="admin-create-event" className="primary-btn full"><Plus size={16}/> Publicar evento</button></form>
      <section className="panel"><div className="panel-title"><h2>Eventos publicados</h2><CalendarDays size={19}/></div>{data.events.map(e=>{const d=dateParts(e.fecha_inicio);return <div className="list-row" key={e.id}><span className="event-thumb"><b>{d.day}</b><small>{d.month}</small></span><span className="grow"><b>{e.titulo}</b><small>{d.long} · {e.attendees} inscritos{e.attendance_recorded?' · asistencia registrada':''}</small></span><span className="row-actions"><button data-testid={`admin-registrations-${e.id}`} className="outline-btn" onClick={()=>openRegs(e)}><Users size={14}/> Inscritos</button><button data-testid={`admin-attendance-${e.id}`} className={e.attendance_recorded?'ghost-btn':'outline-btn'} disabled={e.attendance_recorded} onClick={()=>attendance(e)}>{e.attendance_recorded?<><Check size={14}/> Registrada</>:<><CheckCircle2 size={14}/> Asistencia</>}</button></span></div>})}</section></div>
    {view&&<Modal eyebrow="Inscripciones" title={view.titulo} onClose={()=>setView(null)}>{regs===null?<div className="skeleton-list"><i/></div>:regs.length===0?<EmptyState icon={Users} title="Aún no hay inscritos" text="Las inscripciones nuevas aparecerán aquí."/>:<div className="member-list">{regs.map(m=><div key={m.id} className="inbox-row"><Avatar src={m.avatar} alt={m.nombre||m.author||""} size={36}/><span><b>{fullName(m)}</b><small>{m.email} · {m.campus}</small></span></div>)}</div>}</Modal>}
  </main>
}

function AdminMissions({data,refresh}){
  const blank={nombre:'',descripcion:'',puntos_xp:25,meta_progreso:1};const [form,setForm]=useState(blank);
  const create=async e=>{e.preventDefault();try{await axios.post(`${API}/admin/missions`,form);toast.success('Misión creada');setForm(blank);refresh()}catch(err){toast.error(errMsg(err))}};
  return <main className="content"><PageTitle eyebrow="Gamificación" title="Retos y misiones" text="Crea oportunidades de participación y define sus recompensas."/>
    <div className="catalog-layout"><form className="panel stack" onSubmit={create}><span className="eyebrow">Nueva misión</span><h2>Crear reto</h2><label className="field">Título<input data-testid="admin-mission-name" required value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></label><label className="field">Descripción<textarea data-testid="admin-mission-description" value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})}/></label><div className="two-col"><label className="field">Recompensa (XP)<input data-testid="admin-mission-xp" type="number" min={1} max={500} value={form.puntos_xp} onChange={e=>setForm({...form,puntos_xp:Number(e.target.value)})}/></label><label className="field">Meta (veces)<input data-testid="admin-mission-goal" type="number" min={1} max={50} value={form.meta_progreso} onChange={e=>setForm({...form,meta_progreso:Number(e.target.value)})}/></label></div><button data-testid="admin-create-mission" className="primary-btn full"><Plus size={16}/> Crear misión</button></form>
      <section className="panel"><div className="panel-title"><h2>{data.missions.length} misiones configuradas</h2><Trophy size={19}/></div>{data.missions.map(m=><div className="list-row" key={m.id}><span className="mission-icon" style={{background:m.color}}><Trophy size={16}/></span><span className="grow"><b>{m.titulo}</b><small>{m.descripcion}{m.cometa?' · reto de Cometa':''}{m.auto?' · automática':''}</small></span><Badge color="lime">+{m.xp} XP</Badge></div>)}</section></div>
  </main>
}

function CampusEditor({campus,states,onClose,onSaved}){
  const [f,setF]=useState({...campus,lat:campus.lat??'',lng:campus.lng??'',imagen:campus.imagen||''});
  const isNew=!campus.id;
  const save=async e=>{e.preventDefault();const body={nombre:f.nombre,estado:f.estado,lat:Number(f.lat),lng:Number(f.lng),is_connect:!!f.is_connect,imagen:f.imagen.trim()};if(!body.nombre||!body.estado||Number.isNaN(body.lat)||Number.isNaN(body.lng)||f.lat===''||f.lng===''){toast.error('Completa nombre, estado y coordenadas');return}try{isNew?await axios.post(`${API}/admin/campuses`,body):await axios.patch(`${API}/admin/campuses/${campus.id}`,body);toast.success(isNew?'Campus agregado':'Campus actualizado');onSaved()}catch(err){toast.error(errMsg(err))}};
  return <Modal eyebrow={isNew?'Nuevo campus':'Editar campus'} title={isNew?'Agregar campus':campus.nombre} onClose={onClose} wide testId="campus-editor"><form className="form-grid" onSubmit={save}>
    <label className="field">Nombre<input data-testid="campus-name" required value={f.nombre||''} onChange={e=>setF({...f,nombre:e.target.value})}/></label>
    <label className="field">Estado<input data-testid="campus-state" required list="estados" value={f.estado||''} onChange={e=>setF({...f,estado:e.target.value})}/><datalist id="estados">{states.map(s=><option key={s} value={s}/>)}</datalist></label>
    <label className="field">Latitud<input data-testid="campus-lat" type="number" step="0.0001" min={14} max={33} required value={f.lat} onChange={e=>setF({...f,lat:e.target.value})} placeholder="25.6866"/></label>
    <label className="field">Longitud<input data-testid="campus-lng" type="number" step="0.0001" min={-118} max={-86} required value={f.lng} onChange={e=>setF({...f,lng:e.target.value})} placeholder="-100.3161"/></label>
    <label className="field wide">Foto del campus (URL de la imagen)<input data-testid="campus-image" type="url" value={f.imagen} onChange={e=>setF({...f,imagen:e.target.value})} placeholder="https://..."/><small className="helper">Abre <a href={TECMI_CAMPUS_URL} target="_blank" rel="noreferrer">tecmilenio.mx/campus</a>, haz clic derecho en la foto del campus › «Copiar dirección de imagen» y pégala aquí. Para coordenadas: clic derecho sobre el campus en Google Maps.</small></label>
    <label className="check wide"><input type="checkbox" checked={!!f.is_connect} onChange={e=>setF({...f,is_connect:e.target.checked})}/> Es Espacio Connect</label>
    <div className="wide campus-editor-preview">{f.imagen?<img src={f.imagen} alt="Vista previa del campus" onError={e=>{e.currentTarget.style.display='none'}}/>:<div className="campus-placeholder small"><ImageOff size={18}/><small>Sin foto</small></div>}</div>
    <div className="wide row-actions end"><button type="button" className="ghost-btn" onClick={onClose}>Cancelar</button><button data-testid="campus-save" className="primary-btn">{isNew?'Agregar campus':'Guardar cambios'}</button></div>
  </form></Modal>
}

function AdminCampuses({data,refresh}){
  const [edit,setEdit]=useState(null);const [q,setQ]=useState('');
  const states=[...new Set(data.campuses.map(c=>c.estado))].sort();
  const shown=data.campuses.filter(c=>`${c.nombre} ${c.estado}`.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>a.estado.localeCompare(b.estado)||a.nombre.localeCompare(b.nombre));
  const missing=data.campuses.filter(c=>!c.imagen).length;
  return <main className="content"><PageTitle eyebrow="Red nacional" title="Campus" text="Mantén actualizada la red: ubicación en el mapa, Espacios Connect y foto de cada campus." action={<button data-testid="admin-create-campuses" className="primary-btn" onClick={()=>setEdit({nombre:'',estado:'',is_connect:false})}><Plus size={16}/> Agregar campus</button>}/>
    {missing>0&&<div className="banner"><ImageOff size={18}/><span>{missing} campus todavía no tienen foto. Edítalos para agregarla.</span></div>}
    <section className="panel"><div className="toolbar"><div className="search small grow"><Search size={15}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar campus o estado" aria-label="Buscar campus"/></div><small className="muted">{data.campuses.length} campus</small></div><div className="data-table">{shown.map(c=><div className="data-row" key={c.id}>{c.imagen?<img className="thumb" src={c.imagen} alt=""/>:<span className="thumb empty"><MapPin size={16}/></span>}<span className="grow"><b>{c.nombre}</b><small>{c.estado}{typeof c.lat==='number'?` · ${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}`:' · sin ubicación'}</small></span>{c.is_connect&&<Badge color="lime">Espacio Connect</Badge>}<button data-testid={`edit-campus-${c.id}`} className="outline-btn" onClick={()=>setEdit(c)}><Pencil size={14}/> Editar</button></div>)}</div></section>
    {edit&&<CampusEditor campus={edit} states={states} onClose={()=>setEdit(null)} onSaved={()=>{setEdit(null);refresh()}}/>}
  </main>
}

function AdminCertificates({data,refresh}){
  const cats=[...new Set(data.certificates.map(c=>c.categoria||'General'))];
  const blank={nombre:'',categoria:cats[0]||'General',proveedor:'',descripcion:''};const [form,setForm]=useState(blank);
  const create=async e=>{e.preventDefault();try{await axios.post(`${API}/admin/certificates`,form);toast.success('Certificado agregado');setForm(blank);refresh()}catch(err){toast.error(errMsg(err))}};
  return <main className="content"><PageTitle eyebrow="Estructura académica" title="Certificados" text="Catálogo de certificaciones que los estudiantes pueden marcar en su perfil."/>
    <div className="catalog-layout"><form className="panel stack" onSubmit={create}><span className="eyebrow">Nuevo registro</span><h2>Agregar certificado</h2><label className="field">Nombre<input data-testid="admin-certificados-name-input" required value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></label><label className="field">Categoría<input list="cert-cats" value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})}/><datalist id="cert-cats">{cats.map(c=><option key={c} value={c}/>)}</datalist></label><label className="field">Proveedor<input value={form.proveedor} onChange={e=>setForm({...form,proveedor:e.target.value})} placeholder="LinkedIn Learning, HubSpot..."/></label><label className="field">Descripción<textarea data-testid="admin-certificados-description-input" value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})}/></label><button data-testid="admin-create-certificados" className="primary-btn full"><Plus size={16}/> Agregar</button></form>
      <section className="panel"><div className="panel-title"><h2>{data.certificates.length} certificados</h2><ShieldCheck size={19}/></div>{data.certificates.map(c=><div className="list-row" key={c.id}><span className="catalog-icon" style={{background:certTheme(c.categoria).soft,color:certTheme(c.categoria).ink}}><GraduationCap size={17}/></span><span className="grow"><b>{c.nombre}</b><small>{c.categoria||'General'} · {c.proveedor||'Tecmilenio'}</small></span></div>)}</section></div>
  </main>
}

export default function AdminDashboard(props){
  const {page}=props;
  if(page==='Usuarios')return <AdminUsers {...props}/>;
  if(page==='Mensajes')return <Messages {...props} isAdmin/>;
  if(page==='Reportes')return <AdminReports {...props}/>;
  if(page==='Comunidades')return <AdminCommunities {...props}/>;
  if(page==='Eventos')return <AdminEvents {...props}/>;
  if(page==='Retos y Misiones')return <AdminMissions {...props}/>;
  if(page==='Campus')return <AdminCampuses {...props}/>;
  if(page==='Certificados')return <AdminCertificates {...props}/>;
  if(page==='Mi perfil')return <Profile {...props} isAdmin/>;
  return <AdminOverview {...props}/>;
}
