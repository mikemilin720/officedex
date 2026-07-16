# OfficeDex third-party notices

OfficeDex is distributed under the GNU General Public License v3.0 only.
Release packages include the complete OfficeDex license as
`OfficeDex-GPL-3.0.txt`.

## PPTist

OfficeDex embeds a modified build of
[PPTist](https://github.com/pipipi-pikachu/PPTist), distributed under the
GNU Affero General Public License v3.0. The corresponding source used for the
embedded build is committed under `third_party/pptist`, including
`OFFICEDEX_CHANGES.md`, its build metadata, and its tests.

Release packages include `PPTist-AGPL-3.0.txt`,
`PPTist-OFFICEDEX_CHANGES.md`, and the embedded font notices.

## OfficeCLI

OfficeDex bundles an OfficeCLI executable fetched from
https://github.com/officecli/officecli-dist. OfficeCLI is distributed under
the MIT License. Release packages include `OfficeCLI-MIT.txt`.

## Embedded fonts

PPTist's shipped web fonts and their official source/license metadata are
listed in `third_party/pptist/src/assets/fonts/LICENSES.json`. The matching
upstream license texts are committed beside that manifest and copied into
release packages under `PPTist-font-licenses/`.
