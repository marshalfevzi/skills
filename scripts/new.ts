#!/usr/bin/env bun
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

/**
 * Downloads a file from a URL and saves it to the destination path.
 */
async function downloadFile(url: string, destPath: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }
    const content = await response.text();
    await mkdir(dirname(destPath), { recursive: true });
    await Bun.write(destPath, content);
  } catch (error: any) {
    console.error(`  [Error] Failed to download ${url}: ${error.message}`);
  }
}

/**
 * Recursively fetches files from a GitHub repository using the Contents API.
 */
async function fetchGitHubRecursive(owner: string, repo: string, path: string, branch: string, baseDir: string) {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  
  const response = await fetch(apiUrl, {
    headers: {
      "User-Agent": "Bun-Skill-Creator",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });

  if (!response.ok) {
    if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
      throw new Error("GitHub API rate limit exceeded. Please set GITHUB_TOKEN environment variable.");
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText} for ${apiUrl}`);
  }

  const data = await response.json();

  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.type === "dir") {
        await fetchGitHubRecursive(owner, repo, item.path, branch, baseDir);
      } else if (item.type === "file") {
        if (item.name.endsWith(".md") || item.name.endsWith(".mdx") || item.name.endsWith(".txt")) {
          const destPath = join(baseDir, item.path);
          console.log(`  [GitHub] Fetching ${item.path}...`);
          await downloadFile(item.download_url, destPath);
        }
      }
    }
  } else if (data.type === "file") {
    if (data.name.endsWith(".md") || data.name.endsWith(".mdx") || data.name.endsWith(".txt")) {
      const destPath = join(baseDir, data.path);
      console.log(`  [GitHub] Fetching ${data.path}...`);
      await downloadFile(data.download_url, destPath);
    }
  }
}

/**
 * Parses a GitHub URL to extract owner, repo, branch, and path.
 */
function parseGitHubUrl(url: string) {
  // Matches:
  // https://github.com/owner/repo
  // https://github.com/owner/repo/tree/branch/path
  // https://github.com/owner/repo/blob/branch/path
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/(tree|blob)\/([^/]+)\/(.*))?/);
  if (!match) return null;
  
  return {
    owner: match[1],
    repo: match[2],
    type: match[3] || "tree",
    branch: match[4] || "main",
    path: match[5] || "",
  };
}

async function main() {
  const skillName = prompt("Name of the new skill:");
  if (!skillName) {
    console.log("Skill name is required. Exiting.");
    return;
  }

  const skillTmpDir = join(process.cwd(), "@tmp", skillName);
  await mkdir(skillTmpDir, { recursive: true });

  let url = prompt("Enter URL:");
  
  while (url && url.trim() !== "") {
    url = url.trim();
    try {
      const github = parseGitHubUrl(url);
      if (github) {
        console.log(`Processing GitHub repository: ${github.owner}/${github.repo} (${github.path || "root"})...`);
        await fetchGitHubRecursive(github.owner, github.repo, github.path, github.branch, skillTmpDir);
      } else if (url.endsWith(".md") || url.endsWith(".mdx") || url.endsWith(".txt")) {
        const filename = url.split("/").pop() || "file.txt";
        const destPath = join(skillTmpDir, filename);
        console.log(`Downloading direct file: ${url}...`);
        await downloadFile(url, destPath);
      } else {
        console.log(`Using markdown.new fallback for: ${url}...`);
        const markdownNewUrl = `https://markdown.new/${url}`;
        // Create a filename based on the URL
        const sanitizedUrl = url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]/gi, "_").toLowerCase();
        const destPath = join(skillTmpDir, `${sanitizedUrl}.md`);
        await downloadFile(markdownNewUrl, destPath);
      }
    } catch (error: any) {
      console.error(`Error processing ${url}: ${error.message}`);
    }

    url = prompt("Enter another URL (or press ENTER to complete):");
  }

  console.log(`\nYour temporary agent documentation is created here: ${skillTmpDir}`);
}

main();
