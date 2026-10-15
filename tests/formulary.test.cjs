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
 for(const label of ['Bisoprolol Fumarate 25 mg Tablet','Bisoprolol Fumarate 2/5 mg Tablet','Trimetazidine 35 mg EXTENDED RELEASE Tablet','Trimetazidine 35 mg Tablet','Empagliflozin 25 mg Tablet and Metformin 500 mg','Perindopril 4 mg Tablet 8 mg'])assert.equal(lookup(label).kind,'none',label);
});
test('a candidate alias cannot point to a nonexistent imported reference',()=>{
 assert.equal(createMatcher([])('Glyceryl Trinitrate 0.5 mg Tablet').kind,'none');
});
