// Logo de Tecmi Link-Up: dos eslabones que suben en diagonal (tú + tu comunidad, conectar y crecer)
// y la estrella ✦ de la marca original, que también evoca a los Cometas.
import {useId} from "react";

export function LogoMark({size=40,title="Tecmi Link-Up"}){
  // ids únicos: si el logo de la barra lateral está oculto (display:none), un id compartido deja sin degradado a los demás
  const id=useId().replace(/[^a-zA-Z0-9]/g,"");
  return <svg className="logo-mark" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title}>
    <defs>
      <linearGradient id={`bg${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0b6a60"/><stop offset="1" stopColor="#003b35"/></linearGradient>
      <clipPath id={`fr${id}`}><rect x="31" y="31" width="9" height="9" transform="rotate(45 35.5 35.5)"/></clipPath>
    </defs>
    <rect width="64" height="64" rx="16" fill={`url(#bg${id})`}/>
    <rect width="63" height="63" x=".5" y=".5" rx="15.5" fill="none" stroke="#ffffff" strokeOpacity=".14"/>
    <g fill="none" strokeWidth="5">
      <rect x="11" y="32" width="28" height="13" rx="6.5" transform="rotate(-45 25 38.5)" stroke="#ffffff"/>
      <rect x="25" y="18" width="28" height="13" rx="6.5" transform="rotate(-45 39 24.5)" stroke="#78d64b"/>
      <rect x="11" y="32" width="28" height="13" rx="6.5" transform="rotate(-45 25 38.5)" stroke="#ffffff" clipPath={`url(#fr${id})`}/>
    </g>
    <path d="M52 5.5 L53.8 10.2 L58.5 12 L53.8 13.8 L52 18.5 L50.2 13.8 L45.5 12 L50.2 10.2 Z" fill="#ffffff"/>
  </svg>
}

export default function Logo({size=40,light=false}){
  return <div className={`logo ${light?'logo-light':''}`}><LogoMark size={size}/><span className="logo-word"><small>Tecmi</small><b>Link-Up</b></span></div>
}
