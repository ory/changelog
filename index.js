// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0

"use strict"
const Q = require("q")
const conventionalChangelog = require("./conventional-changelog")
const parserOpts = require("./parser-opts")
const recommendedBumpOpts = require("./conventional-recommended-bump")
const writerOpts = require("./writer-opts")

module.exports = Q.all([
  conventionalChangelog,
  parserOpts,
  recommendedBumpOpts,
  writerOpts,
]).spread(
  (conventionalChangelog, parserOpts, recommendedBumpOpts, writerOpts) => {
    return {
      conventionalChangelog,
      parserOpts,
      recommendedBumpOpts,
      writerOpts,
    }
  },
)
