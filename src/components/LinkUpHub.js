import {useEffect,useMemo,useState} from "react";
import axios from "axios";
import {BookOpen,ChevronRight,Compass,ExternalLink,Flag,Flame,GraduationCap,Heart,ImageOff,MapPin,MessageCircle,Search,Send,ShieldAlert,ShieldCheck,Sparkles,Star,ThumbsUp,Trophy,Users,X,Zap,Check} from "lucide-react";
import {toast} from "sonner";
import {API,Avatar,Portal,certTheme,ChatThread,ConnectButton,EmptyState,MessageButton,Modal,PageTitle,errMsg,fullName,timeAgo} from "@/components/common";
import MEXICO from "@/data/mexico-map.json";

const iconMap={flame:Flame,heart:Heart,sparkles:Sparkles,book:BookOpen};
export const TECMI_CAMPUS_URL="https://tecmilenio.mx/es/sobre-tecmilenio/campus";

function Match({data,refresh,openChat,openProfile}){
  const [mode,setMode]=useState('Todos');const [campus,setCampus]=useState('Todos');const [q,setQ]=useState('');
  const campusList=['Todos',...new Set(data.students.map(p=>p.campus).filter(Boolean))];
  const mine=data.student;
  const people=data.students.filter(p=>{
    if(mode==='Pueden ayudarme'&&!(p.skills||[]).some(x=>(mine.needs||[]).includes(x)))return false;
    if(mode==='Puedo ayudarles'&&!(p.needs||[]).some(x=>(mine.skills||[]).includes(x)))return false;
    if(campus!=='Todos'&&p.campus!==campus)return false;
    const t=q.trim().toLowerCase();return !t||[fullName(p),p.campus,p.carrera,...(p.intereses||[]),...(p.skills||[]),...(p.needs||[])].join(' ').toLowerCase().includes(t)});
  const avg=people.length?Math.round(people.reduce((a,b)=>a+(b.match_score||0),0)/people.length):0;
  return <main className="content"><PageTitle eyebrow="Red académica · Tecmi Match" title="Conexiones que hacen match" text="Comparamos intereses, habilidades y lo que buscas para sugerirte perfiles que te complementan." action={<div className="summary-pill"><Sparkles size={18}/><b>{avg}%</b><small>match promedio</small></div>}/>
    <div className="toolbar"><div className="search small grow"><Search size={16}/><input data-testid="students-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por nombre, carrera, interés o habilidad" aria-label="Buscar estudiantes"/></div><label className="select-pill"><MapPin size={15}/><select data-testid="match-campus-filter" value={campus} onChange={e=>setCampus(e.target.value)} aria-label="Filtrar por campus">{campusList.map(c=><option key={c} value={c}>{c==='Todos'?'Todos los campus':c}</option>)}</select></label></div>
    <div className="chip-row"><span className="chip-row-label">Quiero ver personas que...</span>{['Todos','Pueden ayudarme','Puedo ayudarles'].map(x=><button data-testid={`match-filter-${x.toLowerCase().replaceAll(' ','-')}`} key={x} className={`chip-btn ${mode===x?'selected':''}`} onClick={()=>setMode(x)}>{x==='Todos'?'Todas':x}</button>)}</div>
    <div className="match-grid">{people.length===0?<EmptyState testId="match-empty" icon={Sparkles} title="Sin coincidencias" text="Ajusta los filtros para descubrir más perfiles."/>:people.map(p=><article className="match-card" key={p.id}>
      <div className="match-cover"><span className="match-pill on-cover" data-testid={`match-score-${p.id}`}><Zap size={12}/>{p.match_score||0}% match</span></div>
      <button className="match-avatar" data-testid={`match-open-profile-${p.id}`} onClick={()=>openProfile(p)} aria-label={`Ver perfil de ${p.nombre}`}><Avatar src={p.avatar} alt={p.nombre} size={76}/></button>
      <div className="match-body"><h2 data-testid={`match-name-${p.id}`}>{fullName(p)}</h2><p className="meta-line"><MapPin size={13}/> {p.campus||'Campus por definir'} · {p.semestre||'—'}</p>{p.cometa&&<p className="meta-line cometa-line">☄ {(data.cometas.find(c=>c.id===p.cometa)||{}).nombre}</p>}
        {(p.shared_interests||[]).length>0&&<div className="shared-tag"><Sparkles size={11}/> Comparten: {p.shared_interests.slice(0,3).join(', ')}</div>}
        <div className="two-col"><div className="tag-box"><small>Puede aportar</small><div className="chips">{(p.skills||[]).slice(0,4).map(x=><span key={x} className="chip lime">{x}</span>)}</div></div><div className="tag-box"><small>Está buscando</small><div className="chips">{(p.needs||[]).slice(0,4).map(x=><span key={x} className="chip purple">{x}</span>)}</div></div></div>
        <div className="row-actions">{p.connection_status==='connected'?<MessageButton person={p} openChat={openChat}/>:<ConnectButton person={p} refresh={refresh}/>}<button data-testid={`match-view-${p.id}`} className="outline-btn" onClick={()=>openProfile(p)}>Ver perfil</button></div>
      </div></article>)}</div>
  </main>
}

