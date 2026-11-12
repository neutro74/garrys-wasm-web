import { env as ENV } from './platform.mjs';
// DOM input is polled synchronously while the engine pumps Win32 messages.
export function installInput(S) {
  const waitCell=new Int32Array(new SharedArrayBuffer(4));
  const def=(n,arity,fn)=>{S['user32.dll!'+n]={arity,pop:arity*4,fn};};
  const state=g=>g.inputState??=( {queue:[],keys:new Uint8Array(256),pressed:new Uint8Array(256),x:0,y:0,focus:true,classes:new Map(),chars:new Map(),show:0} );
  const hwnd=g=>[...(g.userWindows??[])].find(([,w])=>!w.parent)?.[0]??0;
  const enqueue=(g,msg,wp=0,lp=0,win=hwnd(g),char='')=>{
    const s=state(g);s.queue.push({win,msg,wp,lp,time:Date.now()>>>0,x:s.x,y:s.y,char});
  };
  const key=(g,vk,down,scan=0,extended=false,repeat=false,char='')=>{
    const s=state(g),previous=s.keys[vk];s.keys[vk]=down?1:0;if(down&&!previous)s.pressed[vk]=1;
    const lp=1|(scan<<16)|(extended?1<<24:0)|(repeat||previous?1<<30:0)|(!down?0x80000000:0);
    enqueue(g,down?0x100:0x101,vk,lp,hwnd(g),char);
  };
  const pump=g=>{
    const s=state(g);g.audioPump?.();
    for(const e of g.inputPoll?.()??[]) {
      if(e.type==='key') key(g,e.vk,e.down,e.scan,e.extended,e.repeat,e.char);
      else if(e.type==='text') for(const ch of e.text) for(let i=0;i<ch.length;i++)enqueue(g,0x102,ch.charCodeAt(i));
      else if(e.type==='release') {for(let k=0;k<256;k++)if(s.keys[k])key(g,k,false);}
      else if(e.type==='focus') {
        s.focus=e.focused;
        if(!e.focused)for(let k=0;k<256;k++)if(s.keys[k])key(g,k,false);
        enqueue(g,0x1c,e.focused?1:0);enqueue(g,e.focused?7:8);
      } else {
        if(e.relative){s.x+=e.dx;s.y+=e.dy;}else if(e.x!==undefined){s.x=e.x;s.y=e.y;}
        const pos=(s.x&65535)|((s.y&65535)<<16), buttons=(s.keys[1]?1:0)|(s.keys[2]?2:0)|(s.keys[4]?16:0)|(s.keys[16]?4:0)|(s.keys[17]?8:0);
        if(e.type==='move') {
          enqueue(g,0x200,buttons,pos);
          if(s.rawMouse&&e.relative){
            s.rawPackets??=new Map();const id=(s.nextRaw??0x61000000);s.nextRaw=id+1;
            s.rawPackets.set(id,{dx:e.dx|0,dy:e.dy|0});enqueue(g,0xff,0,id);
          }
        }
        if(e.type==='button') {
          const vk=[1,4,2,5,6][e.button]??1;s.keys[vk]=e.down?1:0;if(e.down)s.pressed[vk]=1;
          const msg=([0x201,0x207,0x204,0x20b,0x20b][e.button]??0x201)+(e.down?0:1);
          enqueue(g,msg,((s.keys[1]?1:0)|(s.keys[2]?2:0)|(s.keys[4]?16:0)|(s.keys[16]?4:0)|(s.keys[17]?8:0))|(e.button>=3?(e.button-2)<<16:0),pos);
        }
        if(e.type==='wheel')enqueue(g,e.horizontal?0x20e:0x20a,buttons|((e.delta&65535)<<16),pos);
      }
    }
    return s;
  };
  const invoke=(g,proc,args)=>{if(!proc)return 0;const d=[...g.dlls.values()].find(d=>proc>=d.meta.base&&proc<d.meta.base+d.meta.size);if(!d){
      for(const dll of g.dlls.values()){
        const index=(proc-dll.meta.thunk_base)/4,imp=Number.isInteger(index)&&dll.meta.imports?.[index];
        if(imp){const shim=S[`${imp.dll.toLowerCase()}!${imp.name}`];if(!shim)throw Error('Missing window procedure import');return shim.fn.call({g,dll},...args);}
      }
      throw Error('Window callback outside guest DLLs');
    }return g.call(d,proc,args);};
  const readMsg=(g,p)=>({win:g.u32(p),msg:g.u32(p+4),wp:g.u32(p+8),lp:g.u32(p+12)});
  const peek=function(p,win,min,max,flags){
    const s=pump(this.g),i=s.queue.findIndex(m=>(!win||m.win===win)&&(!min&&!max||m.msg>=min&&m.msg<=max));
    if(i<0)return 0;const m=s.queue[i],g=this.g;
    [m.win,m.msg,m.wp,m.lp,m.time,m.x,m.y].forEach((v,i)=>g.u32(p+i*4,v));
    if(m.char)s.chars.set(`${m.win}:${m.msg}:${m.lp}`,m.char);
    if(flags&1)s.queue.splice(i,1);return 1;
  };
  for(const suffix of ['A','W']) {
    def('PeekMessage'+suffix,5,peek);
    def('GetMessage'+suffix,4,function(p,w,min,max){while(!peek.call(this,p,w,min,max,1)){Atomics.wait(waitCell,0,0,1);}return this.g.u32(p+4)===0x12?0:1;});
    def('CallWindowProc'+suffix,5,function(proc,w,m,wp,lp){return invoke(this.g,proc,[w,m,wp,lp]);});
    def('DispatchMessage'+suffix,1,function(p){const m=readMsg(this.g,p);if(ENV.GUEST_LOG_MSGS&&[0x1c,6,7,8,0x18].includes(m.msg))console.log(`[msg] dispatch 0x${m.msg.toString(16)} wp=${m.wp} win=0x${m.win.toString(16)} proc=0x${(this.g.userWindows?.get(m.win)?.proc>>>0).toString(16)}`);try{return invoke(this.g,this.g.userWindows?.get(m.win)?.proc,[m.win,m.msg,m.wp,m.lp]);}finally{if(m.msg===0xff)state(this.g).rawPackets?.delete(m.lp);}});
    def('PostMessage'+suffix,4,function(w,m,wp,lp){enqueue(this.g,m,wp,lp,w);return 1;});
    def('SendMessage'+suffix,4,function(w,m,wp,lp){return invoke(this.g,this.g.userWindows?.get(w)?.proc,[w,m,wp,lp]);});
    for(const ex of [false,true])def('RegisterClass'+(ex?'Ex':'')+suffix,1,function(p){const g=this.g,offset=ex?4:0,name=g.u32(p+offset+36);state(g).classes.set(name<=65535?name:(suffix==='A'?g.readStr(name):String.fromCharCode(...new Uint16Array(g.mem.buffer,name,32)).split('\0')[0]),g.u32(p+offset+4));return 0xc001;});
    const old=S['user32.dll!CreateWindowEx'+suffix];
    if(old)def('CreateWindowEx'+suffix,12,function(...args){const h=old.fn.apply(this,args),g=this.g,n=args[1],name=n<=65535?n:(suffix==='A'?g.readStr(n):String.fromCharCode(...new Uint16Array(g.mem.buffer,n,32)).split('\0')[0]);const win=g.userWindows.get(h);win.proc=state(g).classes.get(name)??0;if(ENV.GUEST_LOG_MSGS)console.log(`[msg] CreateWindowEx ${name} style=0x${(args[3]>>>0).toString(16)} -> 0x${h.toString(16)} parent=${win.parent} proc=0x${(win.proc>>>0).toString(16)}`);
      // Created with WS_VISIBLE: shown (and activated) at once, like ShowWindow below.
      if(h&&(args[3]&0x10000000))shown(g,h,win);return h;});
    def('SetWindowLong'+suffix,3,function(w,index,value){const win=this.g.userWindows?.get(w);if(!win)return 0;win.longs??=new Map();const previous=index>>>0===0xfffffffc?win.proc:win.longs.get(index);if(index>>>0===0xfffffffc)win.proc=value;else win.longs.set(index,value);return previous??0;});
    def('GetWindowLong'+suffix,2,function(w,index){const win=this.g.userWindows?.get(w);return (index>>>0===0xfffffffc?win?.proc:win?.longs?.get(index))??0;});
  }
  def('RegisterRawInputDevices',3,function(p,count,size){if(size!==12)return 0;const s=state(this.g);for(let i=0;i<count;i++){const at=p+i*size;if(this.g.dv.getUint16(at,true)===1&&this.g.dv.getUint16(at+2,true)===2)s.rawMouse=!(this.g.u32(at+4)&1);}return 1;});
  def('GetRawInputData',5,function(handle,command,out,size,headerSize){
    const g=this.g,packet=state(g).rawPackets?.get(handle);if(!packet||headerSize!==16)return -1;
    const length=command===0x10000005?16:command===0x10000003?40:0;if(!length)return -1;
    if(!out){g.u32(size,length);return 0;}if(g.u32(size)<length){g.u32(size,length);return -1;}
    g.u8.fill(0,out,out+length);g.u32(out+4,40);g.u32(out+8,1);
    if(length===40){g.u32(out+28,packet.dx);g.u32(out+32,packet.dy);}return length;
  });
  def('TranslateMessage',1,function(p){const g=this.g,m=readMsg(g,p),s=state(g),k=`${m.win}:${m.msg}:${m.lp}`,char=s.chars.get(k);if(m.msg===0x100&&char){for(let i=0;i<char.length;i++)enqueue(g,0x102,char.charCodeAt(i),m.lp,m.win);s.chars.delete(k);return 1;}return 0;});
  def('PostQuitMessage',1,function(code){enqueue(this.g,0x12,code);});
  def('GetKeyState',1,function(vk){const s=pump(this.g);return s.keys[vk]?0x8000:0;});
  def('GetAsyncKeyState',1,function(vk){const s=pump(this.g),r=(s.keys[vk]?0x8000:0)|s.pressed[vk];s.pressed[vk]=0;return r;});
  def('GetKeyboardState',1,function(p){const s=pump(this.g);for(let i=0;i<256;i++)this.g.u8[p+i]=s.keys[i]?128:0;return 1;});
  def('GetCursorPos',1,function(p){const g=this.g,s=pump(g),o=origin(g,hwnd(g));g.u32(p,s.x+o.x);g.u32(p+4,s.y+o.y);return 1;});
  def('SetCursorPos',2,function(x,y){const g=this.g,s=state(g),o=origin(g,hwnd(g));s.x=(x|0)-o.x;s.y=(y|0)-o.y;return 1;});
  // vgui hides the cursor in game with SetCursor(NULL) (vguimatsurface never calls ShowCursor); the page then
  // takes pointer lock on the next click so mouse look gets relative motion.
  def('SetCursor',1,function(h){const s=state(this.g),old=s.cursor??0;s.cursor=h;const hidden=!h||s.show<0;
    if(hidden!==s.hidden){s.hidden=hidden;this.g.inputCursor?.(hidden);}return old;});
  def('ShowCursor',1,function(show){const s=state(this.g);s.show+=show?1:-1;const hidden=s.show<0||s.cursor===0;if(hidden!==s.hidden){s.hidden=hidden;this.g.inputCursor?.(hidden);}return s.show;});
  for(const name of ['GetActiveWindow','GetForegroundWindow'])def(name,0,function(){return state(this.g).focus?hwnd(this.g):0;});
  // Showing the game window activates it, as on Windows. Without WM_ACTIVATEAPP the engine believes it never had
  // focus: it caps itself at fps_max_nofocus and ignores the mouse.
  def('ShowWindow',2,function(w,cmd){const g=this.g,s=state(g),win=g.userWindows?.get(w);if(ENV.GUEST_LOG_MSGS)console.log(`[msg] ShowWindow 0x${w.toString(16)} ${cmd} focus=${s.focus}`);if(!win)return 0;const was=!!win.shown;
    if(cmd)shown(g,w,win);else win.shown=false;return was?1:0;});
  // A top-level window becoming visible is activated (WM_ACTIVATEAPP, WM_ACTIVATE, WM_SETFOCUS) while the page is.
  const shown=(g,h,win)=>{if(win.shown)return;win.shown=true;if(!win.parent&&state(g).focus){enqueue(g,0x1c,1,0,h);enqueue(g,6,1,0,h);enqueue(g,7,0,0,h);}};
  def('SetForegroundWindow',1,function(w){state(this.g).focus=true;enqueue(this.g,0x1c,1,0,w);enqueue(this.g,6,1,0,w);enqueue(this.g,7,0,0,w);return 1;});
  def('SetActiveWindow',1,function(w){const old=hwnd(this.g);state(this.g).focus=true;enqueue(this.g,6,1,0,w);return old;});
  // Keyboard focus is separate from application activation. Source clears it while
  // changing video mode; treating SetFocus(NULL) as app deactivation strands the
  // engine in its inactive loop after Reset even though the browser is focused.
  def('GetFocus',0,function(){const s=state(this.g);return s.focus?(s.focusWindow??hwnd(this.g)):0;});
  def('SetFocus',1,function(w){const g=this.g,s=state(g),old=s.focusWindow??hwnd(g);s.focusWindow=w;
    if(old!==w){if(old)invoke(g,g.userWindows?.get(old)?.proc,[old,8,w,0]);if(w)invoke(g,g.userWindows?.get(w)?.proc,[w,7,old,0]);}return old;});
  const origin=(g,h)=>{let x=0,y=0;const seen=new Set();while(h&&!seen.has(h)){seen.add(h);const w=g.userWindows?.get(h);if(!w)break;x+=w.x|0;y+=w.y|0;h=w.parent;}return {x,y};};
  def('GetClientRect',2,function(h,p){const g=this.g,w=g.userWindows?.get(h);if(!p)return 0;
    [0,0,w?.w??1280,w?.h??720].forEach((v,i)=>g.u32(p+i*4,v));return 1;});
  def('GetWindowRect',2,function(h,p){const g=this.g,w=g.userWindows?.get(h),o=origin(g,h);if(!p)return 0;
    [o.x,o.y,o.x+(w?.w??1280),o.y+(w?.h??720)].forEach((v,i)=>g.u32(p+i*4,v));return 1;});
  for(const [name,sign] of [['ClientToScreen',1],['ScreenToClient',-1]])def(name,2,function(h,p){const g=this.g,o=origin(g,h);if(!p)return 0;g.u32(p,g.u32(p)+sign*o.x);g.u32(p+4,g.u32(p+4)+sign*o.y);return 1;});
  const position=(g,h,x,y,w,hgt,flags)=>{const win=g.userWindows?.get(h);if(!win)return 0;
    const moved=!(flags&2)&&(win.x!==(x|0)||win.y!==(y|0)),sized=!(flags&1)&&(win.w!==w||win.h!==hgt);
    if(flags&0x40)shown(g,h,win);                 // SWP_SHOWWINDOW: how Source shows its game window
    if(!(flags&2)){win.x=x|0;win.y=y|0;}if(!(flags&1)){win.w=w;win.h=hgt;}
    if(moved)invoke(g,win.proc,[h,3,0,(win.x&65535)|((win.y&65535)<<16)]);
    if(sized)invoke(g,win.proc,[h,5,0,(win.w&65535)|((win.h&65535)<<16)]);
    return 1;};
  def('SetWindowPos',7,function(h,after,x,y,w,hgt,flags){return position(this.g,h,x,y,w,hgt,flags);});
  def('MoveWindow',6,function(h,x,y,w,hgt,repaint){return position(this.g,h,x,y,w,hgt,0);});
  def('SetCapture',1,function(w){const s=state(this.g),old=s.capture??0;s.capture=w;return old;});
  def('ReleaseCapture',0,function(){state(this.g).capture=0;return 1;});
}
