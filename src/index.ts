import { CharacterWeight, SimilarityResult, StabilityResult, getAverageSimilarityScore, getAverageStabilityScore, getCharacterScore, getCompetitionScore, getNormalizedPromptScores, getPromptScore, getTrialScore, getWeights } from './score';
import { appendLog, createLogFolder, createOutputFolder, listAllDirs, listAllFiles, listCharactersDirs } from './file-utils';

// @ts-ignore
import { AsyncParser } from '@json2csv/node';
import BigNumber from 'bignumber.js'
import fs from 'fs'
import parseArgs from 'minimist'
import path from 'path'

export const STAGE_STABILITY = 'stability'
export const STAGE_SIMILARITY = 'similarity'
export const NUM_TRIALS = 10

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
type AllTeamCharacterScores = { characterScore: BigNumber, character: string, team: string }[]

async function main() {
  const { sFolder, sourceFolder } = getSourcePathFromArgument();

  const logFolderPath = await createLogFolder(sFolder)
  const prompts = await listAllDirs(sFolder)

  const weights = await getWeights(sFolder)

  const allTeamTrialScores = [] as AllTeamTrialScores
  const allTeamAverageStabilityScores = [] as AllTeamAverageStabilityScores
  const allTeamAverageSimilarityScores = [] as AllTeamAverageSimilarityScores
  const allTeamCharacterScores = [] as AllTeamCharacterScores
  const allTeamPromptScores = [] as AllTeamPromptScores
  const allTeamsFinalScoresAndRanks = [] as AllTeamFinalScoresAndRanks

  for (const prompt of prompts) {
    const teamLog = `[${new Date().toISOString().replaceAll(':', '_')}] Processing - prompt: ${[prompt]}`
    await appendLog(logFolderPath, teamLog)

    const promptFilePath = path.posix.join(sFolder, prompt)

    let stability = [] as string[]
    let similarity = [] as string[]

    try {
      const stabilityPath = path.posix.join(promptFilePath, STAGE_STABILITY)
      stability = await listAllFiles(stabilityPath)
    } catch (e) {
      const promptLog = `[${new Date().toISOString().replaceAll(':', '_')}] Processing - prompt: ${prompt} - Failed`
      if (e instanceof Error) {
        await appendLog(logFolderPath, `${promptLog} - ${e.message.toString()}`)
      } else if (typeof e === 'string') {
        await appendLog(logFolderPath, `${promptLog} - ${e}`)
      }
    }

    try {
      const similarityPath = path.posix.join(promptFilePath, STAGE_SIMILARITY)
      similarity = await listAllFiles(similarityPath)
    } catch (e) {
      const promptLog = `[${new Date().toISOString().replaceAll(':', '_')}] Processing - prompt: ${prompt} - Failed`
      if (e instanceof Error) {
        await appendLog(logFolderPath, `${promptLog} - ${e.message.toString()}`)
      } else if (typeof e === 'string') {
        await appendLog(logFolderPath, `${promptLog} - ${e}`)
      }
    }

    if (stability.length !== 0 && similarity.length !== 0) {
      const promptLog = `[${new Date().toISOString().replaceAll(':', '_')}] Processing - prompt: ${prompt} - Failed`
      await appendLog(logFolderPath, `${promptLog} - Stability files or similarity files are not exist.`)

      if (stability.length !== similarity.length) {
        const promptLog = `[${new Date().toISOString().replaceAll(':', '_')}] Processing - prompt: ${prompt} - Failed`
        await appendLog(logFolderPath, `${promptLog} - Number of stability files and similarity files are not equal.`)
        return
      }
    }

    const characterScores = [] as TeamCharacterScore[]

    for (const characterFilePath of similarity) {
      const character = characterFilePath.replace('.json', '')
      const characterStabilityFilePath = path.posix.join(promptFilePath, STAGE_STABILITY, characterFilePath)
      const characterSimilarityFilePath = path.posix.join(promptFilePath, STAGE_SIMILARITY, characterFilePath)

      const stabilityFile = await fs.promises.readFile(characterStabilityFilePath, 'utf8')
      const similarityFile = await fs.promises.readFile(characterSimilarityFilePath, 'utf8')

      const stabilityResult = await JSON.parse(stabilityFile) as StabilityResult
      const similarityResult = await JSON.parse(similarityFile) as SimilarityResult

      const trialScores = [] as TeamTrialScore[]
      const stabilityScores = [] as TeamStabilityScore[]
      const similarityScores = [] as TeamSimilarityScore[]
      const averageStabilityScores = [] as BigNumber[]
      const averageSimilarityScores = [] as BigNumber[]

      for (let i = 0; i < NUM_TRIALS; i++) {
        const trialStability = new BigNumber(stabilityResult.raws[i].score) || new BigNumber(0)
        stabilityScores.push({ stabilityScore: trialStability, character, team: prompt, trial: i + 1 })
        const trialSimilarity = new BigNumber(similarityResult.trials[i].similarity) || new BigNumber(0)
        similarityScores.push({ similarityScore: trialSimilarity, character, team: prompt, trial: i + 1 })

        const trialScore = getTrialScore(weights, character, trialStability, trialSimilarity)
        trialScores.push({ trialScore, character, team: prompt, trial: i + 1 })

        const trialLog = `[${new Date().toISOString().replaceAll(':', '_')}] Calculating trial score - prompt: ${prompt} - character: ${character} - trial: ${i + 1} - stability: ${trialStability} - similarity: ${trialSimilarity} - trial_score: ${trialScore?.toFixed()}`
        appendLog(logFolderPath, trialLog)

        averageStabilityScores.push(trialStability)
        averageSimilarityScores.push(trialSimilarity)
      }

      allTeamTrialScores.push({ trialScores, character, team: prompt, stabilityScores, similarityScores })

      const avgStability = getAverageStabilityScore(averageStabilityScores)
      allTeamAverageStabilityScores.push({ avgStability, character, team: prompt })
      const avgSimilarity = getAverageSimilarityScore(averageSimilarityScores)
      allTeamAverageSimilarityScores.push({ avgSimilarity, character, team: prompt })

      const averageLog = `[${new Date().toISOString().replaceAll(':', '_')}] Calculating average stability and similarity - prompt: ${prompt} - character: ${character} - stability: ${avgStability.toFixed()} - similarity: ${avgSimilarity.toFixed()}`
      appendLog(logFolderPath, averageLog)

      const characterScore = getCharacterScore(trialScores.map((x) => x.trialScore))
      characterScores.push({ characterScore, character, team: prompt })
      allTeamCharacterScores.push({ characterScore, character, team: prompt })

      const characterLog = `[${new Date().toISOString().replaceAll(':', '_')}] Calculating character score - prompt: ${prompt} - character: ${character} - character_score: ${characterScore?.toFixed()}`
      appendLog(logFolderPath, characterLog)
    }

    const promptScore = getPromptScore(characterScores)
    allTeamPromptScores.push({ team: prompt, promptScore })

    const promptLog = `[${new Date().toISOString().replaceAll(':', '_')}] Calculating prompt score - prompt: ${prompt} - prompt_score: ${promptScore?.toFixed()}`
    appendLog(logFolderPath, promptLog)
  }

  const competitionScore = getCompetitionScore(allTeamPromptScores);

  const competitionLog = `[${new Date().toISOString().replaceAll(':', '_')}] Calculating competition score - competition_score: ${competitionScore.toFixed()}`
  appendLog(logFolderPath, competitionLog)

  const normPromptScores = getNormalizedPromptScores(allTeamPromptScores, competitionScore)

  normPromptScores.forEach((p, i) => {
    const normPromptLog = `[${new Date().toISOString().replaceAll(':', '_')}] Calculating normalized prompt score - prompt: ${p.team} - normalized_prompt_score: ${p.promptScore} - rank: ${i + 1}`
    appendLog(logFolderPath, normPromptLog)
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
      allTeamCharacterScores,
    },
    sourceFolder,
    weights
  })
}

