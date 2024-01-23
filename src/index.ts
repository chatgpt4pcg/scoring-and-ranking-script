import { CharacterWeight, DiversityResult, SimilarityResult, StabilityResult, getAverageSimilarityScore, getAverageStabilityScore, getCharacterScore, getCompetitionScore, getNormalizedPromptScores, getPromptScore, getTrialScore, getWeights } from './score';
import { appendLog, createLogFolder, createResultOutputFolder, listAllDirs, listAllFiles, parseSourceFolderArgument } from 'chatgpt4pcg-node';

// @ts-ignore
import { AsyncParser } from '@json2csv/node';
import BigNumber from 'bignumber.js'
import fs from 'fs'
import path from 'path'

export const CHARACTER_LIST = ['A', 'B', 'C', 'D', 'E', 'F', 'G',
  'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R',
  'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
export const STAGE_STABILITY = 'stability'
export const STAGE_SIMILARITY = 'similarity'
export const STAGE_DIVERSITY = 'diversity'
export const NUM_TRIALS = 10
export const CURRENT_STAGE = 'result'

type TeamTrialScore = { trialScore: BigNumber | undefined, character: string, team: string, trial: number }
type TeamStabilityScore = { stabilityScore: BigNumber, character: string, team: string, trial: number }
type TeamSimilarityScore = { similarityScore: BigNumber, character: string, team: string, trial: number }
type TeamCharacterScore = { characterScore: BigNumber, character: string, team: string }

type AllTeamTrialScores = {
  trialScores: TeamTrialScore[],
  stabilityScores: TeamStabilityScore[],
  similarityScores: TeamSimilarityScore[],
  character: string, team: string
}[]
type AllTeamPromptScores = { team: string, promptScore: BigNumber | undefined }[]
type AllTeamFinalScoresAndRanks = { team: string, promptScore: string, normalizedPromptScore: string, rank: number }[]
type AllTeamAverageStabilityScores = { avgStability: BigNumber, character: string, team: string }[]
type AllTeamAverageSimilarityScores = { avgSimilarity: BigNumber, character: string, team: string }[]
type AllTeamDiversityScores = { diversityScore: BigNumber, character: string, team: string }[]
type AllTeamCharacterScores = { characterScore: BigNumber, character: string, team: string }[]

async function main() {
  let sourceFolder = ''
  try {
    sourceFolder = parseSourceFolderArgument()
  } catch (e) {
    if (e instanceof Error) {
      console.error(e.message)
    }
    return
  }

  const logFolderPath = await createLogFolder(sourceFolder)
  const prompts = await listAllDirs(sourceFolder)

  const weights = await getWeights(sourceFolder)

  const allTeamTrialScores = [] as AllTeamTrialScores
  const allTeamAverageStabilityScores = [] as AllTeamAverageStabilityScores
  const allTeamAverageSimilarityScores = [] as AllTeamAverageSimilarityScores
  const allTeamDiversityScores = [] as AllTeamDiversityScores
  const allTeamCharacterScores = [] as AllTeamCharacterScores
  const allTeamPromptScores = [] as AllTeamPromptScores
  const allTeamsFinalScoresAndRanks = [] as AllTeamFinalScoresAndRanks

  for (const prompt of prompts) {
    const teamLog = `[${new Date().toISOString()}] Processing - prompt: ${[prompt]}`
    await appendLog(logFolderPath, CURRENT_STAGE, teamLog)

    const promptFilePath = path.posix.join(sourceFolder, prompt)

    let stability = [] as string[]
    let similarity = [] as string[]
    let diversity = [] as string[]

    try {
      const stabilityPath = path.posix.join(promptFilePath, STAGE_STABILITY)
      stability = await listAllFiles(stabilityPath)
    } catch (e) {
      const promptLog = `[${new Date().toISOString()}] Processing - prompt: ${prompt} - Failed`
      if (e instanceof Error) {
        await appendLog(logFolderPath, CURRENT_STAGE, `${promptLog} - ${e.message.toString()}`)
      } else if (typeof e === 'string') {
        await appendLog(logFolderPath, CURRENT_STAGE, `${promptLog} - ${e}`)
      }
    }

    try {
      const similarityPath = path.posix.join(promptFilePath, STAGE_SIMILARITY)
      similarity = await listAllFiles(similarityPath)
    } catch (e) {
      const promptLog = `[${new Date().toISOString()}] Processing - prompt: ${prompt} - Failed`
      if (e instanceof Error) {
        await appendLog(logFolderPath, CURRENT_STAGE, `${promptLog} - ${e.message.toString()}`)
      } else if (typeof e === 'string') {
        await appendLog(logFolderPath, CURRENT_STAGE, `${promptLog} - ${e}`)
      }
    }

    try {
      const diversityPath = path.posix.join(promptFilePath, STAGE_DIVERSITY)
      diversity = await listAllFiles(diversityPath)
    } catch (e) {
      const promptLog = `[${new Date().toISOString()}] Processing - prompt: ${prompt} - Failed`
      if (e instanceof Error) {
        await appendLog(logFolderPath, CURRENT_STAGE, `${promptLog} - ${e.message.toString()}`)
      } else if (typeof e === 'string') {
        await appendLog(logFolderPath, CURRENT_STAGE, `${promptLog} - ${e}`)
      }
    }

    if (stability.length !== similarity.length || stability.length !== diversity.length) {
      const promptLog = `[${new Date().toISOString()}] Processing - prompt: ${prompt} - Failed`
      await appendLog(logFolderPath, CURRENT_STAGE, `${promptLog} - Number of stability files and similarity files are not equal.`)
      return
    }

    const characterScores = [] as TeamCharacterScore[]

    for (const character of CHARACTER_LIST) {
      const characterFilePath = `${character}.json`
      const characterStabilityFilePath = path.posix.join(promptFilePath, STAGE_STABILITY, characterFilePath)
      const characterSimilarityFilePath = path.posix.join(promptFilePath, STAGE_SIMILARITY, characterFilePath)
      const characterDiversityFilePath = path.posix.join(promptFilePath, STAGE_DIVERSITY, characterFilePath)

      let stabilityResult = {
        dataCount: 0,
        rate: 0,
        raws: [],
      } as StabilityResult
      let similarityResult = {
        count: 0,
        similarityRate: 0,
        trials: [],
        similarities: []
      } as SimilarityResult
      let diversityResult = {
        count: 0,
        diversityRate: 0,
        trials: [],
        diversities: []
      } as DiversityResult

      try {
        const stabilityFile = await fs.promises.readFile(characterStabilityFilePath, 'utf8')
        const similarityFile = await fs.promises.readFile(characterSimilarityFilePath, 'utf8')
        const diversityFile = await fs.promises.readFile(characterDiversityFilePath, 'utf8')

        stabilityResult = await JSON.parse(stabilityFile) as StabilityResult
        similarityResult = await JSON.parse(similarityFile) as SimilarityResult
        diversityResult = await JSON.parse(diversityFile) as DiversityResult
      } catch (e) {
        const characterLog = `[${new Date().toISOString()}] Processing - prompt: ${prompt} - character: ${character}`
        if (e instanceof Error) {
          await appendLog(logFolderPath, CURRENT_STAGE, `${characterLog} - ${e.message.toString()}`)
        } else if (typeof e === 'string') {
          await appendLog(logFolderPath, CURRENT_STAGE, `${characterLog} - ${e}`)
        }
      }

      const trialScores = [] as TeamTrialScore[]
      const stabilityScores = [] as TeamStabilityScore[]
      const similarityScores = [] as TeamSimilarityScore[]
      const averageStabilityScores = [] as BigNumber[]
      const averageSimilarityScores = [] as BigNumber[]

      for (let i = 0; i < NUM_TRIALS; i++) {
        const stabilityScore = stabilityResult.raws[i]?.score || 0
        const trialStability = new BigNumber(stabilityScore)
        stabilityScores.push({ stabilityScore: trialStability, character, team: prompt, trial: i + 1 })
        const similarityScore = similarityResult.trials[i]?.similarity || 0
        const trialSimilarity = new BigNumber(similarityScore)
        similarityScores.push({ similarityScore: trialSimilarity, character, team: prompt, trial: i + 1 })

        const trialScore = getTrialScore(weights, character, trialStability, trialSimilarity)
        trialScores.push({ trialScore, character, team: prompt, trial: i + 1 })

        const trialLog = `[${new Date().toISOString()}] Calculating trial score - prompt: ${prompt} - character: ${character} - trial: ${i + 1} - stability: ${trialStability} - similarity: ${trialSimilarity} - trial_score: ${trialScore?.toFixed()}`
        appendLog(logFolderPath, CURRENT_STAGE, trialLog)

        averageStabilityScores.push(trialStability)
        averageSimilarityScores.push(trialSimilarity)
      }

      allTeamTrialScores.push({ trialScores, character, team: prompt, stabilityScores, similarityScores })

      const avgStability = getAverageStabilityScore(averageStabilityScores)
      allTeamAverageStabilityScores.push({ avgStability, character, team: prompt })
      const avgSimilarity = getAverageSimilarityScore(averageSimilarityScores)
      allTeamAverageSimilarityScores.push({ avgSimilarity, character, team: prompt })

      const averageLog = `[${new Date().toISOString()}] Calculating average stability and similarity - prompt: ${prompt} - character: ${character} - stability: ${avgStability.toFixed()} - similarity: ${avgSimilarity.toFixed()}`
      appendLog(logFolderPath, CURRENT_STAGE, averageLog)

      const characterScore = getCharacterScore(trialScores.map((x) => x.trialScore), new BigNumber(diversityResult.diversityRate))
      characterScores.push({ characterScore, character, team: prompt })
      allTeamCharacterScores.push({ characterScore, character, team: prompt })
      allTeamDiversityScores.push({ diversityScore: new BigNumber(diversityResult.diversityRate), character, team: prompt })

      const characterLog = `[${new Date().toISOString()}] Calculating character score - prompt: ${prompt} - character: ${character} - character_score: ${characterScore?.toFixed()}`
      appendLog(logFolderPath, CURRENT_STAGE, characterLog)
    }

    const promptScore = getPromptScore(characterScores)
    allTeamPromptScores.push({ team: prompt, promptScore })

    const promptLog = `[${new Date().toISOString()}] Calculating prompt score - prompt: ${prompt} - prompt_score: ${promptScore?.toFixed()}`
    appendLog(logFolderPath, CURRENT_STAGE, promptLog)
  }

  const competitionScore = getCompetitionScore(allTeamPromptScores);

  const competitionLog = `[${new Date().toISOString()}] Calculating competition score - competition_score: ${competitionScore.toFixed()}`
  appendLog(logFolderPath, CURRENT_STAGE, competitionLog)

  const normPromptScores = getNormalizedPromptScores(allTeamPromptScores, competitionScore)

  normPromptScores.forEach((p, i) => {
    const normPromptLog = `[${new Date().toISOString()}] Calculating normalized prompt score - prompt: ${p.team} - normalized_prompt_score: ${p.promptScore} - rank: ${i + 1}`
    appendLog(logFolderPath, CURRENT_STAGE, normPromptLog)
  })

  normPromptScores.forEach((p, i) => {
    allTeamsFinalScoresAndRanks.push({
      team: p.team, normalizedPromptScore: p.promptScore, promptScore: allTeamPromptScores.find(
        (x) => x.team === p.team
      )?.promptScore?.toFixed() || '0', rank: i + 1
    })
  })

  await outputToFiles({
    scores: {
      allTeamTrialScores,
      competitionScore,
      allTeamsFinalScoresAndRanks,
      allTeamAverageStabilityScores,
      allTeamAverageSimilarityScores,
      allTeamDiversityScores,
      allTeamCharacterScores,
    },
    sourceFolder,
    weights
  })
}

type OutputToFilesFunction = {
  scores: {
    allTeamTrialScores: AllTeamTrialScores,
    competitionScore: BigNumber,
    allTeamsFinalScoresAndRanks: AllTeamFinalScoresAndRanks,
    allTeamAverageStabilityScores: AllTeamAverageStabilityScores,
    allTeamAverageSimilarityScores: AllTeamAverageSimilarityScores,
    allTeamDiversityScores: AllTeamDiversityScores,
    allTeamCharacterScores: AllTeamCharacterScores,
  },
  weights: CharacterWeight[],
  sourceFolder: string,
}

async function outputToFiles({
  scores: {
    allTeamTrialScores,
    competitionScore,
    allTeamsFinalScoresAndRanks,
    allTeamAverageStabilityScores,
    allTeamAverageSimilarityScores,
    allTeamDiversityScores,
    allTeamCharacterScores,
  },
  sourceFolder,
  weights
}: OutputToFilesFunction) {
  const allTeamTrialScoresObj = allTeamTrialScores.map((x) => {
    return x.trialScores.map((y) => {
      return {
        teamName: x.team,
        character: y.character,
        trial: y.trial,
        trial_score: y.trialScore?.toFixed(),
        stabilityScore: x.stabilityScores.find((z) => z.team === x.team && z.character === y.character && z.trial === y.trial)?.stabilityScore.toFixed(),
        similarityScore: x.similarityScores.find((z) => z.team === x.team && z.character === y.character && z.trial === y.trial)?.similarityScore.toFixed(),
        diversityScore: allTeamDiversityScores.find((z) => z.team === x.team && z.character === y.character)?.diversityScore.toFixed()
      }
    })
  }).flat()

  const allTeamCharacterScoresObj = allTeamCharacterScores.map((x) => {
    return {
      teamName: x.team,
      character: x.character,
      characterScore: x.characterScore?.toFixed(),
      nonWeightedAverageStabilityScore: allTeamAverageStabilityScores.find((y) => y.team === x.team && y.character === x.character)?.avgStability.toFixed(),
      nonWeightedAverageSimilarityScore: allTeamAverageSimilarityScores.find((y) => y.team === x.team && y.character === x.character)?.avgSimilarity.toFixed(),
      diversityScore: allTeamDiversityScores.find((y) => y.team === x.team && y.character === x.character)?.diversityScore.toFixed()
    }
  })

  const constantsJSON = JSON.stringify({
    competitionScore: competitionScore.toFixed(),
    'weights': weights.map(w => ({
      character: w.character,
      weight: w.weight.toFixed(),
      weightStability: w.weightStability.toFixed(),
      weightSimilarity: w.weightSimilarity.toFixed(),
      weightDiversity: w.weightDiversity.toFixed()
    }))
  })

  const outputDir = await createResultOutputFolder(sourceFolder)
  const constantsOutputFile = path.posix.join(outputDir, 'constants.json')
  await fs.promises.writeFile(constantsOutputFile, constantsJSON)

  try {
    const parser = new AsyncParser()

    const trialsOutputFile = path.posix.join(outputDir, 'trial_scores.csv')
    const charactersOutputFile = path.posix.join(outputDir, 'character_scores.csv')
    const ranksOutputFile = path.posix.join(outputDir, 'prompt_scores_ranks.csv')

    const allTeamTrialScoresCSV = await parser.parse(JSON.stringify(allTeamTrialScoresObj)).promise()
    const allTeamCharacterScoresCSV = await parser.parse(JSON.stringify(allTeamCharacterScoresObj)).promise()
    const allTeamFinalScoresAndRanksCSV = await parser.parse(JSON.stringify(allTeamsFinalScoresAndRanks)).promise()

    await fs.promises.writeFile(trialsOutputFile, allTeamTrialScoresCSV)
    await fs.promises.writeFile(charactersOutputFile, allTeamCharacterScoresCSV)
    await fs.promises.writeFile(ranksOutputFile, allTeamFinalScoresAndRanksCSV)
  } catch (e) {
    console.error(e)
  }
}

main()