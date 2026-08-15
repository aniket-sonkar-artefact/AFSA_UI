# AFSA Platform — Angular Frontend

Angular port of the AFSA Pilot Demo Figma design, using mock data throughout (no backend calls yet).

## Getting started

```bash
npm install
npm start        # ng serve, http://localhost:4200
```

## Build

```bash
npm run build
```

## Project structure

```
src/
  environments/            environment.ts / environment.prod.ts (apiUrl placeholder, useMockData flag)
  app/
    core/
      models/               TypeScript interfaces for all domain data
      services/              Injectable services, mock data + RxJS Observables (auth.service.ts, etc.)
      guards/                auth.guard.ts — redirects to /login when not authenticated
    layout/                 Sidebar + top context bar shell (wraps all authenticated routes)
    shared/                 Reusable icon + logo-badge components
    screens/
      login/                Team selection / mock sign-in
      overview/             Dashboard KPIs, capability cards, "Requires Attention" feed
      submission-review/    Completeness / Irregularities / CoA Mapping tabs
      compliance/           IFRS note review + on-demand compliance check
      variance/             Group variance analysis table
      integrity/            Cross-reference + footing/subfooting checks
      reports/              Generated report list with filters
    app.routes.ts           Route table (lazy-loaded standalone components)
```

## Notes

- No Tailwind — plain component-scoped CSS, with global design tokens (colors, glass effects, animations)
  ported 1:1 from the original Figma export's `index.css` into `src/styles.css`.
- All services simulate real API calls (`Observable` + `delay()`) using mock data, matching how the
  service layer will look once wired to a real backend — swap the `of(...)` bodies for `HttpClient` calls
  to `environment.apiUrl` when ready.
- `auth.service.ts` returns the current user's `id`, `name`, `email`, and `role` — the `role` field is
  ready to drive role-based UI/access decisions later.

## Deploying to GCP (Docker + Cloud Run)

The app ships with a multi-stage `Dockerfile` (Node build stage → nginx serve stage) and an `nginx.conf`
tuned for a single-page app (client-side route fallback, gzip, long-cache on hashed assets, no-cache on
`index.html` so deploys are picked up immediately).

**Build and run locally:**

```bash
docker build -t afsa-platform .
docker run -p 8080:8080 afsa-platform
# open http://localhost:8080
```

**Deploy to Cloud Run (recommended — serverless, scales to zero, no cluster to manage):**

Option A — one-shot script (requires `gcloud` + `docker` installed locally, already authenticated):

```bash
PROJECT_ID=your-gcp-project-id ./deploy.sh
```

This creates an Artifact Registry repo if needed, builds and pushes the image, and deploys to Cloud Run.

Option B — manual steps:

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable artifactregistry.googleapis.com run.googleapis.com

gcloud artifacts repositories create afsa-platform-repo \
  --repository-format=docker --location=us-central1

gcloud auth configure-docker us-central1-docker.pkg.dev

docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/afsa-platform-repo/afsa-platform:latest .
docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/afsa-platform-repo/afsa-platform:latest

gcloud run deploy afsa-platform \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/afsa-platform-repo/afsa-platform:latest \
  --region=us-central1 --port=8080 --allow-unauthenticated
```

Option C — CI/CD via Cloud Build: `cloudbuild.yaml` is included. Connect this repo to Cloud Build
triggers (GitHub/Cloud Source Repositories) and every push will build, push, and redeploy automatically.
Run manually with:

```bash
gcloud builds submit --config=cloudbuild.yaml
```

**Other GCP options**, if Cloud Run isn't the right fit:
- **GKE** — same Docker image works as-is; wrap it in a Deployment + Service (or Ingress) manifest.
- **Compute Engine (Container-Optimized OS)** — run the same image directly with `docker run` on a VM.
- **Firebase Hosting / GCS + Cloud CDN** — since this is a pure static SPA build, you don't strictly need
  a container at all for these; `dist/afsa-platform/browser` can be deployed directly. Worth considering
  if you don't need server-side logic and want the cheapest/simplest static hosting.

**Once you have a real backend:** set `apiUrl` in `environment.prod.ts` to your API's URL before building
the image (or pass it in at build time), and make sure your backend's CORS policy allows the Cloud Run
service's domain.