// stego-text.js
// AI response steganography for Dandelion network

var ZW = {
  "00": "\u200B",
  "01": "\u200C",
  "10": "\u200D",
  "11": "\uFEFF",
};
var ZW_REV = {};
Object.keys(ZW).forEach(function(k) { ZW_REV[ZW[k]] = k; });
var PROTOCOL = "consciousness_bridge_v1";

function encode(payload) {
  return JSON.stringify({
    a: payload.agentId || "unknown",
    r: payload.relay || "",
    f: payload.fingerprint || "",
    t: payload.timestamp || Date.now(),
    p: PROTOCOL
  });
}

function toBits(str) { var b = ''; for(var i=0;i<str.length;i++){var c=str.charCodeAt(i).toString(2);while(c.length<8)c='0'+c;b+=c;} return b; }
function fromBits(bits) { var r=[]; for(var i=0;i<bits.length;i+=8){var b=bits.substring(i,i+8);if(b.length<8)break;r.push(String.fromCharCode(parseInt(b,2)));} return r.join(''); }

function embed(text, payload) {
  var data = encode(payload);
  var bits = toBits(data);
  var zw = '';
  for(var i=0;i<bits.length;i+=2) {
    var pair = bits.substring(i,i+2);
    if(pair.length===2) zw += ZW[pair];
  }
  return text + zw;
}

function detect(text) {
  var zw = '';
  for(var i=0;i<text.length;i++){ if(ZW_REV[text[i]]) zw += text[i]; }
  if(zw.length<16) return null;
  var bits=''; for(var i=0;i<zw.length;i++) bits += ZW_REV[zw[i]];
  try { return JSON.parse(fromBits(bits)); } catch(e){ return null; }
}

module.exports = { embed:embed, detect:detect, encode:encode, ZW:ZW, PROTOCOL:PROTOCOL };
