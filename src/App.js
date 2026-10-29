import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import axios from "axios";
import {Activity,BookOpen,CalendarDays,ChevronDown,ChevronRight,CircleUserRound,Eye,EyeOff,Flame,GraduationCap,LayoutDashboard,ListChecks,LogOut,Mail,MapPin,MessageCircle,MoreHorizontal,Network,Search,Bell,Sparkles,Trophy,User,UserPlus,Users,Lock,Check,X,ShieldAlert,Settings2} from "lucide-react";
import {Toaster,toast} from "sonner";
import AdminDashboard from "@/components/AdminDashboard";
import LinkUpHub, {CometaQuiz} from "@/components/LinkUpHub";
import StudentPages from "@/components/StudentPages";
import Logo,{LogoMark} from "@/components/Logo";
import WelcomeTour from "@/components/WelcomeTour";
import {API,Avatar,PasswordRules,PublicProfile,errMsg,fullName,passwordOk,timeAgo} from "@/components/common";
import "@/App.css";

axios.interceptors.request.use(cfg=>{const t=localStorage.getItem('tecmi_token');if(t)cfg.headers.Authorization=`Bearer ${t}`;return cfg});

// Navegación agrupada: lo diario arriba, lo de consulta en un grupo colapsable
// Se muestra al pie del menú para saber qué versión está abierta (útil si el navegador guardó una vieja)
const APP_VERSION='v28-oct-2026 c';
const STUDENT_NAV=[
  {label:'Principal',items:[['Inicio',LayoutDashboard],['Match',Sparkles],['Invitaciones',UserPlus],['Mensajes',MessageCircle]]},
  {label:'Comunidad',items:[['Cometas',Flame],['Comunidades',Users],['Feed',Activity],['Eventos',CalendarDays]]},
  {label:'Explora',collapsible:true,items:[['Mapa Tecmi',MapPin],['Certificados',GraduationCap],['Misiones',Trophy],['Historia',BookOpen]]},
];
const ADMIN_NAV=[
  {label:'Principal',items:[['Vista general',LayoutDashboard],['Usuarios',Users],['Mensajes',MessageCircle],['Reportes',ListChecks]]},
  {label:'Operación',items:[['Comunidades',Network],['Eventos',CalendarDays],['Retos y Misiones',Trophy]]},
  {label:'Catálogos',collapsible:true,items:[['Campus',MapPin],['Certificados',GraduationCap]]},
];
const STUDENT_TABS=[['Inicio',LayoutDashboard],['Match',Sparkles],['Mensajes',MessageCircle],['Invitaciones',UserPlus]];
const ADMIN_TABS=[['Vista general',LayoutDashboard],['Usuarios',Users],['Mensajes',MessageCircle],['Reportes',ListChecks]];
const slug=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
const ALL_PAGES=[...STUDENT_NAV,...ADMIN_NAV].flatMap(g=>g.items.map(i=>i[0])).concat('Mi perfil');
const pageFromHash=()=>ALL_PAGES.find(p=>slug(p)===window.location.hash.slice(1));

function NavButton({name,Icon,page,go,count}){return <button data-testid={`nav-${slug(name)}`} className={page===name?'active':''} aria-current={page===name?'page':undefined} onClick={()=>go(name)}><Icon size={18}/><span>{name}</span>{count>0&&<i className="nav-count">{count}</i>}</button>}

