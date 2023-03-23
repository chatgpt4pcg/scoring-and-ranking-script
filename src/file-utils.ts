import fs from 'fs'
import path from 'path'

const RESULT_FOLDER_NAME = 'result'
const LOG_FOLDER_NAME = 'logs'
const START_TIME = new Date().toISOString().replace(":", "_")

export async function listAllDirs(sourceFolder: string) {
  const files = await fs.promises.readdir(sourceFolder)
  const directories = []
  for (const file of files) {
    const fPath = path.posix.join(sourceFolder, file)
    const fileState = await fs.promises.stat(fPath)
    if (fileState.isDirectory() && !file.startsWith('.') && file !== LOG_FOLDER_NAME && file !== RESULT_FOLDER_NAME) {
      directories.push(file)
    }
  }
  return directories
}

export async function listAllFiles(sourceFolder: string) {
  const files = await fs.promises.readdir(sourceFolder)
  const out = []
  for (const file of files) {
    const fPath = path.posix.join(sourceFolder, file)
    const fileStat = await fs.promises.stat(fPath)
    const isDirectory = fileStat.isDirectory()
    const fileName = file.split('/')[file.split('/').length - 1]
    if (!isDirectory && !fileName.startsWith('.')) {
      out.push(fileName)
    }
  }
  return out
}

export async function listCharactersDirs(sourceFolder: string, stage: string) {
  const fPath = path.posix.join(sourceFolder, stage)
  const characters = await listAllDirs(fPath)
  return characters
}

export async function createOutputFolder(sourceFolder: string) {
  const outputDir = path.posix.join(sourceFolder, RESULT_FOLDER_NAME)

  if (!fs.existsSync(outputDir)) {
    await fs.promises.mkdir(outputDir)
  }
  
  return outputDir
}

export async function createLogFolder(sourceFolder: string) {
  const outputDir = path.posix.join(sourceFolder, LOG_FOLDER_NAME)
  if (!fs.existsSync(outputDir)) {
    fs.promises.mkdir(outputDir)
  }
  return outputDir
}

export async function appendLog(logFolderPath: string, log: string) {
  console.log(log)
  const logFilePath = path.posix.join(logFolderPath, `result_log_${START_TIME}.txt`)
  if (!fs.existsSync(logFilePath)) {
    await fs.promises.writeFile(logFilePath, '')
  }

  await fs.promises.appendFile(logFilePath, `${log}\n`)
}
