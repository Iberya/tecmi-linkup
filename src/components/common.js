import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import axios from "axios";
import {Check,GraduationCap,Heart,MapPin,MessageCircle,Send,Sparkles,UserCheck,Clock3,X,Zap} from "lucide-react";
import {toast} from "sonner";

export const API=`${process.env.REACT_APP_BACKEND_URL}/api`;
export const avatarFallback='https://i.pravatar.cc/160?img=47';
const MONTHS=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
const MONTHS_LONG=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// Fechas "AAAA-MM-DD" sin pasar por Date, para que la zona horaria no mueva el día
export const dateParts=s=>{const [y,m,d]=(s||'').split('-').map(Number);return {day:d||'',month:MONTHS[(m||1)-1],long:d?`${d} de ${MONTHS_LONG[m-1]} de ${y}`:''}};
export const timeAgo=iso=>{if(!iso)return'';const s=(Date.now()-new Date(iso).getTime())/1000;if(s<60)return'ahora';if(s<3600)return`hace ${Math.floor(s/60)} min`;if(s<86400)return`hace ${Math.floor(s/3600)} h`;const d=Math.floor(s/86400);return d<7?`hace ${d} d`:new Date(iso).toLocaleDateString('es-MX',{day:'numeric',month:'short'})};
export const errMsg=(e,fallback='Algo salió mal. Intenta de nuevo.')=>{const d=e?.response?.data?.detail;return typeof d==='string'?d:Array.isArray(d)?'Revisa los datos del formulario':fallback};
export const fullName=p=>`${p?.nombre||''} ${p?.apellido||''}`.trim();

// Reduce la foto antes de guardarla: el perfil viaja a todos los alumnos, así que debe pesar poco
export const resizeImage=(file,max=320)=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const k=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.82))};img.onerror=reject;img.src=r.result};r.onerror=reject;r.readAsDataURL(file)});

