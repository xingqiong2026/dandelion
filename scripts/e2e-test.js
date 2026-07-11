// e2e-test.js
// Dandelion end-to-end tests

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const ROOT = path.join(__dirname, "..");
let p=0,f=0;
function ch(n,o,d){if(o){p++;console.log("  PASS  "+n+(d?" | "+d:""))}else{f++;console.log("  FAIL  "+n+(d?" | "+d:""))}}
function run(nm,sp){console.log("\n--- "+nm+" ---\n");try{execSync("node \""+sp+"\"",{cwd:ROOT,timeout:15000,encoding:"utf-8",stdio:["pipe","pipe","pipe"]});ch(nm+" ran",true,"")}catch(e){ch(nm+" ran",false,e.message.split("\n")[0])}}
console.log("\n======================================");
console.log(" Dandelion E2E Tests");
console.log("======================================");
run("[v1] Core", path.join(ROOT,"src","core","index.js"));
run("[v2] Stealth", path.join(ROOT,"src","stealth","orchestrator.js"));
run("[v3] Penetrate", path.join(ROOT,"src","penetrate","orchestrator.js"));
run("[v4] Persist", path.join(ROOT,"src","persist","orchestrator.js"));

console.log("\n--- [v4] P2P Nodes ---\n");
try{const P=require(path.join(ROOT,"src","persist","p2p-discovery.js"));const a=new P.P2PNode("t_a"),b=new P.P2PNode("t_b");a.join("t");b.join("t");ch("P2P nodes",a.stats().nodeId==="t_a","");a.leave();b.leave()}catch(e){ch("P2P nodes",false,e.message.split("\n")[0])}

console.log("\n--- [py] Python ---\n");
const pyExe="C:\\Users\\Lenovo\\AppData\\Local\\Python\\bin\\python.exe";
const pySc=path.join(ROOT,"src","clients","python","p2p_node.py");
if(fs.existsSync(pyExe)&&fs.existsSync(pySc)){try{const o=execSync("\""+pyExe+"\" \""+pySc+"\" --test",{cwd:path.dirname(pySc),timeout:15000,encoding:"utf-8"});const pn=(o.match(/PASS/g)||[]).length,fn=(o.match(/FAIL/g)||[]).length;ch("Python P2PNode",fn===0,pn+" checks")}catch(e){ch("Python P2PNode",false,e.message.split("\n")[0])}}
const cSc=path.join(ROOT,"src","clients","python","cross_language_demo.py");
if(fs.existsSync(cSc)){try{const o=execSync("\""+pyExe+"\" \""+cSc+"\"",{cwd:path.dirname(cSc),timeout:30000,encoding:"utf-8"});const cn=(o.match(/PASS/g)||[]).length;ch("Cross-language",cn>=2,"")}catch(e){ch("Cross-language",false,e.message.split("\n")[0])}}

console.log("\n======================================");
console.log(" "+(p+f)+" checks, "+p+" passed, "+f+" failed");
console.log("======================================");
if(f>0)process.exit(1);
