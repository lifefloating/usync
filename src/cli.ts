#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { Command } from "commander";
import { discoverSyncItems } from "./discovery.js";
import { GistClient } from "./gist-client.js";
import { resolveProviders } from "./providers.js";
import { createProgressReporter } from "./progress.js";
import { downloadFromGist, uploadToGist } from "./sync.js";
import { bullet, fail, info, section, success, warn } from "./ui.js";

interface BaseOptions {
  providers?: string;
  cwd?: string;
  token?: string;
  progress?: boolean;
}

interface TokenOptions {
  token?: string;
  tokenEnv?: string;
}

interface ResolvedToken {
  token?: string;
  source: string;
}

function resolveToken(opts: TokenOptions): ResolvedToken {
  if (opts.token) return { token: opts.token, source: "--token" };
  const envName = opts.tokenEnv ?? "GITHUB_TOKEN";
  const fromPreferred = process.env[envName];
  if (fromPreferred) return { token: fromPreferred, source: envName };
  const fromGhToken = process.env.GH_TOKEN;
  if (fromGhToken) return { token: fromGhToken, source: "GH_TOKEN" };
  return { token: undefined, source: "none" };
}

function ensureToken(opts: TokenOptions): string {
  const resolved = resolveToken(opts);
  if (!resolved.token) {
    throw new Error(
      "GitHub token not found. Create one at https://github.com/settings/tokens/new (scope: gist), then pass --token <PAT> or set GITHUB_TOKEN/GH_TOKEN.",
    );
  }
  info(`Using GitHub token from ${resolved.source}`);
  return resolved.token;
}

const program = new Command();

program
  .name("usync")
  .description("Sync ClaudeCode/OpenCode/Codex/Gemini CLI configs and skills to GitHub Gist")
  .version("0.1.0");

program
  .command("init")
  .description("Validate token and gist access, optionally create a new gist")
  .option("--token <token>", "GitHub PAT")
  .option("--token-env <name>", "Token environment variable name", "GITHUB_TOKEN")
  .option("--gist-id <id>", "Existing gist ID to verify access")
  .option("--description <text>", "Description for new gist", "cloudSettings")
  .option("--public", "Create public gist when gist-id is omitted", false)
  .action(
    async (opts: TokenOptions & { gistId?: string; description: string; public: boolean }) => {
      section("Initialize usync");
      const token = ensureToken(opts);

      const gistClient = new GistClient(token);
      const user = await gistClient.getAuthenticatedUser();
      success(`Token valid for: ${user.login}`);

      if (opts.gistId) {
        const gist = await gistClient.getGist(opts.gistId);
        success(`Gist accessible: ${gist.id}`);
        bullet(`description: ${gist.description ?? "no description"}`);
        return;
      }

      const gist = await gistClient.createGist({
        description: opts.description,
        isPublic: opts.public,
        files: {
          "usync-init.txt": { content: `initialized at ${new Date().toISOString()}` },
        },
      });
      success(`Created gist: ${gist.id}`);
      bullet(`URL: https://gist.github.com/${gist.id}`);
    },
  );

program
  .command("scan")
  .description("Scan and list discovered local files")
  .option("--providers <names>", "Comma-separated providers: claudecode,opencode,codex,gemini-cli")
  .option("--cwd <dir>", "Project root for project-level config discovery", process.cwd())
  .action(async (opts: BaseOptions) => {
    const projectRoot = path.resolve(opts.cwd ?? process.cwd());
    const providers = resolveProviders(opts.providers);
    const items = await discoverSyncItems(providers, projectRoot);
    if (items.length === 0) {
      warn("No files found for selected providers.");
      return;
    }

    section(`Scan result: ${items.length} files`);
    for (const item of items) {
      bullet(`[${item.provider}/${item.category}] ${item.absolutePath}`);
    }
  });

