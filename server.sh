#!/bin/bash

output() {
  printf "\n$1\n"
}

deps() {
  echo "Checking for dependencies..."
  npm install
}

runVrt() {
  # make sure we're not on master
  BRANCH="${TRAVIS_BRANCH:-$(git branch | grep \* | cut -d ' ' -f2)}"
  SLUG="${TRAVIS_REPO_SLUG:-$(git config --local remote.origin.url | cut -d: -f2)}"
  OWNER=$(echo $SLUG | cut -d/ -f1)

  echo "Current branch: $BRANCH"
  echo "From remote: $OWNER"

  if [ "$BRANCH" = "master" ] && [ "$OWNER" = "hmrc" ]; then
    output "Vrts not run on $BRANCH branch."
  else
    # Store some vars for later
    if [[ $TRAVIS_BRANCH ]]; then
      HEAD=$TRAVIS_COMMIT
    fi

    COMMIT="${HEAD:-$BRANCH}"
    echo "Current commit: $COMMIT"

    BRANCHPOINT=$(git merge-base master HEAD)
    echo "Branch point: $BRANCHPOINT"

    # run VRTs
    git checkout $BRANCHPOINT &&
    npm run vrt:baseline &&
    git checkout $COMMIT &&
    npm run vrt:compare
  fi
}

if [[ -n $1 ]]; then
  case "$1" in

  "dev") deps && output "Starting gulp in dev mode..."
    npm run dev
    ;;
  "vrt") deps && output "Starting vrts..."
    runVrt
    ;;
  "build") deps && output "Starting gulp build task..."
    if [[ -n $2 ]]; then
      runVrt && npm run build $2
    else
      runVrt && npm run build
    fi
    ;;
  "test-dev") deps && output "Auto watch tests..."
    npm run test:dev
    ;;
  "test") deps && output "Starting gulp test task..."
    npm run test
    ;;
  *)  echo "invalid parameter '$1'"
    ;;
  esac
else
  port=${1-9032}
  echo "Starting simple server on port $port..."
  cd target
  python -m SimpleHTTPServer $port
fi