export function CometaQuiz({onClose,onDone,intro,doneLabel='Ver mi Cometa'}){
  const [questions,setQuestions]=useState([]);const [step,setStep]=useState(0);const [answers,setAnswers]=useState([]);const [result,setResult]=useState(null);
  useEffect(()=>{axios.get(`${API}/cometa-quiz`).then(r=>setQuestions(r.data))},[]);
  const pick=async id=>{const na=[...answers,id];setAnswers(na);if(step+1<questions.length){setStep(step+1);return}try{const r=await axios.post(`${API}/cometa-quiz/submit`,{answers:na});setResult(r.data);onDone()}catch(e){toast.error(errMsg(e))}};
  if(!questions.length)return null;
  return <Modal onClose={onClose} testId="cometa-quiz-modal">{result?<div className="quiz-result" style={{background:result.detalle.gradient}} data-testid="quiz-result"><Star size={38}/><span className="eyebrow light">Tu Cometa</span><h2>{result.detalle.nombre}</h2><b>{result.detalle.lema}</b><p>{result.detalle.descripcion}</p><button data-testid="quiz-close-final" className="lime-btn" onClick={onClose}>{doneLabel}</button></div>:<div className="quiz"><span className="eyebrow">Test de Cometa · {step+1} de {questions.length}</span>{intro&&step===0&&<p className="muted">{intro}</p>}<h2>{questions[step].q}</h2><div className="quiz-options">{questions[step].opts.map((o,i)=><button key={i} data-testid={`quiz-opt-${step}-${i}`} className="quiz-opt" onClick={()=>pick(o[1])}><span>{o[0]}</span><ChevronRight size={15}/></button>)}</div><div className="bar"><i style={{width:`${step/questions.length*100}%`}}/></div>{step>0&&<button className="text-btn" onClick={()=>{setStep(step-1);setAnswers(answers.slice(0,-1))}}>Volver a la pregunta anterior</button>}</div>}</Modal>
}

function CometaMembers({data,cometa,openProfile}){
  const [campus,setCampus]=useState('Todos');const [skill,setSkill]=useState('Todos');const [rows,setRows]=useState(null);
  useEffect(()=>{axios.get(`${API}/cometas/${cometa.id}/members`,{params:{campus,skill}}).then(r=>setRows(r.data)).catch(()=>setRows([]))},[cometa.id,campus,skill]);
  const campuses=['Todos',...new Set(data.students.concat([data.student]).map(s=>s.campus).filter(Boolean))];
  const skills=['Todos',...new Set(data.students.flatMap(s=>s.skills||[]))];
  return <section className="panel" data-testid="cometa-members"><div className="panel-title"><div><span className="eyebrow">Miembros de {cometa.nombre}</span><h2>Quién comparte tu constelación</h2></div></div><div className="toolbar"><label className="select-pill"><MapPin size={15}/><select data-testid="members-campus" value={campus} onChange={e=>setCampus(e.target.value)} aria-label="Campus">{campuses.map(c=><option key={c} value={c}>{c==='Todos'?'Todos los campus':c}</option>)}</select></label><label className="select-pill"><Sparkles size={15}/><select data-testid="members-skill" value={skill} onChange={e=>setSkill(e.target.value)} aria-label="Habilidad">{skills.map(s=><option key={s} value={s}>{s==='Todos'?'Todas las habilidades':s}</option>)}</select></label></div>
    {rows===null?<div className="skeleton-list"><i/><i/></div>:rows.length===0?<EmptyState icon={Users} title="Sin miembros con esos filtros" text="Ajusta campus o habilidad."/>:<div className="members-grid" data-testid="members-grid">{rows.map(m=><button className="member-card" key={m.id} data-testid={`member-${m.id}`} onClick={()=>openProfile(data.students.find(s=>s.id===m.id)||m)}><Avatar src={m.avatar} alt={m.nombre} size={44}/><span><b>{fullName(m)}{m.id===data.student.id&&' (tú)'}</b><small>{m.campus}</small><span className="chips">{(m.skills||[]).slice(0,3).map(x=><span className="chip" key={x}>{x}</span>)}</span></span></button>)}</div>}</section>
}

