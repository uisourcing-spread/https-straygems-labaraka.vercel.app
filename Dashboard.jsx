import { useState, useMemo, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area
} from "recharts";
import { fetchAll, createRecord, updateRecord, deleteRecord } from "./airtable";

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  bg:"#0D0D12", surface:"#13131A", surface2:"#1A1A24",
  border:"rgba(139,92,246,0.18)", borderStrong:"rgba(139,92,246,0.4)",
  purple:"#8B5CF6", purpleLight:"#A78BFA", purpleDim:"rgba(139,92,246,0.12)",
  accent:"#C084FC", grey:"#6B7280", greyLight:"#9CA3AF",
  text:"#E5E0F0", textDim:"#7B7490", textMuted:"#4A4560",
  active:"#4ADE80", activeDim:"rgba(74,222,128,0.1)",
  danger:"#EF4444", dangerDim:"rgba(239,68,68,0.08)", amber:"#F59E0B",
};
const CAT_COLORS = { Luxury:"#C084FC", Vintage:"#8B5CF6", Workwear:"#6366F1", Streetwear:"#818CF8" };
const MONTHS_FR  = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const CATEGORIES = ["Luxury","Vintage","Workwear","Streetwear"];

// ─── UTILS ────────────────────────────────────────────────────────────────────
const pct  = (b,s) => s ? Math.round(((s-b)/s)*100) : 0;
const euro = (n)   => `${Number(n||0).toLocaleString("fr-FR")}€`;
const getMonth    = (d) => d ? parseInt(d.split("-")[1])-1 : null;
const daysElapsed = (a,b) => Math.round((new Date(b||Date.now())-new Date(a))/86400000);

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
const Tag = ({children,color}) => (
  <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"0.1em",
    padding:"2px 8px",borderRadius:2,background:`${color}18`,border:`1px solid ${color}50`,color}}>
    {children}
  </span>
);

const Stat = ({label,value,sub,color}) => (
  <div style={{flex:1,minWidth:130,padding:"18px 20px",background:C.surface,
    border:`1px solid ${C.border}`,borderRadius:4,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:color||C.purple}}/>
    <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,
      letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>{label}</div>
    <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:26,fontWeight:700,color:color||C.purpleLight}}>{value}</div>
    {sub && <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginTop:4}}>{sub}</div>}
  </div>
);

const SectionTitle = ({children,icon}) => (
  <div style={{display:"flex",alignItems:"center",gap:10,margin:"32px 0 16px"}}>
    <span style={{fontSize:16}}>{icon}</span>
    <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:15,color:C.text,margin:0,
      fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{children}</h2>
    <div style={{flex:1,height:1,background:`linear-gradient(90deg,${C.border},transparent)`}}/>
  </div>
);

const CTip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:"#0D0D12",border:`1px solid ${C.borderStrong}`,
      padding:"10px 14px",fontFamily:"'DM Mono',monospace",fontSize:12,borderRadius:4}}>
      <div style={{color:C.purpleLight,marginBottom:6,fontWeight:700}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||C.text}}>{p.name}: <strong>
          {typeof p.value==="number" ? (p.name.includes("%") ? `${p.value}%` : euro(p.value)) : p.value}
        </strong></div>
      ))}
    </div>
  );
};

const Toast = ({msg,type}) => (
  <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",
    background:type==="success"?"#1A2E1A":"#2E1A1A",
    border:`1px solid ${type==="success"?"rgba(74,222,128,0.4)":"rgba(239,68,68,0.4)"}`,
    color:type==="success"?C.active:C.danger,
    padding:"12px 24px",borderRadius:99,fontFamily:"'DM Mono',monospace",fontSize:13,
    zIndex:9999,whiteSpace:"nowrap",pointerEvents:"none",boxShadow:"0 8px 32px rgba(0,0,0,0.6)"}}>
    {type==="success"?"✓ ":""}{msg}
  </div>
);

const Spinner = () => (
  <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,flexDirection:"column",gap:16}}>
    <div style={{width:32,height:32,border:`2px solid ${C.border}`,borderTop:`2px solid ${C.purple}`,
      borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.textDim}}>Chargement Airtable...</div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

// ─── MODAL AJOUT/ÉDITION ──────────────────────────────────────────────────────
const EMPTY = {ref:"",name:"",category:"Vintage",buyPrice:"",sellPrice:"",
  finalPrice:"",depositDate:"",saleDate:"",channel:"store",status:"active",notes:""};

