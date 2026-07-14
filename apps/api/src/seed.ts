import { db, pool } from "./db/client.js";
import {
  carriers,
  networks,
  plans,
  providers,
  providerDirectories,
  addresses,
  networkMemberships,
} from "./db/schema.js";

async function main() {
  // ---- Health Net of California ----
  const [hn] = await db.insert(carriers).values({ name: "Health Net of California" }).returning();
  await db.insert(providerDirectories).values({
    carrierId: hn.id,
    url: "https://findaprovider.healthnetcalifornia.com/location",
    instructions:
      "Enter the location and confirm by clicking the dropdown result. Then click select your plan. " +
      "Find the network that matches and continue. Now, search by provider name and " +
      "click Enter to send the search. If there is result card matches the " +
      "provider name, open it and read whether it participates in the requested network/plan. If the results have no " +
      "matching name, return out_of_network.",
  });
  // The site's "Select a network" dropdown — each option is a network.
  const hnNetworks = await db
    .insert(networks)
    .values(
      [
        "Aon Northern California HMO (In Network Only)",
        "Aon Northern California PPO (In & Out-of-Network)",
        "Aon Southern California PPO (In & Out-of-Network)",
        "Blue and Gold HMO",
        "HMO - CanopyCare",
        "HMO - ExcelCare Network Medicare COB",
        "HMO - ExcelCare Network Medicare COB (with walk-in-clinics)",
        "HMO - ExcelCare Small Group/Large Group",
        "HMO - ExcelCare Small Group/Large Group (with walk-in-clinic)",
        "HMO - Full HMO (FEHB Northern CA)",
        "HMO - Full Network Large Group",
        "HMO - Full Network Small Group (Platinum, Gold, Silver, GF Plans)",
        "HMO - Medicare COB",
        "HMO - SmartCare Network Large Group",
        "HMO - SmartCare Network Large Group (with walk-in-clinics)",
        "HMO - WholeCare Small Group (Platinum, Gold, Silver)",
        "POS - Elect Large Group (tier 1)",
        "POS - Elect Large Group (tier 2)",
        "POS - Elect Medicare COB (tier 1)",
        "POS - Elect Medicare COB (tier 2)",
        "POS - Elect Open Access ExcelCare Small Group/Large Group (tier 1)",
        "POS - Elect Open Access ExcelCare Small Group/Large Group (tier 2)",
        "POS - Elect Open Access Medicare COB (tier 1)",
        "POS - Elect Open Access Medicare COB (tier 2)",
        "POS - Elect Open Access Small Group/Large Group (tier 1)",
        "POS - Elect Open Access Small Group/Large Group (tier 2)",
        "POS - Elect Open Access Small Group/Large Group (with walk-in clinic) (tier 1)",
        "POS - Elect Open Access Small Group/Large Group (with walk-in clinic) (tier 2)",
        "POS - Medicare COB (tier 1)",
        "POS - Medicare COB (tier 2)",
        "POS - Select Medicare COB (tier 1)",
        "POS - Select Medicare COB (tier 2)",
        "POS - Select Small Group/Large Group (tier 1)",
        "POS - Select Small Group/Large Group (tier 2)",
        "PPO - Large Group/Small Group (Platinum, Gold, Silver, Bronze, GF Plans, HSA Compatible, HDHP)",
        "Seniority Plus (Employer HMO)",
        "Seniority Plus (Employer HMO) - No Pharmacy",
        "Wellcare Dual Liberty (HMO D-SNP)",
        "Wellcare Low Premium (HMO)",
        "Wellcare Low Premium (HMO) - San Francisco",
        "Wellcare Specialty Simple Focus (HMO C-SNP)",
      ].map((title) => ({ title, carrierId: hn.id })),
    )
    .returning();
  // Derive plans from the metal tiers listed in a network's parentheses, e.g.
  // "... (Platinum, Gold, Silver)" -> Platinum / Gold / Silver. Networks without a
  // tier list get a single plan whose title mirrors the network.
  const TIER_TOKENS = new Set([
    "Platinum",
    "Gold",
    "Silver",
    "Bronze",
    "GF Plans",
    "HSA Compatible",
    "HDHP",
  ]);
  const hnPlanRows = hnNetworks.flatMap((net) => {
    const paren = net.title.match(/\(([^)]*)\)/);
    const parts = paren ? paren[1].split(",").map((s) => s.trim()) : [];
    const titles = parts.length && parts.every((p) => TIER_TOKENS.has(p)) ? parts : [net.title];
    return titles.map((title) => ({ title, carrierId: hn.id, networkId: net.id }));
  });
  await db.insert(plans).values(hnPlanRows);
  // Keep the colloquial WholeCare plan name used elsewhere for lookups.
  const hnWholeCare = hnNetworks.find(
    (n) => n.title === "HMO - WholeCare Small Group (Platinum, Gold, Silver)",
  )!;
  await db
    .insert(plans)
    .values({ title: "Health Net WholeCare HMO", carrierId: hn.id, networkId: hnWholeCare.id });

  console.log("seeded 1 carrier (Health Net CA)");
  await pool.end();
}

main();
