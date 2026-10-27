#!/usr/bin/env python3
"""Request an assigned course deployment without logging credentials."""

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request


def request_deployment(url, token, digest, registry_token=""):
    address = urllib.parse.urlsplit(url)
    if (
        address.scheme != "https"
        or not address.hostname
        or address.username
        or address.password
        or address.query
        or address.fragment
        or not re.fullmatch(r"/__deploy/p[0-9]{2}", address.path)
    ):
        raise ValueError("Invalid course deployment URL.")
    if not token or not re.fullmatch(r"sha256:[a-f0-9]{64}", digest):
        raise ValueError("A deployment token and SHA-256 digest are required.")

    body = {"digest": digest}
    if registry_token:
        body["registry_token"] = registry_token
    deployment_request = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args):
            return None

    opener = urllib.request.build_opener(NoRedirect())
    with opener.open(deployment_request, timeout=440) as response:
        result = json.load(response)
        if response.status != 200 or result.get("status") != "healthy":
            raise ValueError("The deployed image did not become healthy.")
        return result


if __name__ == "__main__":
    try:
        result = request_deployment(
            os.environ.get("DEPLOY_URL", ""),
            os.environ.get("DEPLOY_TOKEN", ""),
            os.environ.get("DIGEST", ""),
            os.environ.get("REGISTRY_TOKEN", ""),
        )
        print(f"Deployment verified: {result['project']} @ {result['digest']}")
    except urllib.error.HTTPError as error:
        if error.code in (401, 403):
            message = f"The course server refused deployment access (HTTP {error.code}). Check the token and project assignment."
        elif error.code == 404:
            message = "The deployment endpoint was not found (HTTP 404). Check IHME_DEPLOY_URL and the assigned project path."
        else:
            message = f"The course server returned HTTP {error.code}. Check the assignment and server status."
        print(message, file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError:
        print("Could not reach the course server. Check IHME_DEPLOY_URL and network availability.", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError:
        print("The course server returned an invalid response.", file=sys.stderr)
        sys.exit(1)
    except ValueError as error:
        print(f"Deployment request rejected: {error}", file=sys.stderr)
        sys.exit(1)
    except KeyError:
        print("The course server response is missing expected fields.", file=sys.stderr)
        sys.exit(1)
    except OSError:
        print(
            "A local or network error interrupted deployment. Check the workflow summary.",
            file=sys.stderr,
        )
        sys.exit(1)