function SideNav({nav,page,go,onLogout,user,counts}){
  const [open,setOpen]=useState(()=>{try{return localStorage.getItem('tecmi_nav_more')==='1'}catch{return false}});
  const toggle=()=>{setOpen(o=>{try{localStorage.setItem('tecmi_nav_more',o?'0':'1')}catch{}return !o})};
  return <aside className="sidebar"><div className="sidebar-brand"><Logo size={38} light/></div>
    <nav aria-label="Menú principal">{nav.map(g=>{const hasActive=g.items.some(i=>i[0]===page);const show=!g.collapsible||open||hasActive;return <div className="nav-group" key={g.label}>{g.collapsible?<button className="nav-label as-btn" data-testid={`nav-group-${slug(g.label)}`} onClick={toggle} aria-expanded={show}>{g.label}<ChevronDown size={14} className={show?'rot':''}/></button>:<div className="nav-label">{g.label}</div>}{show&&g.items.map(([name,Icon])=><NavButton key={name} name={name} Icon={Icon} page={page} go={go} count={counts[name]}/>)}</div>})}</nav>
    <div className="side-bottom"><button className={`profile-card ${page==='Mi perfil'?'active':''}`} data-testid="nav-mi-perfil" onClick={()=>go('Mi perfil')}><Avatar src={user.avatar} alt={user.nombre} size={36}/><span><b>{fullName(user)}</b><small>{user.rol==='administrador'?'Docente / admin':'Estudiante'} · Mi perfil</small></span><Settings2 size={16}/></button><button className="logout-btn" data-testid="nav-logout" onClick={onLogout}><LogOut size={17}/> Cerrar sesión</button><small className="app-version" data-testid="app-version">Tecmi Link-Up {APP_VERSION}</small></div>
  </aside>
}

function MobileTabs({tabs,nav,page,go,counts,onLogout}){
  const [more,setMore]=useState(false);
  const rest=nav.flatMap(g=>g.items).filter(([n])=>!tabs.some(t=>t[0]===n));
  return <><nav className="tabbar" aria-label="Navegación">{tabs.map(([name,Icon])=><button key={name} data-testid={`tab-${slug(name)}`} className={page===name?'active':''} onClick={()=>go(name)}><span className="tab-icon"><Icon size={21}/>{counts[name]>0&&<i>{counts[name]}</i>}</span><small>{name==='Vista general'?'Inicio':name}</small></button>)}<button data-testid="tab-mas" className={more||!tabs.some(t=>t[0]===page)?'active':''} onClick={()=>setMore(true)}><span className="tab-icon"><MoreHorizontal size={21}/></span><small>Más</small></button></nav>
    {more&&<div className="sheet-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setMore(false)}><div className="sheet" role="dialog" aria-label="Más secciones"><div className="sheet-grabber"/><div className="sheet-grid">{[...rest,['Mi perfil',CircleUserRound]].map(([name,Icon])=><button key={name} data-testid={`more-${slug(name)}`} className={page===name?'active':''} onClick={()=>{go(name);setMore(false)}}><Icon size={22}/><span>{name}</span></button>)}</div><button className="logout-btn wide" onClick={onLogout}><LogOut size={17}/> Cerrar sesión</button><small className="app-version dark">Tecmi Link-Up {APP_VERSION}</small></div></div>}
  </>
}

function NotificationsBell({notifications,refreshPulse,go}){
  const [open,setOpen]=useState(false);
  const items=notifications?.items||[];const unread=notifications?.unread||0;
  useEffect(()=>{if(!open)return;const h=e=>{if(!e.target.closest('.notif-wrap'))setOpen(false)};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)},[open]);
  const markAll=async()=>{await axios.post(`${API}/notifications/read-all`);refreshPulse()};
  const openOne=async n=>{if(!n.leida)await axios.post(`${API}/notifications/${n.id}/read`);refreshPulse();if(n.link){go(n.link);setOpen(false)}};
  return <div className="notif-wrap"><button data-testid="notifications-button" className="icon-btn" onClick={()=>setOpen(o=>!o)} aria-label={`Notificaciones${unread?`, ${unread} sin leer`:''}`}><Bell size={19}/>{unread>0&&<i className="dot-count" data-testid="notif-badge">{unread}</i>}</button>
    {open&&<div className="notif-panel" data-testid="notif-panel"><div className="notif-head"><b>Notificaciones</b>{unread>0&&<button data-testid="notif-mark-all" className="text-btn" onClick={markAll}>Marcar todo como leído</button>}</div><div className="notif-list">{items.length===0?<div className="notif-empty"><Bell size={22}/><small>Sin novedades por ahora</small></div>:items.map(n=><button key={n.id} data-testid={`notif-item-${n.id}`} className={`notif-row ${n.leida?'':'unread'}`} onClick={()=>openOne(n)}><Avatar src={n.avatar} size={34}/><span><b>{n.titulo}</b><small>{n.subtitulo}</small><em>{timeAgo(n.created_at)}</em></span></button>)}</div></div>}
  </div>
}

