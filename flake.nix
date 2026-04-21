{
  description = "Vane (Perplexica) — self-hosted AI search engine, reverb256 fork";

  inputs = {};

  outputs = { self }: {
    # No Nix build — Vane builds via podman (Dockerfile.slim).
    # This flake exists for project tracking and AGENTS.md conventions.
  };
}