function Cometas({data,refresh,openProfile,user}){
  const [selected,setSelected]=useState(null);const [chat,setChat]=useState(null);const [quiz,setQuiz]=useState(false);
  const cometas=data.cometas||[];const mine=data.student.cometa;const myCometa=cometas.find(c=>c.id===mine);
  const open=selected||myCometa||cometas[0];
  const retos=(data.missions||[]).filter(m=>m.cometa===mine);
  const completeReto=async id=>{try{const r=await axios.post(`${API}/missions/${id}/complete`);r.data.already_completed?toast('Ya completaste este reto'):toast.success(`¡Reto completado! +${r.data.xp} XP para ${myCometa?.nombre}`);refresh()}catch(e){toast.error(errMsg(e))}};
  if(!open)return null;
  return <main className="content"><PageTitle eyebrow="Cometas · Sociedades Tecmi" title="Encuentra dónde perteneces" text="Cada estudiante forma parte de un Cometa según sus fortalezas. Diferentes personalidades, una misma constelación." action={<button data-testid="open-quiz-button" className="primary-btn" onClick={()=>setQuiz(true)}><Sparkles size={16}/> {mine?'Repetir test':'Hacer test'}</button>}/>
    <div className="cometa-grid">{cometas.map(c=>{const Icon=iconMap[c.icon]||Star;return <button key={c.id} data-testid={`cometa-${c.id}`} className={`cometa-card ${open.id===c.id?'active':''}`} style={{background:c.gradient}} onClick={()=>setSelected(c)} aria-pressed={open.id===c.id}><Icon size={26}/><b>{c.nombre}</b><small>{c.lema}</small><span className="cometa-foot">{c.id===mine&&<em data-testid="mine-badge"><ShieldCheck size={11}/> Tu Cometa</em>}<span>{c.miembros} {c.miembros===1?'miembro':'miembros'}</span></span></button>})}</div>
    <section className="cometa-detail panel"><div><span className="eyebrow" style={{color:open.color}}>{open.nombre}</span><h2>{open.lema}</h2><p>{open.descripcion}</p><div className="chips">{(open.fortalezas||[]).map(f=><span key={f} className="chip chip-outline" style={{borderColor:open.color,color:open.color}}>{f}</span>)}</div><blockquote data-testid={`cometa-cita-${open.id}`}>“{open.cita}”</blockquote>{(open.id===mine||user.rol==='administrador')?<button data-testid={`cometa-chat-open-${open.id}`} className="outline-btn" onClick={()=>setChat(open)}><MessageCircle size={15}/> Abrir chat del Cometa</button>:<small className="helper">El chat de {open.nombre} es para sus miembros.</small>}</div><div className="cometa-visual" style={{background:open.gradient}}><Star size={56}/><b>Constelación Tecmilenio</b></div></section>
    <div className="bento">
      <section className="panel" data-testid="cometa-ranking"><div className="panel-title"><div><span className="eyebrow">Ranking semanal</span><h2>Constelación en movimiento</h2></div><Trophy size={18}/></div>{(data.cometas_ranking||[]).map((r,i)=><div className="rank-row" key={r.id} data-testid={`rank-${r.id}`}><span className="rank-pos">{i+1}</span><span className="rank-name"><b>{r.nombre}</b><small>{r.members} miembros · {r.total_xp} XP</small></span><span className="rank-bar"><i style={{width:`${r.percent}%`,background:r.gradient}}/></span></div>)}</section>
      <section className="panel"><div className="panel-title"><div><span className="eyebrow">Tus insignias {myCometa?`en ${myCometa.nombre}`:''}</span><h2>Vas reforzando tu identidad</h2></div></div>{(data.insignias||[]).length===0?<EmptyState icon={Star} title="Tu primera insignia llega a los 100 XP" text="Completa misiones y retos de tu Cometa."/>:<div className="chips">{data.insignias.map(i=><span key={i.nombre} className="chip insignia" data-testid={`insignia-${i.nombre}`}><Star size={13} fill="currentColor"/> {i.nombre} · {i.xp_req}+ XP</span>)}</div>}</section>
    </div>
    {retos.length>0&&<section className="panel" data-testid="cometa-retos"><div className="panel-title"><div><span className="eyebrow">Retos exclusivos de {myCometa?.nombre}</span><h2>XP directo al ranking</h2></div></div><div className="retos-list">{retos.map(m=>{const done=m.progress>=m.goal;return <div className="reto-card" key={m.id} data-testid={`reto-${m.id}`}><span className="mission-icon" style={{background:m.color}}><Flag size={17}/></span><span><b>{m.titulo}</b><small>{m.descripcion}</small></span><span className="reto-side"><em>+{m.xp} XP</em>{done?<span className="status-note ok"><Check size={14}/> Hecho</span>:<button data-testid={`reto-complete-${m.id}`} className="outline-btn" onClick={()=>completeReto(m.id)}>Marcar como hecho</button>}</span></div>})}</div></section>}
    {myCometa&&<CometaMembers data={data} cometa={myCometa} openProfile={openProfile}/>}
    {chat&&<Portal><div className="drawer-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setChat(null)}><aside className="drawer" role="dialog" aria-label={`Chat del Cometa ${chat.nombre}`} data-testid={`cometa-chat-${chat.id}`}><header className="drawer-head" style={{background:chat.gradient}}><div><span className="eyebrow light">Chat en vivo</span><h2>☄ Cometa {chat.nombre}</h2><small>{chat.lema}</small></div><button className="icon-btn light" data-testid="cometa-chat-close" onClick={()=>setChat(null)} aria-label="Cerrar"><X size={18}/></button></header><ChatThread key={chat.id} testId="cometa-chat" meId={user.id} load={()=>axios.get(`${API}/cometas/${chat.id}/messages`).then(r=>r.data)} send={t=>axios.post(`${API}/cometas/${chat.id}/messages`,{contenido:t})} placeholder={`Mensaje al Cometa ${chat.nombre}...`}/></aside></div></Portal>}
    {quiz&&<CometaQuiz onClose={()=>{setQuiz(false);refresh()}} onDone={refresh}/>}
  </main>
}

// Proyección lineal idéntica a la usada para generar el mapa (src/data/mexico-map.json)
export const project=(lat,lng)=>{const p=MEXICO.proj;return [((lng-p.minLon)*p.cos*p.k)/p.W*100,((p.maxLat-lat)*p.k)/p.H*100]};

// Separa pines que se encimarían (p. ej. CDMX y Estado de México) y conserva una línea hacia su ubicación real
function spreadPins(pins,minDist=4.2){
  const out=pins.map(p=>({...p,px:p.x,py:p.y*0.626}));
  for(let it=0;it<60;it++)for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){const a=out[i],b=out[j];const dx=b.px-a.px,dy=b.py-a.py;const d=Math.hypot(dx,dy)||.01;if(d<minDist){const push=(minDist-d)/2;const ux=dx/d,uy=dy/d;a.px-=ux*push;a.py-=uy*push;b.px+=ux*push;b.py+=uy*push}}
  return out.map(p=>({...p,px:p.px,py:p.py/0.626}));
}

