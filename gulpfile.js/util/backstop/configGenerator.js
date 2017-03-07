'use strict'

var fs = require('fs')
var BuildScenarios = require('./BuildScenarios')

var Transform = require('stream').Transform
var util = require('util')

var RemoveBrowserReportOnCI = function (options) {
  Transform.call(this, options)
}

util.inherits(RemoveBrowserReportOnCI, Transform)

RemoveBrowserReportOnCI.prototype._transform = function (chunk, enc, cb) {
  var json = JSON.parse(chunk)

  if (process.env.TRAVIS) {
    json.report.splice(json.report.indexOf('browser'), 1)
  }

  this.push(JSON.stringify(json))
  cb()
}

var getCompLibPaths = function (config) {
  var files = fs.readdirSync(config.compLib.baseDir)

  return files.filter(function (file) {
    return file !== ('index.html' || '') && file.includes('.html')
  })
}

module.exports = function (config) {
  var compLibPaths = getCompLibPaths(config)
  var buildScenarios = new BuildScenarios({objectMode: true}, compLibPaths, config)
  var readConfig = fs.createReadStream(config.vrt.backstopConfigTemplate)
  var writeConfig = fs.createWriteStream(config.vrt.backstopConfig)
  var removeBrowserReportOnCI = new RemoveBrowserReportOnCI({objectMode: true})

  return new Promise(function (resolve, reject) {
    readConfig.setEncoding('utf8')
    readConfig
      .pipe(removeBrowserReportOnCI)
      .pipe(buildScenarios)
      .on('error', reject)
      .pipe(writeConfig)
      .on('error', reject)
      .on('finish', function () {
        resolve('backstop.json created')
      })
  })
}
