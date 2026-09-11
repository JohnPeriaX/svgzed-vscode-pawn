const fs=require('fs'); const cp=require('child_process'); const path=require('path');
const root=path.resolve(__dirname,'..');
const server=path.join(root,'dist','zed-pawn','pawn-language-server.js');
if(!fs.existsSync(server)) throw new Error('missing zed server bundle');
const child=cp.spawn(process.execPath,[server,'--stdio'],{stdio:['pipe','pipe','pipe']});
let out=Buffer.alloc(0), nextId=1, responses=new Map(), notifications=[];
function send(obj){const body=Buffer.from(JSON.stringify(obj)); child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`); child.stdin.write(body);}
child.stdout.on('data',chunk=>{out=Buffer.concat([out,chunk]); for(;;){const h=out.indexOf(Buffer.from('\r\n\r\n')); if(h<0)break; const head=out.slice(0,h).toString(); const m=/Content-Length:\s*(\d+)/i.exec(head); if(!m){out=out.slice(h+4);continue;} const n=Number(m[1]), start=h+4; if(out.length<start+n)break; const msg=JSON.parse(out.slice(start,start+n).toString()); out=out.slice(start+n); if(msg.id!==undefined) responses.set(msg.id,msg); else notifications.push(msg); }});
function wait(id,ms=5000){return new Promise((res,rej)=>{const t=setInterval(()=>{if(responses.has(id)){clearInterval(t);res(responses.get(id));}},20); setTimeout(()=>{clearInterval(t);rej(new Error('timeout '+id));},ms);});}
(async()=>{
 send({jsonrpc:'2.0',id:nextId,method:'initialize',params:{processId:null,rootUri:null,capabilities:{textDocument:{documentHighlight:{dynamicRegistration:false}}}}}); const init=await wait(nextId++); if(!init.result?.capabilities?.documentHighlightProvider) throw new Error('ZED server missing documentHighlightProvider');
 send({jsonrpc:'2.0',method:'initialized',params:{}}); const uri='file:///zed-smoke.pwn'; const text='if (x) {\\n    if (y) {\\n        SendClientMessage(0, -1, "�� { } ");\\n    } else {\\n        return 0;\\n    }\\n}'; send({jsonrpc:'2.0',method:'textDocument/didOpen',params:{textDocument:{uri,languageId:'Pawn',version:1,text}}});
 send({jsonrpc:'2.0',id:nextId,method:'textDocument/documentHighlight',params:{textDocument:{uri},position:{line:0,character:7}}}); const hi=await wait(nextId++); if(!hi.result || hi.result.length!==2) throw new Error('unexpected Zed highlight result');
 console.log('ZED_BUNDLE_LSP_OK'); child.kill();
})().catch(e=>{console.error(e); child.kill(); process.exitCode=1;});
