## PostHog-LLM-Lite

PostHog-LLM-Lite is a fork of [PostHog](https://github.com/PostHog/posthog) with extensions to use PostHog as a LLM text analytics platform and be able to display the LLM interactions while exploring insights. 

This lite version is a fork of PostHog v1.31 that only uses Postgres and Redis (current PostHog also uses Clickhouse, Kafka and a few other components). The latest PostHog is undoubtly better and we published LLM extensions for it in [PostHog-LLM](https://github.com/postlang/posthog-llm).  

We find this version interesting because of its simplicity, using a straightforward stack of Django, Celery, Postgres, and Redis, making it an good starting point for development and experimentation. It is also simpler and needs less resources for deployment.

## Get started with PostHog-LLM-Lite

These are instructions to setup and use this version of PostHog. A good source of additional documentation is [this version](https://github.com/PostHog/posthog.com/tree/cd6076efac5174fc57127a6a68a927b081b96ec7/contents) of the posthog.com documentation repository.

### Run on Docker

On a system with Docker and Docker compose installed, first clone the repository, 
then first generate a random key (eg. run `openssl rand -hex 32` to generate a key). 
Then, open the `docker-compose.yml` file and replace `"<randomly generated secret key>"` 
for the key you generated. This means the `SECRET_KEY: "<randomly generated secret key>"` 
line will end up looking something like this (with your key, of course):

    ```
    SECRET_KEY: "cd8a182315defa70d995452d9258908ef502da512f52c20eeaa7951d0bb96e75"
    ```

Then, to run do:
```bash
docker-compose up -d
```

PostHog should be accessible on the domain you set up or the IP of your instance.

### Setup for local development


Clone the repository:

```bash
git clone https://github.com/postlang/posthog-llm-lite
```

Make sure you have Python 3.10 installed `python3 --version`.

Make sure you have Docker and Docker Compose installed, then run `docker compose` to 
start Postgres and Redis.

```bash
docker compose -f docker-compose.dev.yml up -d redis db
```

Navigate into the correct folder (project's root directory):
```bash
cd posthog
```

Create the virtual environment in current directory called 'env':
```bash
python3 -m venv env
```

Activate the virtual environment:
```bash
source env/bin/activate
```

Install requirements with pip
```bash
pip install -r requirements.txt
```

Install dev requirements:
```bash
pip install -r requirements-dev.txt
```

Export the connection to the database 

```bash
export DATABASE_URL=postgres://posthog:posthog@localhost:5432/posthog_lite
```

Run migrations
```bash
DEBUG=1 python3 manage.py migrate
```

Prepare the OS with the following dependencies:

1. Install nvm: https://github.com/nvm-sh/nvm

2. Install the latest Node.js 16 with `nvm install 16`. You can start using it in the current shell with `nvm use 16`.

3. Install yarn with `npm install -g yarn@1`.

Install the packages and build the app. Also build the plugin-server.

```bash
yarn install
yarn build

cd plugin-server  
yarn install
yarn build
```

Start the backend, worker, and frontend simultaneously with:

```bash
./bin/start
```

Now open [http://localhost:8000](http://localhost:8000) to see the app.

## Install Plugins

To maximize the capabilities of PostHog-LLM-Lite for analytics in LLMs, it's important to augment 
LLM interactions with additional metadata. This enhancement can be done through the deployment 
of machine learning models as PostHog plugins. Examples of such plugins, which are available 
in their respective repositories, include:

LLM conversation flow classifier: Enhances understanding of the conversation with specific agent and user flow labels.

Plugin: [https://github.com/minuva/ph-flowdetect-plugin](https://github.com/minuva/ph-flowdetect-plugin)

Model: [https://github.com/minuva/llm-flow-classification](https://github.com/minuva/llm-flow-classification)

Emotion classifier: Identifies emotions in text, providing a deeper insight into the emotional context of interactions.

Plugin: [https://github.com/minuva/ph-emotion-plugin](https://github.com/minuva/ph-emotion-plugin)

Model: [https://github.com/minuva/fast-nlp-text-emotion](https://github.com/minuva/fast-nlp-text-emotion)

Toxicity classifier: Detects toxic content in text, allowing for a safer and more positive user experience.

Plugin: [https://github.com/minuva/ph-toxicity-plugin](https://github.com/minuva/ph-toxicity-plugin)

Model: [https://github.com/minuva/fast-nlp-text-toxicity](https://github.com/minuva/fast-nlp-text-toxicity)

These plugins link the PostHog data ingestion process with the machine learning models. These models need to be 
hosted on separate servers, a setup process that is detailed within each model's repository.

To install a plugin, navigate to the 'Plugins' section within the PostHog-LLM-Lite user interface, select the 'Advanced' 
tab, and enter the GitHub repository URL of the plugin into the designated field. This action will fetch the plugin's 
code from GitHub and initiate its installation. Subsequently, specify the address and port of your model server in 
the 'HOSTNAME URL' field to complete the setup.

PostHog's plugin system is designed to facilitate the configuration of a model pipeline, enabling sequential data 
processing where each model can access and use properties appended by preceding models. The order of these models, 
as displayed in the PostHog UI, is important for ensuring that each model operates on the enriched dataset provided by 
its predecessors. PostHog-LLM-Lite adheres to a naming convention for LLM properties, and the machine learning models above 
are triggered exclusively for LLM events that include interaction texts.

## Check PostHog

Check the [PostHog repository](https://github.com/PostHog/posthog) for more details all for the list of [authors and contributors](https://github.com/PostHog/posthog#contributors-).

## Open-source

This repo is [MIT licensed](/LICENSE).