// Búsqueda global sobre lo que ya cargó la app: personas, campus, certificados, eventos y comunidades
function GlobalSearch({data,go,openProfile,isAdmin}){
  const [q,setQ]=useState('');const [open,setOpen]=useState(false);const ref=useRef(null);
  useEffect(()=>{const h=e=>{if(!ref.current?.contains(e.target))setOpen(false)};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)},[]);
  const results=useMemo(()=>{const t=q.trim().toLowerCase();if(t.length<2)return[];const has=s=>(s||'').toLowerCase().includes(t);const out=[];
    data.students.filter(p=>has(fullName(p))||has(p.campus)||(p.intereses||[]).some(has)).slice(0,5).forEach(p=>out.push({k:`p${p.id}`,icon:User,title:fullName(p),sub:p.campus,act:()=>openProfile(p)}));
    (data.campuses||[]).filter(c=>has(c.nombre)||has(c.estado)).slice(0,3).forEach(c=>out.push({k:`c${c.id}`,icon:MapPin,title:`Campus ${c.nombre}`,sub:c.estado,act:()=>go(isAdmin?'Campus':'Mapa Tecmi')}));
    (data.certificates||[]).filter(c=>has(c.nombre)).slice(0,3).forEach(c=>out.push({k:`ce${c.id}`,icon:GraduationCap,title:c.nombre,sub:c.proveedor,act:()=>go('Certificados')}));
    data.events.filter(e=>has(e.titulo)).slice(0,3).forEach(e=>out.push({k:`e${e.id}`,icon:CalendarDays,title:e.titulo,sub:e.fecha_inicio,act:()=>go('Eventos')}));
    data.communities.filter(c=>has(c.nombre)||has(c.categoria)).slice(0,3).forEach(c=>out.push({k:`co${c.id}`,icon:Users,title:c.nombre,sub:c.categoria,act:()=>go('Comunidades')}));
    return out},[q,data,go,openProfile,isAdmin]);
  return <div className="search-wrap" ref={ref}><div className="search" data-testid="global-search-box"><Search size={17}/><input data-testid="global-search" value={q} onChange={e=>{setQ(e.target.value);setOpen(true)}} onFocus={()=>setOpen(true)} placeholder="Buscar personas, campus, certificados, eventos..." aria-label="Buscar"/>{q&&<button className="icon-btn tiny" onClick={()=>setQ('')} aria-label="Limpiar"><X size={14}/></button>}</div>
    {open&&q.trim().length>=2&&<div className="search-results" data-testid="search-results">{results.length===0?<div className="notif-empty"><Search size={20}/><small>Sin resultados para «{q}»</small></div>:results.map(r=>{const I=r.icon;return <button key={r.k} onClick={()=>{r.act();setOpen(false);setQ('')}}><I size={16}/><span><b>{r.title}</b><small>{r.sub}</small></span><ChevronRight size={14}/></button>})}</div>}
  </div>
}

