import os


def make_llm():
    provider = os.getenv("LLM_PROVIDER", "anthropic")
    model = os.getenv("LLM_MODEL", "claude-sonnet-4-6")
    if provider == "anthropic":
        from browser_use import ChatAnthropic
        return ChatAnthropic(model=model)
    raise ValueError(f"Unknown LLM_PROVIDER: {provider}")
