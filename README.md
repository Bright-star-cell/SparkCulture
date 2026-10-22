# SparkCulture

SparkCulture discovers cross-vertical partnership ideas from Qloo's taste graph. The Next.js client calls a FastAPI service; only the backend communicates with Qloo and holds `QLOO_API_KEY`.

## Run in Codespaces

1. Reopen the repository in the configured dev container.
2. Copy `backend/.env.example` to `backend/.env` and add your hackathon `QLOO_API_KEY`.
3. Start the backend and frontend in separate terminals:

   ```bash
   cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

   ```bash
   cd frontend && npm run dev
   ```

4. Open forwarded port 3000. The API listens on port 8000.

The API accepts `title`, `vertical`, and an optional `description` at `POST /api/analyze-ip`. The browser calls a same-origin Next.js rewrite, which forwards API requests to FastAPI at `BACKEND_INTERNAL_URL` (default `http://127.0.0.1:8000`). Supported source verticals are `video_game`, `movie`, `tv_show`, `podcast`, `artist`, `brand`, and `book`. When a description is supplied, its tags are resolved through Qloo before cross-vertical affinity queries. Pro forma amounts are explicit planning assumptions, not Qloo data or a financial forecast.

Set `FRONTEND_ORIGIN` to the frontend's browser origin when deploying. Both Qloo base URL environment variables are intentionally restricted to the hackathon host.
