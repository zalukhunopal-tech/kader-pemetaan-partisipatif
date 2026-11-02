import { execSync } from "child_process";

const cwd = "C:/Users/IT/.gemini/antigravity/scratch/kader-pemetaan-partisipatif";
const repo = "zalukhunopal-tech/kader-pemetaan-partisipatif";

function run(cmd) {
  console.log(`> ${cmd}`);
  const out = execSync(cmd, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
  console.log(out);
  return out;
}

try {
  run("git add -A");
  run('git commit -m "feat(simulasi): 55 real-world field simulation scenarios, bug fixes, and diagnostic report"');
  run("git push -u origin feat/simulasi-55-skenario-bug-fixes");
  console.log("Push successful!");

  console.log("Creating Pull Request...");
  const prJson = run(`gh api repos/${repo}/pulls -f title="feat(simulasi): 55 real-world field simulation scenarios and resilience bug fixes" -f head="feat/simulasi-55-skenario-bug-fixes" -f base="main" -f body="Implementasi 55 skenario simulasi lapangan nyata dan perbaikan bug ketahanan (canopy multipath spike filter, NaN altitude defense, polygon self-intersection validator, IDB connection cleanup, zero-byte photo validation, sanitasi input XSS, dan LAPORAN_BUG_SIMULASI.md)."`);
  const pr = JSON.parse(prJson);
  const prNumber = pr.number;
  console.log(`PR #${prNumber} created: ${pr.html_url}`);

  console.log(`Merging PR #${prNumber}...`);
  const mergeJson = run(`gh api -X PUT repos/${repo}/pulls/${prNumber}/merge -f merge_method="merge" -f commit_title="Merge PR #${prNumber}: 55 real-world field simulations and bug fixes"`);
  console.log("Merge result:", mergeJson);
} catch (e) {
  console.error("Error executing command:", e.stdout || e.message);
  if (e.stderr) console.error(e.stderr);
  process.exit(1);
}
