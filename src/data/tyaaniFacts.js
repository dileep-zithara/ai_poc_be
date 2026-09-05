/** Official Tyaani knowledge — source of truth for policies, stores, and contacts.
 *  Prices and stock still come only from the live catalog. */

export const TYAANI_EMAIL = "info@tyaani.com";
export const TYAANI_CENTRAL_PHONE = "9619587978";
export const TYAANI_RETURNS_PHONE = "9820412054";
export const TYAANI_WEBSITE = "https://tyaani.com";
export const TYAANI_STORES_PAGE = "https://tyaani.com/pages/stores";

export function prettyPhone(digits) {
  const d = String(digits || "").replace(/\D/g, "").slice(-10);
  if (d.length !== 10) return digits || "";
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

export const TYAANI_CONTACTS = {
  whatsapp: prettyPhone(TYAANI_CENTRAL_PHONE),
  returns: prettyPhone(TYAANI_RETURNS_PHONE),
  returnsHours: "10:30 AM–6:30 PM IST, Mon–Sat",
  email: TYAANI_EMAIL,
  website: TYAANI_WEBSITE,
};

export const TYAANI_OFFICIAL_STORES = [
  { id: "mumbai-bandra", city: "Mumbai, Bandra", aliases: ["mumbai", "bandra", "turner road", "bandra west"], address: "Bandra 190, Turner Road, Bandra West, Mumbai, Maharashtra 400050", hours: "Mon–Sat 11:00 am–6:00 pm", phone: "+91 84229 18035" },
  { id: "mumbai-santacruz", city: "Mumbai, Santacruz", aliases: ["santacruz", "santa cruz", "linking road", "krishna curve"], address: "3rd Floor, Krishna Curve Building, Linking Road, Santacruz, Mumbai", hours: "Confirm on the stores page or with the team", phone: TYAANI_CONTACTS.whatsapp },
  { id: "delhi-mehrauli", city: "Delhi, Mehrauli", aliases: ["delhi", "new delhi", "mehrauli", "qutub", "kutub"], address: "Kutub Boulevard, Seth Sarai, Mehrauli, New Delhi 110030", hours: "Tue–Sun 11:00 am–7:00 pm", phone: "+91 82913 45290" },
  { id: "hyderabad", city: "Hyderabad, Jubilee Hills", aliases: ["hyderabad", "hyd", "jubilee hills", "jubilee"], address: "Pillar No. 1649, Road No. 36, Jubilee Hills, Hyderabad, Telangana 500033", hours: "Mon–Sat 11:30 am–8:00 pm", phone: "+91 96523 70235" },
  { id: "bengaluru", city: "Bengaluru, Dickenson Road", aliases: ["bengaluru", "bangalore", "blr", "dickenson", "shivaji nagar"], address: "27/3, Dickenson Road, Shivaji Nagar, Bengaluru, Karnataka 560042", hours: "Mon–Sun 11:00 am–7:30 pm", phone: "+91 82919 26979" },
  { id: "chandigarh", city: "Chandigarh, Sector 17C", aliases: ["chandigarh", "sector 17", "17c", "bridge market"], address: "SCO 131–132, Bridge Market, 17C, Sector 17, Chandigarh 160017", hours: "Mon–Sun 11:00 am–8:00 pm", phone: "+91 82916 06279" },
  { id: "pune", city: "Pune, Kalyani Nagar", aliases: ["pune", "kalyani nagar", "mulik"], address: "G.F. Shop No. 1, East Ave Pillar-391, Near Mulik Palace, Kalyani Nagar, Pune 411014", hours: "Mon–Sun 11:30 am–7:30 pm", phone: "+91 84228 47678" },
  { id: "lucknow", city: "Lucknow, Hazratganj", aliases: ["lucknow", "hazratganj", "saharaganj"], address: "G.F. 1-B & 1C, Shahnajaf Rd, opp. Saharaganj Mall, Hazratganj, Lucknow 226001", hours: "Mon–Sun 11:30 am–7:30 pm", phone: "+91 96196 74085" },
  { id: "ahmedabad", city: "Ahmedabad", aliases: ["ahmedabad", "amdavad", "sindhu bhavan"], address: "Shop No. 9, Abhinit Square, Sindhu Bhavan Marg, Opp Taj Skyline, Ahmedabad, Gujarat", hours: "Mon–Sun 11:00 am–7:00 pm", phone: "+91 96198 58967" },
  { id: "kolkata", city: "Kolkata, Elgin Road", aliases: ["kolkata", "calcutta", "elgin", "woodburn"], address: "4, Woodburn Park Road, Elgin Rd, Kolkata, West Bengal 700020", hours: "Mon–Sun 11:00 am–8:00 pm", phone: "+91 84228 34581" },
  { id: "jalandhar", city: "Jalandhar", aliases: ["jalandhar", "jawahar nagar"], address: "Central Arc Building, New Jawahar Nagar, Jalandhar, Punjab 144001", hours: "Mon–Sat 11:00 am–8:00 pm", phone: "+91 82915 00394" },
  { id: "surat", city: "Surat, Ghod Dod Road", aliases: ["surat", "ghod dod"], address: "Dasani Plaza, Opp. Sarela Shopping Center, Ghod Dod Rd, Surat, Gujarat 395001", hours: "Mon–Sun 11:00 am–8:00 pm", phone: "+91 96197 46253" },
  { id: "jammu", city: "Jammu, Channi Himat", aliases: ["jammu", "channi himat"], address: "Channi Himat, Jammu, Jammu and Kashmir 180015", hours: "Mon–Sun 11:00 am–8:00 pm", phone: "+91 96193 87006" },
];

export const TYAANI_QA = [
  { section: "guidelines", q: "What must the agent never invent?", a: "Never invent product prices, stock, delivery dates, discounts, certifications, or store availability. Use the live catalog for names and INR. Use this official knowledge for policies. Website-wide information can change — product-page specs win for a named piece." },
  { section: "brand", q: "What is Tyaani?", a: "Tyaani Jewellery is a Karan Johar brand of fine 22KT/18KT gold Polki jewellery, crafted with certified natural uncut diamonds (Polkis). It is the Pret collection — traditionally uber-luxury Jadau made more accessible, lightweight, and wearable. Every piece is handcrafted, quality-checked, and comes with an in-house certificate of authenticity. Official channels only: tyaani.com, Tyaani stores, and verified @tyaanijewellery social handles." },
  { section: "founder", q: "Who founded Tyaani?", a: "Tyaani was founded by Bollywood filmmaker Karan Johar — producer, director, writer, and talk-show host — who brings his design sensibility to heritage jewellery that is wearable every day, not only at weddings." },
  { section: "products", q: "What jewellery does Tyaani sell?", a: "22KT/18KT gold Polki, diamond jewellery, and gemstone jewellery (emerald, ruby, sapphire, tanzanite, morganite, rose quartz, pearls). Types: necklaces (beaded chokers, pendants, Polki chokers, U and long necklaces), earrings (chandbalis, jhumkas, long earrings, tops), bangles, maang tikkas, rings, bracelets, and jewellery sets. Occasions: bridal, daily wear, statement/party, festive, and gifting." },
  { section: "polki", q: "What is Polki jewellery?", a: "Polki uses natural uncut diamonds left in their raw, non-faceted form. Only a small fraction of diamonds have the right character to be Polki. Polki is not Kundan: Kundan uses glass stones; Polki uses real uncut diamonds. Tyaani sources certified Syndicate-grade Polki (finer than Zimbabwe or Kilwas). Natural inclusions and cloudiness are expected and a mark of authenticity, not a defect." },
  { section: "materials", q: "What materials does Tyaani use?", a: "Hallmarked 22KT gold (traditional Polki/Jadau) and hallmarked 18KT gold (select bridal and contemporary / daily wear). Motifs are always 22KT or 18KT gold. Earring stems and push-backs/screw-backs are 18KT. Some structural, non-visible parts use brass (links, clasps with micro gold plating, micro-plated brass wires for pearls/stones) because 22KT is soft. Exact specs can be shared on request. Materials are described as ethically sourced." },
  { section: "lightweight", q: "Why is Tyaani jewellery lightweight?", a: "A proprietary technique keeps pieces lightweight while retaining the required gold quantity. Material weight is estimated before manufacturing; it is close, not always 100% exact." },
  { section: "handmade", q: "Is Tyaani jewellery handmade and certified?", a: "Yes. Every piece is handcrafted by skilled karigars using Jadau and modern finishing. Real hallmarked 18KT/22KT gold and natural Syndicate Polki. In-house certificate of authenticity after quality checks. Handmade pieces and natural stones can vary slightly from photos — that is normal, not a defect." },
  { section: "care", q: "How do I care for Polki Jadau jewellery?", a: "Store each piece separately in a soft pouch, away from sun, humidity, and heat. Wear after perfume, hairspray, and makeup. Do not swim, bathe, exercise, or sleep in it. Never soak it or use ultrasonic/chemical cleaners. Wipe with a soft dry cloth. Hold the metal, not the stones. Get it checked by a Polki specialist every couple of years if worn often." },
  { section: "bridal", q: "Is Tyaani only for brides?", a: "No. Bridal and festive sets are a signature, but Tyaani also has daily wear, minimal, and party jewellery. You do not need to be a bride to shop." },
  { section: "customize", q: "Can I customize a Tyaani design?", a: "Yes — gemstone colour and sizing. Simple tweaks: WhatsApp the team. Full custom bridal: visit or connect with a store; digital orders go through an online selling representative. Confirm cost and timeline with the team. Do not invent a price or date." },
  { section: "gift", q: "Can I add a gift message?", a: "Yes. Website checkout has a comments box. In store, ask the store team." },
  { section: "soldout", q: "A piece I liked is gone from the site. Can I still order it?", a: "Often yes — sold-out styles are delisted quickly but can usually still be made. Share a screenshot or description on WhatsApp and the team will check." },
  { section: "packaging", q: "How is my order packaged?", a: "Tamper-proof outer pack, exclusive Tyaani gift box, and certificates. A packing video is sent before shipping. Check the parcel matches that video and record while unboxing." },
  { section: "voucher", q: "Is a Tyaani gift voucher refundable for cash?", a: "No. Vouchers cannot be exchanged for cash, credit, or any other refund. They can only be used toward a jewellery purchase." },
  { section: "shipping", q: "What is Tyaani shipping and delivery?", a: "Free shipping within India. International: all orders ship from India. Free international shipping above INR 2,00,000; below that, shipping is INR 11,000 and destination duties/taxes are paid by the customer. Made-to-order dispatch is 3–4 weeks. Ready-to-ship is typically 4–5 days; some pieces ship within 96 hours. Dates are estimates only. Signature and ID may be required on delivery (India: PAN; NRI: driving licence or passport). Once dispatched, an order cannot be redirected." },
  { section: "international", q: "Do you ship internationally? What duties apply?", a: `Yes, from India. Free shipping above INR 2,00,000 (USA has free shipping on any order amount — see ${TYAANI_WEBSITE}/pages/free-shipping-to-usa). Under INR 2,00,000: INR 11,000 shipping. Duties/taxes are extra and paid by the recipient. Approximate combined rates can change — confirm with local customs. International payments are in USD only; Indian-issued cards are not accepted for international orders.` },
  { section: "pincode", q: "Do you ship to my pincode?", a: `Generally across India if the courier covers that pin. Share the pincode on WhatsApp ${TYAANI_CONTACTS.whatsapp} or email ${TYAANI_EMAIL} to confirm or arrange an alternate drop point.` },
  { section: "address", q: "Can I change my shipping address?", a: `Not after dispatch. If it has not shipped, WhatsApp ${TYAANI_CONTACTS.whatsapp} or email ${TYAANI_EMAIL} with the order number immediately.` },
  { section: "track", q: "How do I track my order?", a: "India: https://track2.bvclogistics.com/ShipmentTracking?Type=Valship — Outside India: https://www.ups.com/track — Account: https://tyaani.com/account/login" },
  { section: "returns", q: "What is the return and exchange policy?", a: `Returns are not offered for change of mind — pieces are handcrafted after the order. Exception: damaged in transit or wrong design, exchange within one week of delivery. Contact ${TYAANI_EMAIL} or ${TYAANI_CONTACTS.returns} (${TYAANI_CONTACTS.returnsHours}).` },
  { section: "cancel", q: "Can I cancel my order?", a: "Once an order is placed with an advance or full payment, it cannot be cancelled. Tyaani issues a gift voucher of equivalent value toward another style. Ask a Tyaani stylist to arrange it." },
  { section: "buyback", q: "What is the exchange and buyback value?", a: "Exchange / return value: Gold 100% at actual gold rate; cut diamonds 100% of invoice; Polki (uncut) 80%; making charges 0%; coloured stones 60%; GST as per law. Cash refund / buyback: Gold 100% at actual gold rate; cut diamonds 85%; Polki 70%; making 0%; coloured stones 40%. Gold rate increase since purchase is accounted for on resale/exchange." },
  { section: "payment", q: "What payment methods and EMI?", a: `Major cards, net banking, and listed gateways — confirm on ${TYAANI_CONTACTS.whatsapp}. Full payment is due within 60 days of the piece being ready and approved; after 60 days a 30% restocking fee is deducted. Once ready, balance is due within 7 working days or the price may be recalculated at the prevailing gold rate.` },
  { section: "stores", q: "Does Tyaani have physical stores?", a: `Yes, 12+ stores across India: Mumbai (Bandra and Santacruz), Delhi, Hyderabad, Bengaluru, Chandigarh, Pune, Lucknow, Ahmedabad, Kolkata, Jalandhar, Surat, and Jammu. Full list: ${TYAANI_STORES_PAGE}. Book an appointment via the WhatsApp link on that page or call the store. Ask which city they are in before quoting one address.` },
  { section: "stylist", q: "Do you offer video-call shopping or a personal stylist?", a: `Yes. Shop via Video Call and Connect a Personal Stylist are on WhatsApp ${TYAANI_CONTACTS.whatsapp}.` },
  { section: "franchise", q: "Does Tyaani offer franchise opportunities?", a: `Yes — ${TYAANI_WEBSITE}/pages/tyaani-franchise-registration` },
  { section: "genuine", q: "Where can I buy genuine Tyaani?", a: "Only official channels guarantee authenticity: tyaani.com, Tyaani's own stores, and verified @tyaanijewellery handles. Treat marketplace or social resellers as unofficial unless verified with the brand. Ask for the in-house certificate." },
];

export function tyaaniFactsBlock() {
  const cities = TYAANI_OFFICIAL_STORES.map((s) => s.city).join("; ");
  return `TYAANI OFFICIAL FACTS (must quote these for policy / brand / stores — do not invent):
Brand: Tyaani Jewellery, a Karan Johar brand. Pret Polki / Jadau in hallmarked 18KT and 22KT gold with certified Syndicate natural uncut diamonds. Lightweight proprietary technique. In-house authenticity certificate. Official: ${TYAANI_WEBSITE}, own stores, @tyaanijewellery.
Central WhatsApp / stylist / video call: ${TYAANI_CONTACTS.whatsapp}
Email: ${TYAANI_EMAIL}
Returns / damaged or wrong item: ${TYAANI_CONTACTS.returns} (${TYAANI_CONTACTS.returnsHours}) or ${TYAANI_EMAIL}
Stores (${TYAANI_OFFICIAL_STORES.length}): ${cities}. Page: ${TYAANI_STORES_PAGE}
Shipping: Free in India. Intl from India. Free intl above INR 2,00,000 (USA free any amount). Else intl shipping INR 11,000. Duties/taxes extra, paid by customer. MTO dispatch 3–4 weeks. Ready-to-ship 4–5 days / some 96 hours. Estimates only. No redirect after dispatch.
Returns: No change-of-mind returns. Damaged/wrong item: exchange within 1 week.
Cancel: cannot cancel after payment; gift voucher of same value instead. Vouchers are not cash-refundable.
Buyback/exchange: quote the official % table only (gold 100% at live gold rate; making 0%; Polki exchange 80% / cash 70%).
Polki ≠ Kundan (Kundan is glass). Inclusions in Polki are normal.
Never invent prices, stock, delivery dates, discounts, or certifications. Catalog rows are the only product/price truth.`;
}

export function wantsCorrection(message) {
  return /\b(wrong|incorrect|galat|that's not|thats not|not true|you are wrong|mistake|update (the )?(answer|kb)|fix (this|that))\b/i.test(String(message || ""));
}

export function isPolicyAsk(message) {
  return /\b(return|refund|exchange|buyback|ship|shipping|delivery|dispatch|store|stores|shop|address|hours|polki|kundan|voucher|cancel|duty|duties|customs|emi|track|care|clean|certificate|hallmark|franchise|stylist|video call|customize|custom|gift message|pincode|pin code|international|usa|packaging|genuine|authentic|lightweight|founder|karan|id proof|pan)\b/i.test(String(message || ""));
}

export function matchOfficialAnswer(message) {
  const q = String(message || "").toLowerCase();
  if (!q.trim()) return null;
  const rules = [
    { test: /return|refund|change of mind|galat (item|piece)|damage/, section: "returns" },
    { test: /cancel/, section: "cancel" },
    { test: /voucher|gift card/, section: "voucher" },
    { test: /buyback|resell|exchange value|gold appreciation/, section: "buyback" },
    { test: /track|tracking|awb/, section: "track" },
    { test: /international|abroad|usa|uk|dut(y|ies)|customs/, section: "international" },
    { test: /pincode|pin code|serviceable/, section: "pincode" },
    { test: /address change|change.*address|redirect/, section: "address" },
    { test: /deliver|ship|dispatch|how long|kitne din|ready.to.ship|made.to.order/, section: "shipping" },
    { test: /store|stores|shop|boutique|nearest|visit|location|address|hours|timing|branch/, section: "stores" },
    { test: /polki|kundan|uncut/, section: "polki" },
    { test: /care|clean|store (it|jewellery)|ultrasonic/, section: "care" },
    { test: /customi[sz]|resize|stone change/, section: "customize" },
    { test: /gift message/, section: "gift" },
    { test: /sold out|can't find|cant find|not on (the )?site|screenshot/, section: "soldout" },
    { test: /packag|unbox|gift box/, section: "packaging" },
    { test: /emi|installment|pay in|payment|usd/, section: "payment" },
    { test: /video call|stylist/, section: "stylist" },
    { test: /franchise/, section: "franchise" },
    { test: /genuine|authentic|real|certificate|hallmark/, section: "genuine" },
    { test: /lightweight|heavy/, section: "lightweight" },
    { test: /founder|karan johar|who (started|founded)/, section: "founder" },
    { test: /only for bride|bridal only/, section: "bridal" },
    { test: /what (do you sell|jewellery)|categories/, section: "products" },
    { test: /material|18kt|22kt|brass|gold/, section: "materials" },
    { test: /what is tyaani|about tyaani|brand/, section: "brand" },
  ];
  for (const rule of rules) {
    if (rule.test.test(q)) {
      const row = TYAANI_QA.find((item) => item.section === rule.section);
      if (row) return row.a;
    }
  }
  return null;
}

export function officialFollowUp(settings) {
  return settings?.nudgeMessage
    || "Just checking in — I can help with a design, a price, a store visit, or shipping. What would you like next?";
}

export async function seedOfficialTyaaniKb() {
  const { KBChunk } = await import("../models/KBChunk.js");
  const existing = await KBChunk.count({ where: { sourceDoc: "tyaani-official-kb" } });
  if (existing === TYAANI_QA.length) return existing;
  await KBChunk.destroy({ where: { sourceDoc: "tyaani-official-kb" } });
  for (const row of TYAANI_QA) {
    await KBChunk.create({
      sourceDoc: "tyaani-official-kb",
      section: row.section,
      type: "qa",
      question: row.q,
      content: row.a,
    });
  }
  return TYAANI_QA.length;
}
