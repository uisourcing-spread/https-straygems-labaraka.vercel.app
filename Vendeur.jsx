import { useState, useMemo, useEffect, useCallback } from "react";
import { fetchAll, createRecord, updateRecord } from "./airtable";

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  bg:"#0D0D12", surface:"#13131A", surface2:"#1A1A24",
  border:"rgba(139,92,246,0.15)", borderStrong:"rgba(139,92,246,0.4)",
  purple:"#8B5CF6", purpleLight:"#A78BFA", purpleDim:"rgba(139,92,246,0.1)",
  accent:"#C084FC", text:"#E5E0F0", textDim:"#7B7490", textMuted:"#4A4560",
  active:"#4ADE80", activeDim:"rgba(74,222,128,0.1)",
  danger:"#EF4444", dangerDim:"rgba(239,68,68,0.08)", amber:"#F59E0B",
};
const CAT_COLORS = { Luxury:"#C084FC", Vintage:"#8B5CF6", Workwear:"#6366F1", Streetwear:"#818CF8" };
const CATEGORIES  = ["Luxury","Vintage","Workwear","Streetwear"];
const daysIn      = (d) => Math.round((new Date()-new Date(d))/86400000);
const euro        = (n) => `${Number(n||0).toLocaleString("fr-FR")}€`;

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
const Tag = ({children,color}) => (
  <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"0.08em",
    padding:"2px 8px",borderRadius:99,background:`${color}18`,border:`1px solid ${color}40`,color,whiteSpace:"nowrap"}}>
    {children}
  </span>
);

const Spinner = ({label="Chargement..."}) => (
  <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:60,flexDirection:"column",gap:12}}>
    <div style={{width:28,height:28,border:`2px solid ${C.border}`,borderTop:`2px solid ${C.purple}`,
      borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim}}>{label}</div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

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

const BackBtn = ({onClick}) => (
  <button onClick={onClick} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",
    fontFamily:"'DM Mono',monospace",fontSize:12,marginBottom:20,padding:0,display:"flex",alignItems:"center",gap:6}}>
    ← Retour
  </button>
);

const FieldLabel = ({children}) => (
  <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,
    letterSpacing:"0.1em",marginBottom:6,textTransform:"uppercase"}}>{children}</div>
);

const Field = ({label,children,col}) => (
  <div style={{marginBottom:14,gridColumn:col}}>
    {label && <FieldLabel>{label}</FieldLabel>}
    {children}
  </div>
);

const inp = {width:"100%",background:"#0A0A0F",border:`1px solid rgba(139,92,246,0.15)`,
  borderRadius:6,color:"#E5E0F0",padding:"11px 14px",fontFamily:"'Space Grotesk',sans-serif",
  fontSize:14,outline:"none",boxSizing:"border-box"};

// ─── STOCK VIEW ───────────────────────────────────────────────────────────────
function StockView({items,onSell,onEdit}) {
  const [cat,setCat]       = useState("all");
  const [search,setSearch] = useState("");

  const stock = useMemo(()=>items.filter(i=>i.status==="active"),[items]);
  const filtered = useMemo(()=>stock.filter(i=>
    (cat==="all"||i.category===cat)&&
    (i.name.toLowerCase().includes(search.toLowerCase())||i.ref.toLowerCase().includes(search.toLowerCase()))
  ),[stock,cat,search]);

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div>
          <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:17,fontWeight:700,color:C.text}}>Stock en rayon</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginTop:2}}>{stock.length} pièces actives</div>
        </div>
        <div style={{width:8,height:8,borderRadius:"50%",background:C.active,boxShadow:`0 0 8px ${C.active}`}}/>
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher réf ou nom..."
        style={{...inp,background:C.surface2,marginBottom:12}}/>

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        {["all",...CATEGORIES].map(c=>(
          <button key={c} onClick={()=>setCat(c)} style={{
            background:cat===c?C.purple:"none",border:`1px solid ${cat===c?C.purple:C.border}`,
            color:cat===c?"#fff":C.textDim,padding:"5px 12px",borderRadius:99,cursor:"pointer",
            fontFamily:"'DM Mono',monospace",fontSize:11,transition:"all 0.15s"}}>
            {c==="all"?"Tout":c}
          </button>
        ))}
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.length===0 && (
          <div style={{textAlign:"center",padding:40,color:C.textDim,fontFamily:"'DM Mono',monospace",fontSize:12}}>
            Aucune pièce trouvée
          </div>
        )}
        {filtered.map(item=>(
          <div key={item.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600,color:C.text,
                  marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim}}>{item.ref}</span>
                  <Tag color={CAT_COLORS[item.category]||C.grey}>{item.category}</Tag>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:700,color:C.purpleLight}}>{euro(item.sellPrice)}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim}}>{item.depositDate?`${daysIn(item.depositDate)}j en rayon`:"—"}</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
              <button onClick={()=>onSell(item)} style={{background:C.activeDim,border:"1px solid rgba(74,222,128,0.3)",
                color:C.active,padding:"9px",borderRadius:6,cursor:"pointer",
                fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:600}}>✓ Vendu</button>
              <button onClick={()=>onEdit(item)} style={{background:C.purpleDim,border:`1px solid ${C.border}`,
                color:C.purpleLight,padding:"9px",borderRadius:6,cursor:"pointer",
                fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:600}}>✎ Modifier</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SELL VIEW ────────────────────────────────────────────────────────────────