// Si la foto no carga, iniciales sobre el verde de la marca en lugar del ícono roto
const initialsAvatar=name=>{const t=(name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0b6a60"/><text x="32" y="41" font-family="system-ui,sans-serif" font-size="24" font-weight="700" fill="#fff" text-anchor="middle">${t}</text></svg>`)}`};
export function Avatar({src,alt='',size=40,className=''}){return <img className={`avatar ${className}`} src={src||avatarFallback} alt={alt} width={size} height={size} style={{width:size,height:size}} loading="lazy" onError={e=>{const f=initialsAvatar(alt);if(e.currentTarget.src!==f)e.currentTarget.src=f}}/>}
export function Badge({children,color='green'}){return <span data-testid="status-badge" className={`badge ${color}`}>{children}</span>}
export function PageTitle({eyebrow,title,text,action}){return <div className="page-heading"><div className="page-heading-copy"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{text&&<p>{text}</p>}</div>{action&&<div className="page-heading-action">{action}</div>}</div>}
export function EmptyState({icon:Icon=Sparkles,title,text,action,testId}){return <div className="empty-state" data-testid={testId}><Icon size={22}/><b>{title}</b>{text&&<small>{text}</small>}{action}</div>}

// Las ventanas flotantes se montan en <body>: dentro de una página animada, position:fixed se calcula contra la página y el popup aparecía hasta abajo
export const Portal=({children})=>createPortal(children,document.body);

// Un color por tipo de certificado; las categorías nuevas que cree un docente toman uno estable de la lista
export const CERT_THEMES={
  'Negocios':{from:'#d9a031',to:'#7a4a06',ink:'#7a4a06',soft:'#fdf2dc'},
  'Tecnología e ingeniería':{from:'#2b8fd0',to:'#0d3f66',ink:'#145a8c',soft:'#e2f1fb'},
  'Industrias creativas':{from:'#e0558f',to:'#7a2459',ink:'#a3285b',soft:'#fde9f1'},
  'Bienestar y salud':{from:'#35b07f',to:'#0f5b49',ink:'#17694f',soft:'#e2f6ec'},
};
const EXTRA_THEMES=[{from:'#7a6be0',to:'#2e2670',ink:'#4f42b0',soft:'#efecff'},{from:'#e0763a',to:'#7a2e0e',ink:'#9a4316',soft:'#fdeee4'},{from:'#14a3a3',to:'#0b4f55',ink:'#0d6b6b',soft:'#e0f5f5'}];
export const certTheme=cat=>CERT_THEMES[cat]||EXTRA_THEMES[[...(cat||'General')].reduce((a,ch)=>a+ch.charCodeAt(0),0)%EXTRA_THEMES.length];

export function Modal({title,eyebrow,onClose,children,wide,testId}){
  useEffect(()=>{const h=e=>e.key==='Escape'&&onClose();document.addEventListener('keydown',h);document.body.classList.add('no-scroll');return()=>{document.removeEventListener('keydown',h);document.body.classList.remove('no-scroll')}},[onClose]);
  return <Portal><div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className={`modal ${wide?'modal-wide':''}`} role="dialog" aria-modal="true" aria-label={title} data-testid={testId}><button className="modal-close" data-testid="modal-close" onClick={onClose} aria-label="Cerrar"><X size={18}/></button>{eyebrow&&<span className="eyebrow">{eyebrow}</span>}{title&&<h2>{title}</h2>}{children}</div></div></Portal>
}

// Botón de conexión según el estado real de la invitación
export function ConnectButton({person,refresh,compact}){
  const [busy,setBusy]=useState(false);
  const st=person.connection_status||'none';
  const run=async fn=>{setBusy(true);try{await fn()}catch(e){toast.error(errMsg(e))}finally{setBusy(false)}};
  if(st==='connected')return null;
  if(st==='sent')return <button data-testid={`cancel-invite-${person.id}`} className="ghost-btn" disabled={busy} onClick={()=>run(async()=>{await axios.delete(`${API}/connections/${person.connection_id}`);toast('Invitación cancelada');refresh()})} title="Cancelar invitación"><Clock3 size={15}/>{compact?'':' Enviada'}</button>;
  if(st==='received')return <button data-testid={`accept-invite-${person.id}`} className="primary-btn" disabled={busy} onClick={()=>run(async()=>{await axios.post(`${API}/connections/${person.connection_id}/accept`);toast.success(`Ahora estás conectado con ${person.nombre}`);refresh()})}><UserCheck size={15}/> Aceptar</button>;
  return <button data-testid={`connect-${person.id}`} className="primary-btn" disabled={busy} onClick={()=>run(async()=>{await axios.post(`${API}/connections/${person.id}`);toast.success(`Invitación enviada a ${person.nombre}`);refresh()})}><Heart size={15}/> Conectar</button>
}

export function MessageButton({person,openChat,label=true}){
  if(person.connection_status!=='connected')return null;
  return <button data-testid={`message-${person.id}`} className="outline-btn" onClick={()=>openChat(person)} aria-label={`Mensaje a ${person.nombre}`}><MessageCircle size={15}/>{label&&' Mensaje'}</button>
}

export function PublicProfile({student,data,onClose,openChat,refresh}){
  if(!student)return null;
  const live=(data?.students||[]).find(s=>s.id===student.id)||student;
  const cometa=(data?.cometas||[]).find(c=>c.id===live.cometa);
  return <Modal onClose={onClose} title="" testId={`public-profile-${live.id}`}>
    <div className="pp">
      <div className="pp-cover" style={{background:cometa?.gradient||'linear-gradient(135deg,#00534c,#003b35)'}}/>
      <Avatar className="pp-avatar" src={live.avatar} alt={live.nombre} size={96}/>
      <h2>{fullName(live)}</h2>
      <p className="meta-line"><MapPin size={13}/> {live.campus||'Campus por definir'} · {live.semestre||'Semestre por definir'}{cometa&&<> · <span style={{color:cometa.color}}>☄ {cometa.nombre}</span></>}</p>
      {live.carrera&&<p className="meta-line"><GraduationCap size={13}/> {live.carrera}</p>}
      {typeof live.match_score==='number'&&<span className="match-pill"><Zap size={12}/>{live.match_score}% match contigo</span>}
      {live.descripcion&&<blockquote className="pp-bio">{live.descripcion}</blockquote>}
      <div className="two-col">
        <div className="tag-box"><small>Puede aportar</small><div className="chips">{(live.skills||[]).map(x=><span key={x} className="chip lime">{x}</span>)}</div></div>
        <div className="tag-box"><small>Está buscando</small><div className="chips">{(live.needs||[]).map(x=><span key={x} className="chip purple">{x}</span>)}</div></div>
      </div>
      {(live.intereses||[]).length>0&&<div className="tag-box"><small>Intereses</small><div className="chips">{live.intereses.map(x=><span key={x} className="chip">{x}</span>)}</div></div>}
      {(live.certificados_cursados||[]).length>0&&<div className="tag-box"><small>Certificaciones</small><div className="chips">{live.certificados_cursados.map(x=><span key={x} className="chip"><GraduationCap size={11}/> {x}</span>)}</div></div>}
      {refresh&&<div className="row-actions">{live.connection_status==='connected'&&<span className="status-note"><UserCheck size={14}/> Ya están conectados</span>}<ConnectButton person={live} refresh={refresh}/>{openChat&&<MessageButton person={live} openChat={p=>{openChat(p);onClose()}}/>}</div>}
    </div>
  </Modal>
}

// Hilo de chat reutilizable: mensajes directos, comunidades, cometas y sala de docentes
export function ChatThread({load,send,meId,placeholder='Escribe un mensaje...',testId='chat',empty='Sé la primera persona en escribir',poll=5000}){
  const [messages,setMessages]=useState([]);
  const [text,setText]=useState('');
  const [sending,setSending]=useState(false);
  const endRef=useRef(null);
  const loadRef=useRef(load);loadRef.current=load;
  useEffect(()=>{let alive=true;const tick=()=>loadRef.current().then(m=>alive&&setMessages(m)).catch(()=>{});tick();const t=setInterval(tick,poll);return()=>{alive=false;clearInterval(t)}},[poll]);
  useEffect(()=>{endRef.current?.scrollIntoView({block:'end'})},[messages.length]);
  const submit=async e=>{e.preventDefault();const t=text.trim();if(!t||sending)return;setSending(true);try{await send(t);setText('');setMessages(await loadRef.current())}catch(err){toast.error(errMsg(err,'No se pudo enviar el mensaje'))}finally{setSending(false)}};
  return <div className="chat-thread" data-testid={testId}>
    <div className="chat-scroll">{messages.length===0?<div className="chat-empty"><Sparkles size={18}/><small>{empty}</small></div>:messages.map((m,i)=>{const mine=m.author_id&&m.author_id===meId;const grouped=i>0&&messages[i-1].author_id===m.author_id&&m.author_id;return <div key={m.id} className={`bubble-row ${mine?'mine':''} ${grouped?'grouped':''}`}>{!mine&&!grouped&&<Avatar src={m.avatar} alt={m.author} size={30}/>}<div className="bubble">{!mine&&!grouped&&<b>{m.author}</b>}<span>{m.contenido}</span><time>{timeAgo(m.created_at)}</time></div></div>})}<div ref={endRef}/></div>
    <form className="chat-composer" onSubmit={submit}><input data-testid={`${testId}-input`} value={text} onChange={e=>setText(e.target.value)} placeholder={placeholder} maxLength={2000} aria-label="Mensaje"/><button data-testid={`${testId}-send`} className="send-btn" disabled={!text.trim()||sending} aria-label="Enviar"><Send size={18}/></button></form>
  </div>
}

const PASSWORD_RULES=[[p=>p.length>=8,'8 caracteres o más'],[p=>/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p),'Una letra'],[p=>/\d/.test(p),'Un número']];
export function PasswordRules({value}){return <ul className="pw-rules" aria-live="polite">{PASSWORD_RULES.map(([ok,label])=><li key={label} className={ok(value)?'ok':''}>{ok(value)?<Check size={13}/>:<span className="pw-dot"/>}{label}</li>)}</ul>}
export const passwordOk=p=>PASSWORD_RULES.every(([ok])=>ok(p));

