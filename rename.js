#!/usr/bin/env node

const fs = require('fs')
const readline = require('readline')

const originalDescription = 'Template to support rapid delivery of microservices for ADP Platform. It contains the configuration needed to deploy a simple Hapi Node server to the Azure Kubernetes Platform.'
const originalNamespace = 'adp-demo'
const originalProjectName = 'adp-frontend-template-node'
const originalHelmDir = './helm/adp-frontend-template-node'
const originalInfraHelmDir = './helm/adp-frontend-template-node-infra'

function processInput (args) {
  const [, , projectName, description, frontendType, tokenize, namespace] = args
  if (args.length === 2) {
    console.error(
      'Please enter a new name and description for the project e.g. ffc-demo-web-internal "Frontend for demo workstream".'
    )
    process.exit(1)
  }
  if (!tokenize) {
    if (
      args.length !== 5 ||
      !projectName ||
      projectName.split('-').length < 3 ||
      !description
    ) {
      const errMsg = [
        'Please enter a new name, description and frontend type (internal/external) for the project.',
        'The name must contain two hypens and be of the form "<program>-<worksream>-<repo>" e.g. "ffc-demo-web-internal".',
        'The description must not be empty and be wrapped in quotes e.g. "excellent new description".'
      ]
      console.error(errMsg.join('\n'))
      process.exit(1)
    }
    let appType = frontendType.toLowerCase()
    if (appType !== 'internal' && appType !== 'external') {
      appType = 'external'
    }
    return { description, projectName, appType }
  } else {
    if (!namespace) {
      console.error(
        'Namespace/workstream name needs to be specified for tokenization'
      )
      process.exit(1)
    }
    const appType = 'scaffolder'
    return { description, projectName, namespace, tokenize, appType }
  }
}

async function confirmRename (projectName, description) {
  const affirmativeAnswer = 'yes'
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  return new Promise((resolve, reject) => {
    rl.question(`Do you want to rename the project to '${projectName}', with a description of '${description}'?\nType '${affirmativeAnswer}' to confirm\n`, (answer) => {
      rl.close()
      resolve(answer === affirmativeAnswer)
    })
  })
}

function getScriptDir () {
  return './scripts'
}

function getHelmDir (projectName) {
  return `./helm/${projectName}`
}

function getInfraHelmDir (projectName) {
  return `./helm/${projectName}-infra`
}

async function getHelmFiles (projectName) {
  const helmDir = getHelmDir(projectName)
  const baseFiles = ['Chart.yaml', 'values.yaml']
  const templateFiles = ['templates/_container.yaml', 'templates/config-map.yaml', 'templates/deployment.yaml', 'templates/ingress.yaml', 'templates/service.yaml']
  const files = [...baseFiles, ...templateFiles]

  return files.map((file) => {
    return `${helmDir}/${file}`
  })
}

async function getInfraHelmFiles (projectName) {
  const helmDir = getInfraHelmDir(projectName)
  const baseFiles = ['Chart.yaml', 'values.yaml']
  const templateFiles = ['templates/namespace-queue.yaml', 'templates/userassignedidentity.yaml']
  const files = [...baseFiles, ...templateFiles]

  return files.map((file) => {
    return `${helmDir}/${file}`
  })
}

function getRootFiles () {
  return ['docker-compose.yaml', 'docker-compose.override.yaml', 'docker-compose.debug.yaml', 'docker-compose.test.yaml', 'docker-compose.test.watch.yaml', 'docker-compose.test.debug.yaml', 'package.json', 'package-lock.json', 'catalog-info.yaml']
}

function getCIpipelineFile () {
  return ['./.azuredevops/build.yaml']
}

function getScriptFiles () {
  const scriptDir = getScriptDir()
  const files = ['test']
  return files.map((file) => {
    return `${scriptDir}/${file}`
  })
}

function getNamespace (projectName, namespace) {
  if (!namespace) {
    const firstIndex = projectName.indexOf('-')
    const secondIndex = projectName.indexOf('-', firstIndex + 1)
    return projectName.substring(0, secondIndex)
  }
  return namespace
}

async function renameDirs (projectName) {
  await fs.promises.rename(originalHelmDir, `./helm/${projectName}`)
  await fs.promises.rename(originalInfraHelmDir, `./helm/${projectName}-infra`)
}

function getAppFiles () {
  return ['./app/views/home.njk', './app/plugins/views.js']
}