function SellView({item,onConfirm,onBack,loading}) {
  const today = new Date().toISOString().split("T")[0];
  const [saleDate,setSaleDate]       = useState(today);
  const [channel,setChannel]         = useState("store");
  const [hasRed,setHasRed]           = useState(false);
  const [finalPrice,setFinalPrice]   = useState(String(item.sellPrice));

  const priceNum  = parseFloat(finalPrice)||0;
  const reduction = item.sellPrice>0?Math.round(((item.sellPrice-priceNum)/item.sellPrice)*100):0;
  const valid     = priceNum>0&&saleDate;

  return (
    <div>
      <BackBtn onClick={onBack}/>
      <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:17,fontWeight:700,color:C.text,marginBottom:4}}>Enregistrer une vente</div>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginBottom:16}}>{item.ref}</div>

      {/* Pièce recap */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:14}}>
        <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:15,fontWeight:600,color:C.text,marginBottom:4}}>{item.name}</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <Tag color={CAT_COLORS[item.category]||C.grey}>{item.category}</Tag>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim}}>Catalogue : {euro(item.sellPrice)}</span>
        </div>
      </div>

      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:12}}>
        <FieldLabel>DATE DE VENTE</FieldLabel>
        <input type="date" value={saleDate} onChange={e=>setSaleDate(e.target.value)}
          style={{...inp,marginBottom:14}}/>

        <FieldLabel>CANAL DE VENTE</FieldLabel>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {["store","online"].map(ch=>(
            <button key={ch} onClick={()=>setChannel(ch)} style={{padding:"10px",borderRadius:8,cursor:"pointer",
              border:`1px solid ${channel===ch?C.purple:C.border}`,
              background:channel===ch?C.purpleDim:"transparent",
              color:channel===ch?C.purpleLight:C.textDim,
              fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:600}}>
              {ch==="store"?"🏬 Store":"🌐 Online"}
            </button>
          ))}
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <FieldLabel>RÉDUCTION ?</FieldLabel>
          <button onClick={()=>{setHasRed(!hasRed);if(hasRed)setFinalPrice(String(item.sellPrice));}} style={{
            background:hasRed?C.purpleDim:"none",border:`1px solid ${hasRed?C.purple:C.border}`,
            color:hasRed?C.purpleLight:C.textDim,padding:"4px 14px",borderRadius:99,cursor:"pointer",
            fontFamily:"'DM Mono',monospace",fontSize:11}}>
            {hasRed?"Oui":"Non"}
          </button>
        </div>

        {hasRed && <>
          <FieldLabel>PRIX FINAL (€)</FieldLabel>
          <input type="number" value={finalPrice} onChange={e=>setFinalPrice(e.target.value)}
            style={{...inp,color:C.purpleLight,fontSize:22,fontWeight:700,textAlign:"center"}}/>
          {priceNum>0&&reduction!==0 && (
            <div style={{marginTop:8,padding:"8px 12px",background:"rgba(245,158,11,0.08)",
              border:"1px solid rgba(245,158,11,0.2)",borderRadius:6,fontFamily:"'DM Mono',monospace",
              fontSize:12,color:C.amber,textAlign:"center"}}>
              {reduction>0?`- ${reduction}% de remise appliquée`:`+ ${Math.abs(reduction)}% au-dessus catalogue`}
            </div>
          )}
        </>}
      </div>

      {/* Récap final */}
      <div style={{background:C.purpleDim,border:`1px solid ${C.border}`,borderRadius:10,
        padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim}}>PRIX ENREGISTRÉ</div>
          <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:24,fontWeight:700,color:C.purpleLight}}>
            {euro(hasRed?priceNum:item.sellPrice)}
          </div>
        </div>
        {hasRed&&reduction>0 && (
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim}}>REMISE</div>
            <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:700,color:C.amber}}>-{reduction}%</div>
          </div>
        )}
      </div>

      <button onClick={()=>onConfirm({
        ...item, status:"sold", saleDate, channel,
        finalPrice:hasRed&&priceNum!==item.sellPrice?priceNum:null
      })} disabled={!valid||loading}
        style={{width:"100%",background:valid&&!loading?`linear-gradient(135deg,${C.purple},${C.accent})`:"#1A1A24",
          border:"none",color:valid&&!loading?"#fff":C.textDim,padding:"13px",borderRadius:8,
          cursor:valid&&!loading?"pointer":"not-allowed",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>
        {loading?"Enregistrement...":"Confirmer la vente"}
      </button>
    </div>
  );
}