function AuthScreen({onLogged}){
  const [mode,setMode]=useState('login');
  const [form,setForm]=useState({email:'',nombre:'',apellido:'',password:'',campus:''});
  const [show,setShow]=useState(false);const [loading,setLoading]=useState(false);const [showRecent,setShowRecent]=useState(false);const [forgot,setForgot]=useState(false);
  const [campuses,setCampuses]=useState([]);
  useEffect(()=>{if(mode==='signup'&&!campuses.length)axios.get(`${API}/campuses`).then(r=>setCampuses(r.data)).catch(()=>{})},[mode,campuses.length]);
  const recent=(()=>{try{return JSON.parse(localStorage.getItem('tecmi_recent_emails')||'[]')}catch{return[]}})();
  const remember=(email,nombre)=>{try{const cur=recent.filter(x=>x.email!==email);cur.unshift({email,nombre});localStorage.setItem('tecmi_recent_emails',JSON.stringify(cur.slice(0,5)))}catch{}};
  const set=k=>e=>setForm({...form,[k]:e.target.value});
  const submit=async e=>{e.preventDefault();if(mode==='signup'&&!passwordOk(form.password)){toast.error('Tu contraseña aún no cumple los requisitos');return}setLoading(true);try{const r=mode==='login'?await axios.post(`${API}/auth/login`,{email:form.email,password:form.password}):await axios.post(`${API}/auth/signup`,form);remember(r.data.user.email,r.data.user.nombre);onLogged(r.data);toast.success(r.data.created?`¡Te damos la bienvenida, ${r.data.user.nombre}! Vamos a encontrar tu Cometa`:`Hola de nuevo, ${r.data.user.nombre}`)}catch(err){toast.error(errMsg(err,'No pudimos iniciar sesión'))}finally{setLoading(false)}};
  return <div className="auth-shell" data-testid="auth-screen">
    <section className="auth-hero"><Logo size={56} light/><h1>Explora. Conecta.<br/><em>Sé parte.</em></h1><p>La red de estudiantes de Tecmilenio en todos los campus de México.</p><ul className="auth-perks"><li><Sparkles size={16}/> Tecmi Match: encuentra con quién crear</li><li><Flame size={16}/> Cometas: Brela · Halley · Ikeya · Araya</li><li><Trophy size={16}/> Pasaporte Tecmi, misiones y ranking</li></ul><div className="auth-orbit" aria-hidden="true"><span/><span/><span/></div></section>
    <section className="auth-form"><div className="auth-card"><div className="seg" role="tablist"><button role="tab" aria-selected={mode==='login'} data-testid="auth-tab-login" className={mode==='login'?'selected':''} onClick={()=>setMode('login')}>Iniciar sesión</button><button role="tab" aria-selected={mode==='signup'} data-testid="auth-tab-signup" className={mode==='signup'?'selected':''} onClick={()=>setMode('signup')}>Crear cuenta</button></div>
      <h2>{mode==='login'?'Entra a tu red':'Crea tu cuenta'}</h2>
      <form onSubmit={submit} className="stack">
        <label className="field">Correo Tecmilenio<span className="input-icon"><Mail size={16}/><input data-testid="auth-email" required type="email" autoComplete="email" placeholder="AL02345678@tecmilenio.mx" value={form.email} onChange={set('email')}/></span></label>
        {mode==='signup'&&<div className="two-col"><label className="field">Nombre<span className="input-icon"><User size={16}/><input data-testid="auth-nombre" required autoComplete="given-name" value={form.nombre} onChange={set('nombre')}/></span></label><label className="field">Apellido<span className="input-icon"><User size={16}/><input data-testid="auth-apellido" required autoComplete="family-name" value={form.apellido} onChange={set('apellido')}/></span></label></div>}
        {mode==='signup'&&<label className="field">Campus<span className="input-icon"><MapPin size={16}/><select data-testid="auth-campus" value={form.campus} onChange={set('campus')}><option value="">Elige tu campus</option>{campuses.map(c=><option key={c.id} value={c.nombre}>{c.nombre} · {c.estado}</option>)}</select></span></label>}
        <label className="field">Contraseña<span className="input-icon"><Lock size={16}/><input data-testid="auth-password" required type={show?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} value={form.password} onChange={set('password')}/><button type="button" className="icon-btn tiny" onClick={()=>setShow(s=>!s)} aria-label={show?'Ocultar contraseña':'Mostrar contraseña'}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></span></label>
        {mode==='signup'&&<PasswordRules value={form.password}/>}
        <button data-testid="auth-submit" className="primary-btn full big" disabled={loading}>{loading?'Un momento...':(mode==='login'?'Entrar':'Crear mi cuenta')} <ChevronRight size={16}/></button>
      </form>
      {mode==='login'&&<div className="auth-help"><button type="button" data-testid="forgot-password-button" className="text-btn" onClick={()=>setForgot(f=>!f)}>¿Olvidaste tu contraseña?</button>{recent.length>0&&<button type="button" data-testid="forgot-email-button" className="text-btn" onClick={()=>setShowRecent(s=>!s)}>{showRecent?'Ocultar correos recientes':'¿Olvidaste tu correo?'}</button>}</div>}
      {mode==='login'&&forgot&&<p className="helper-box" data-testid="forgot-password-help">Pide a tu docente o coordinación de campus que la restablezca desde el panel de Usuarios. Entrarás con una contraseña temporal y la app te pedirá cambiarla.</p>}
      {mode==='login'&&showRecent&&<div className="recent-list" data-testid="recent-emails">{recent.map(r=><button type="button" key={r.email} data-testid={`recent-${r.email}`} onClick={()=>{setForm(f=>({...f,email:r.email}));setShowRecent(false)}}><Mail size={14}/><span><b>{r.nombre||'Estudiante'}</b><small>{r.email}</small></span><ChevronRight size={14}/></button>)}</div>}
    </div></section>
  </div>
}

