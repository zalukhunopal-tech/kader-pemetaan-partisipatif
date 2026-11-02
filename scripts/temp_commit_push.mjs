import { execSync } from "child_process";

const cwd = "C:/Users/IT/.gemini/antigravity/scratch/kader-pemetaan-partisipatif";

function run(cmd) {
  console.log(`> ${cmd}`);
  const out = execSync(cmd, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
  console.log(out);
  return out;
}

try {
  run("git add -A");
  run('git commit -m "feat(ui): redesign Titik Tapak field-GIS UI/UX with modern glassmorphic HUD and responsive shell"');
  run("git push origin feat/redesign-ui-titik-tapak");
  console.log("Push successful!");
} catch (e) {
  console.error("Error executing command:", e.stdout || e.message);
  if (e.stderr) console.error(e.stderr);
  process.exit(1);
}
