// Copyright © 2024 Ory Corp
// SPDX-License-Identifier: Apache-2.0

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
      if (
        commit.notes.length === 0 &&
        !commit.version &&
        ignoreTypes.includes(commit.type)
      ) {
        return
      }
      const issues = []

      const notes = commit.notes.map((note) => {
        return {
          ...note,
          title: "Breaking Changes",
          isReleaseNote: false,
        }
      })

      let type
      if (commit.revert) {
        type = types.revert
      } else if (types[commit.type]) {
        type = types[commit.type]
      } else {
        type = types.other
      }

      if (commit.version) {
        const message = getGitTagMessage(commit.version)
        if (message.length > 0) {
          notes.unshift({
            text: message,
            title: "",
            isReleaseNote: true,
          })
        }
      }

      const scope = commit.scope === "*" ? "" : commit.scope

      let shortHash = commit.shortHash
      let hash = commit.hash
      if (typeof commit.hash === "string") {
        shortHash = commit.hash.substring(0, 7)
      } else {
        // some commits don't include the hash for some reason, so we extract it from the footer
        hash = commit.footer.split("\n").at(-1).replaceAll("'", "")
        shortHash = hash.substring(0, 7)
      }

      let subject = commit.subject
      if (typeof subject === "string") {
        let url = context.repository
          ? `${context.host}/${context.owner}/${context.repository}`
          : context.repoUrl
        if (url) {
          url = `${url}/issues/`
          // Issue URLs.
          subject = subject.replace(/#([0-9]+)/g, (_, issue) => {
            issues.push(issue)
            return `[#${issue}](${url}${issue})`
          })
        }
        if (context.host) {
          // User URLs.
          subject = subject.replace(
            /\B@([a-z0-9](?:-?[a-z0-9/]){0,38})/g,
            (_, username) => {
              if (username.includes("/")) {
                return `@${username}`
              }

              return `[@${username}](${context.host}/${username})`
            },
          )
        }
        subject = subject.charAt(0).toUpperCase() + subject.substring(1)
      }

      // remove references that already appear in the subject
      const references = commit.references.filter((reference) => {
        if (issues.indexOf(reference.issue) === -1) {
          return true
        }

        return false
      })

      let hasBody = false
      let body = commit.body
      if (typeof body === "string") {
        body = body.replace(/^signed-off-by: .*$/im, "")
        body = body.replace(/^co-authored-by: .*$/im, "")
        if (body.trim().length > 0) {
          body =
            "\n" +
            body
              .split("\n")
              .map((text) => `    ${text}`)
              .join("\n") +
            "\n"
          hasBody = true
        }
      }

      return {
        ...commit,
        notes,
        type,
        scope,
        subject,
        issues,
        references,
        hash,
        shortHash,
        hasBody,
        body,
      }
    },
    groupBy: "type",
    commitGroupsSort: "title",
    commitsSort: ["type", "scope", "subject"],
    noteGroupsSort: "title",
    notesSort: compareFunc,
  }
}
