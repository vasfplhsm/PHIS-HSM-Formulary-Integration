(function(root){
 const normalize=s=>s.toLowerCase().replace(/(\d)\s*(mg|mcg|g|ml|%)/g,'$1 $2').replace(/[^a-z0-9%]+/g,' ').trim().replace(/\s+/g,' ');
 function match(text,records){
  const needle=normalize(text); if(!needle)return [];
  const exact=records.filter(r=>normalize(r.name)===needle);if(exact.length)return exact;
  // Only full generic labels or full brand labels; never fuzzy-select a strength.
  return records.filter(r=>{const n=normalize(r.name);return needle===n||needle.startsWith(n+' ')||(r.brand&&normalize(r.brand)===needle);});
 }
 const api={normalize,match}; root.PhisMatcher=api;
 if(typeof module!=='undefined')module.exports=api;
})(globalThis);
