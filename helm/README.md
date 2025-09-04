# Helm Charts

This directory contains Helm charts for deploying applications to Kubernetes.

## Available Charts

### bun-git-proxy

A Helm chart for deploying the Git proxy Application to Kubernetes.

#### Quick Start on Local

```bash
# Test locally without middleware
helm template bun-git-proxy ./helm/bun-git-proxy -f helm/bun-git-proxy/values-local.yaml

# Install locally
helm install bun-git-proxy ./helm/bun-git-proxy -f helm/bun-git-proxy/values-local.yaml
```

### Run on production
```bash
# Test production with middleware
helm template bun-git-proxy ./helm/bun-git-proxy 

# Install production
helm install bun-git-proxy ./helm/bun-git-proxy
```

# Upgrade existing installation
helm upgrade bun-git-proxy ./bun-git-proxy

# Uninstall
```bash
helm uninstall bun-git-proxy
```

#### Configuration

The chart supports environment-specific configurations:

- **Default values**: `values.yaml` - Production configuration
- **Local development**: `values-local.yaml` - Local development setup

#### Features

- Configurable deployment with rolling updates
- Health checks (liveness and readiness probes)
- Ingress configuration with TLS support
- Traefik middleware for HTTPS redirects
- Resource limits and requests
- Environment-specific configurations

#### Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- Traefik Ingress Controller (if using ingress)
- cert-manager (if using TLS)

For more detailed information, see the [bun-git-proxy README](bun-git-proxy/README.md).
