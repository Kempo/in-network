from browser_use import Agent, BrowserSession, BrowserProfile, Tools
from browser_use.tools.views import ScrollAction
from fastapi import HTTPException
from app.llm import make_llm
from app.schemas import BrowserUseInput, Findings

MAX_SCROLL_PAGES = 2.0  # clamp: big page jumps overshoot past results to the footer


def _make_tools() -> Tools:
    """Default browser-use tools, but with `scroll` clamped to <=2 pages so the agent
    can't leap 5-10 pages and overshoot the results list (the biggest time-sink we saw).
    Keeps the `index` param (scroll within a dropdown/modal); scroll_to_text stays
    available for precise jumps. Re-registering `scroll` overwrites the default."""
    tools = Tools()
    original_scroll = tools.registry.registry.actions["scroll"].function

    @tools.registry.action(
        "Scroll by pages (max 2). Prefer scroll_to_text to reach a specific provider or "
        "message; use index to scroll within a dropdown/modal.",
        param_model=ScrollAction,
    )
    async def scroll(params: ScrollAction, browser_session):
        params.pages = min(params.pages, MAX_SCROLL_PAGES)
        return await original_scroll(params=params, browser_session=browser_session)

    return tools


async def run_browser_use(data: BrowserUseInput) -> Findings:
    session = BrowserSession(
        browser_profile=BrowserProfile(
            headless=True,
            viewport={"width": 1400, "height": 850},  # match Claude's LLM screenshot size -> no distorting per-step resize
        )
    )
    agent = Agent(
        task=data.prompt,
        llm=make_llm(),
        fallback_llm=make_llm(),  # retry malformed LLM turns instead of failing the step
        browser_session=session,
        tools=_make_tools(),
        output_model_schema=Findings,
        step_timeout=60,  # per-step wall-clock cap (heavy DOM was timing out at 30s)
    )
    history = await agent.run(max_steps=40)  # cap runaway loops; useful path is ~12 steps
    try:
        findings = history.structured_output
    except Exception:
        # Agent stopped with a non-JSON final result (gave up / timed out): the
        # structured_output property raises on model_validate_json. Treat as undecided.
        findings = None
    if not findings:
        # Fail cleanly (422) instead of crashing on model_validate_json (500).
        raise HTTPException(status_code=422, detail="agent could not determine network status")
    return findings