export function MexicoMap({campuses,selectedState,selectedCampus,onState}){
  const byState=useMemo(()=>campuses.reduce((a,c)=>{if(typeof c.lat==='number'&&typeof c.lng==='number')(a[c.estado]=a[c.estado]||[]).push(c);return a},{}),[campuses]);
  const pins=useMemo(()=>spreadPins(Object.entries(byState).map(([estado,items])=>{const pts=items.map(c=>project(c.lat,c.lng));return {estado,items,x:pts.reduce((s,p)=>s+p[0],0)/pts.length,y:pts.reduce((s,p)=>s+p[1],0)/pts.length}})),[byState]);
  const active=selectedState&&byState[selectedState];
  return <div className="mexico-map" data-testid="mexico-map"><div className="map-canvas">
    <svg viewBox={MEXICO.viewBox} className="mexico-svg" aria-hidden="true">{MEXICO.paths.map(p=><path key={p.name} d={p.d}/>)}
      {pins.map(p=>(Math.abs(p.px-p.x)>.3||Math.abs(p.py-p.y)>.3)&&<line key={`l-${p.estado}`} x1={p.x*10} y1={p.y*6.26} x2={p.px*10} y2={p.py*6.26} className="pin-leader"/>)}
      {pins.map(p=><circle key={`d-${p.estado}`} cx={p.x*10} cy={p.y*6.26} r="3.2" className="pin-dot"/>)}
      {active&&active.map(c=>{const [x,y]=project(c.lat,c.lng);return <circle key={c.id} cx={x*10} cy={y*6.26} r="5" className={`campus-dot ${selectedCampus?.id===c.id?'on':''}`}/>})}
    </svg>
    {pins.map((p,i)=><button key={p.estado} data-testid={`map-state-${p.estado.toLowerCase().replaceAll(' ','-')}`} className={`map-pin ${selectedState===p.estado?'active':''} ${selectedState&&selectedState!==p.estado?'dim':''}`} style={{left:`${p.px}%`,top:`${p.py}%`,animationDelay:`${i*18}ms`}} onClick={()=>onState(p.estado)} aria-label={`${p.estado}: ${p.items.length} campus`}><span>{p.items.length}</span><em className="pin-tip">{p.estado}</em></button>)}
    </div><div className="map-legend"><b>{Object.keys(byState).length}</b> estados · <b>{campuses.length}</b> campus</div>
  </div>
}

