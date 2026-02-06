import chalk from "chalk";

export function createProgressReporter(enabled: boolean): (current: number, total: number, label: string) => void {
  if (!enabled) return () => undefined;

  return (current: number, total: number, label: string): void => {
    const percent = total === 0 ? 100 : Math.floor((current / total) * 100);
    const pct = chalk.bold.blue(`${String(percent).padStart(3, " ")}%`);
    const line = `${chalk.gray("⏳")} [${pct}] ${current}/${total} ${label}`;
    if (current >= total) {
      process.stdout.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\r`);
    }
  };
}
