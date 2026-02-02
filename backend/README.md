# Witchs Cauldron Backend

FastAPI backend service for Chzzk clip collection using Selenium.

## Features

- **Clip Collection**: Automatically collect clips from Chzzk platform
- **Headless Selenium**: Runs in Docker with Chromium
- **Background Jobs**: Async clip collection with progress tracking
- **REST API**: Full CRUD operations for clips

## Quick Start

### With Docker (Recommended)

```bash
# From project root
docker-compose up -d backend
```

### Local Development

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check with Selenium status |
| GET | `/api/clips` | List all clips |
| GET | `/api/clips/{id}` | Get specific clip |
| POST | `/api/clips/collect` | Start clip collection job |
| DELETE | `/api/clips/{id}` | Delete a clip |
| GET | `/api/jobs/{id}` | Get job status |
| GET | `/api/jobs` | List recent jobs |

## API Documentation

- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

## Environment Variables

See `.env.example` for all configuration options.

## Architecture

```
app/
├── main.py              # FastAPI app entry
├── config.py            # Settings (pydantic-settings)
├── api/
│   ├── router.py        # Main router
│   └── endpoints/       # API endpoints
├── schemas/             # Pydantic models
├── services/            # Business logic
│   ├── clip_collector.py   # Selenium collector
│   ├── file_manager.py     # File operations
│   └── job_manager.py      # Background jobs
└── core/
    └── selenium_driver.py  # WebDriver factory
```

## Collecting Clips

```bash
# Start collection (5 clips, popular order)
curl -X POST http://localhost:8000/api/clips/collect \
  -H "Content-Type: application/json" \
  -d '{"max_clips": 5, "filter_type": "ALL", "order_type": "POPULAR"}'

# Check job status
curl http://localhost:8000/api/jobs/{job_id}

# List collected clips
curl http://localhost:8000/api/clips
```

## Notes

- Clip collection takes ~30-40 seconds per clip
- Minimum 1GB RAM recommended for Selenium
- Clips are saved to `/app/shared/clips` (Docker volume)