function CampusImage({campus}){
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[campus.id]);
  return <figure className="campus-preview" data-testid="campus-preview">{campus.imagen&&!failed?<img src={campus.imagen} alt={`Instalaciones de Tecmilenio campus ${campus.nombre}`} onError={()=>setFailed(true)}/>:<div className="campus-placeholder"><ImageOff size={22}/><b>Campus {campus.nombre}</b><small>Foto pendiente: el equipo admin puede agregarla desde Catálogos › Campus.</small></div>}<figcaption><span><b>{campus.nombre}</b><small>{campus.estado}{campus.is_connect?' · Espacio Connect':''}</small></span><a className="text-btn" href={TECMI_CAMPUS_URL} target="_blank" rel="noreferrer">Ver en tecmilenio.mx <ExternalLink size={13}/></a></figcaption></figure>
}

function CampusMap({data,openProfile}){
  const [state,setState]=useState(null);const [campus,setCampus]=useState(null);
  const campuses=data.campuses||[];
  const people=useMemo(()=>[data.student,...data.students].filter(s=>s.rol!=='administrador'),[data]);
  const items=state?campuses.filter(c=>c.estado===state).sort((a,b)=>a.nombre.localeCompare(b.nombre)):[];
  const states=[...new Set(campuses.map(c=>c.estado))].sort();
  const pickState=s=>{setState(s);const only=campuses.filter(c=>c.estado===s);setCampus(only.length===1?only[0]:null)};
  const users=campus?people.filter(p=>p.campus===campus.nombre):[];
  const countFor=c=>people.filter(p=>p.campus===c.nombre).length;
  return <main className="content"><PageTitle eyebrow="Mapa Tecmi" title="Una comunidad, muchos campus" text="Toca un estado para ver sus campus. Elige un campus para ver su foto y quién estudia ahí."/>
    <section className="map-explorer panel">
      <MexicoMap campuses={campuses} selectedState={state} selectedCampus={campus} onState={pickState}/>
      <div className="map-sidebar">{!state?<><span className="eyebrow">Campus conectados</span><h2>Elige un estado</h2><p className="muted">Haz clic en un pin o selecciona un estado.</p><div className="state-list">{states.map(s=><button data-testid={`state-btn-${s.toLowerCase().replaceAll(' ','-')}`} key={s} onClick={()=>pickState(s)}><MapPin size={14}/><span>{s}</span><em>{campuses.filter(c=>c.estado===s).length}</em><ChevronRight size={14}/></button>)}</div></>:
        <><button className="text-btn back-link" data-testid="map-clear-state" onClick={()=>{setState(null);setCampus(null)}}><ChevronRight size={14} className="flip"/> Todos los estados</button><span className="eyebrow">{items.length} {items.length===1?'campus':'campus'}</span><h2>{state}</h2>
          <div className="campus-state-list" data-testid="campus-state-list">{items.map(c=><button key={c.id} className={`state-campus ${campus?.id===c.id?'active':''}`} data-testid={`campus-item-${c.id}`} onClick={()=>setCampus(c)} aria-pressed={campus?.id===c.id}><MapPin size={14}/><span><b>{c.nombre}</b><small>{countFor(c)} {countFor(c)===1?'estudiante':'estudiantes'}</small></span>{c.is_connect&&<em className="connect-tag">Connect</em>}<ChevronRight size={14}/></button>)}</div></>}
      </div>
    </section>
    {campus&&<section className="campus-detail-grid" data-testid="campus-detail"><CampusImage campus={campus}/><div className="panel"><div className="panel-title"><div><span className="eyebrow">Comunidad del campus</span><h2>Estudiantes en {campus.nombre}</h2></div><span className="summary-pill small"><Users size={15}/><b>{users.length}</b></span></div>{users.length===0?<EmptyState icon={Users} title="Aún no hay estudiantes registrados aquí" text="Invita a tus compañeros de este campus."/>:<div className="member-list" data-testid="campus-users">{users.map(u=><button key={u.id} className="inbox-row" onClick={()=>u.id!==data.student.id&&openProfile(u)}><Avatar src={u.avatar} alt={u.nombre||u.author||""} size={40}/><span><b>{fullName(u)}{u.id===data.student.id&&' (tú)'}</b><small>{u.carrera||u.semestre||''}</small></span>{u.id!==data.student.id&&typeof u.match_score==='number'&&<span className="match-pill small"><Zap size={11}/>{u.match_score}%</span>}</button>)}</div>}</div></section>}
  </main>
}

