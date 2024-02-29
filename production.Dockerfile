#
# This Dockerfile is used for self-hosted production builds.
#

#
# Build the frontend artifacts
#
FROM node:16.15-alpine3.14 AS frontend-build

WORKDIR /code

COPY package.json yarn.lock ./
RUN yarn config set network-timeout 300000 && \
    yarn install --frozen-lockfile

COPY frontend/ frontend/
COPY ./bin/ ./bin/
COPY babel.config.js tsconfig.json webpack.config.js ./
RUN yarn build

#
# ---------------------------------------------------------
#
#
# Build the plugin-server artifacts. Note that we still need to install the
# runtime deps in the main image
#
FROM node:16.15-alpine3.14 AS plugin-server-build

WORKDIR /code

# Install python, make and gcc as they are needed for the yarn install
RUN apk --update --no-cache add \
    "make~=4.3" \
    "g++~=10.3" \
    "gcc~=10.3" \
    "python3~=3.9"

# Compile and install Yarn dependencies.
#
# Notes:
#
# - we explicitly COPY the files so that we don't need to rebuild
#   the container every time a dependency changes
COPY ./plugin-server/ ./plugin-server/
RUN yarn config set network-timeout 300000 && \
    yarn install --cwd plugin-server

# Build the plugin server
#
# Note: we run the build as a separate actions to increase
# the cache hit ratio of the layers above.
RUN cd plugin-server  \
    && yarn build

#
# ---------------------------------------------------------
#
FROM python:3.10.10-slim-bullseye AS posthog-build
WORKDIR /code
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Compile and install Python dependencies.
# We install those dependencies on a custom folder that we will
# then copy to the last image.
COPY requirements.txt ./
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    "build-essential" \
    "git" \
    "libpq-dev" \
    "libxmlsec1" \
    "libxmlsec1-dev" \
    "libffi-dev" \
    "pkg-config" \
    && \
    rm -rf /var/lib/apt/lists/* && \
    pip install -r requirements.txt --compile --no-cache-dir --target=/python-runtime

ENV PATH=/python-runtime/bin:$PATH \
    PYTHONPATH=/python-runtime

# Add in Django deps and generate Django's static files.
COPY manage.py manage.py
COPY posthog posthog/
COPY --from=frontend-build /code/frontend/dist /code/frontend/dist
RUN SKIP_SERVICE_VERSION_REQUIREMENTS=1 SECRET_KEY='unsafe secret key for collectstatic only' DATABASE_URL='postgres:///' REDIS_URL='redis:///' python manage.py collectstatic --noinput

#
# ---------------------------------------------------------
#

FROM python:3.10.10-slim-bullseye
WORKDIR /code
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ENV PYTHONUNBUFFERED 1

# Install OS runtime dependencies.
# Note: please add in this stage runtime dependences only!
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    "libpq-dev" \
    "libxmlsec1" \
    "libxmlsec1-dev" \
    "libxml2"

# Install NodeJS 18.
RUN apt-get install -y --no-install-recommends \
    "curl" \
    && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y --no-install-recommends \
    "nodejs" \
    && \
    rm -rf /var/lib/apt/lists/*

# Install and use a non-root user.
RUN groupadd posthog && \
    useradd -r -g posthog posthog && \
    chown posthog:posthog /code
USER posthog

# Add in the compiled plugin-server & its runtime dependencies from the plugin-server-build stage.
COPY --from=plugin-server-build --chown=posthog:posthog /code/plugin-server/dist /code/plugin-server/dist
COPY --from=plugin-server-build --chown=posthog:posthog /code/plugin-server/node_modules /code/plugin-server/node_modules
COPY --from=plugin-server-build --chown=posthog:posthog /code/plugin-server/package.json /code/plugin-server/package.json

# Copy the Python dependencies and Django staticfiles from the posthog-build stage.
COPY --from=posthog-build --chown=posthog:posthog /code/staticfiles /code/staticfiles
COPY --from=posthog-build --chown=posthog:posthog /python-runtime /python-runtime
ENV PATH=/python-runtime/bin:$PATH \
    PYTHONPATH=/python-runtime

# Copy the frontend assets from the frontend-build stage.
# TODO: this copy should not be necessary, we should remove it once we verify everything still works.
COPY --from=frontend-build --chown=posthog:posthog /code/frontend/dist /code/frontend/dist


# Add in the Gunicorn config, custom bin files and Django deps.
COPY --chown=posthog:posthog gunicorn.config.py ./
COPY --chown=posthog:posthog ./bin ./bin/
COPY --chown=posthog:posthog manage.py manage.py
COPY --chown=posthog:posthog posthog posthog/

# Setup ENV.
ENV NODE_ENV=production

# Expose container port and run entry point script.
EXPOSE 8000

CMD ["./bin/docker"]