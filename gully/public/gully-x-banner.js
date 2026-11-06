/*! Gully Labs X banner v1 */
(function(d,w){var s=d.currentScript,o=s.dataset,r=d.documentElement,k='gully-x-banner-off',e,c,t,f;
if(w.top!==w||(o.skip&&new RegExp(o.skip).test(location.pathname))||(o.yield&&d.querySelector(o.yield)))return;
try{if(w.localStorage.getItem(k))return}catch(x){}
c=('~{position:relative;display:flex;box-sizing:content-box;height:44px;padding-top:env(safe-area-inset-top,0);background:'+o.bg+';color:'+o.fg+';border-bottom:1px solid '+o.line+';font-size:14px;font-weight:500;line-height:20px}~ a{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 44px;color:inherit;text-decoration:none;white-space:nowrap}~ a:hover span{text-decoration:underline}~ svg{flex:none;width:16px;height:16px;fill:currentColor}~ button{position:absolute;right:0;bottom:0;width:44px;height:44px;padding:0;border:0;background:none;color:inherit;font:400 22px/44px sans-serif;cursor:pointer}~ :focus-visible{outline:2px solid currentColor;outline-offset:-3px}@media print{~{display:none}}').replace(/~/g,'#gxb');
try{t=new CSSStyleSheet;t.replaceSync(c);d.adoptedStyleSheets=[...d.adoptedStyleSheets,t]}catch(x){t=d.createElement('style');t.textContent=c;d.head.appendChild(t)}
e=d.createElement('aside');e.id='gxb';e.setAttribute('aria-label','Gully Labs on X');
e.innerHTML='<a href="https://x.com/Gully_Labs" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg><span>Follow Gully Labs on X</span></a><button type="button" aria-label="Dismiss banner">&times;</button>';
s.parentNode.insertBefore(e,s);
f=function(){r.style.setProperty('--gxb-h',Math.max(0,e.offsetHeight-w.scrollY)+'px')};
f();w.addEventListener('scroll',f,{passive:true});
e.lastChild.onclick=function(){try{w.localStorage.setItem(k,'1')}catch(x){}e.remove();f()}})(document,window);
