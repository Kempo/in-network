export function buildExplorePrompt(p: {
  directoryUrl: string;
  instructions: string;
  planTitle: string;
  location: string;
  descriptor: { name: string; address?: string };
}): string {
  const addr = p.descriptor.address ? ` (${p.descriptor.address})` : "";
  return [
    `Go to ${p.directoryUrl}. ${p.instructions}`,
    `Determine whether provider '${p.descriptor.name}'${addr} participates in the ` +
      `'${p.planTitle}' plan/network.`,
    `Enter this location in the site's location field: ${p.location}.`,
    `Tips for these directory sites:`,
    `- The location fields are usually a dropdown that needs to be selected. Type the ` +
      `location, then press ArrowDown or Enter to reveal the suggestions. Do not wait, re-click, or ` +
      `inspect the DOM hunting for suggestions.`,
    `- Search suggestions are FUZZY - do NOT treat a suggestion as a match on its own. ` +
      `BUT if a suggestion's name is an EXACT match on the provider's last name at/near the ` +
      `searched location, click THAT specific suggestion to open the provider's profile page. ` +
      `Reaching the profile confirms in_network - read the NPI and full address line from it. ` +
      `Do NOT click "View all" when an exact-match suggestion is present.`,
    `- Otherwise run the FULL search: type the name, press Enter, and open the actual ` +
      `results list. Judge the first THREE individual result cards: if a card matches the ` +
      `provider name specifically, return in_network; if the first three clearly have no ` +
      `matching card, return out_of_network and finish. Do NOT look up external registries or ` +
      `try other locations/plans.`,
    `- A site error on the results page (e.g. "We aren't able to complete your search right ` +
      `now") is NOT a "no results" answer. Wait briefly and retry the search ONCE. If it still ` +
      `errors, return status inconclusive - never guess out_of_network from an error page.`,
    `- Never run the same check twice: if a search, filter, or search_page returns a ` +
      `result, act on it or conclude immediately - repeating an identical call returns ` +
      `the same result and wastes steps. If an action did not change the page, try a ` +
      `different approach or conclude.`,
    `- To reach a specific card or message, prefer scroll_to_text over paging. Scroll only ` +
      `~1 page at a time; never hunt by scrolling many pages (you overshoot to the footer).`,
    `Return status in_network, out_of_network, or inconclusive; the provider's confirmed ` +
      `name, NPI, full address line, city, and state; and scope_hint network_level unless the ` +
      `result is clearly plan-specific. If the results list loaded with no matching card, ` +
      `return out_of_network. If the site errored and could not return results after one ` +
      `retry, return inconclusive. Either way include the searched name and the location you used.`,
  ].join("\n");
}