main()

type OutputToFilesFunction = {
  scores: {
    allTeamTrialScores: AllTeamTrialScores,
    competitionScore: BigNumber,
    allTeamsFinalScoresAndRanks: AllTeamFinalScoresAndRanks,
    allTeamAverageStabilityScores: AllTeamAverageStabilityScores,
    allTeamAverageSimilarityScores: AllTeamAverageSimilarityScores,
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
        trial_Score: y.trialScore?.toFixed(),
        stabilityScore: x.stabilityScores.find((z) => z.team === x.team && z.character === y.character && z.trial === y.trial)?.stabilityScore.toFixed(),
        similarityScore: x.similarityScores.find((z) => z.team === x.team && z.character === y.character && z.trial === y.trial)?.similarityScore.toFixed()
      }
    })
  }).flat()

  const allTeamCharacterScoresObj = allTeamCharacterScores.map((x) => {
    return {
      teamName: x.team,
      character: x.character,
      characterScore: x.characterScore?.toFixed(),
      nonWeightedAverageStabilityScore: allTeamAverageStabilityScores.find((y) => y.team === x.team && y.character === x.character)?.avgStability.toFixed(),
      nonWeightedAverageSimilarityScore: allTeamAverageSimilarityScores.find((y) => y.team === x.team && y.character === x.character)?.avgSimilarity.toFixed()
    }
  })

  const constantsJSON = JSON.stringify({
    competitionScore: competitionScore.toFixed(),
    'weights': weights.map(w => ({
      character: w.character,
      weight: w.weight.toFixed(),
      weightStability: w.weightStability.toFixed(),
      weightSimilarity: w.weightSimilarity.toFixed()
    }))
  })

  const outputDir = await createOutputFolder(sourceFolder)
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

function getSourcePathFromArgument() {
  const args = parseArgs(process.argv.slice(2));
  const argv = process.platform === 'win32' ? args['_'] : args['s'];
  if (argv === undefined) {
    throw Error('Insufficient parameters to work with.');
  }

  const sourceFolder = argv + '/';
  const sFolder = path.posix.resolve(sourceFolder);
  return { sFolder, sourceFolder };
}