const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const {match}=require('../extension/matcher');const {importCsv}=require('../extension/csv');
const data=require('../extension/data/formulary.json');
test('bundled reference has complete named records',()=>{assert.equal(data.records.length,1025);assert.ok(data.records.every(r=>r.name));});
test('strength spacing matches without changing dose',()=>{assert.equal(match('Dexlansoprazole 30mg Delayed Release Capsule',data.records).length,1);assert.equal(match('Dexlansoprazole 31mg Delayed Release Capsule',data.records).length,0);});
test('brand ambiguity stays visible',()=>{assert.equal(match('Dexilant',data.records).length,2)});
test('release formulation is not silently removed',()=>{assert.equal(match('Dexlansoprazole 30mg Capsule',data.records).length,0)});
test('CSV preserves quoted commas and multiline clinical text',()=>{const d=importCsv('Data updated:,16/07/2026,,\r\nGeneric Name,Indication,Dosage,Brandname\r\n"Medicine 10mg Tablet","A, B\nC","One tablet","Brand"');assert.equal(d.records[0].indication,'A, B\nC');assert.equal(d.updated,'16/07/2026')});
test('invalid imports fail before replacing reference',()=>{assert.throws(()=>importCsv('Generic Name,Indication\nx,y'),/Dosage/);assert.throws(()=>importCsv('Generic Name,Indication,Dosage\nx,y'),/Column count/);assert.throws(()=>importCsv('"bad'),/Unclosed/)});
