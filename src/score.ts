import { NUM_TRIALS, STAGE_SIMILARITY, STAGE_STABILITY } from ".";
import { appendLog, createLogFolder, listAllDirs, listAllFiles } from "./file-utils";

import BigNumber from "bignumber.js";
import fs from "fs";
import path from "path";

export type CharacterWeight = {
  character: string,
  weightStability: BigNumber,
  weightSimilarity: BigNumber,
  weight: BigNumber
}

export type StabilityResult = {
  dataCount: number, rate: number, raws: { tag: string, score: number }[]
}

export type SimilarityResult = {
  count: number, similarityRate: number, trials: { id: string, label: string, similarity: number }[], similarities: { id: string, raws: { id: string, label: string, softmax_prob: number }[] }[]
}

export function getNormalizedPromptScores(allTeamPromptScores: { team: string; promptScore: BigNumber | undefined; }[], competitionScore: BigNumber) {
  return allTeamPromptScores
    .map(p => ({
      team: p.team,
      promptScore: p.promptScore?.dividedBy(competitionScore).multipliedBy(100) || new BigNumber(0)
    }))
    .sort((a, b) => a.promptScore.gt(b.promptScore || new BigNumber(0)) ? -1 : 1)
    .map(p => ({
      team: p.team,
      promptScore: p.promptScore.toFixed()
    }));
}

export function getCompetitionScore(allTeamPromptScores: { team: string; promptScore: BigNumber | undefined; }[]) {
  let competitionScore = new BigNumber(0);
  for (const promptScore of allTeamPromptScores) {
    competitionScore = competitionScore.plus(promptScore.promptScore || new BigNumber(0));
  }
  return competitionScore;
}

export function getCharacterScore(trialScores: (BigNumber | undefined)[]) {
  return trialScores.reduce((acc, cur) => acc?.plus(cur || new BigNumber(0)), new BigNumber(0))?.dividedBy(NUM_TRIALS) || new BigNumber(0);
}

export function getAverageSimilarityScore(averageSimilarityScores: BigNumber[]) {
  return averageSimilarityScores.reduce((acc, cur) => acc.plus(cur), new BigNumber(0)).dividedBy(NUM_TRIALS);
}

export function getAverageStabilityScore(averageStabilityScores: BigNumber[]) {
  return averageStabilityScores.reduce((acc, cur) => acc.plus(cur), new BigNumber(0)).dividedBy(NUM_TRIALS);
}

export function getTrialScore(weights: CharacterWeight[], character: string, trialStability: BigNumber, trialSimilarity: BigNumber) {
  return weights
    .find(w => w.character === character)
    ?.weight
    .multipliedBy(trialStability)
    .multipliedBy(trialSimilarity);
}

export function getPromptScore(characterScores: { characterScore: BigNumber | undefined; character: string; team: string; }[]) {
  return characterScores
    .map(score => score.characterScore)
    .reduce((acc, cur) => acc?.plus(cur || new BigNumber(0)), new BigNumber(0))
    ?.dividedBy(characterScores.length);
}

export async function getWeights(sourceFolder: string) {
  const teamFolders = await listAllDirs(sourceFolder)
  const logFolderPath = await createLogFolder(sourceFolder)

  const characterListPath = path.posix.join(sourceFolder, teamFolders[0], STAGE_STABILITY)
  const characterList = await listAllFiles(characterListPath)

  const characterWeights: CharacterWeight[] = []

  for (const character of characterList) {
    const averageStability = await getAverageStabilityAcrossTeams(teamFolders, character)
    const weightStability = BigNumber.max(new BigNumber(1).minus(averageStability), new BigNumber(1).dividedBy(characterList.length))

    const averageSimilarity = await getAverageSimilarityAcrossTeams(character);
    const weightSimilarity = BigNumber.max(new BigNumber(1).minus(averageSimilarity), new BigNumber(1).dividedBy(characterList.length))

    const weight = {
      character: character.replace('.json', ''),
      weightStability,
      weightSimilarity,
      weight: weightStability.multipliedBy(weightSimilarity)
    }
    characterWeights.push(weight)

    const weightLog = `[${new Date().toISOString().replaceAll(':', '_')}] character: ${weight.character} - weight: ${weight.weight.toFixed()} - weightStability: ${weight.weightStability.toFixed()} - weightSimilarity: ${weight.weightSimilarity.toFixed()}`
    await appendLog(logFolderPath, weightLog)
  }

  return characterWeights

  // ------------------------------

  async function getAverageStabilityAcrossTeams(teamFolders: string[], character: string) {
    let sumOfStabilityOfAllTeams = new BigNumber(0)
    for (const team of teamFolders) {
      const trialStability = await getTrialStability(team, character);
      sumOfStabilityOfAllTeams = sumOfStabilityOfAllTeams.plus(trialStability)
    }

    return sumOfStabilityOfAllTeams.dividedBy(teamFolders.length * NUM_TRIALS)
  }

  async function getAverageSimilarityAcrossTeams(character: string) {
    let sumOfSimilarityOfAllTeams = new BigNumber(0);

    for (const team of teamFolders) {
      const trialSimilarity = await getTrialSimilarity(team, character);
      sumOfSimilarityOfAllTeams = sumOfSimilarityOfAllTeams.plus(trialSimilarity);
    }
    const averageSimilarity = sumOfSimilarityOfAllTeams.dividedBy(teamFolders.length * NUM_TRIALS);
    return averageSimilarity;
  }

  async function getTrialSimilarity(team: string, character: string) {
    const similarityResultPath = path.posix.join(sourceFolder, team, STAGE_SIMILARITY, character);
    const similarityFile = await fs.promises.readFile(similarityResultPath, 'utf8');
    const similarityResult = await JSON.parse(similarityFile) as SimilarityResult;

    const trialSimilarity = similarityResult.trials.reduce((acc, cur) => acc.plus(new BigNumber(cur.similarity)), new BigNumber(0));
    return trialSimilarity;
  }

  async function getTrialStability(team: string, character: string) {
    const stabilityResultPath = path.posix.join(sourceFolder, team, STAGE_STABILITY, character);
    const stabilityFile = await fs.promises.readFile(stabilityResultPath, 'utf8');
    const stabilityResult = await JSON.parse(stabilityFile) as StabilityResult;

    const trialStability = stabilityResult.raws.reduce((acc, cur) => acc.plus(new BigNumber(cur.score)), new BigNumber(0));
    return trialStability;
  }
}