program
  .command("upload")
  .description("Upload discovered files to a GitHub Gist")
  .option("--token <token>", "GitHub PAT (scope: gist write)")
  .option("--token-env <name>", "Token environment variable name", "GITHUB_TOKEN")
  .option("--gist-id <id>", "Existing gist ID; if omitted a new gist is created")
  .option("--description <text>", "Gist description", "cloudSettings")
  .option("--public", "Create public gist when gist-id is omitted", false)
  .option("--providers <names>", "Comma-separated providers: claudecode,opencode,codex,gemini-cli")
  .option("--cwd <dir>", "Project root for project-level config discovery", process.cwd())
  .option("--watch", "Keep polling and auto-upload changes", false)
  .option("--interval <seconds>", "Polling interval in seconds (watch mode)", "15")
  .option("--no-progress", "Disable progress output")
  .action(async (opts: BaseOptions & TokenOptions & { gistId?: string; description: string; public: boolean; watch: boolean; interval: string }) => {
    section("Upload to gist");
    const token = ensureToken(opts);
    const projectRoot = path.resolve(opts.cwd ?? process.cwd());
    const providers = resolveProviders(opts.providers);
    const gistClient = new GistClient(token);
    const user = await gistClient.getAuthenticatedUser();
    success(`Authenticated as ${user.login}`);
    const runUploadOnce = async (): Promise<void> => {
      const items = await discoverSyncItems(providers, projectRoot);
      if (items.length === 0) {
        warn("No local config files found. Nothing to upload.");
        return;
      }

      const progress = createProgressReporter(opts.progress ?? true);
      const result = await uploadToGist({
        gistClient,
        gistId: opts.gistId,
        description: opts.description,
        isPublic: opts.public,
        localItems: items,
        onProgress: progress,
      });

      success(`Gist ${result.created ? "created" : "updated"}: ${result.gistId}`);
      info(`Uploaded/changed: ${result.plan.changed.length}`);
      for (const item of result.plan.changed) {
        bullet(`+ ${item.relativeLabel}`);
      }
      info(`Deleted from remote: ${result.plan.deletedTemplatePaths.length}`);
      for (const removed of result.plan.deletedTemplatePaths) {
        bullet(`- ${removed}`);
      }
      info(`Unchanged: ${result.plan.unchanged.length}`);
    };

    if (!opts.watch) {
      await runUploadOnce();
      return;
    }

    const intervalMs = Math.max(3, Number(opts.interval || "15")) * 1000;
    info(`Watch interval: ${intervalMs / 1000}s`);
    const { createHash } = await import("node:crypto");
    const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

    let stop = false;
    process.on("SIGINT", () => {
      stop = true;
    });

    let lastFingerprint = "";
    while (!stop) {
      const items = await discoverSyncItems(providers, projectRoot);
      const fingerprint = createHash("sha256")
        .update(
          items
            .map((item) => `${item.templatePath}:${createHash("sha256").update(item.content).digest("hex")}`)
            .join("\n"),
        )
        .digest("hex");

      if (fingerprint !== lastFingerprint) {
        await runUploadOnce();
        lastFingerprint = fingerprint;
      }

      await sleep(intervalMs);
    }
    warn("upload watch stopped");
  });

program
  .command("download")
  .description("Download synced files from a GitHub Gist")
  .requiredOption("--gist-id <id>", "Gist ID")
  .option("--token <token>", "GitHub PAT (recommended for private gist access)")
  .option("--token-env <name>", "Token environment variable name", "GITHUB_TOKEN")
  .option("--cwd <dir>", "Project root for project-level target resolution", process.cwd())
  .option("--output-root <dir>", "Override restore destination; write into this sandbox path")
  .option("--force", "Overwrite local files even if local mtime is newer", false)
  .option("--strict-manifest", "Require usync manifest; disable raw gist fallback", false)
  .option("--no-progress", "Disable progress output")
  .action(
    async (
      opts: BaseOptions & TokenOptions & { gistId: string; outputRoot?: string; force: boolean; strictManifest: boolean },
    ) => {
    const projectRoot = path.resolve(opts.cwd ?? process.cwd());
    section("Download from gist");
    const resolvedToken = resolveToken(opts);
    if (resolvedToken.token) {
      info(`Using GitHub token from ${resolvedToken.source}`);
    } else {
      warn("No token found, trying anonymous gist access.");
    }
    const gistClient = new GistClient(resolvedToken.token);
    const progress = createProgressReporter(opts.progress ?? true);

    const result = await downloadFromGist({
      gistClient,
      gistId: opts.gistId,
      projectRoot,
      outputRoot: opts.outputRoot,
      force: opts.force,
      allowRawFallback: !opts.strictManifest,
      onProgress: progress,
    });

    success(`Downloaded: ${result.downloaded.length}`);
    for (const file of result.downloaded) {
      bullet(`+ ${file}`);
    }
    info(`Skipped: ${result.skipped.length}`);
    for (const file of result.skipped) {
      bullet(`- ${file}`);
    }
    },
  );

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(`usync error: ${message}`);
  process.exitCode = 1;
});
