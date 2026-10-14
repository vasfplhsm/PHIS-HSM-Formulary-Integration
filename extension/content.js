(async()=>{
 const {sites=[]}=await chrome.storage.local.get('sites');
 if(!sites.includes(location.origin))return;
 if(window.__hsmFormulary)return;window.__hsmFormulary=true;
 const data=await chrome.runtime.sendMessage({type:'formulary'});if(!data)return;
 const host=document.createElement('div');host.id='hsm-formulary-root';host.style.cssText='position:fixed;z-index:2147483647;pointer-events:none;';
 const shadow=host.attachShadow({mode:'open'});
 shadow.innerHTML=`<style>:host{position:fixed;z-index:2147483647;pointer-events:none}section{pointer-events:auto;font:14px/1.5 system-ui;color:#172c3e;background:white;border:1px solid #bbc9d4;border-radius:10px;box-shadow:0 8px 32px #0003;padding:16px;max-height:65vh;overflow:auto;width:360px}h3{margin:0 28px 8px 0}h4{margin:12px 0 3px;color:#096d70}p{margin:0;white-space:pre-wrap}small{color:#526574}button{float:right;cursor:pointer}section[hidden]{display:none}</style><section hidden role="dialog" aria-label="Hospital formulary reference"><button aria-label="Close">×</button><div></div></section>`;
 document.documentElement.append(host);
 const panel=shadow.querySelector('section'),body=shadow.querySelector('div');let timer;
 const close=()=>{panel.hidden=true};shadow.querySelector('button').onclick=close;
 function field(title,value){if(!value)return;const h=document.createElement('h4'),p=document.createElement('p');h.textContent=title;p.textContent=value;body.append(h,p);}
 function show(el){
  const text=el.innerText||el.textContent||'';
  if(text.length>350)return;
  const records=PhisMatcher.match(text.trim(),data.records);if(!records.length)return;
  clearTimeout(timer);body.replaceChildren();
  const title=document.createElement('h3');title.textContent=records.length>1?'Multiple formulary matches':records[0].name;body.append(title);
  field('Status','Listed in HSM formulary • Stock availability not checked');
  for(const r of records){if(records.length>1)field('Medication',r.name);field('Brand',r.brand);field('Indication',r.indication||'Not provided in formulary');field('Dosage reference',r.dosage||'Not provided in formulary');field('Prescribing restriction',r.restriction);field('Prescriber category',r.prescriber);field('Department / remarks',r.remarks);field('Quota / UKK',[r.quota,r.ukk].filter(Boolean).join(' • '));}
  field('Source',`HSM formulary • Updated ${data.updated}\nReference guidance; confirm suitability for this patient. Interactions are not checked.`);
  panel.hidden=false;const box=el.getBoundingClientRect();host.style.left=Math.max(8,Math.min(box.left,window.innerWidth-410))+'px';host.style.top=Math.max(8,box.bottom+8)+'px';panel.style.maxHeight=Math.max(120,window.innerHeight-box.bottom-40)+'px';
 }
 function target(e){return e.target.closest('td,.z-listcell,.z-label,[data-medication]');}
 document.addEventListener('mouseover',e=>{const el=target(e);if(el)show(el)});
 document.addEventListener('focusin',e=>{const el=target(e);if(el)show(el)});
 document.addEventListener('mouseout',()=>{timer=setTimeout(close,450)});
 host.addEventListener('mouseenter',()=>clearTimeout(timer));host.addEventListener('mouseleave',()=>{timer=setTimeout(close,450)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
})();