function Certificates({data,refresh}){
  const [cat,setCat]=useState('Todos');
  const grouped=(data.certificates||[]).reduce((a,c)=>{const k=c.categoria||'General';(a[k]=a[k]||[]).push(c);return a},{});
  const items=cat==='Todos'?(data.certificates||[]):grouped[cat]||[];
  const mine=data.student.certificados_cursados||[];
  const people=[data.student,...data.students];
  const toggle=async c=>{const has=mine.includes(c.nombre);try{await axios.put(`${API}/students/${data.student.id}`,{certificados_cursados:has?mine.filter(x=>x!==c.nombre):[...mine,c.nombre]});toast.success(has?'Quitada de tu perfil':'Agregada a tu perfil');refresh()}catch(e){toast.error(errMsg(e))}};
  return <main className="content"><PageTitle eyebrow="Portafolio académico" title="Certificaciones Tecmilenio" text="Explora certificaciones de industria, negocios, creatividad y bienestar. Marca las que ya cursaste."/>
    <div className="chip-row">{['Todos',...Object.keys(grouped)].map(c=><button data-testid={`cert-cat-${c.toLowerCase().replaceAll(' ','-')}`} key={c} className={`chip-btn ${cat===c?'selected':''}`} style={c!=='Todos'?{'--cat':certTheme(c).from}:undefined} onClick={()=>setCat(c)}>{c!=='Todos'&&<i className="cat-dot"/>}{c}</button>)}</div>
    <div className="certificate-grid">{items.map((c,i)=>{const has=mine.includes(c.nombre);const n=people.filter(p=>(p.certificados_cursados||[]).includes(c.nombre)).length;return <article className={`certificate-card ${has?'mine':''}`} style={{'--cat':certTheme(c.categoria).from}} key={c.id} data-testid={`cert-card-${c.id}`}><div className="certificate-banner" style={{background:`var(--grain),linear-gradient(135deg,${certTheme(c.categoria).from},${certTheme(c.categoria).to})`}}><BookOpen size={22}/><span>{c.categoria||'General'}</span></div><div className="certificate-body"><h2>{c.nombre}</h2><p className="meta-line"><GraduationCap size={13}/> {c.proveedor||'Tecmilenio'}</p><div className="certificate-foot"><span className="meta-line"><Users size={13}/> {n} {n===1?'estudiante':'estudiantes'}</span><button data-testid={`cert-toggle-${c.id}`} className={has?'ghost-btn':'outline-btn'} onClick={()=>toggle(c)} aria-pressed={has}>{has?<><Check size={14}/> Cursada</>:'La cursé'}</button></div></div></article>})}</div>
  </main>
}

const REPORT_REASONS=['Contenido inapropiado','Acoso o conducta inadecuada','Información falsa','Spam'];
function Comments({post,refresh,user}){
  const [items,setItems]=useState(null);const [text,setText]=useState('');
  const load=()=>axios.get(`${API}/feed/${post.id}/comments`).then(r=>setItems(r.data));
  useEffect(()=>{load()},[post.id]);// eslint-disable-line react-hooks/exhaustive-deps
  const send=async e=>{e.preventDefault();if(!text.trim())return;try{await axios.post(`${API}/feed/${post.id}/comment`,{contenido:text});setText('');load();refresh()}catch(err){toast.error(errMsg(err))}};
  return <div className="comments" data-testid={`comments-${post.id}`}>{items===null?<div className="skeleton-list"><i/></div>:items.map(c=><div className="comment" key={c.id}><Avatar src={c.avatar} alt={c.nombre||c.author||""} size={28}/><span><b>{c.author}</b> {c.contenido}<time>{timeAgo(c.created_at)}</time></span></div>)}<form className="comment-form" onSubmit={send}><Avatar src={user.avatar} alt={user.nombre||user.author||""} size={28}/><input data-testid={`comment-input-${post.id}`} value={text} onChange={e=>setText(e.target.value)} placeholder="Escribe un comentario..." maxLength={1000} aria-label="Comentario"/><button className="send-btn small" data-testid={`comment-send-${post.id}`} disabled={!text.trim()} aria-label="Comentar"><Send size={15}/></button></form></div>
}

