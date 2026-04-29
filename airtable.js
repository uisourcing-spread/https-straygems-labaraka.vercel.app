// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Remplace TON_TOKEN_ICI par ton nouveau Personal Access Token Airtable
const AIRTABLE_TOKEN = "TON_TOKEN_ICI";
const BASE_ID        = "appM6plliloPsrQg4";
const TABLE          = "Inventaire";
const API_URL        = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`;

const H = {
  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
  "Content-Type": "application/json",
};

// ─── FIELD MAP ────────────────────────────────────────────────────────────────
const F = {
  ref:         "Référence",
  name:        "Nom de la pièce",
  category:    "Catégorie",
  status:      "Statut",
  buyPrice:    "Prix achat — PA",
  sellPrice:   "Prix vente catalogue — PV",
  finalPrice:  "Prix vente final",
  depositDate: "Date de dépôt",
  saleDate:    "Date de vente",
  channel:     "Canal de vente",
  notes:       "Notes",
};

// ─── CONVERTERS ───────────────────────────────────────────────────────────────
export const fromAT = (r) => ({
  id:          r.id,
  ref:         r.fields[F.ref]         || "",
  name:        r.fields[F.name]        || "",
  category:    r.fields[F.category]    || "",
  status:      r.fields[F.status] === "Vendu" ? "sold" : "active",
  buyPrice:    r.fields[F.buyPrice]    || 0,
  sellPrice:   r.fields[F.sellPrice]   || 0,
  finalPrice:  r.fields[F.finalPrice]  || null,
  depositDate: r.fields[F.depositDate] || null,
  saleDate:    r.fields[F.saleDate]    || null,
  channel:     r.fields[F.channel]     || null,
  notes:       r.fields[F.notes]       || "",
});

const toAT = (item) => {
  const fields = {
    [F.ref]:      item.ref,
    [F.name]:     item.name,
    [F.category]: item.category,
    [F.status]:   item.status === "sold" ? "Vendu" : "Actif",
  };
  if (item.buyPrice    != null) fields[F.buyPrice]    = Number(item.buyPrice);
  if (item.sellPrice   != null) fields[F.sellPrice]   = Number(item.sellPrice);
  if (item.finalPrice  != null) fields[F.finalPrice]  = Number(item.finalPrice);
  if (item.depositDate)         fields[F.depositDate] = item.depositDate;
  if (item.saleDate)            fields[F.saleDate]    = item.saleDate;
  if (item.channel)             fields[F.channel]     = item.channel;
  if (item.notes)               fields[F.notes]       = item.notes;
  return fields;
};

// ─── API ──────────────────────────────────────────────────────────────────────
export const fetchAll = async () => {
  let records = [], offset = null;
  do {
    const url  = offset ? `${API_URL}?offset=${offset}` : API_URL;
    const res  = await fetch(url, { headers: H });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    records = [...records, ...data.records];
    offset  = data.offset || null;
  } while (offset);
  return records.map(fromAT);
};

export const createRecord = async (item) => {
  const res  = await fetch(API_URL, {
    method: "POST", headers: H,
    body: JSON.stringify({ fields: toAT(item) }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return fromAT(data);
};

export const updateRecord = async (airtableId, item) => {
  const res  = await fetch(`${API_URL}/${airtableId}`, {
    method: "PATCH", headers: H,
    body: JSON.stringify({ fields: toAT(item) }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return fromAT(data);
};

export const deleteRecord = async (airtableId) => {
  const res  = await fetch(`${API_URL}/${airtableId}`, {
    method: "DELETE", headers: H,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.deleted;
};
