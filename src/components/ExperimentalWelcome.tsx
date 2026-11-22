import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import MoneyCore from './MoneyCore';
import './experimental.css';

type Props = { reducedMotion: boolean; onEnter: (name:string)=>void };
export default function ExperimentalWelcome({ reducedMotion, onEnter }: Props) {
  const [name,setName] = useState('');
  const [entering,setEntering] = useState(false);
  const submit = (e:React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || entering) return;
    if(reducedMotion) { onEnter(name.trim()); return; }
    setEntering(true);
  };
  return <main className="ex-welcome">
    <header className="ex-welcome-head"><a className="ex-brand" href="#top" aria-label="VYRA home">VYRA<span>.</span></a><span className="ex-volume">EDITION / 02 — EXPERIMENTAL</span><span className="ex-head-tag">NOT YOUR ORDINARY FINANCE APP</span></header>
    <div className="ex-hero">
      <div className="ex-visual-area" aria-label="Interactive three-dimensional VYRA payment card">
        <div className="ex-visual-grid" aria-hidden="true" />
        <motion.div className="ex-visual-object" initial={false} animate={entering?{scale:.67,x:'38vw',y:'-28vh',rotate:15,opacity:0}:{scale:1,x:0,y:0,rotate:0,opacity:1}} transition={{duration:.85,ease:[.2,.8,.2,1]}} onAnimationComplete={()=>{if(entering)onEnter(name.trim());}}>
          <MoneyCore tone="#ff7040" reducedMotion={reducedMotion}/>
        </motion.div>
        <div className="ex-visual-sticker">MOVE<br/>DIFFERENT<span>®</span></div>
        <div className="ex-visual-footer"><span>THE FUTURE IS TANGIBLE</span><span>001 / VIRTUAL CARD</span></div>
      </div>
      <div className="ex-copy">
        <div className="ex-kicker"><Zap size={16}/> FINANCIAL FREEDOM / REWIRED</div>
        <h1>MAKE<br/><em>MONEY</em><br/>MOVE<span className="ex-period">.</span></h1>
        <p>Not another banking dashboard. A living, tactile space for payments, shared expenses and everything you're building toward.</p>
        <form onSubmit={submit} className="ex-form">
          <label htmlFor="ex-name">FIRST, WHAT SHOULD WE CALL YOU?</label>
          <div className="ex-entry"><input id="ex-name" value={name} onChange={e=>setName(e.target.value)} maxLength={40} placeholder="Your first name" required disabled={entering}/><button type="submit" disabled={entering}>{entering?'Entering...':'Enter VYRA'} <ArrowRight size={19}/></button></div>
        </form>
        <div className="ex-disclaimer"><ShieldCheck size={17}/> Interactive prototype. No real bank accounts or payments.</div>
      </div>
    </div>
    <footer className="ex-footer"><span>DESIGNED TO MOVE YOU.</span><span>SCROLL LESS. FEEL MORE.</span><span>VYRA / 2026</span></footer>
    <AnimatePresence>{entering&&<motion.div className="ex-transition-wipe" initial={{scaleY:0}} animate={{scaleY:1}} exit={{opacity:0}} transition={{duration:.68,ease:[.85,0,.15,1],delay:.28}} aria-hidden="true"/>}</AnimatePresence>
  </main>;
}
