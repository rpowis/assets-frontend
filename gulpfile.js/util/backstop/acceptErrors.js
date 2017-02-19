var fs = require('fs')
var path = require('path')
var https = require('https')
var xml2js = require('xml2js')

var parser = new xml2js.Parser()
var report = path.resolve('vrt-output', 'ci-report', 'component-library-xunit.xml')

var readReport = function (file) {
  return new Promise (function (resolve, reject) {
    fs.readFile(file, function (err, result) {
      if(err) {
        reject(new Error(err))
      } else {
        resolve(result.toString())
      }
    })
  })
}

var findErrors = function (xml) {
  return new Promise (function (resolve, reject) {
    parser.parseString(xml, function (err, results) {
      if(err) {
        reject(new Error(err))
      } else {
        var tests = results.testsuites['$'].errors
          ? results.testsuites.testsuite[0].testcase
          : []

        var errors = tests.filter(function(test) {
            return test.error
          }).map(function(error) {
            return error['$'].name.replace(/[^a-zA-Z0-9-_]*/, '')
          })

        resolve(errors)
      }
    })
  })
}

var getPullRequestComments = function (errors) {
  var data = {
    errors: errors,
    comments: []
  }

  return new Promise (function (resolve, reject) {
    if (!errors.length) {
      resolve(data)
    }

    // TODO: reliable way of getting PR number outside of travis
    var pr = process.env.TRAVIS_PULL_REQUEST || process.env.PR
    var options = {
      hostname: 'api.github.com',
      path: '/repos/rpowis/assets-frontend/issues/' + pr + '/comments',
      method: 'GET',
      headers: {
        'user-agent': 'node.js'
      }
    }

    https.request(options, function(response) {
      var statusCode = response.statusCode

      if (statusCode !== 200) {
        reject(new Error('Request Failed. Status Code: ' + statusCode))
      }

      var rawData = '';

      response.on('data', function (chunk) {
        rawData += chunk
      })

      response.on('end', function () {
        try {
          // reduce comment bodies to array of strings
          data.comments = JSON.parse(rawData).map(function(comment) {
            return comment.body
          })

          resolve(data)
        } catch (e) {
          reject(new Error(e.message))
        }
      })
    }).on('error', function (err) {
      reject(new Error('Got error: ' + err.message))
    }).end()
  })
}

var findAcceptedErrors = function (data) {
  if (!data.comments.length || !data.errors.length) {
    return false
  }

  var notAccepted = data.errors.filter(function (error) {
    return data.comments.every(function (comment) {
      var re = new RegExp('accept[\\s\\S]*?vrt[\\s\\S]*?' + error, 'i')
      return !comment.match(re)
    })
  })

  if (notAccepted.length) {
    throw new Error('Failed VRTs not accepted: ' + notAccepted.join(','))
  }
}

var acceptErrors = function(cb) {
  readReport(report)
    .then(findErrors)
    .then(getPullRequestComments)
    .then(findAcceptedErrors)
    .catch(function(err) {
      cb(err)
    })
}

module.exports = acceptErrors
