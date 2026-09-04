/** Store-level source of truth for Tyaani (sub-merchant / city store). */
export const TYAANI_STORES = [
  { id: "jammu", city: "Jammu", aliases: ["jammu", "j&k", "kashmir"], address: "Channi Himat, Jammu, Jammu and Kashmir 180015", hours: "Monday to Sunday 11:00 am – 08:00 pm", whatsapp: "+91 96193 87006" },
  { id: "surat", city: "Surat", aliases: ["surat"], address: "Dasani Plaza, Opposite Sarela Shopping Center, Ghod Dod Rd, Surat, Gujarat 395001", hours: "Monday to Saturday 11:00 am – 08:00 pm", whatsapp: "+91 96197 46253" },
  { id: "jalandhar", city: "Jalandhar", aliases: ["jalandhar"], address: "Central Arc Building, New Jawahar Nagar, Jalandhar, Punjab 144001", hours: "Monday to Saturday 11:00 am – 08:00 pm", whatsapp: "+91 82915 00394" },
  { id: "kolkata", city: "Kolkata", aliases: ["kolkata", "calcutta"], address: "4, Woodburn Park Road, Elgin Rd, Kolkata, West Bengal 700020", hours: "Monday to Sunday 11:00 am – 08:00 pm", whatsapp: "+91 84228 34581" },
  { id: "ahmedabad", city: "Ahmedabad", aliases: ["ahmedabad", "amdavad"], address: "Shop No. 9, Abhinit Square, Sindhu Bhavan Marg, Opp Taj Skyline, Ahmedabad, Gujarat", hours: "Monday to Sunday 11:00 am – 07:00 pm", whatsapp: "+91 96198 58967" },
  { id: "lucknow", city: "Lucknow", aliases: ["lucknow", "hazratganj"], address: "G.F. 1-B & 1C, Shahnajaf Rd, opp. Saharaganj Mall, Hazratganj, Lucknow 226001", hours: "Monday to Sunday 11:30 am – 07:30 pm", whatsapp: "+91 96196 74085" },
  { id: "bandra", city: "Bandra, Mumbai", aliases: ["bandra", "mumbai", "bombay"], address: "190, Turner Road, Bandra West, Mumbai, Maharashtra 400050", hours: "Monday to Saturday 11:00 am – 06:00 pm", whatsapp: "+91 84229 18035" },
  { id: "pune", city: "Pune", aliases: ["pune", "kalyani nagar"], address: "G.F. Shop No. 1, East Ave, Pillar 391, Near Mulik Palace, Kalyani Nagar, Pune 411014", hours: "Monday to Sunday 11:30 am – 07:30 pm", whatsapp: "+91 84228 47678" },
  { id: "delhi", city: "Delhi", aliases: ["delhi", "mehrauli", "new delhi", "ncr"], address: "Kutub Boulevard, Mehrauli, New Delhi 110030", hours: "Tuesday to Sunday 11:00 am – 07:00 pm", whatsapp: "+91 82913 45290" },
  { id: "hyderabad", city: "Hyderabad", aliases: ["hyderabad", "jubilee", "jubilee hills"], address: "Pillar No. 1649, Rd. No. 36, Jubilee Hills, Hyderabad, Telangana 500033", hours: "Monday to Saturday 11:30 am – 08:00 pm", whatsapp: "+91 82912 90468" },
  { id: "chandigarh", city: "Chandigarh", aliases: ["chandigarh", "sector 17"], address: "SCO 131-132, Bridge Market, 17C, Sector 17, Chandigarh 160017", hours: "Monday to Sunday 11:00 am – 08:00 pm", whatsapp: "+91 82916 06279" },
  { id: "bangalore", city: "Bangalore", aliases: ["bangalore", "bengaluru", "dickenson"], address: "27/3, Dickenson Road, Shivaji Nagar, Bengaluru, Karnataka 560042", hours: "Monday to Sunday 11:00 am – 07:30 pm", whatsapp: "+91 82919 26979" },
];

const CENTRAL = { whatsapp: "+91 96195 87978", email: "info@Tyaani.com" };

export function mapsLink(store) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Tyaani Jewellery ${store.city} ${store.address}`)}`;
}

export function findStore(text) {
  const hay = String(text || "").toLowerCase();
  if (!hay) return null;
  return TYAANI_STORES.find((store) => store.aliases.some((alias) => hay.includes(alias))) || null;
}

export function formatStore(store) {
  if (!store) return null;
  return {
    ...store,
    maps: mapsLink(store),
    card: `${store.city}\n${store.address}\nHours: ${store.hours}\nWhatsApp: ${store.whatsapp}\nMap: ${mapsLink(store)}`,
  };
}

export function storeBlock(store) {
  const resolved = store ? formatStore(store) : null;
  if (!resolved) {
    return `STORE DIRECTORY: no city matched yet. Central WhatsApp ${CENTRAL.whatsapp}. Ask which city they are in, then quote that store only.`;
  }
  return `STORE (source of truth for this city — do not invent another address):\n${resolved.card}\nCentral line if they are not near a store: ${CENTRAL.whatsapp}`;
}

export { CENTRAL };
