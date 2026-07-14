from typing import Literal, Optional
from pydantic import BaseModel


class BrowserUseInput(BaseModel):
    prompt: str


class ProviderFinding(BaseModel):
    name: str
    npi: Optional[str] = None
    address: Optional[str] = None  # full address line; only known when a profile was opened (in_network)
    city: str
    state: str


class Findings(BaseModel):
    status: Literal["in_network", "out_of_network", "inconclusive"]
    provider: ProviderFinding
    scope_hint: Literal["network_level", "plan_specific"]