async function updateProjectName (projectName, namespace) {
  const rootFiles = getRootFiles()
  const buildYaml = getCIpipelineFile()
  const helmFiles = await getHelmFiles(projectName)
  const infraHelmFiles = await getInfraHelmFiles(projectName)
  const scriptFiles = await getScriptFiles()
  const viewFiles = getAppFiles()
  const filesToUpdate = [
    ...rootFiles,
    ...helmFiles,
    ...infraHelmFiles,
    ...scriptFiles,
    ...buildYaml,
    ...viewFiles
  ]
  const ns = getNamespace(projectName, namespace)

  console.log(
    `Updating projectName from '${originalProjectName}', to '${projectName}'. In...`
  )
  await Promise.all(
    filesToUpdate.map(async (file) => {
      console.log(file)
      const content = await fs.promises.readFile(file, 'utf8')
      const projectNameRegex = new RegExp(originalProjectName, 'g')
      const namespaceRegex = new RegExp(originalNamespace, 'g')
      const updatedContent = content
        .replace(projectNameRegex, projectName)
        .replace(namespaceRegex, ns)
      return fs.promises.writeFile(file, updatedContent)
    })
  )
  console.log('Completed projectName update.')
}

async function updateProjectDescription (projectName, description) {
  const helmDir = await getHelmDir(projectName)
  const infraHelmDir = await getInfraHelmDir(projectName)
  const filesToUpdate = ['package.json', `${helmDir}/Chart.yaml`, `${infraHelmDir}/Chart.yaml`, 'catalog-info.yaml']

  console.log(`Updating description from '${originalDescription}', to '${description}'. In...`)
  await Promise.all(filesToUpdate.map(async (file) => {
    console.log(file)
    const content = await fs.promises.readFile(file, 'utf8')
    const updatedContent = content.replace(originalDescription, description)
    return fs.promises.writeFile(file, updatedContent)
  }))
  console.log('Completed description update.')
}

async function updateReadme (projectName, description) {
  const file = 'README.md'
  console.log(`Updating ${file}...`)
  const header = [`# ${projectName}`, description]
  const content = await fs.promises.readFile(file, 'utf8')
  const indexToKeep = content.indexOf('## Prerequisites')
  const contentKeep = content.substring(indexToKeep)
  const updatedContent = [header.join('\n'), contentKeep].join('\n')
  await fs.promises.writeFile(file, updatedContent)
  console.log(`${file} update completed`)
}

function getRawTokenFiles () {
  return ['./app/views/home.njk', './.azuredevops/build.yaml']
}
async function removeRawTokens () {
  const filesToUpdate = getRawTokenFiles()
  console.log(
    'Removing raw tokens in...'
  )
  await Promise.all(
    filesToUpdate.map(async (file) => {
      console.log(file)
      const content = await fs.promises.readFile(file, 'utf8')
      const rawToken = '{% raw %}'
      const endRawToken = '{% endraw %}'
      const rawRegex = new RegExp(rawToken, 'g')
      const endRawRegex = new RegExp(endRawToken, 'g')
      const updatedContent = content
        .replace(rawRegex, '')
        .replace(endRawRegex, '')
      return fs.promises.writeFile(file, updatedContent)
    })
  )
  console.log('Completed raw token removal.')
}

async function renderUiTypeLayoutTemplate (frontendType) {
  console.log('Rendering template files for UI type:', frontendType)
  const layoutFiles = [{ name: 'external', path: './app/views/_layout.external.template.njk' },
    { name: 'internal', path: './app/views/_layout.internal.template.njk' },
    { name: 'scaffolder', path: './app/views/_layout.scaffolder.template.njk' }
  ]
  const filesToRemove = layoutFiles.filter((x) => x.name !== frontendType).map((x) => x.path)
  await removeFiles(filesToRemove)
  const fileToRename = layoutFiles.filter((x) => x.name === frontendType)[0]
  await renameFile(fileToRename)
}

async function removeFiles (files) {
  console.log('Removing files not required for UI type')
  await Promise.all(
    files.map(async (file) => {
      console.log(file)
      return fs.promises.unlink(file)
    })
  )
  console.log('Removing files completed')
}

async function renameFile (obj) {
  console.log('Renaming file: ', obj.path)
  const newPath = obj.path.replace(`.${obj.name}`, '')
  await fs.promises.rename(obj.path, newPath)
  console.log('Rename file completed to ', newPath)
}

async function rename () {
  const { description, projectName, namespace, appType, tokenize } = processInput(process.argv)
  const rename = await confirmRename(projectName, description)
  if (rename) {
    await renameDirs(projectName)
    await updateProjectName(projectName, namespace)
    await updateProjectDescription(projectName, description)
    await updateReadme(projectName, description)
    await renderUiTypeLayoutTemplate(appType)
    if (!tokenize) {
      await removeRawTokens()
    }
  } else {
    console.log('Project has not been renamed.')
  }
}

rename()
