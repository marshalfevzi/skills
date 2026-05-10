import { readdir, stat, readFile } from "node:fs/promises";
import { join } from "node:path";

const SKILLS_DIR = join(import.meta.dir, "..", "skills");

async function validate() {
  console.log("🔍 Validating skills...");
  let hasError = false;

  const entries = await readdir(SKILLS_DIR);

  for (const entry of entries) {
    const skillPath = join(SKILLS_DIR, entry);
    const s = await stat(skillPath);

    if (!s.isDirectory()) {
      continue;
    }

    // 1. Check kebab-case
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry)) {
      console.error(`❌ Error: Skill directory name "${entry}" must be kebab-case.`);
      hasError = true;
    }

    // 2. Check SKILL.md exists
    const skillMdPath = join(skillPath, "SKILL.md");
    try {
      await stat(skillMdPath);
    } catch (e) {
      console.error(`❌ Error: Skill "${entry}" is missing SKILL.md.`);
      hasError = true;
      continue;
    }

    // 3. Validate SKILL.md frontmatter
    const content = await readFile(skillMdPath, "utf-8");
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      console.error(`❌ Error: Skill "${entry}" SKILL.md is missing YAML frontmatter.`);
      hasError = true;
      continue;
    }

    const frontmatter = frontmatterMatch[1];
    const hasName = /name:\s*.+/.test(frontmatter);
    const hasDescription = /description:\s*.+/.test(frontmatter);

    if (!hasName) {
      console.error(`❌ Error: Skill "${entry}" SKILL.md frontmatter is missing "name".`);
      hasError = true;
    }

    if (!hasDescription) {
      console.error(`❌ Error: Skill "${entry}" SKILL.md frontmatter is missing "description".`);
      hasError = true;
    }
  }

  if (hasError) {
    console.error("\n🚨 Validation failed!");
    process.exit(1);
  } else {
    console.log("\n✅ All skills validated successfully!");
  }
}

validate().catch((err) => {
  console.error("💥 Unexpected error during validation:", err);
  process.exit(1);
});
