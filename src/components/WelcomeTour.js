import {useCallback,useEffect,useLayoutEffect,useRef,useState} from "react";
import {ChevronLeft,ChevronRight,X} from "lucide-react";
import {Portal} from "@/components/common";
import {LogoMark} from "@/components/Logo";

// Recorrido de bienvenida: oscurece la pantalla y deja visible solo el botón que se explica.
// Cada paso lista selectores en orden de preferencia; se usa el primero visible (barra lateral en escritorio, barra inferior en móvil).
const STEPS=[
  {title:'¡Bienvenida a Tecmi Link-Up!',text:'Te mostramos en un minuto dónde está todo. Puedes saltar el recorrido cuando quieras.'},
  {sel:['nav-inicio','tab-inicio'],title:'Inicio',text:'Tu tablero: tu nivel y XP, tus misiones activas y personas sugeridas para ti cada día.'},
  {sel:['nav-match','tab-match'],title:'Match',text:'Encuentra estudiantes de cualquier campus que te complementan. Filtra por quién puede ayudarte o a quién puedes ayudar y envía invitaciones.'},
  {sel:['nav-invitaciones','tab-invitaciones'],title:'Invitaciones',text:'Aquí llegan las invitaciones para conectar. Acéptalas o recházalas y revisa las que tú enviaste.'},
  {sel:['nav-mensajes','tab-mensajes'],title:'Mensajes',text:'Conversa uno a uno con las personas de tu red. El chat se abre cuando ambos están conectados.'},
  {sel:['nav-cometas'],title:'Cometas',text:'Tu sociedad Tecmi según tus fortalezas: ranking, retos exclusivos y el chat de tu Cometa.'},
  {sel:['nav-comunidades'],title:'Comunidades',text:'Únete a grupos por intereses o crea el tuyo y platica con sus miembros.'},
  {sel:['nav-feed'],title:'Feed',text:'Comparte logros, oportunidades y noticias. Comenta, reacciona y reporta lo que no esté bien.'},
  {sel:['nav-eventos'],title:'Eventos',text:'Agenda nacional y local de tu campus. Inscríbete con un clic.'},
  {sel:['nav-group-explora'],title:'Explora',text:'El mapa de campus con fotos, certificaciones, misiones e historia. Despliega este grupo cuando lo necesites.'},
  {sel:['tab-mas'],title:'Más',text:'Cometas, Comunidades, Feed, Eventos, el mapa de campus, certificaciones y tu perfil están aquí.'},
  {sel:['global-search-box'],title:'Buscador',text:'Busca personas, campus, certificados, eventos y comunidades desde cualquier página.'},
  {sel:['notifications-button'],title:'Notificaciones',text:'Te avisamos de invitaciones, mensajes y comentarios nuevos.'},
  {sel:['nav-mi-perfil','session-pill'],title:'Tu perfil',text:'Agrega tu foto, intereses, lo que puedes aportar y lo que buscas. Un perfil completo recibe mejores matches.'},
  {title:'¡Todo listo!',text:'Ya conoces Tecmi Link-Up. Un buen primer paso: completa tu perfil y busca tu primer match.',last:true},
];
const PAD=8,GAP=14;

const visible=id=>{const el=document.querySelector(`[data-testid="${id}"]`);if(!el)return null;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'?el:null};

export default function WelcomeTour({onFinish}){
  // los botones existen hasta después del primer render, por eso los pasos se filtran aquí y no al iniciar el estado
  const [steps,setSteps]=useState(null);
  useLayoutEffect(()=>{setSteps(STEPS.filter(s=>!s.sel||s.sel.some(visible)))},[]);
  const [i,setI]=useState(0);
  const [rect,setRect]=useState(null);
  const [card,setCard]=useState({top:0,left:0});
  const cardRef=useRef(null);const nextRef=useRef(null);
  const step=steps?.[i]||STEPS[0];
  const target=useCallback(()=>step.sel&&step.sel.map(visible).find(Boolean),[step]);

  const place=useCallback(()=>{
    const el=target();const vw=window.innerWidth,vh=window.innerHeight;
    const cw=cardRef.current?.offsetWidth||340,ch=cardRef.current?.offsetHeight||200;
    if(!el){setRect(null);setCard({top:Math.max(16,(vh-ch)/2),left:Math.max(16,(vw-cw)/2)});return}
    const r=el.getBoundingClientRect();const box={top:r.top-PAD,left:r.left-PAD,width:r.width+PAD*2,height:r.height+PAD*2};setRect(box);
    // a la derecha si hay espacio (barra lateral), si no abajo o arriba (barra superior / inferior)
    let top,left;
    if(box.left+box.width+GAP+cw<=vw-16&&box.width<vw/2){left=box.left+box.width+GAP;top=box.top+box.height/2-ch/2}
    else if(box.top+box.height+GAP+ch<=vh-16){top=box.top+box.height+GAP;left=box.left+box.width/2-cw/2}
    else{top=box.top-GAP-ch;left=box.left+box.width/2-cw/2}
    setCard({top:Math.min(Math.max(16,top),vh-ch-16),left:Math.min(Math.max(16,left),vw-cw-16)});
  },[target]);

  useLayoutEffect(()=>{const el=target();if(el)el.scrollIntoView({block:'nearest',inline:'nearest'});place();const t=setTimeout(place,250);return()=>clearTimeout(t)},[i,place,target]);
  useEffect(()=>{window.addEventListener('resize',place);window.addEventListener('scroll',place,true);return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true)}},[place]);
  useEffect(()=>{nextRef.current?.focus({preventScroll:true})},[i]);

  const finish=useCallback(()=>onFinish(),[onFinish]);
  const next=useCallback(()=>step.last?finish():setI(n=>n+1),[step,finish]);
  const back=useCallback(()=>setI(n=>Math.max(0,n-1)),[]);
  useEffect(()=>{const h=e=>{if(e.key==='Escape')finish();else if(e.key==='ArrowRight')next();else if(e.key==='ArrowLeft')back()};document.addEventListener('keydown',h);return()=>document.removeEventListener('keydown',h)},[finish,next,back]);

  if(!steps)return null;
  return <Portal><div className="tour" data-testid="welcome-tour">
    <div className="tour-blocker" onMouseDown={e=>e.preventDefault()}/>
    <div className={`tour-spot ${rect?'':'none'}`} style={rect||undefined}/>
    <div ref={cardRef} className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text" style={card}>
      <div className="tour-head">{!step.sel&&<LogoMark size={36}/>}<span className="eyebrow">Paso {i+1} de {steps.length}</span>{!step.last&&<button className="icon-btn tiny" data-testid="tour-skip-x" onClick={()=>finish()} aria-label="Saltar recorrido"><X size={15}/></button>}</div>
      <h2 id="tour-title">{step.title}</h2>
      <p id="tour-text">{step.text}</p>
      <div className="tour-dots" aria-hidden="true">{steps.map((_,k)=><i key={k} className={k===i?'on':k<i?'done':''}/>)}</div>
      <div className="tour-actions">
        {!step.last?<button className="text-btn" data-testid="tour-skip" onClick={()=>finish()}>Saltar explicación</button>:<span/>}
        <div className="row-actions">{i>0&&<button className="ghost-btn" data-testid="tour-back" onClick={back} aria-label="Paso anterior"><ChevronLeft size={16}/></button>}
          <button ref={nextRef} className="primary-btn" data-testid="tour-next" onClick={next}>{step.last?'Empezar a usar la app':i===0?'Empezar recorrido':'Siguiente'}{!step.last&&<ChevronRight size={16}/>}</button></div>
      </div>
    </div>
  </div></Portal>
}
