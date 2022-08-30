# Slack-export2html

## Prerequisites

- `unzip`
- `node`
- `readlink -f` (e.g., GNU coreutils has this option)

## Usage

Please replace `<WorkspaceSlackExportData>` with the name of the Zip archive downloaded from Slack.

```bash
$ slack-export2html <WorkspaceSlackExportData>.zip
```

HTML files will be created in a directory `<WorkspaceSlackExportData>`.
