const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const {match}=require('../extension/matcher');const {importCsv}=require('../extension/csv');
const data=require('../extension/data/formulary.json');
test('bundled reference has complete named records',()=>{assert.equal(data.records.length,1025);assert.ok(data.records.every(r=>r.name));});
test('strength spacing matches without changing dose',()=>{assert.equal(match('Dexlansoprazole 30mg Delayed Release Capsule',data.records).length,1);assert.equal(match('Dexlansoprazole 31mg Delayed Release Capsule',data.records).length,0);});
test('brand ambiguity stays visible',()=>{assert.equal(match('Dexilant',data.records).length,2)});
test('release formulation is not silently removed',()=>{assert.equal(match('Dexlansoprazole 30mg Capsule',data.records).length,0)});
test('CSV preserves quoted commas and multiline clinical text',()=>{const d=importCsv('Data updated:,16/07/2026,,\r\nGeneric Name,Indication,Dosage,Brandname\r\n"Medicine 10mg Tablet","A, B\nC","One tablet","Brand"');assert.equal(d.records[0].indication,'A, B\nC');assert.equal(d.updated,'16/07/2026')});
test('invalid imports fail before replacing reference',()=>{assert.throws(()=>importCsv('Generic Name,Indication\nx,y'),/Dosage/);assert.throws(()=>importCsv('Generic Name,Indication,Dosage\nx,y'),/Column count/);assert.throws(()=>importCsv('"bad'),/Unclosed/)});
const {createMatcher}=require('../extension/matcher');
test('screenshot medication labels resolve to the correct formulary records',()=>{
 const lookup=createMatcher(data.records);
 for(const label of ['Bisoprolol Fumarate 2.5 mg Tablet','Perindopril 4 mg Tablet','Empagliflozin 25 mg Tablet','Isosorbide-5-Mononitrate 60 mg SR Tablet','Trimetazidine 35 mg MODIFIED RELEASE Tablet','Acetylsalicylic Acid 100 mg, Glycine 45 mg Tablet']){
  const result=lookup(label);assert.equal(result.kind,'generic',label);assert.equal(result.records.length,1,label);
 }
 assert.equal(lookup('Trimetazidine 35 mg MODIFIED RELEASE Tablet').records[0].name,'Trimetazidine 35mg MR Tablet');
});
test('omitted sublingual route is an explicit candidate, not a confirmed match',()=>{
 const result=createMatcher(data.records)('Glyceryl Trinitrate 0.5 mg Tablet');
 assert.equal(result.kind,'candidate');assert.match(result.reason,/Confirm the route/);
 assert.equal(result.records[0].name,'Glyceryl Trinitrate 0.5mg Sublingual Tablet');
 assert.deepEqual(match('Glyceryl Trinitrate 0.5 mg Tablet',data.records),[]);
 assert.equal(createMatcher(data.records)('Glyceryl Trinitrate 5 mg Tablet').kind,'none');
});
test('release types, strengths and combination products remain distinct',()=>{
 const lookup=createMatcher(data.records);
 for(const label of ['Bisoprolol Fumarate 25 mg Tablet','Bisoprolol Fumarate 2/5 mg Tablet','Trimetazidine 35 mg EXTENDED RELEASE Tablet','Empagliflozin 25 mg Tablet and Metformin 500 mg','Perindopril 4 mg Tablet 8 mg'])assert.equal(lookup(label).kind,'none',label);
});
test('a candidate alias cannot point to a nonexistent imported reference',()=>{
 assert.equal(createMatcher([])('Glyceryl Trinitrate 0.5 mg Tablet').kind,'none');
});
test('misspellings and transpositions produce suggestions, never confirmed matches',()=>{
 const lookup=createMatcher(data.records);
 const result=lookup('Metformni 500mg tablet');
 assert.equal(result.kind,'possible');assert.equal(result.records.length,2);
 assert.ok(result.records.every(r=>r.name.startsWith('Metformin HCl 500 mg')));
 assert.deepEqual(match('Metformni 500mg tablet',data.records),[]);
});
test('shortened names and omitted salt words can be suggested',()=>{
 const lookup=createMatcher(data.records);
 assert.equal(lookup('metform').kind,'possible');
 assert.equal(lookup('Bisoprolol 2.5 mg Tab').records[0].name,'Bisoprolol Fumarate 2.5 mg Tablet');
 assert.equal(lookup('Atorva 20 mg Tablet').records[0].name,'Atorvastatin 20 mg, 40 mg Tablet');
});
test('missing strength, form and release details are stated explicitly',()=>{
 const result=createMatcher(data.records)('metform');
 assert.ok(result.suggestions.every(item=>item.warnings.some(text=>/Strength/.test(text))));
 assert.ok(result.suggestions.every(item=>item.warnings.some(text=>/Dosage form/.test(text))));
 const er=result.suggestions.find(item=>/Extended Release/.test(item.record.name));
 assert.ok(er.warnings.some(text=>/Release type/.test(text)));
 const mr=createMatcher(data.records)('Trimetazidine 35 mg Tablet');
 assert.equal(mr.kind,'possible');assert.match(mr.suggestions[0].warnings.join(' '),/Release type/);
});
test('conflicting strengths, concentrations, release types, routes and salts are excluded',()=>{
 const records=[
  {name:'Examplemed Hydrochloride 0.5 mg Sublingual Tablet',brand:''},
  {name:'Examplemed 125 mg/5 ml Oral Suspension',brand:''},
  {name:'Examplemed 20 mg MR Capsule',brand:''}
 ];
 const lookup=createMatcher(records);
 for(const label of ['Examplemd 5 mg Tablet','Examplemd 125 mg Tablet','Examplemd 125 mg/ml Suspension','Examplemd 20 mg ER Capsule','Examplemd 0.5 mg Oral Tablet','Examplemd Fumarate 0.5 mg Sublingual Tablet','Examplemd 20 mg MR Tablet']){
  assert.equal(lookup(label).kind,'none',label);
 }
 assert.equal(lookup('Examplemd 125 mg/5 ml Oral Suspension').kind,'possible');
});
test('one active ingredient cannot suggest a combination product or vice versa',()=>{
 const records=[{name:'Examplemed 10 mg Tablet',brand:''},{name:'Examplemed 10 mg and Othermed 5 mg Tablet',brand:''}];
 assert.deepEqual(createMatcher(records)('Examplemd').records.map(r=>r.name),['Examplemed 10 mg Tablet']);
 assert.deepEqual(createMatcher([records[0]])('Examplemed Othermed').records,[]);
 assert.deepEqual(createMatcher([records[1]])('Examplemd 10 mg Tablet').records,[]);
 const electrolytes=[{name:'Glucose 50 mg Tablet',brand:''},{name:'Glucose 50 mg and Sodium Chloride 9 mg Tablet',brand:''}];
 assert.deepEqual(createMatcher(electrolytes)('Glucse').records.map(r=>r.name),['Glucose 50 mg Tablet']);
 assert.deepEqual(createMatcher([electrolytes[0]])('Glucose Sodium Chloride').records,[]);
});
test('strength numbers in a brand label are never corrected as spelling',()=>{
 const records=[{name:'Examplemed 4 mg Tablet',brand:'Brandname 4'}];
 assert.equal(createMatcher(records)('Brandnme 4').kind,'possible');
 assert.equal(createMatcher(records)('Brandnme 8').kind,'none');
});
test('brand names in separate CSV lines work independently',()=>{
 const records=[{name:'Examplemed 10 mg Tablet',brand:'Firstbrand\nSecondbrand'}];
 assert.equal(createMatcher(records)('Secondbrand').kind,'brand');
 assert.equal(createMatcher(records)('Secondbrnd 10 mg Tablet').kind,'possible');
});
test('suggestions are bounded, deduplicated, and report additional records',()=>{
 const records=Array.from({length:9},(_,i)=>({name:`Examplemed ${i+1} mg Tablet`,brand:'Examplemed'}));
 const result=createMatcher(records)('Examplemd');
 assert.equal(result.kind,'possible');assert.equal(result.records.length,5);assert.equal(result.total,9);
 assert.equal(new Set(result.records).size,5);
});
test('very short, unrelated and extra ingredient words do not create suggestions',()=>{
 const lookup=createMatcher(data.records);
 for(const label of ['met','tablet','500mg','Normal Collection','Empagliflozin 25 mg Tablet and Metformin 500mg','Unknown medicine 999 mg Tablet'])assert.equal(lookup(label).kind,'none',label);
});
test('exact labels and brands take precedence over all suggestions',()=>{
 const lookup=createMatcher(data.records);
 assert.equal(lookup('Metformin HCl 500 mg Tablet').kind,'generic');
 assert.equal(lookup('Diabetmin').kind,'brand');
 assert.equal(lookup('Dexilant').kind,'brand');
});
