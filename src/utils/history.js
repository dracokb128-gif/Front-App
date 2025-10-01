// src/utils/history.js
const KEY = (uid) => `completedOrders:v1:${uid}`;

function read(uid){ try{return JSON.parse(localStorage.getItem(KEY(uid))||"[]");}catch{return[];} }
function write(uid,list){ try{ localStorage.setItem(KEY(uid), JSON.stringify(list.slice(0,500))); }catch{} }

const stripT = (id="") => String(id||"").replace(/^t[_-]?/i, "");

export function snapshotFromTask(task, ts=Date.now()){
  if(!task) return null;
  const base = {
    id: stripT(task.id || task.orderId || ""),
    kind: task.kind === "combine" ? "combine" : "single",
    orderAmount: Number(task.orderAmount||0),
    commission: Number(task.commission||0),
    commissionRate: Number(task.commissionRate||0),
    ts
  };
  if(base.kind==="combine"){
    base.items=(task.items||[]).map(it=>({
      title: String(it.title||"Product"),
      image: String(it.image||""),
      unitPrice: Number(it.unitPrice ?? it.price ?? 0),
      quantity: Number(it.quantity||1)
    }));
  }else{
    base.title = String(task.title||"Order");
    base.image = String(task.image||"");
    base.unitPrice = Number(task.unitPrice ?? task.orderAmount ?? 0);
    base.quantity = Number(task.quantity||1);
  }
  return base;
}

export function pushCompleted(uid, snap){
  if(!snap) return;
  const list = read(uid);
  const i = list.findIndex(x=>x.id===snap.id);
  if(i!==-1) list.splice(i,1);
  list.unshift(snap);
  write(uid, list);
}

export function listCompleted(uid){
  return read(uid).sort((a,b)=>(b.ts||0)-(a.ts||0));
}
