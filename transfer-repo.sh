#!/usr/bin/env bash
# Push main to GitHub, or fetch GitHub's main, through a throw-away Docker container:
# on this Mac git's own network operations do not work, so the commits travel as a bundle
# and the container (with the host's SSH agent forwarded) talks to GitHub.
#
#   ./transfer-repo.sh          push local main (fast-forward only, never forced)
#   ./transfer-repo.sh fetch    fetch GitHub's main into origin/main (then merge or rebase locally)
set -euo pipefail

MODE="${1:-push}"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
REMOTE_URL="git@github.com:tgreaves/goldbox-rerolled.git"
BRANCH="main"
CONTAINER_NAME="goldbox-repo-transfer"
WORK="$(mktemp -d)"
BUNDLE="$WORK/goldbox.bundle"

cleanup() {
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
    rm -rf "$WORK"
}
trap cleanup EXIT

case "$MODE" in
    push|fetch) ;;
    *) echo "usage: $0 [push|fetch]" >&2; exit 2 ;;
esac

echo "==> Starting Docker container (with SSH agent forwarding)..."
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER_NAME" \
    --mount type=bind,src=/run/host-services/ssh-auth.sock,target=/run/host-services/ssh-auth.sock \
    -e SSH_AUTH_SOCK=/run/host-services/ssh-auth.sock \
    -e GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new" \
    alpine:latest sleep 3600 >/dev/null
docker exec "$CONTAINER_NAME" apk add --no-cache --quiet git openssh

if [ "$MODE" = push ]; then
    echo "==> Bundling local $BRANCH..."
    git -C "$REPO_DIR" bundle create "$BUNDLE" "refs/heads/$BRANCH"
    docker cp "$BUNDLE" "$CONTAINER_NAME:/tmp/repo.bundle"
    docker exec "$CONTAINER_NAME" sh -c "git init -q /repo && cd /repo && \
        git fetch -q /tmp/repo.bundle refs/heads/$BRANCH:refs/heads/$BRANCH && \
        git remote add origin $REMOTE_URL"

    echo "==> Pushing $BRANCH to $REMOTE_URL..."
    # No --force: if GitHub has commits this side lacks, the push is refused; run "fetch" first.
    docker exec -w /repo "$CONTAINER_NAME" git push origin "refs/heads/$BRANCH:refs/heads/$BRANCH"

    # Record what GitHub now has, as a real push would.
    git -C "$REPO_DIR" update-ref "refs/remotes/origin/$BRANCH" "refs/heads/$BRANCH"
    echo "==> Done: $(git -C "$REPO_DIR" log --oneline -1 "$BRANCH") pushed."
else
    echo "==> Fetching $BRANCH from $REMOTE_URL..."
    docker exec "$CONTAINER_NAME" sh -c "git clone -q --bare --single-branch --branch $BRANCH \
        $REMOTE_URL /repo.git && git -C /repo.git bundle create /tmp/repo.bundle refs/heads/$BRANCH"
    docker cp "$CONTAINER_NAME:/tmp/repo.bundle" "$BUNDLE"
    git -C "$REPO_DIR" fetch -q "$BUNDLE" "refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
    echo "==> Done: origin/$BRANCH is $(git -C "$REPO_DIR" log --oneline -1 "origin/$BRANCH")."
    git -C "$REPO_DIR" status -sb | head -1
fi
