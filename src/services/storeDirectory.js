/** Store directory: official Tyaani list, overlaid by Business Profile when present. */
import { displayWhatsApp } from "../config.js";
import { TYAANI_CONTACTS, TYAANI_EMAIL, TYAANI_OFFICIAL_STORES } from "../data/tyaaniFacts.js";

function officialDirectory() {
  return {
    stores: TYAANI_OFFICIAL_STORES.map((store) => ({
      ...store,
      whatsapp: store.phone || TYAANI_CONTACTS.whatsapp,
    })),
    brand: "Tyaani",
    central: { whatsapp: TYAANI_CONTACTS.whatsapp, email: TYAANI_EMAIL },
  };
}

function lines(value) {
  return String(value || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function slug(city) {
  return String(city || "").split(",")[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "store";
}

export function aliasesFor(city) {
  const base = String(city || "").toLowerCase();
  const parts = base.split(/[,/]| and /i).map((part) => part.trim()).filter((part) => part.length > 2);
  return [...new Set([base, ...parts])].filter((alias) => !/^(the|and|store|india)$/.test(alias));
}

export function parseStoresFromProfile(profile = {}) {
  const hoursMap = {};
  const hourChunks = String(profile.supportHours || "").replace(/\n+/g, "; ").split(/;\s*/);
  for (const chunk of hourChunks) {
    const match = chunk.trim().match(/^([A-Za-z][A-Za-z\s,/]+):\s*(.+)$/);
    if (!match) continue;
    const hours = match[2].trim();
    for (const city of match[1].split(/[,/]| and /i).map((c) => c.trim().toLowerCase()).filter(Boolean)) {
      hoursMap[city] = hours;
    }
  }

  const whatsappMap = {};
  let centralWhatsapp = "";
  let email = "";
  for (const line of lines(profile.contactInfo)) {
    const central = line.match(/Central WhatsApp:\s*(.+)/i);
    if (central) centralWhatsapp = central[1].trim();
    const mail = line.match(/Email:\s*(.+)/i);
    if (mail) email = mail[1].trim();
    const wa = line.match(/(\+?\d[\d\s-]{8,18})\s*\(([^)]+)\)/);
    if (wa && !/chat|click|book|assist/i.test(wa[2])) {
      whatsappMap[wa[2].trim().toLowerCase()] = wa[1].replace(/\s+/g, " ").trim();
    }
  }

  function lookup(map, city) {
    const key = String(city || "").split(",")[0].trim().toLowerCase();
    if (map[key]) return map[key];
    const hit = Object.keys(map).find((name) => key.includes(name) || name.includes(key));
    return hit ? map[hit] : "";
  }

  const stores = lines(profile.location)
    .filter((line) => !/^stores?:/i.test(line))
    .map((line) => {
      const idx = line.search(/[:—-]/);
      const city = (idx === -1 ? line : line.slice(0, idx)).replace(/^[-*]\s*/, "").trim();
      const address = (idx === -1 ? "" : line.slice(idx + 1)).trim();
      if (!city || /^(location|stores?|cities)$/i.test(city)) return null;
      return {
        id: slug(city),
        city,
        aliases: aliasesFor(city),
        address,
        hours: lookup(hoursMap, city),
        whatsapp: lookup(whatsappMap, city),
      };
    })
    .filter(Boolean);

  const central = centralWhatsapp || displayWhatsApp();
  return {
    stores: stores.map((store) => ({ ...store, whatsapp: store.whatsapp || central })),
    brand: String(profile.businessName || "").trim(),
    central: { whatsapp: central, email },
  };
}

let directory = officialDirectory();

export function hydrateStoreDirectory(profile) {
  const fromProfile = parseStoresFromProfile(profile || {});
  const base = officialDirectory();
  directory = {
    ...base,
    brand: fromProfile.brand || base.brand,
    central: {
      whatsapp: base.central.whatsapp,
      email: fromProfile.central.email || base.central.email,
    },
  };
  return directory;
}

export async function loadStoreDirectory() {
  const { BusinessProfile } = await import("../models/BusinessProfile.js");
  const row = await BusinessProfile.findByPk(1);
  return hydrateStoreDirectory(row ? row.toJSON() : {});
}

export function getStores() {
  return directory.stores;
}

export function getCentral() {
  return directory.central;
}

export function mapsLink(store) {
  const brand = directory.brand || "store";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${brand} ${store.city} ${store.address || ""}`.trim())}`;
}

export function findStore(text) {
  const hay = String(text || "").toLowerCase();
  if (!hay) return null;
  return directory.stores.find((store) => store.aliases.some((alias) => hay.includes(alias))) || null;
}

export function formatStore(store) {
  if (!store) return null;
  return {
    ...store,
    maps: mapsLink(store),
    card: `${store.city}\n${store.address || ""}\nHours: ${store.hours || "not listed"}\nPhone: ${store.phone || store.whatsapp || directory.central.whatsapp || displayWhatsApp()}\nMap: ${mapsLink(store)}`,
  };
}

export function storeBlock(store) {
  const resolved = store ? formatStore(store) : null;
  const brand = directory.brand || "This brand";
  const cities = directory.stores.map((s) => s.city.split(",")[0]).join(", ");
  const central = ` Central WhatsApp ${directory.central.whatsapp || displayWhatsApp()}.`;
  if (!directory.stores.length) {
    return `STORE DIRECTORY: use official Tyaani stores. Central WhatsApp ${directory.central.whatsapp || displayWhatsApp()}. Do not invent addresses.`;
  }
  if (!resolved) {
    return `STORE DIRECTORY: ${directory.stores.length} stores — ${cities}. City not matched yet. Ask which city they are in, then quote that store only.${central}`;
  }
  return `STORE (source of truth for this city — do not invent another address):\n${resolved.card}\n${brand} has ${directory.stores.length} stores (${cities}). Quote this store only unless they asked for the full list.${central}`;
}

export const TYAANI_STORES = TYAANI_OFFICIAL_STORES;
export const CENTRAL = { whatsapp: TYAANI_CONTACTS.whatsapp, email: TYAANI_EMAIL };
