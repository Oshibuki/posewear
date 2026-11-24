#!/usr/bin/env python3
"""The site CSP value, shared by production _headers and the CI fixture dist.

post.py writes the full Cloudflare _headers template with this value;
scripts/ci-assets.py writes a minimal _headers with the same value for the
committed-fixture dist, which tests/check_csp.py validates.
"""

CONNECT = ("'self' data: blob: https://api.openai.com https://generativelanguage.googleapis.com https://*.volces.com https://*.bytepluses.com https://oaidalleapiprodscus.blob.core.windows.net https://*.googleusercontent.com http://127.0.0.1:* http://localhost:*")


def csp_value(script_hashes='', img_origins=(), depth_origins=(), asset_host='', analytics=False):
    """Build the Content-Security-Policy value used in the site's _headers."""
    imgs = ["'self'", 'data:', 'blob:', *depth_origins, *img_origins]
    if asset_host:
        imgs.append(asset_host)
    connect = CONNECT + ((' ' + ' '.join(img_origins)) if img_origins else '') + ((' https://cloudflareinsights.com') if analytics else '')
    return ("default-src 'self'; script-src 'self' " + script_hashes + (" https://static.cloudflareinsights.com" if analytics else "") + "; style-src 'self' 'unsafe-inline'; img-src " + ' '.join(imgs) + "; font-src 'self' data:; connect-src " + connect + "; worker-src 'self'; manifest-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests")
