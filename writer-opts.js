// Copyright © 2022 Ory Corp

"use strict"

const compareFunc = require("compare-func")
const Q = require("q")
const readFile = Q.denodeify(require("fs").readFile)
const resolve = require("path").resolve
const exec = require("child_process").execSync

module.exports = Q.all([
  readFile(resolve(__dirname, "./templates/default/template.hbs"), "utf-8"),
  readFile(resolve(__dirname, "./templates/default/header.hbs"), "utf-8"),
  readFile(resolve(__dirname, "./templates/default/commit.hbs"), "utf-8"),
  readFile(resolve(__dirname, "./templates/default/footer.hbs"), "utf-8"),
]).spread((template, header, commit, footer) => {
  const writerOpts = getWriterOpts()

  writerOpts.mainTemplate = template
  writerOpts.headerPartial = header
  writerOpts.commitPartial = commit
  writerOpts.footerPartial = footer

  return writerOpts
})

var types = {
  feat: "Features",
  fix: "Bug Fixes",
  perf: "Performance Improvements",
  refactor: "Code Refactoring",
  security: "Security Improvements",
  docs: "Documentation",
  style: "Styles",
  test: "Tests",
  build: "Build System",
  chore: "Chores",
  autogen: "Code Generation",
  ci: "Continuous Integration",
  revert: "Reverts",
  other: "Unclassified",
}

var ignoreTypes = ["style", "chore", "autogen", "ci"]

function getGitTagMessage(tag) {
  if (!tag) {
    return ""
  }
  var message = exec(`git tag -l --format='%(contents)' v${tag}`).toString()
  // remove possible signatures
  return message.replace(
    /-*BEGIN PGP SIGNATURE-*[\s\S]*-*END PGP SIGNATURE-*/g,
    "",
  )
}

function getWriterOpts() {
  return {
    transform: (commit, context) => {
      let discard = true
      const issues = []

      commit.notes.forEach((note) => {
        note.title = "Breaking Changes"
        note.isReleaseNote = false
        discard = false
      })

      if (commit.revert) {
        commit.type = "revert"
      }

      if (!types[commit.type]) {
        commit.type = "other"
      }

      if (commit.version) {
        discard = false
        const message = getGitTagMessage(commit.version)
        if (message.length > 0) {
          commit.notes.unshift({
            text: message,
            title: "",
            isReleaseNote: true,
          })
        }
      }

      if (ignoreTypes.indexOf(commit.type) > -1 && discard) {
        return
      }

      commit.type = types[commit.type]

      if (commit.scope === "*") {
        commit.scope = ""
      }

      if (typeof commit.hash === "string") {
        commit.shortHash = commit.hash.substring(0, 7)
      }

      if (typeof commit.subject === "string") {
        let url = context.repository
          ? `${context.host}/${context.owner}/${context.repository}`
          : context.repoUrl
        if (url) {
          url = `${url}/issues/`
          // Issue URLs.
          commit.subject = commit.subject.replace(/#([0-9]+)/g, (_, issue) => {
            issues.push(issue)
            return `[#${issue}](${url}${issue})`
          })
        }
        if (context.host) {
          // User URLs.
          commit.subject = commit.subject.replace(
            /\B@([a-z0-9](?:-?[a-z0-9/]){0,38})/g,
            (_, username) => {
              if (username.includes("/")) {
                return `@${username}`
              }

              return `[@${username}](${context.host}/${username})`
            },
          )
        }
        commit.subject =
          commit.subject.charAt(0).toUpperCase() + commit.subject.substring(1)
      }

      // remove references that already appear in the subject
      commit.references = commit.references.filter((reference) => {
        if (issues.indexOf(reference.issue) === -1) {
          return true
        }

        return false
      })

      commit.hasBody = false
      if (typeof commit.body === "string") {
        commit.body = commit.body.replace(/^signed-off-by: .*$/im, "")
        commit.body = commit.body.replace(/^co-authored-by: .*$/im, "")
        if (commit.body.trim().length > 0) {
          commit.body =
            "\n" +
            commit.body
              .split("\n")
              .map((text) => `    ${text}`)
              .join("\n") +
            "\n"
          commit.hasBody = true
        }
      }

      return commit
    },
    groupBy: "type",
    commitGroupsSort: "title",
    commitsSort: ["type", "scope", "subject"],
    noteGroupsSort: "title",
    notesSort: compareFunc,
  }
}
