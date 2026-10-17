async function refresh() {
 const {sites=[]}=await chrome.storage.local.get('sites');
 await chrome.scripting.unregisterContentScripts();
 if(sites.length) await chrome.scripting.registerContentScripts([{id:'phis',matches:[...new Set(sites.map(s=>{const u=new URL(s);return u.protocol+'//'+u.hostname+'/*'}))],js:['matcher.js','checks.js','prescription.js','content.js'],css:['content.css'],runAt:'document_idle',allFrames:true}]);
}
chrome.runtime.onInstalled.addListener(refresh);
chrome.runtime.onStartup.addListener(refresh);
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.sites)refresh();});
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(msg.type==='formulary'){chrome.storage.local.get('formulary').then(async v=>reply(v.formulary||await (await fetch(chrome.runtime.getURL('data/formulary.json'))).json()));return true;}
 if(msg.type==='checksConfig'){chrome.storage.local.get(['ruleset','broadGroups']).then(v=>reply(v));return true;}
});