function Feed({data,refresh,user}){
  const [text,setText]=useState('');const [category,setCategory]=useState('Comunidad');const [filter,setFilter]=useState('Todos');
  const [report,setReport]=useState(null);const [reason,setReason]=useState(REPORT_REASONS[0]);const [detail,setDetail]=useState('');const [openComments,setOpenComments]=useState({});
  const posts=(data.feed||[]).filter(p=>filter==='Todos'||p.categoria===filter);
  const post=async()=>{if(!text.trim())return;try{await axios.post(`${API}/feed`,{contenido:text,categoria:category});setText('');toast.success('Publicación compartida');refresh()}catch(e){toast.error(errMsg(e))}};
  const react=async p=>{try{await axios.post(`${API}/feed/${p.id}/react`);refresh()}catch(e){toast.error(errMsg(e))}};
  const sendReport=async()=>{try{await axios.post(`${API}/feed/${report.id}/report`,{motivo:reason,detalle:detail});toast.success('Gracias. Tu reporte llegó al equipo de moderación.');setReport(null);setDetail('')}catch(e){toast.error(errMsg(e))}};
  return <main className="content"><PageTitle eyebrow="Feed Tecmi" title="Lo que pasa en la comunidad" text="Comparte oportunidades, proyectos, eventos y logros."/>
    <section className="feed-layout"><div className="feed-main">
      <div className="composer panel"><Avatar src={user.avatar} alt={user.nombre} size={40}/><div className="composer-body"><textarea data-testid="feed-post-input" value={text} maxLength={2000} onChange={e=>setText(e.target.value)} placeholder="¿Qué quieres compartir con tu comunidad?" aria-label="Nueva publicación"/><div className="composer-foot"><div className="chip-row tight" role="radiogroup" aria-label="Categoría">{['Comunidad','Noticias','Oportunidades'].map(c=><button key={c} role="radio" aria-checked={category===c} data-testid={`composer-cat-${c.toLowerCase()}`} className={`chip-btn small ${category===c?'selected':''}`} onClick={()=>setCategory(c)}>{c}</button>)}</div><button data-testid="feed-publish-button" className="primary-btn" disabled={!text.trim()} onClick={post}>Publicar</button></div></div></div>
      <div className="chip-row" data-testid="feed-filters">{['Todos','Comunidad','Noticias','Oportunidades'].map(c=><button key={c} data-testid={`feed-filter-${c.toLowerCase()}`} className={`chip-btn ${filter===c?'selected':''}`} onClick={()=>setFilter(c)}>{c}</button>)}</div>
      {posts.length===0?<EmptyState testId="feed-empty" icon={Compass} title="Sin publicaciones aquí" text="Prueba otra categoría o comparte la primera."/>:posts.map(p=><article className="feed-post panel" key={p.id}><div className="feed-author"><Avatar src={p.avatar} alt={p.author} size={40}/><span><b>{p.author}</b><small>{p.categoria} · {timeAgo(p.created_at)}</small></span><button data-testid={`feed-report-${p.id}`} className="icon-btn" onClick={()=>setReport(p)} aria-label="Reportar publicación" title="Reportar"><ShieldAlert size={17}/></button></div><p>{p.contenido}</p><div className="feed-actions"><button data-testid={`feed-react-${p.id}`} className={p.my_reaction?'on':''} onClick={()=>react(p)} aria-pressed={p.my_reaction}><ThumbsUp size={15}/> {p.reactions||0}</button><button data-testid={`feed-comment-${p.id}`} className={openComments[p.id]?'on':''} onClick={()=>setOpenComments(o=>({...o,[p.id]:!o[p.id]}))} aria-expanded={!!openComments[p.id]}><MessageCircle size={15}/> {p.comments_count?`${p.comments_count} comentarios`:'Comentar'}</button></div>{openComments[p.id]&&<Comments post={p} refresh={refresh} user={user}/>}</article>)}
    </div><aside className="feed-aside panel"><span className="eyebrow light">Espacio seguro</span><h2>Construye tu historia</h2><p>Tu participación también es parte de la historia viva de Tecmilenio. Si ves algo que no está bien, usa <ShieldAlert size={13}/> para reportarlo.</p><div className="story-card"><Star size={18}/><b>Orgullo Tecmilenio</b><small>Comparte logros, proyectos y aprendizajes.</small></div><div className="story-card"><Flag size={18}/><b>Oportunidades</b><small>Retos, becas y proyectos para llevar tus ideas más lejos.</small></div></aside></section>
    {report&&<Modal eyebrow="Espacio seguro" title="Reportar publicación" onClose={()=>setReport(null)} testId="report-modal"><p className="muted">Ayúdanos a mantener una comunidad respetuosa. El equipo docente revisará el reporte.</p><label className="field">Motivo<select data-testid="report-reason" value={reason} onChange={e=>setReason(e.target.value)}>{REPORT_REASONS.map(r=><option key={r}>{r}</option>)}</select></label><label className="field">Detalle (opcional)<textarea data-testid="report-detail" value={detail} onChange={e=>setDetail(e.target.value)} maxLength={500} placeholder="Cuéntanos qué pasó"/></label><button data-testid="send-report-button" className="primary-btn full" onClick={sendReport}>Enviar a moderación</button></Modal>}
  </main>
}

