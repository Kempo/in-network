from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
load_dotenv("../.env")
from app.agents.browser_use import run_browser_use
from app.schemas import BrowserUseInput

app = FastAPI()
REGISTRY = {"browser_use": (BrowserUseInput, run_browser_use)}


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/agents/{name}")
async def run_agent(name: str, payload: dict):
    if name not in REGISTRY:
        raise HTTPException(status_code=404, detail=f"unknown agent: {name}")
    input_model, runner = REGISTRY[name]
    result = await runner(input_model(**payload))
    return result.model_dump()
