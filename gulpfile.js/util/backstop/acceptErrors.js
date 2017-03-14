var fs = require('fs')
var path = require('path')
var gutil = require('gulp-util')
var xml2js = require('xml2js')
var parseChangelog = require('changelog-parser')

var parser = new xml2js.Parser()
var report = path.resolve('vrt-output', 'ci-report', 'component-library-xunit.xml')
var changelog = path.resolve('CHANGELOG.md')

var readReport = function (file) {
  return new Promise(function (resolve, reject) {
    fs.readFile(file, function (err, result) {
      if (err) {
        reject(new Error(err))
      } else {
        resolve(result.toString())
      }
    })
  })
}

var findErrors = function (xml) {
  return new Promise(function (resolve, reject) {
    parser.parseString(xml, function (err, results) {
      if (err) {
        reject(new Error(err))
      } else {
        var tests = results.testsuites['$'].errors
          ? results.testsuites.testsuite[0].testcase
          : []

        var errors = tests.filter(function (test) {
          return test.error
        }).map(function (error) {
          return error['$'].name.replace(/[^a-zA-Z0-9-_]*/, '')
        })

        resolve(errors)
      }
    })
  })
}

var getUnreleasedFromChangelog = function (errors) {
  var data = {
    errors: errors,
    changelog: ''
  }

  return new Promise(function (resolve, reject) {
    parseChangelog(changelog, function (err, result) {
      if (err) {
        reject(new Error(err))
      } else {
        var unreleased = result.versions.filter(function (version) {
          return version.title.includes('Unreleased')
        })

        data.changelog = unreleased[0].body
        resolve(data)
      }
    })
  })
}

var findAcceptedErrors = function (data) {
  if (!data.errors.length) {
    return true
  }

  var notAccepted = data.errors.filter(function (error) {
    return !data.changelog.includes(error)
  })

  if (notAccepted.length) {
    var msg = 'ERROR: Failed VRTs not accepted: ' + notAccepted.join(',')
    throw new Error(gutil.log(gutil.colors.red(msg)))
  }
}

var acceptErrors = function (cb) {
  readReport(report)
    .then(findErrors)
    .then(getUnreleasedFromChangelog)
    .then(findAcceptedErrors)
    .catch(function (err) {
      cb(err)
    })
}

module.exports = acceptErrors