function History({go}){
  const sections=[
    {icon:Sparkles,title:'Tecmi Match',text:'Analiza intereses, habilidades y objetivos para encontrar conexiones que se complementen. No se trata solo de conocer personas, sino de descubrir con quién podrías crear algo que por tu cuenta quizá no habrías podido hacer.',page:'Match'},
    {icon:Flame,title:'Cometas',text:'Brela, Halley, Ikeya y Araya: cuatro sociedades inspiradas en fortalezas humanas para que cada estudiante sienta identidad y orgullo de pertenecer a la constelación Tecmilenio.',page:'Cometas'},
    {icon:Users,title:'Comunidades y clubes',text:'Espacios abiertos alrededor de intereses como Moda, Gaming, Emprendimiento, Arte o Deportes. A veces una conexión no comienza con «¿qué estudias?», sino con «a mí también me gusta eso».',page:'Comunidades'},
    {icon:BookOpen,title:'Certificados como portafolio',text:'Los certificados no se quedan en una calificación: se vuelven parte de tu historia académica y profesional, visible para toda la red.',page:'Certificados'},
    {icon:Star,title:'Eventos, retos y Pasaporte Tecmi',text:'Participa en actividades, colabora con otros estudiantes, gana XP y construye tu Pasaporte Tecmi.',page:'Misiones'},
    {icon:ShieldCheck,title:'Una comunidad segura',text:'Herramientas para reportar comportamientos inadecuados y moderar conversaciones, para que cada estudiante participe con confianza.',page:'Feed'},
  ];
  return <main className="content"><PageTitle eyebrow="¿Qué es Tecmi Link-Up?" title="Una historia que nos conecta" text="Estudiar en Tecmilenio no es solo compartir salón o campus: es formar parte de una comunidad mucho más grande."/>
    <section className="history-hero panel"><div><span className="eyebrow light">Tecmi Link-Up</span><h2>Conectar, pertenecer, colaborar y crecer juntos</h2><p>Una plataforma de networking y comunidad para conectar a estudiantes de Tecmilenio sin importar dónde estudien, qué certificado cursen o cuáles sean sus intereses.</p></div><div className="history-emblem"><Star size={40}/><b>Comunidad que inspira</b></div></section>
    <div className="linkup-sections">{sections.map(s=>{const I=s.icon;return <button key={s.title} className="linkup-section panel" onClick={()=>go(s.page)}><span className="ls-icon"><I size={21}/></span><span><h3>{s.title}</h3><p>{s.text}</p><em>Ir a {s.page} <ChevronRight size={13}/></em></span></button>})}</div>
    <section className="history-closing panel"><span className="eyebrow">En pocas palabras</span><h2>Ningún estudiante estudia solo</h2><p>Descubre quién comparte tus intereses, quién complementa tus habilidades, qué Cometa te representa y qué oportunidades surgen de una conexión. <b>Tecmi Link-Up busca ser ese puente.</b></p></section>
  </main>
}

export default function LinkUpHub(props){const {page}=props;if(page==='Match')return <Match {...props}/>;if(page==='Cometas')return <Cometas {...props}/>;if(page==='Mapa Tecmi')return <CampusMap {...props}/>;if(page==='Certificados')return <Certificates {...props}/>;if(page==='Feed')return <Feed {...props}/>;return <History {...props}/>}