const Modal = ({item,onClose,onSave,loading}) => {
  const [f,setF] = useState(item ? {
    ...item, buyPrice:String(item.buyPrice||""), sellPrice:String(item.sellPrice||""),
    finalPrice:String(item.finalPrice||""),
  } : EMPTY);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const isEdit = !!item?.id;
  const valid  = f.ref&&f.name&&f.sellPrice&&f.depositDate;

  const inp = {background:"#0A0A0F",border:`1px solid ${C.border}`,borderRadius:3,
    color:C.text,padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:13,
    width:"100%",outline:"none",boxSizing:"border-box"};

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:1000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.surface,border:`1px solid ${C.borderStrong}`,borderRadius:8,
        padding:24,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 style={{fontFamily:"'Space Grotesk',sans-serif",color:C.purpleLight,margin:0,fontSize:16}}>
            {isEdit ? "✎ Modifier la pièce" : "+ Nouveau dépôt"}
          </h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.grey,cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>RÉFÉRENCE *</label>
            <input style={inp} value={f.ref} onChange={e=>set("ref",e.target.value.toUpperCase())} placeholder="SG-021"/></div>
          <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>CATÉGORIE</label>
            <select style={{...inp,cursor:"pointer"}} value={f.category} onChange={e=>set("category",e.target.value)}>
              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select></div>
          <div style={{gridColumn:"1/-1"}}><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>NOM DE LA PIÈCE *</label>
            <input style={inp} value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Ex: Bomber Avirex Leather"/></div>
          <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>PRIX ACHAT — PA (€)</label>
            <input style={inp} type="number" value={f.buyPrice} onChange={e=>set("buyPrice",e.target.value)}/></div>
          <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>PRIX VENTE — PV (€) *</label>
            <input style={inp} type="number" value={f.sellPrice} onChange={e=>set("sellPrice",e.target.value)}/></div>
          <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>DATE DE DÉPÔT *</label>
            <input style={inp} type="date" value={f.depositDate} onChange={e=>set("depositDate",e.target.value)}/></div>
          <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>STATUT</label>
            <select style={{...inp,cursor:"pointer"}} value={f.status} onChange={e=>set("status",e.target.value)}>
              <option value="active">Actif</option><option value="sold">Vendu</option>
            </select></div>
          {f.status==="sold" && <>
            <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>DATE DE VENTE</label>
              <input style={inp} type="date" value={f.saleDate} onChange={e=>set("saleDate",e.target.value)}/></div>
            <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>CANAL</label>
              <select style={{...inp,cursor:"pointer"}} value={f.channel} onChange={e=>set("channel",e.target.value)}>
                <option value="store">Store</option><option value="online">Online</option>
              </select></div>
            <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>PRIX FINAL (si réduction)</label>
              <input style={inp} type="number" value={f.finalPrice} onChange={e=>set("finalPrice",e.target.value)} placeholder="Laisser vide si aucune"/></div>
          </>}
          <div style={{gridColumn:"1/-1"}}><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>NOTES</label>
            <textarea style={{...inp,height:60,resize:"vertical"}} value={f.notes} onChange={e=>set("notes",e.target.value)}/></div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,
            padding:"8px 20px",borderRadius:3,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:13}}>Annuler</button>
          <button onClick={()=>onSave({...f,buyPrice:parseFloat(f.buyPrice)||0,
            sellPrice:parseFloat(f.sellPrice)||0,finalPrice:parseFloat(f.finalPrice)||null})}
            disabled={!valid||loading}
            style={{background:valid&&!loading?`linear-gradient(135deg,${C.purple},${C.accent})`:"#1A1A24",
              border:"none",color:valid&&!loading?"#fff":C.textDim,padding:"8px 24px",borderRadius:3,
              cursor:valid&&!loading?"pointer":"not-allowed",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>
            {loading?"Enregistrement...":isEdit?"Sauvegarder":"Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── EDITABLE TABLE ROW ───────────────────────────────────────────────────────
const InventoryTable = ({items,onEdit,onDelete,saving}) => {
  const [confirmDelete,setConfirmDelete] = useState(null);
  return (
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,overflowX:"auto"}}>
      {confirmDelete && (
        <div style={{padding:"12px 16px",background:C.dangerDim,
          borderBottom:`1px solid rgba(239,68,68,0.2)`,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.danger}}>Supprimer cette pièce ? Irréversible.</span>
          <button onClick={()=>{onDelete(confirmDelete);setConfirmDelete(null);}}
            style={{background:C.danger,border:"none",color:"#fff",padding:"4px 14px",
              borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12}}>Confirmer</button>
          <button onClick={()=>setConfirmDelete(null)}
            style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,padding:"4px 14px",
              borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12}}>Annuler</button>
        </div>
      )}
      <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
        <thead>
          <tr style={{borderBottom:`1px solid ${C.border}`}}>
            {["Réf","Pièce","Catégorie","PA","PV","Marge","Dépôt","Vente","Canal","Délai","Statut",""].map(h=>(
              <th key={h} style={{padding:"10px 12px",textAlign:"left",fontFamily:"'DM Mono',monospace",
                fontSize:10,color:C.textDim,letterSpacing:"0.1em",fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item,idx)=>{
            const effectiveSell = item.finalPrice || item.sellPrice;
            const m = pct(item.buyPrice, effectiveSell);
            const d = daysElapsed(item.depositDate, item.saleDate||null);
            return (
              <tr key={item.id} style={{borderBottom:`1px solid rgba(139,92,246,0.06)`,
                background:idx%2===0?"transparent":"rgba(139,92,246,0.02)"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(139,92,246,0.04)"}
                onMouseLeave={e=>e.currentTarget.style.background=idx%2===0?"transparent":"rgba(139,92,246,0.02)"}>
                <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim}}>{item.ref}</td>
                <td style={{padding:"10px 12px",fontSize:13,fontWeight:500,color:C.text,maxWidth:180,
                  whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</td>
                <td style={{padding:"10px 12px"}}><Tag color={CAT_COLORS[item.category]||C.grey}>{item.category}</Tag></td>
                <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.greyLight}}>{euro(item.buyPrice)}</td>
                <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.purpleLight,fontWeight:600}}>
                  {euro(item.sellPrice)}
                  {item.finalPrice && item.finalPrice!==item.sellPrice && (
                    <span style={{color:C.amber,marginLeft:6,fontSize:10}}>→{euro(item.finalPrice)}</span>
                  )}
                </td>
                <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,
                  color:m>=60?C.active:m>=45?C.purpleLight:C.grey}}>{item.buyPrice?`${m}%`:"—"}</td>
                <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:11,color:C.grey}}>{item.depositDate||"—"}</td>
                <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:11,color:C.grey}}>{item.saleDate||"—"}</td>
                <td style={{padding:"10px 12px"}}>
                  {item.channel
                    ? <Tag color={item.channel==="store"?C.purple:"#6366F1"}>{item.channel}</Tag>
                    : <span style={{color:C.textDim,fontFamily:"'DM Mono',monospace",fontSize:11}}>—</span>}
                </td>
                <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:11,
                  color:item.status==="sold"?(d<=21?C.active:d<=45?C.purpleLight:C.amber):C.textDim}}>
                  {item.depositDate?(item.status==="sold"?`${d}j`:`${d}j en stock`):"—"}
                </td>
                <td style={{padding:"10px 12px"}}>
                  <Tag color={item.status==="sold"?C.purple:C.active}>{item.status==="sold"?"Vendu":"Actif"}</Tag>
                </td>
                <td style={{padding:"10px 12px",whiteSpace:"nowrap"}}>
                  <button onClick={()=>onEdit(item)}
                    style={{background:"none",border:`1px solid ${C.border}`,color:C.purpleLight,
                      padding:"3px 10px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,marginRight:6}}>✎</button>
                  <button onClick={()=>setConfirmDelete(item.id)}
                    style={{background:"none",border:"1px solid rgba(239,68,68,0.2)",color:C.danger,
                      padding:"3px 10px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11}}>✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [items,setItems]           = useState([]);
  const [loading,setLoading]       = useState(true);
  const [saving,setSaving]         = useState(false);
  const [error,setError]           = useState(null);
  const [view,setView]             = useState("dashboard");
  const [period,setPeriod]         = useState("monthly");
  const [modal,setModal]           = useState(null); // null | "new" | item
  const [filterCat,setFilterCat]   = useState("all");
  const [filterSt,setFilterSt]     = useState("all");
  const [toast,setToast]           = useState(null);
  const [monthlyFee,setMonthlyFee] = useState(100);
  const [feeInput,setFeeInput]     = useState("100");
  const [partnerName,setPartnerName]   = useState("La Baraka");
  const [partnerInput,setPartnerInput] = useState("La Baraka");
  const [maxSlots,setMaxSlots]     = useState(40);
  const [maxSlotsInput,setMaxSlotsInput] = useState("40");
  const [settingsSaved,setSettingsSaved] = useState(false);

  const showToast = (msg,type="success") => {
    setToast({msg,type});
    setTimeout(()=>setToast(null),3000);
  };

  // ── Load from Airtable ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchAll();
      setItems(data);
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(()=>{ load(); },[load]);

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (formData.id) {
        const updated = await updateRecord(formData.id, formData);
        setItems(prev=>prev.map(i=>i.id===updated.id?updated:i));
        showToast("Pièce mise à jour");
      } else {
        const created = await createRecord(formData);
        setItems(prev=>[...prev, created]);
        showToast(`${formData.ref} ajouté`);
      }
      setModal(null);
    } catch(e) {
      showToast(e.message,"error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setSaving(true);
    try {
      await deleteRecord(id);
      setItems(prev=>prev.filter(i=>i.id!==id));
      showToast("Pièce supprimée");
    } catch(e) {
      showToast(e.message,"error");
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = () => {
    const fee = parseFloat(feeInput);
    if (!isNaN(fee)&&fee>=0) setMonthlyFee(fee);
    if (partnerInput.trim()) setPartnerName(partnerInput.trim());
    const slots = parseInt(maxSlotsInput);
    if (!isNaN(slots)&&slots>0) setMaxSlots(slots);
    setSettingsSaved(true);
    setTimeout(()=>setSettingsSaved(false),2000);
  };

  // ── Derived data ─────────────────────────────────────────────────────────
  const sold   = useMemo(()=>items.filter(i=>i.status==="sold"),[items]);
  const active = useMemo(()=>items.filter(i=>i.status==="active"),[items]);

  const totalRevenue = useMemo(()=>sold.reduce((a,i)=>a+(i.finalPrice||i.sellPrice),0),[sold]);
  const totalProfit  = useMemo(()=>sold.reduce((a,i)=>a+(i.finalPrice||i.sellPrice)-i.buyPrice,0),[sold]);
  const avgMargin    = useMemo(()=>sold.length?Math.round(sold.reduce((a,i)=>a+pct(i.buyPrice,i.finalPrice||i.sellPrice),0)/sold.length):0,[sold]);
  const avgBasket    = useMemo(()=>sold.length?Math.round(totalRevenue/sold.length):0,[sold,totalRevenue]);
  const avgDays      = useMemo(()=>sold.filter(i=>i.depositDate&&i.saleDate).length?Math.round(sold.filter(i=>i.depositDate&&i.saleDate).reduce((a,i)=>a+daysElapsed(i.depositDate,i.saleDate),0)/sold.filter(i=>i.depositDate&&i.saleDate).length):0,[sold]);
  const activeValue  = useMemo(()=>active.reduce((a,i)=>a+i.sellPrice,0),[active]);

  const monthlyData = useMemo(()=>{
    const map={};
    items.forEach(i=>{
      if(i.depositDate){
        const m=getMonth(i.depositDate);
        const k=`2025-${String(m+1).padStart(2,"0")}`;
        if(!map[k]) map[k]={month:MONTHS_FR[m],deposits:0,sold:0,revenue:0,profit:0,margins:[],days:[]};
        map[k].deposits++;
      }
      if(i.status==="sold"&&i.saleDate){
        const m=getMonth(i.saleDate);
        const k=`2025-${String(m+1).padStart(2,"0")}`;
        if(!map[k]) map[k]={month:MONTHS_FR[m],deposits:0,sold:0,revenue:0,profit:0,margins:[],days:[]};
        const fp=i.finalPrice||i.sellPrice;
        map[k].sold++;
        map[k].revenue+=fp;
        map[k].profit+=(fp-i.buyPrice);
        map[k].margins.push(pct(i.buyPrice,fp));
        if(i.depositDate) map[k].days.push(daysElapsed(i.depositDate,i.saleDate));
      }
    });
    return Object.keys(map).sort().map(k=>({
      ...map[k],
      netProfit:map[k].profit-monthlyFee,
      avgMargin:map[k].margins.length?Math.round(map[k].margins.reduce((a,v)=>a+v,0)/map[k].margins.length):0,
      avgDays:map[k].days.length?Math.round(map[k].days.reduce((a,v)=>a+v,0)/map[k].days.length):0,
    }));
  },[items,monthlyFee]);

  const quarterlyData = useMemo(()=>[
    {label:"Q1",months:[0,1,2]},{label:"Q2",months:[3,4,5]},
    {label:"Q3",months:[6,7,8]},{label:"Q4",months:[9,10,11]},
  ].map(q=>{
    const rel=sold.filter(i=>i.saleDate&&q.months.includes(getMonth(i.saleDate)));
    const revenue=rel.reduce((a,i)=>a+(i.finalPrice||i.sellPrice),0);
    const profit=rel.reduce((a,i)=>a+(i.finalPrice||i.sellPrice)-i.buyPrice,0);
    return {label:q.label,sold:rel.length,revenue,profit,netProfit:profit-monthlyFee*3,
      avgMargin:rel.length?Math.round(rel.reduce((a,i)=>a+pct(i.buyPrice,i.finalPrice||i.sellPrice),0)/rel.length):0};
  }),[sold,monthlyFee]);

  const catData = useMemo(()=>{
    const map={};
    sold.forEach(i=>{if(!map[i.category])map[i.category]={name:i.category,count:0,revenue:0};
      map[i.category].count++;map[i.category].revenue+=(i.finalPrice||i.sellPrice);});
    return Object.values(map);
  },[sold]);

  const channelData = useMemo(()=>[
    {name:"Store",value:sold.filter(i=>i.channel==="store").length},
    {name:"Online",value:sold.filter(i=>i.channel==="online").length},
  ],[sold]);

  const marginDist = useMemo(()=>{
    const b={"<40%":0,"40-50%":0,"50-60%":0,"60-70%":0,">70%":0};
    sold.forEach(i=>{const m=pct(i.buyPrice,i.finalPrice||i.sellPrice);
      if(m<40)b["<40%"]++;else if(m<50)b["40-50%"]++;else if(m<60)b["50-60%"]++;else if(m<70)b["60-70%"]++;else b[">70%"]++;});
    return Object.entries(b).map(([name,value])=>({name,value}));
  },[sold]);

  const filteredItems = useMemo(()=>items.filter(i=>
    (filterCat==="all"||i.category===filterCat)&&
    (filterSt==="all"||i.status===filterSt)
  ),[items,filterCat,filterSt]);

  const chartData = period==="monthly"?monthlyData:period==="quarterly"?quarterlyData:
    [{label:"2025",sold:sold.length,revenue:totalRevenue,profit:totalProfit,netProfit:totalProfit-monthlyFee*12}];

  // ── NAV HELPERS ──────────────────────────────────────────────────────────
  const navBtn=(id,label)=>(
    <button onClick={()=>setView(id)} style={{
      background:view===id?C.purpleDim:"none",
      border:view===id?`1px solid ${C.borderStrong}`:`1px solid transparent`,
      color:view===id?C.purpleLight:C.textDim,
      padding:"7px 18px",borderRadius:3,cursor:"pointer",
      fontFamily:"'DM Mono',monospace",fontSize:12,letterSpacing:"0.08em",transition:"all 0.2s"
    }}>{label}</button>
  );
  const periodBtn=(id,label)=>(
    <button onClick={()=>setPeriod(id)} style={{
      background:period===id?C.purple:"none",
      border:`1px solid ${period===id?C.purple:C.border}`,
      color:period===id?"#fff":C.textDim,
      padding:"5px 14px",borderRadius:2,cursor:"pointer",
      fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.08em",
    }}>{label}</button>
  );

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"'Space Grotesk',sans-serif"}}>
      {toast && <Toast msg={toast.msg} type={toast.type}/>}
      {modal && <Modal item={modal==="new"?null:modal} onClose={()=>setModal(null)} onSave={handleSave} loading={saving}/>}

      {/* Header */}
      <div style={{borderBottom:`1px solid ${C.border}`,padding:"0 32px"}}>
        <div style={{maxWidth:1280,margin:"0 auto",display:"flex",alignItems:"center",
          justifyContent:"space-between",height:60}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.purple,boxShadow:`0 0 12px ${C.purple}`}}/>
            <span style={{fontWeight:700,fontSize:15,letterSpacing:"0.06em"}}>STRAYGEMS</span>
            <span style={{color:C.textDim,fontSize:12,fontFamily:"'DM Mono',monospace"}}>/ {partnerName}</span>
            {/* Sync button */}
            <button onClick={load} title="Sync Airtable" style={{background:"none",border:`1px solid ${C.border}`,
              color:C.textDim,padding:"3px 10px",borderRadius:2,cursor:"pointer",
              fontFamily:"'DM Mono',monospace",fontSize:11,marginLeft:8}}>
              {loading?"⟳ sync...":"⟳ sync"}
            </button>
          </div>
          <div style={{display:"flex",gap:4}}>
            {navBtn("dashboard","Dashboard")}
            {navBtn("inventory","Inventaire")}
            {navBtn("settings","⚙ Config")}
          </div>
          <button onClick={()=>setModal("new")} style={{
            background:`linear-gradient(135deg,${C.purple},${C.accent})`,
            border:"none",color:"#fff",padding:"8px 20px",borderRadius:3,
            cursor:"pointer",fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:600}}>
            + Déposer
          </button>
        </div>
      </div>

      <div style={{maxWidth:1280,margin:"0 auto",padding:"28px 32px"}}>
        {error && (
          <div style={{background:C.dangerDim,border:`1px solid rgba(239,68,68,0.3)`,borderRadius:4,
            padding:"12px 16px",marginBottom:20,fontFamily:"'DM Mono',monospace",fontSize:12,color:C.danger,
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            ⚠ Erreur Airtable : {error} — vérifie ton token dans src/airtable.js
            <button onClick={load} style={{background:C.danger,border:"none",color:"#fff",
              padding:"4px 12px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11}}>Réessayer</button>
          </div>
        )}

        {loading && <Spinner/>}

        {!loading && view==="dashboard" && <>
          {/* KPIs */}
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <Stat label="CA total vendu"   value={euro(totalRevenue)}  sub={`${sold.length} pièces vendues`}/>
            <Stat label="Profit net"       value={euro(totalProfit-monthlyFee*monthlyData.length)} sub="après frais loyer" color={C.accent}/>
            <Stat label="Marge moyenne"    value={`${avgMargin}%`}     sub="sur pièces vendues" color={C.purpleLight}/>
            <Stat label="Panier moyen"     value={euro(avgBasket)}     sub="prix de vente moyen"/>
            <Stat label="Délai écoulement" value={`${avgDays}j`}       sub="dépôt → vente" color="#818CF8"/>
            <Stat label="Stock actif"      value={`${active.length}`}  sub={`valeur ${euro(activeValue)}`} color={C.active}/>
          </div>

          {/* Period selector */}
          <div style={{display:"flex",alignItems:"center",gap:8,margin:"28px 0 4px"}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginRight:4}}>PÉRIODE :</span>
            {periodBtn("monthly","Mensuel")}
            {periodBtn("quarterly","Trimestriel")}
            {periodBtn("annual","Annuel")}
          </div>

          {/* Area CA + profit */}
          <SectionTitle icon="📈">Évolution CA & Profit</SectionTitle>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"20px 8px"}}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{top:10,right:20,left:0,bottom:0}}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.purple} stopOpacity={0.3}/><stop offset="95%" stopColor={C.purple} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.accent} stopOpacity={0.25}/><stop offset="95%" stopColor={C.accent} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)"/>
                <XAxis dataKey={period==="monthly"?"month":"label"} tick={{fontFamily:"'DM Mono',monospace",fontSize:11,fill:C.textDim}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontFamily:"'DM Mono',monospace",fontSize:11,fill:C.textDim}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}€`}/>
                <Tooltip content={<CTip/>}/>
                <Legend wrapperStyle={{fontFamily:"'DM Mono',monospace",fontSize:11}}/>
                <Area type="monotone" dataKey="revenue" name="CA (€)" stroke={C.purple} fill="url(#gRev)" strokeWidth={2} dot={false}/>
                <Area type="monotone" dataKey="netProfit" name="Profit net (€)" stroke={C.accent} fill="url(#gPro)" strokeWidth={2} dot={false} strokeDasharray="4 2"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Bar dépôts vs ventes */}
          <SectionTitle icon="📦">Dépôts vs Ventes</SectionTitle>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"20px 8px"}}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={period==="monthly"?monthlyData:quarterlyData} margin={{top:10,right:20,left:0,bottom:0}} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" vertical={false}/>
                <XAxis dataKey={period==="monthly"?"month":"label"} tick={{fontFamily:"'DM Mono',monospace",fontSize:11,fill:C.textDim}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontFamily:"'DM Mono',monospace",fontSize:11,fill:C.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                <Tooltip content={<CTip/>}/>
                <Legend wrapperStyle={{fontFamily:"'DM Mono',monospace",fontSize:11}}/>
                <Bar dataKey="deposits" name="Déposées" fill={C.border} radius={[2,2,0,0]}/>
                <Bar dataKey="sold" name="Vendues" fill={C.purple} radius={[2,2,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Marge + délai */}
          <SectionTitle icon="⚡">Marge moyenne & Délai écoulement</SectionTitle>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"20px 8px"}}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData} margin={{top:10,right:20,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)"/>
                <XAxis dataKey="month" tick={{fontFamily:"'DM Mono',monospace",fontSize:11,fill:C.textDim}} axisLine={false} tickLine={false}/>
                <YAxis yAxisId="l" tick={{fontFamily:"'DM Mono',monospace",fontSize:11,fill:C.textDim}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                <YAxis yAxisId="r" orientation="right" tick={{fontFamily:"'DM Mono',monospace",fontSize:11,fill:C.textDim}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}j`}/>
                <Tooltip content={<CTip/>}/>
                <Legend wrapperStyle={{fontFamily:"'DM Mono',monospace",fontSize:11}}/>
                <Line yAxisId="l" type="monotone" dataKey="avgMargin" name="Marge avg%" stroke={C.purple} strokeWidth={2} dot={{fill:C.purple,r:4}}/>
                <Line yAxisId="r" type="monotone" dataKey="avgDays" name="Délai avg (j)" stroke="#6366F1" strokeWidth={2} dot={{fill:"#6366F1",r:4}} strokeDasharray="5 3"/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Camemberts */}
          <SectionTitle icon="🥧">Répartition</SectionTitle>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            {[
              {title:"VENTES PAR CATÉGORIE",data:catData,dkey:"count",nkey:"name",colors:catData.map(e=>CAT_COLORS[e.name])},
              {title:"CANAL DE VENTE",data:channelData,dkey:"value",nkey:"name",colors:[C.purple,"#6366F1"]},
            ].map(({title,data,dkey,nkey,colors})=>(
              <div key={title} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:20}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",marginBottom:12}}>{title}</div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={data} dataKey={dkey} nameKey={nkey} cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={3}>
                      {data.map((_,i)=><Cell key={i} fill={colors[i]||C.purple}/>)}
                    </Pie>
                    <Tooltip contentStyle={{background:"#0D0D12",border:`1px solid ${C.borderStrong}`,fontFamily:"'DM Mono',monospace",fontSize:12}}/>
                    <Legend wrapperStyle={{fontFamily:"'DM Mono',monospace",fontSize:11}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ))}
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:20}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",marginBottom:12}}>DISTRIBUTION DES MARGES</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={marginDist} margin={{top:0,right:0,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" vertical={false}/>
                  <XAxis dataKey="name" tick={{fontFamily:"'DM Mono',monospace",fontSize:10,fill:C.textDim}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontFamily:"'DM Mono',monospace",fontSize:10,fill:C.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip contentStyle={{background:"#0D0D12",border:`1px solid ${C.borderStrong}`,fontFamily:"'DM Mono',monospace",fontSize:12}}/>
                  <Bar dataKey="value" name="Pièces" radius={[2,2,0,0]}>
                    {marginDist.map((_,i)=><Cell key={i} fill={`hsl(${260+i*12},70%,${50+i*6}%)`}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ROI Loyer */}
          <SectionTitle icon="💸">Rentabilité loyer ({euro(monthlyFee)}/mois)</SectionTitle>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:20}}>
            <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
              {monthlyData.filter(m=>m.sold>0).map(m=>{
                const roi=((m.profit/monthlyFee)*100).toFixed(0);
                const pos=m.profit>=monthlyFee;
                return (
                  <div key={m.month} style={{flex:1,minWidth:100,padding:"12px 14px",
                    background:pos?"rgba(139,92,246,0.08)":C.dangerDim,
                    border:`1px solid ${pos?C.border:"rgba(239,68,68,0.2)"}`,borderRadius:3}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,marginBottom:4}}>{m.month} 2025</div>
                    <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:700,color:pos?C.purpleLight:C.danger}}>{euro(m.netProfit)}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,marginTop:2}}>ROI : {roi}%</div>
                  </div>
                );
              })}
            </div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim}}>
              Profit brut : <span style={{color:C.purpleLight}}>{euro(totalProfit)}</span> · Loyer cumulé : <span style={{color:C.danger}}>{euro(monthlyFee*monthlyData.length)}</span> · Net : <span style={{color:totalProfit-monthlyFee*monthlyData.length>=0?C.active:C.danger,fontWeight:600}}>{euro(totalProfit-monthlyFee*monthlyData.length)}</span>
            </div>
          </div>
        </>}

        {!loading && view==="inventory" && <>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:20,flexWrap:"wrap"}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim}}>FILTRER :</span>
            {["all",...CATEGORIES].map(c=>(
              <button key={c} onClick={()=>setFilterCat(c)} style={{
                background:filterCat===c?C.purpleDim:"none",border:`1px solid ${filterCat===c?C.borderStrong:C.border}`,
                color:filterCat===c?C.purpleLight:C.textDim,padding:"5px 12px",borderRadius:2,cursor:"pointer",
                fontFamily:"'DM Mono',monospace",fontSize:11}}>
                {c==="all"?"Tout":c}
              </button>
            ))}
            <div style={{width:1,height:20,background:C.border,margin:"0 4px"}}/>
            {["all","active","sold"].map(s=>(
              <button key={s} onClick={()=>setFilterSt(s)} style={{
                background:filterSt===s?C.purpleDim:"none",border:`1px solid ${filterSt===s?C.borderStrong:C.border}`,
                color:filterSt===s?C.purpleLight:C.textDim,padding:"5px 12px",borderRadius:2,cursor:"pointer",
                fontFamily:"'DM Mono',monospace",fontSize:11}}>
                {s==="all"?"Tous":s==="active"?"En stock":"Vendus"}
              </button>
            ))}
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginLeft:"auto"}}>{filteredItems.length} pièces</span>
          </div>
          <InventoryTable items={filteredItems} onEdit={item=>setModal(item)} onDelete={handleDelete} saving={saving}/>
        </>}

        {view==="settings" && <>
          <SectionTitle icon="⚙️">Configuration — {partnerName}</SectionTitle>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,maxWidth:640}}>
            <div style={{gridColumn:"1/-1",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:24}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",marginBottom:12}}>NOM DU PARTENAIRE</div>
              <input value={partnerInput} onChange={e=>setPartnerInput(e.target.value)}
                style={{width:"100%",background:"#0A0A0F",border:`1px solid ${C.border}`,borderRadius:3,color:C.text,padding:"10px 14px",fontFamily:"'Space Grotesk',sans-serif",fontSize:15,outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:24}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",marginBottom:12}}>LOYER MENSUEL (€)</div>
              <input type="number" min="0" value={feeInput} onChange={e=>setFeeInput(e.target.value)}
                style={{width:"100%",background:"#0A0A0F",border:`1px solid ${C.border}`,borderRadius:3,color:C.purpleLight,padding:"10px 14px",fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:700,outline:"none",boxSizing:"border-box"}}/>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginTop:8}}>Actuellement : <span style={{color:C.purpleLight}}>{euro(monthlyFee)}/mois</span></div>
            </div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:24}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",marginBottom:12}}>EMPLACEMENTS MAX</div>
              <input type="number" min="1" value={maxSlotsInput} onChange={e=>setMaxSlotsInput(e.target.value)}
                style={{width:"100%",background:"#0A0A0F",border:`1px solid ${C.border}`,borderRadius:3,color:C.purpleLight,padding:"10px 14px",fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:700,outline:"none",boxSizing:"border-box"}}/>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginTop:8}}>
                Occupation : <span style={{color:active.length>maxSlots?C.danger:C.active}}>{active.length}/{maxSlots}</span>
              </div>
            </div>
            <div style={{gridColumn:"1/-1",background:C.purpleDim,border:`1px solid ${C.borderStrong}`,borderRadius:4,padding:20,display:"flex",gap:24,flexWrap:"wrap"}}>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>COÛT / PIÈCE EN STOCK</div>
                <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,color:C.accent}}>{active.length>0?`${(monthlyFee/active.length).toFixed(2)}€`:"—"}</div>
              </div>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>SEUIL RENTABILITÉ / MOIS</div>
                <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,color:C.purpleLight}}>{euro(monthlyFee)} profit brut</div>
              </div>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>LOYER ANNUEL PROJETÉ</div>
                <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,color:C.danger}}>{euro(monthlyFee*12)}</div>
              </div>
            </div>
            <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:14}}>
              <button onClick={saveSettings} style={{background:`linear-gradient(135deg,${C.purple},${C.accent})`,border:"none",color:"#fff",padding:"10px 28px",borderRadius:3,cursor:"pointer",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>Enregistrer</button>
              {settingsSaved && <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.active}}>✓ Sauvegardé</span>}
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}