// ─── EDIT VIEW ────────────────────────────────────────────────────────────────
function EditView({item,onSave,onBack,loading}) {
  const [draft,setDraft] = useState({
    name:item.name, category:item.category,
    sellPrice:String(item.sellPrice), depositDate:item.depositDate||"",
  });
  const set = (k,v) => setDraft(p=>({...p,[k]:v}));
  const valid = draft.name&&draft.sellPrice&&parseFloat(draft.sellPrice)>0&&draft.depositDate;

  return (
    <div>
      <BackBtn onClick={onBack}/>
      <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:17,fontWeight:700,color:C.text,marginBottom:4}}>Modifier la pièce</div>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginBottom:16}}>{item.ref}</div>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:12}}>
        <Field label="NOM DE LA PIÈCE *">
          <input style={inp} value={draft.name} onChange={e=>set("name",e.target.value)} placeholder="Nom de la pièce"/>
        </Field>
        <Field label="CATÉGORIE">
          <select style={{...inp,cursor:"pointer"}} value={draft.category} onChange={e=>set("category",e.target.value)}>
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="PRIX DE VENTE (€) *">
          <input type="number" style={inp} value={draft.sellPrice} onChange={e=>set("sellPrice",e.target.value)}/>
        </Field>
        <Field label="DATE DE DÉPÔT *">
          <input type="date" style={{...inp,marginBottom:0}} value={draft.depositDate} onChange={e=>set("depositDate",e.target.value)}/>
        </Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <button onClick={onBack} style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,
          padding:"12px",borderRadius:8,cursor:"pointer",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>Annuler</button>
        <button onClick={()=>onSave({...item,...draft,sellPrice:parseFloat(draft.sellPrice)})}
          disabled={!valid||loading}
          style={{background:valid&&!loading?`linear-gradient(135deg,${C.purple},${C.accent})`:"#1A1A24",
            border:"none",color:valid&&!loading?"#fff":C.textDim,padding:"12px",borderRadius:8,
            cursor:valid&&!loading?"pointer":"not-allowed",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>
          {loading?"Enregistrement...":"Sauvegarder"}
        </button>
      </div>
    </div>
  );
}

