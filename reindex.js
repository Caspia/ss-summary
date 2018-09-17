#!/usr/bin/node

/**
 * Read files used by offlineweb to prepare index for display.
 *
 * offlineweb files should be in ~/offlineweb/cache/responses
 *
 * webgrab config files should be in directories under ~/webgrab
 *
 * discoverer results are placed in ~/discoverer
 */

const fs = require('fs-extra')
const URL = require('url').URL
const prettyFormat = require('pretty-format')
const crypto = require('crypto')
const JSDOM = require('jsdom').JSDOM
const commander = require('commander')
const yauzl = require('yauzl-promise')
const expandTilde = require('expand-tilde')
const streamToString = require('stream-to-string')

let directory;
async function main() {
  commander
    .usage('[options] <directory>')
    .arguments('<directory>')
    .description('specify the directory as the root for siteSave files, default is home directory')
    .option('-f, --force', 'Update all summaries, overwriting pre-existing')
    .parse(process.argv)

  let ssDirectory = commander.args[0] || '~/'
  // expand home directory entered as ~
  ssDirectory = expandTilde(ssDirectory)
  console.log(`siteSave files directory: ${ssDirectory}`)

  const configsPath = ssDirectory + '/webgrab'
  const responsePath = ssDirectory + '/offlineweb/cache/responses'
  const resultPath = ssDirectory + '/discoverer'
  fs.ensureDirSync(resultPath)

  // For each directory in webgrab, process config.json
  const files = await fs.readdir(configsPath)
  console.log(`files: ${prettyFormat(files)}`)

  for (const file of files) {
    const json = await fs.readFile(configsPath + '/' + file + '/config.json')
    // console.log(`json: ${json}`)
    const config = JSON.parse(json)
    // console.log(`config: ${prettyFormat(config)}`)
    for (const siteConfig of config) {
      const site = siteConfig.site
      console.log(`site: ${site}`)
      const siteUrl = new URL(site)
      const host = siteUrl.host
      console.log(`host: ${host}`)
      const siteDir = responsePath + '/' + host
      const {encodedHostname, encodedFilename} = encodeUrl(site)
      console.log(`encodedHostname: ${encodedHostname} encodedFilename: ${encodedFilename}`)

      // processing of cache.zip
      const cacheFile = await yauzl.open(configsPath + '/' + file + '/cache.zip')

      // try to locate the entry corresponding to the site
      const fileName = 'responses/' + encodedHostname + '/' + encodedFilename;
      let configEntry, configHeaders;
      await cacheFile.walkEntries(entry => {
        if (entry.fileName === fileName) {
          configEntry = entry
        }
        if (entry.fileName === fileName + '.headers') {
          configHeaders = entry
        }
      })

      // TODO: error handling if not found
      console.log(`entry:\n ${prettyFormat(configEntry.fileName)}`)
      console.log(`headers:\n ${prettyFormat(configHeaders.fileName)}`)
      const htmlStream = await cacheFile.openReadStream(configEntry)
      const content = await streamToString(htmlStream)

      // const contentPath = responsePath + '/' + encodedHostname + '/' + encodedFilename
      //const content = await fs.readFile(contentPath)
      // console.log(`content: ${content}`)
      const dom = new JSDOM(content)
      const title = dom.window.document.title
      console.log(`title: ${title}`)
      const metas = dom.window.document.head.getElementsByTagName('meta')
      console.log(`metas.length: ${metas.length}`)
      const descriptionElement = dom.window.document.head.querySelector('meta[name="description"]')
      console.log(`descriptionElement: ${descriptionElement}`)
      const description = descriptionElement.getAttribute('content')
      console.log(`descripton: ${description}`)

      const headersStream = await cacheFile.openReadStream(configHeaders)
      const headers = JSON.parse(await streamToString(headersStream))
      const date = new Date(headers.date)
      const saved = date.toDateString()
      console.log(`saved: ${saved}`)

      // prepare and write the result
      const result = {
        site,
        description,
        title,
        saved
      }
      await fs.writeJson(resultPath + '/' + encodedHostname + encodedFilename, result)
    }
  }
}

/**
 * Generate the filename for the cached response.
 *
 * We recognize a url for cache writing and reading by the sanitized hostname
 * and path. Hostnames are represented by directories, containing files starting with sanitized
 * paths beginning with '/' so we can represent the empty path.
 *
 * @param {string} siteUrl the url of the desired content
 * @returns {EncodedUrlNames} host and file names
 */
function encodeUrl(siteUrl) {
  const siteUrlObject = new URL(siteUrl)
  const encodedHostname = encodeURIComponent(siteUrlObject.host)
  let encodedFilename = encodeURIComponent(siteUrlObject.pathname)

  // Some urls are too long to be filenames, use a hash instead.
  if (encodedFilename.length > 128) {
    const hash = crypto.createHash('sha256')
    hash.update(encodedFilename)
    encodedFilename = hash.digest('hex')
  }
  return {encodedHostname, encodedFilename}
}

main()
