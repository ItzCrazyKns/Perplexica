# Vane Helm Chart

A Helm chart to deploy [Vane](https://github.com/ItzCrazyKns/Vane) — a
privacy-focused AI answering engine — on Kubernetes.

The chart ships both official images through a single `variant` switch:

| `variant` | Image                              | SearXNG                                              |
| --------- | ---------------------------------- | ---------------------------------------------------- |
| `full`    | `itzcrazykns1337/vane:latest`      | Bundled inside the image (no extra setup)            |
| `slim`    | `itzcrazykns1337/vane:slim-latest` | External — deployed by this chart or provided by you |

## Prerequisites

- Kubernetes 1.19+
- Helm 3.x
- A default `StorageClass` (or set `persistence.*.storageClass`) for the
  persistent volumes that hold Vane's config, database and uploads.

## Installing

From a checkout of the repository:

```bash
# Full image (Vane + bundled SearXNG) — the recommended default
helm install vane ./charts/vane

# Slim image, letting the chart deploy SearXNG for you
helm install vane ./charts/vane \
  --set variant=slim \
  --set searxng.deploy=true

# Slim image, using an existing SearXNG instance
helm install vane ./charts/vane \
  --set variant=slim \
  --set searxng.deploy=false \
  --set searxng.url=http://my-searxng.example.com:8080
```

After the pod is ready, port-forward (or use your Ingress) and finish setup in
the UI — API keys, models and, if needed, the search backend URL:

```bash
kubectl port-forward svc/vane 3000:3000
# open http://127.0.0.1:3000
```

## Choosing a variant

- **`full` (default)** — `itzcrazykns1337/vane:latest` bundles SearXNG in the
  same container. It is the simplest option and mirrors the recommended Docker
  setup. `searxng.*` values are ignored.
- **`slim`** — `itzcrazykns1337/vane:slim-latest` contains only Vane. You must
  provide a SearXNG backend:
  - `searxng.deploy=true` (default for slim): the chart deploys a SearXNG
    `Deployment` + `Service` + `Secret` (configured with JSON format and the
    Wolfram Alpha engine enabled, as Vane requires) and wires
    `SEARXNG_API_URL` automatically.
  - `searxng.deploy=false`: set `searxng.url` to an existing SearXNG instance.
    That instance must have the JSON format and Wolfram Alpha engine enabled.

The image tag is derived from `variant` automatically (`latest` /
`slim-latest`). Override it with `image.tag` to pin a specific release such as
`1.12.2` or `slim-1.12.2`.

## Persistence

Vane keeps its configuration (`config.json`) and history (`db.sqlite`) in
`/home/vane/data`, and uploaded files in `/home/vane/uploads`. Both are backed
by `PersistentVolumeClaim`s by default:

| Volume    | Mount path           | Default size | Value                   |
| --------- | -------------------- | ------------ | ----------------------- |
| `data`    | `/home/vane/data`    | `2Gi`        | `persistence.data.*`    |
| `uploads` | `/home/vane/uploads` | `5Gi`        | `persistence.uploads.*` |

Because the database is a local SQLite file on a `ReadWriteOnce` volume, keep
`replicaCount: 1` (the default) unless you supply a `ReadWriteMany` volume.

## Configuration

The most relevant values (see [`values.yaml`](./values.yaml) for the full list):

| Key                        | Description                                                      | Default                |
| -------------------------- | ---------------------------------------------------------------- | ---------------------- |
| `variant`                  | `full` or `slim`                                                 | `full`                 |
| `image.repository`         | Vane image repository                                            | `itzcrazykns1337/vane` |
| `image.tag`                | Overrides the tag derived from `variant`                         | `''`                   |
| `replicaCount`             | Number of Vane replicas                                          | `1`                    |
| `vane.env`                 | Extra env vars (e.g. provider API keys, `DATA_DIR`)              | `{}`                   |
| `vane.envFrom`             | Extra env vars from existing ConfigMaps/Secrets                  | `[]`                   |
| `searxng.deploy`           | (slim) Deploy an in-cluster SearXNG and wire it automatically    | `true`                 |
| `searxng.url`              | (slim) External SearXNG URL, used when `searxng.deploy=false`    | `''`                   |
| `searxng.image.repository` | SearXNG image repository                                         | `searxng/searxng`      |
| `searxng.secretKey`        | SearXNG `secret_key`; auto-generated (and kept stable) if empty  | `''`                   |
| `service.type`             | Vane Service type                                                | `ClusterIP`            |
| `service.port`             | Vane Service port                                                | `3000`                 |
| `ingress.enabled`          | Enable an Ingress for Vane                                       | `false`                |
| `persistence.data.size`    | Size of the config/database volume                               | `2Gi`                  |
| `persistence.uploads.size` | Size of the uploads volume                                       | `5Gi`                  |
| `resources`                | Resource requests/limits for Vane                                | `{}`                   |
| `autoscaling.enabled`      | Enable a HorizontalPodAutoscaler (not advised with local SQLite) | `false`                |

### Configuring providers via environment variables

Vane can pre-load provider credentials from environment variables on first
boot. Pass them through `vane.env` or `vane.envFrom`:

```yaml
vane:
  envFrom:
    - secretRef:
        name: vane-provider-keys # e.g. OPENAI_API_KEY, ANTHROPIC_API_KEY, ...
```

Everything can also be configured later from the in-app settings screen.

## Uninstalling

```bash
helm uninstall vane
```

PersistentVolumeClaims created by the chart are not deleted automatically;
remove them manually if you no longer need the data:

```bash
kubectl delete pvc -l app.kubernetes.io/instance=vane
```
