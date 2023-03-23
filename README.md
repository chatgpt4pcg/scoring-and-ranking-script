# Scoring and Ranking Script

This repository contains a script that can be used to score and rank the results of the ChatGPT4PCG competition.

## Installation

To use this script, you must have <a href="https://nodejs.org/en/" target="_new">Node.js</a> and <a href="https://www.npmjs.com/" target="_new">npm</a> installed on your system.

1. Clone this repository to your local machine.
2. Navigate to the repository directory in your terminal.
3. Run `npm install` to install the necessary dependencies.

## Usage

1. Run the script using the command `npm start -s="<SOURCE_FOLDER>"`. For example, `npm start -s="./competition"`.
2. The script will output a `prompt_scores_ranks.csv` file containg the result of the competition along with `constants.json`, `trial_scores.csv`, and `character_scores.csv` in `<SOURCE_FOLDER>/result` directory. This file contains the results of the competition. The file `result_log_<DATE_TIME>.txt` will be created in the `<SOURCE_FOLDER>/logs` folder.

Note: This script assumes `10` trials of each character, i.e., every `<SOURCE_FOLDER>/<TEAM_NAME>/similarity` and `<SOURCE_FOLDER>/<TEAM_NAME>/stability containing` containing `10` result files. The number of trials can be adjusted using the NUM_TRIALS constant in the src/index.ts file.

Please ensure that the source folder is in the same folder as the script and has the following structure:

```
<SOURCE_FOLDER>
├── <TEAM_NAME>
|   ├── <STAGE>
│   │    └── <CHARACTER>
│   │       ├── <TRIAL_NUMBER>.jpg
│   │       ├── <TRIAL_NUMBER>.jpg
│   │       └── <TRIAL_NUMBER>.png
│   └── <STAGE>
│        └── <CHARACTER>
│           ├── <TRIAL_NUMBER>.txt
│           ├── <TRIAL_NUMBER>.txt
│           └── <TRIAL_NUMBER>.txt
└── <TEAM_NAME>
    ├── <STAGE>
    │    └── <CHARACTER>
    │       ├── <TRIAL_NUMBER>.jpg
    │       ├── <TRIAL_NUMBER>.png
    │       └── <TRIAL_NUMBER>.jpg
    └── <STAGE>
         └── <CHARACTER>
            ├── <TRIAL_NUMBER>.txt
            ├── <TRIAL_NUMBER>.txt
            └── <TRIAL_NUMBER>.txt
```