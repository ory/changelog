// Copyright © 2022 Ory Corp

"use strict"
const Q = require("q")
const conventionalChangelog = require("./conventional-changelog")
const parserOpts = require("./parser-opts")
const recommendedBumpOpts = require("./conventional-recommended-bump")
const writerOpts = require("./writer-opts")
const readFile = Q.denodeify(require("fs").readFile)
const resolve = require("path").resolve

module.exports = Q.all([
  conventionalChangelog,
  parserOpts,
  recommendedBumpOpts,
  writerOpts,
  readFile(resolve(__dirname, "./templates/email/template.hbs"), "utf-8"),
  readFile(resolve(__dirname, "./templates/email/header.hbs"), "utf-8"),
  readFile(resolve(__dirname, "./templates/email/commit.hbs"), "utf-8"),
  readFile(resolve(__dirname, "./templates/email/footer.hbs"), "utf-8"),
]).spread(
  (
    conventionalChangelog,
    parserOpts,
    recommendedBumpOpts,
    writerOpts,
    template,
    header,
    commit,
    footer,
  ) => {
    writerOpts.mainTemplate = template
    writerOpts.headerPartial = header
    writerOpts.commitPartial = commit
    writerOpts.footerPartial = footer

    return {
      conventionalChangelog,
      parserOpts,
      recommendedBumpOpts,
      writerOpts,
    }
  },
)