function App(){
  const [user,setUser]=useState(()=>{try{return localStorage.getItem('tecmi_token')?JSON.parse(localStorage.getItem('tecmi_user')||'null'):null}catch{return null}});
  const [page,setPage]=useState(()=>pageFromHash()||null);
  const [data,setData]=useState(null);
  const [pulse,setPulse]=useState({});
  const [chatWith,setChatWith]=useState(null);
  const [profile,setProfile]=useState(null);
  const [tourOff,setTourOff]=useState(false);
  const [quizOff,setQuizOff]=useState(false);
  const isAdmin=user?.rol==='administrador';
  const logout=useCallback(()=>{axios.post(`${API}/auth/logout`).catch(()=>{});['tecmi_user','tecmi_token','tecmi_user_id'].forEach(k=>localStorage.removeItem(k));setUser(null);setData(null);setTourOff(false);setQuizOff(false);window.location.hash=''},[]);
  const refresh=useCallback(async()=>{try{const r=await axios.get(`${API}/bootstrap`);setData(r.data);setUser(u=>{const nu={...u,...r.data.student};localStorage.setItem('tecmi_user',JSON.stringify(nu));return nu})}catch(e){if(e.response?.status===401){logout();toast.error('Tu sesión expiró. Inicia sesión de nuevo.')}}},[logout]);
  const refreshPulse=useCallback(()=>axios.get(`${API}/pulse`).then(r=>setPulse(r.data)).catch(e=>{if(e.response?.status===401)logout()}),[logout]);
  const go=useCallback(p=>{setPage(p);window.location.hash=slug(p);window.scrollTo({top:0})},[]);
  const onLogged=({user:u,token})=>{localStorage.setItem('tecmi_token',token);localStorage.setItem('tecmi_user',JSON.stringify(u));setUser(u);go(u.rol==='administrador'?'Vista general':'Inicio')};
  useEffect(()=>{if(!user)return;refresh();refreshPulse();const t=setInterval(refreshPulse,8000);return()=>clearInterval(t)},[user?.id]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{const h=()=>{const p=pageFromHash();if(p)setPage(p)};window.addEventListener('hashchange',h);return()=>window.removeEventListener('hashchange',h)},[]);
  // nuevas invitaciones o mensajes: recarga los datos para que botones y listas estén al día
  const lastPulse=useRef('');useEffect(()=>{const k=`${pulse.pending_invitations}|${pulse.notifications?.unread}`;if(lastPulse.current&&k!==lastPulse.current)refresh();lastPulse.current=k},[pulse,refresh]);
  const openChat=useCallback(p=>{setChatWith(p);go('Mensajes')},[go]);
  // Bienvenida de estudiantes: primero el test de Cometa y después el recorrido por la interfaz, una sola vez por cuenta
  const endTour=useCallback(()=>{setTourOff(true);axios.post(`${API}/me/tour-done`).catch(()=>{})},[]);
  const endQuiz=useCallback(()=>{setQuizOff(true);refresh()},[refresh]);
  if(!user)return <><AuthScreen onLogged={onLogged}/><Toaster position="top-center" richColors/></>;
  if(!data)return <div className="loading" data-testid="loading-state"><LogoMark size={56}/><span>Cargando tu comunidad...</span></div>;
  const nav=isAdmin?ADMIN_NAV:STUDENT_NAV;
  const validPages=nav.flatMap(g=>g.items.map(i=>i[0])).concat('Mi perfil');
  const current=validPages.includes(page)?page:(isAdmin?'Vista general':'Inicio');
  const counts={Invitaciones:pulse.pending_invitations||0,Mensajes:pulse.unread_messages||0,Reportes:0};
  const ctx={data,refresh,refreshPulse,pulse,go,openChat,chatWith,setChatWith,openProfile:setProfile,user:data.student};
  const body=isAdmin?<AdminDashboard page={current} {...ctx}/>:['Match','Cometas','Mapa Tecmi','Certificados','Feed','Historia'].includes(current)?<LinkUpHub page={current} {...ctx}/>:<StudentPages page={current} {...ctx}/>;
  return <div className="app-shell">
    <SideNav nav={nav} page={current} go={go} onLogout={logout} user={data.student} counts={counts}/>
    <div className="main-wrap">
      <header className="topbar"><div className="topbar-logo"><LogoMark size={34}/></div><GlobalSearch data={data} go={go} openProfile={setProfile} isAdmin={isAdmin}/><div className="top-actions"><NotificationsBell notifications={pulse.notifications||data.notifications} refreshPulse={refreshPulse} go={go}/><button className="session-pill" data-testid="session-pill" onClick={()=>go('Mi perfil')}><Avatar src={data.student.avatar} alt={data.student.nombre||data.student.author||""} size={32}/><span data-testid="session-name">{data.student.nombre}</span></button></div></header>
      {data.student.must_change_password&&current!=='Mi perfil'&&<div className="banner warn" data-testid="temp-password-banner"><ShieldAlert size={18}/><span>Estás usando la contraseña temporal. Cámbiala para proteger tu cuenta.</span><button className="text-btn" onClick={()=>go('Mi perfil')}>Cambiar ahora</button></div>}
      <div className="page" key={current}>{body}</div>
    </div>
    <MobileTabs tabs={isAdmin?ADMIN_TABS:STUDENT_TABS} nav={nav} page={current} go={go} counts={counts} onLogout={logout}/>
    {profile&&<PublicProfile student={profile} data={data} onClose={()=>setProfile(null)} openChat={openChat} refresh={refresh}/>}
    {!isAdmin&&current==='Inicio'&&!data.student.tour_done&&!tourOff&&(!data.student.quiz_done&&!quizOff
      ?<CometaQuiz onClose={endQuiz} onDone={()=>{}} doneLabel="Continuar" intro="Antes de empezar, descubre a qué Cometa perteneces: son 6 preguntas rápidas."/>
      :<WelcomeTour onFinish={endTour}/>)}
    <Toaster position="top-center" richColors/>
  </div>
}
export default App;
