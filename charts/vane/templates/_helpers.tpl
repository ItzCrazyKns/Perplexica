{{/*
Expand the name of the chart.
*/}}
{{- define "vane.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this
(by the DNS naming spec).
*/}}
{{- define "vane.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "vane.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "vane.labels" -}}
helm.sh/chart: {{ include "vane.chart" . }}
{{ include "vane.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "vane.selectorLabels" -}}
app.kubernetes.io/name: {{ include "vane.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use.
*/}}
{{- define "vane.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "vane.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Resolve the image tag from the explicit override or the variant.
*/}}
{{- define "vane.imageTag" -}}
{{- if .Values.image.tag -}}
{{- .Values.image.tag -}}
{{- else if eq .Values.variant "slim" -}}
slim-latest
{{- else -}}
latest
{{- end -}}
{{- end -}}

{{/*
Full image reference for the Vane container.
*/}}
{{- define "vane.image" -}}
{{- printf "%s:%s" .Values.image.repository (include "vane.imageTag" .) -}}
{{- end -}}

{{/*
Name of the in-cluster SearXNG resources.
*/}}
{{- define "vane.searxng.fullname" -}}
{{- printf "%s-searxng" (include "vane.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
SearXNG selector labels.
*/}}
{{- define "vane.searxng.selectorLabels" -}}
app.kubernetes.io/name: {{ include "vane.name" . }}-searxng
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
SearXNG labels.
*/}}
{{- define "vane.searxng.labels" -}}
helm.sh/chart: {{ include "vane.chart" . }}
{{ include "vane.searxng.selectorLabels" . }}
app.kubernetes.io/component: searxng
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Whether this release deploys an in-cluster SearXNG (slim variant only).
Returns "true" or an empty string.
*/}}
{{- define "vane.searxng.deployed" -}}
{{- if and (eq .Values.variant "slim") .Values.searxng.deploy -}}
true
{{- end -}}
{{- end -}}

{{/*
Resolve the SEARXNG_API_URL to inject into Vane.
  * full   -> empty (the image bundles SearXNG at http://localhost:8080).
  * slim + deploy -> in-cluster SearXNG service.
  * slim + external -> the provided URL.
*/}}
{{- define "vane.searxngUrl" -}}
{{- if eq .Values.variant "slim" -}}
{{- if .Values.searxng.deploy -}}
{{- printf "http://%s:%v" (include "vane.searxng.fullname" .) .Values.searxng.service.port -}}
{{- else -}}
{{- .Values.searxng.url -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Resolve the SearXNG secret_key: explicit value, previously generated value
(kept stable across upgrades via lookup), or a freshly generated one.
*/}}
{{- define "vane.searxng.secretKey" -}}
{{- if .Values.searxng.secretKey -}}
{{- .Values.searxng.secretKey -}}
{{- else -}}
{{- $existing := lookup "v1" "Secret" .Release.Namespace (include "vane.searxng.fullname" .) -}}
{{- if and $existing $existing.data (index $existing.data "secretKey") -}}
{{- index $existing.data "secretKey" | b64dec -}}
{{- else -}}
{{- randAlphaNum 64 -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Guardrails: validate the chosen variant / SearXNG configuration.
*/}}
{{- define "vane.validate" -}}
{{- if not (or (eq .Values.variant "full") (eq .Values.variant "slim")) -}}
{{- fail (printf "vane: `variant` must be either \"full\" or \"slim\", got %q" .Values.variant) -}}
{{- end -}}
{{- if eq .Values.variant "slim" -}}
{{- if and (not .Values.searxng.deploy) (not .Values.searxng.url) -}}
{{- fail "vane: with variant=slim you must either set searxng.deploy=true or provide searxng.url (external SearXNG instance)." -}}
{{- end -}}
{{- end -}}
{{- end -}}
