# In-Network

Welcome to **In-Network**, an MCP server that enables agents to check whether a physician you want to see is in-network with your health insurance.

## Demo

WIP

## Pre-requisites

Before running `npm run setup`, make sure you have these installed:

| Tool | Why it's needed | Install |
| --- | --- | --- |
| **Node.js 24** (with npm) | Runs the MCP server, the API, and `npm run setup` itself. | [nodejs.org](https://nodejs.org) or `brew install node` |
| **Docker + Docker Compose** | Runs the Postgres database. | [OrbStack](https://orbstack.dev) (lighter, recommended) or [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| **uv** | Python package manager for the browser agent (pulls Python 3.11+ for you). | `brew install uv` or [astral.sh/uv](https://docs.astral.sh/uv/getting-started/installation/) |

Create your local env file `.env` following the `.env.example`.

The app reads its config from `.env`. The defaults work out of the box — the only thing you *must* set yourself is `ANTHROPIC_API_KEY`:

| Variable | What it's for | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | **Required.** Your Anthropic key for parsing + browsing. Get one at [console.anthropic.com](https://console.anthropic.com). | _(empty — you fill this in)_ |
| `LLM_PROVIDER` | Which LLM provider to use. | `anthropic` |
| `LLM_MODEL` | Which model to use. | `claude-sonnet-4-6` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Credentials for the Postgres Docker container. | `postgres` / `postgres` / `in_network` |
| `DATABASE_URL` | Connection string the API uses to reach Postgres. | `postgresql://postgres:postgres@localhost:5432/in_network` |
| `API_PORT` / `AGENT_PORT` | Ports for the API (Hono) and agent (FastAPI). | `3000` / `8000` |
| `API_URL` / `AGENT_URL` | Where the services find each other. | `http://localhost:3000` / `http://localhost:8000` |

## Running the app locally

Install project dependencies with:
```
npm run setup
```

After that runs, you can run the entire app here:
```
npm run dev
```

## Architecture

```mermaid
flowchart TD
    client["MCP Client<br/>(e.g. Claude)"]

    subgraph mcp["MCP Server (mcp/, stdio) — in-network-mcp"]
        t1["find_carrier / find_plan"]
        t2["find_provider / save_provider"]
        t3["check_provider_plan"]
        t4["search_provider / get_search_status"]
    end

    subgraph api["API (apps/api, Hono :3000)"]
        r1["GET /carriers · /plans"]
        r2["GET/POST /providers"]
        r3["GET /verify<br/>(cache, 3-day TTL)"]
        r4["POST /providers/explore<br/>GET /providers/explore/:runId"]
    end

    subgraph agent["Agent (apps/agent, FastAPI :8000)"]
        bu["browser_use agent"]
        chromium["Chromium<br/>(Playwright)"]
    end

    db[("Postgres<br/>carriers, networks, plans, providers,<br/>addresses, memberships, agent_runs")]
    npi["CMS NPI registry (api)"]
    directory["Carrier provider<br/>directory (web)"]

    client --> t1 & t2 & t3 & t4
    t1 --> r1
    t2 --> r2
    t3 --> r3
    t4 --> r4
    r2 -->|no local match| npi
    r4 -->|spawn run| bu
    bu --> chromium
    chromium -->|browse| directory
    bu -->|structured findings| r4
    r1 & r2 & r3 & r4 -->|read/write| db
```

## Database

The data is stored in **Postgres** (managed via Drizzle). Design notes:

- **Coverage lives on memberships, not plans.** A provider's participation in a plan/network is what determines coverage. Plans and networks don't carry geography — only providers have addresses.
- **Network-level vs. plan-specific.** A `null` `plan_id` on a membership means the provider accepts *all* plans under that network; a set `plan_id` scopes coverage to one plan.
- **Cache with TTL.** Memberships go stale after 3 days and are re-fetched (via the browser agent) on the next lookup.
- **Agent runs are a clean boundary.** They track each agent execution (e.g. browser-use) separately from business logic, so "querying a browser" stays decoupled from "verifying provider participation."

### Tables

| Table | Key columns | Notes |
| --- | --- | --- |
| `carriers` | `name` | Insurance carriers. |
| `networks` | `title`, `carrier_id` | A carrier's network. |
| `plans` | `title`, `carrier_id`, `network_id` | `network_id` is the plan's primary network. |
| `providers` | `name`, `specialty`, `npi`, `address_id` | Healthcare providers/facilities. |
| `addresses` | `line1`, `line2`, `zip`, `locality`, `state`, `country` | Provider addresses. |
| `provider_directories` | `carrier_id`, `url`, `instructions` | Where/how to browse a carrier's directory. |
| `network_memberships` | `status`, `plan_id` (nullable), `provider_id`, `network_id`, `refreshed_at` | The coverage cache. Unique on `(provider, network, plan)`. |
| `agent_runs` | `status`, `prompt`, `result`, `error` | Log of agent executions; references no domain tables. |