// ─── DEPOSIT VIEW ─────────────────────────────────────────────────────────────
function DepositView({onSave,onBack,loading}) {
  const today = new Date().toISOString().split("T")[0];
  const [form,setForm] = useState({ref:"",name:"",category:"Luxury",sellPrice:"",depositDate:today});
  const set   = (k,v) => setForm(p=>({...p,[k]:v}));
  const valid = form.ref.trim()&&form.name&&form.sellPrice&&parseFloat(form.sellPrice)>0&&form.depositDate;

  return (
    <div>
      <BackBtn onClick={onBack}/>
      <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:17,fontWeight:700,color:C.text,marginBottom:4}}>Déposer une pièce</div>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginBottom:16}}>Renseignez tous les champs</div>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:12}}>
        <Field label="RÉFÉRENCE *">
          <input style={inp} value={form.ref} onChange={e=>set("ref",e.target.value.toUpperCase())} placeholder="Ex: SG-021"/>
        </Field>
        <Field label="NOM DE LA PIÈCE *">
          <input style={inp} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Ex: Bomber Avirex Leather"/>
        </Field>
        <Field label="CATÉGORIE">
          <select style={{...inp,cursor:"pointer"}} value={form.category} onChange={e=>set("category",e.target.value)}>
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="PRIX DE VENTE (€) *">
          <input type="number" style={inp} value={form.sellPrice} onChange={e=>set("sellPrice",e.target.value)} placeholder="0"/>
        </Field>
        <Field label="DATE DE DÉPÔT *">
          <input type="date" style={{...inp,marginBottom:0}} value={form.depositDate} onChange={e=>set("depositDate",e.target.value)}/>
        </Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <button onClick={onBack} style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,
          padding:"12px",borderRadius:8,cursor:"pointer",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>Annuler</button>
        <button onClick={()=>onSave({...form,ref:form.ref.trim(),sellPrice:parseFloat(form.sellPrice),status:"active"})}
          disabled={!valid||loading}
          style={{background:valid&&!loading?`linear-gradient(135deg,${C.purple},${C.accent})`:"#1A1A24",
            border:"none",color:valid&&!loading?"#fff":C.textDim,padding:"12px",borderRadius:8,
            cursor:valid&&!loading?"pointer":"not-allowed",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>
          {loading?"Enregistrement...":"Déposer"}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN VENDEUR ─────────────────────────────────────────────────────────────
export default function Vendeur() {
  const [items,setItems]     = useState([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving]   = useState(false);
  const [error,setError]     = useState(null);
  const [screen,setScreen]   = useState("stock");
  const [selected,setSelected] = useState(null);
  const [toast,setToast]     = useState(null);

  const showToast = (msg,type="success") => {
    setToast({msg,type});
    setTimeout(()=>setToast(null),3000);
  };

  const load = useCallback(async()=>{
    setLoading(true); setError(null);
    try { setItems(await fetchAll()); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ load(); },[load]);

  const activeCount = useMemo(()=>items.filter(i=>i.status==="active").length,[items]);

  const goBack = () => { setScreen("stock"); setSelected(null); };

  const handleSell = async (data) => {
    setSaving(true);
    try {
      const updated = await updateRecord(data.id, data);
      setItems(prev=>prev.map(i=>i.id===updated.id?updated:i));
      showToast(`${data.name} → vendu ${euro(data.finalPrice||data.sellPrice)}`);
      goBack();
    } catch(e) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };

  const handleEdit = async (data) => {
    setSaving(true);
    try {
      const updated = await updateRecord(data.id, data);
      setItems(prev=>prev.map(i=>i.id===updated.id?updated:i));
      showToast("Pièce mise à jour");
      goBack();
    } catch(e) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };

  const handleDeposit = async (data) => {
    setSaving(true);
    try {
      const created = await createRecord(data);
      setItems(prev=>[...prev,created]);
      showToast(`${data.ref} déposé`);
      goBack();
    } catch(e) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };

  const NavBtn = ({id,icon,label}) => (
    <button onClick={()=>{setScreen(id);setSelected(null);}} style={{flex:1,padding:"10px 0",
      background:"none",border:"none",color:screen===id?C.purpleLight:C.textMuted,cursor:"pointer",
      display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
      <span style={{fontSize:18}}>{icon}</span>
      <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"0.08em"}}>{label}</span>
    </button>
  );

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,
      fontFamily:"'Space Grotesk',sans-serif",maxWidth:480,margin:"0 auto",position:"relative"}}>

      {toast && <Toast msg={toast.msg} type={toast.type}/>}

      {/* Header */}
      <div style={{padding:"18px 20px 14px",borderBottom:`1px solid ${C.border}`,
        display:"flex",alignItems:"center",justifyContent:"space-between",
        position:"sticky",top:0,background:C.bg,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:C.purple,boxShadow:`0 0 10px ${C.purple}`}}/>
          <span style={{fontWeight:700,fontSize:15,letterSpacing:"0.06em"}}>LA BARAKA</span>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim}}>× Straygems</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={load} style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,
            padding:"3px 10px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10}}>
            {loading?"⟳":"⟳ sync"}
          </button>
          <div style={{width:7,height:7,borderRadius:"50%",background:C.active}}/>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.active}}>{activeCount} actifs</span>
        </div>
      </div>

      {/* Content */}
      <div style={{padding:"20px 16px 96px"}}>
        {loading && <Spinner label="Chargement depuis Airtable..."/>}
        {error && !loading && (
          <div style={{background:C.dangerDim,border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,
            padding:"14px 16px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.danger}}>
            ⚠ Erreur : {error}
            <button onClick={load} style={{display:"block",marginTop:8,background:C.danger,border:"none",
              color:"#fff",padding:"6px 16px",borderRadius:4,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11}}>
              Réessayer
            </button>
          </div>
        )}
        {!loading && !error && <>
          {screen==="stock"   && <StockView items={items} onSell={i=>{setSelected(i);setScreen("sell");}} onEdit={i=>{setSelected(i);setScreen("edit");}}/>}
          {screen==="sell"    && selected && <SellView item={selected} onConfirm={handleSell} onBack={goBack} loading={saving}/>}
          {screen==="edit"    && selected && <EditView item={selected} onSave={handleEdit} onBack={goBack} loading={saving}/>}
          {screen==="deposit" && <DepositView onSave={handleDeposit} onBack={goBack} loading={saving}/>}
        </>}
      </div>

      {/* Bottom nav */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
        width:"100%",maxWidth:480,background:C.surface,borderTop:`1px solid ${C.border}`,
        display:"flex",padding:"4px 0 8px"}}>
        <NavBtn id="stock"   icon="🏷"  label="STOCK"/>
        <NavBtn id="deposit" icon="＋"  label="DÉPOSER"/>
      </div>
    </div>
  );
}
