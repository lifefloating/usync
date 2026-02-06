import chalk from "chalk";

export function info(message: string): void {
  console.log(`${chalk.cyan("ℹ")} ${message}`);
}

export function success(message: string): void {
  console.log(`${chalk.green("✅")} ${message}`);
}

export function warn(message: string): void {
  console.log(`${chalk.yellow("⚠️")} ${message}`);
}

export function section(message: string): void {
  console.log(chalk.bold.magenta(`\n🚀 ${message}`));
}

export function bullet(message: string): void {
  console.log(`  ${chalk.gray("•")} ${message}`);
}

export function fail(message: string): void {
  console.error(`${chalk.red("❌")} ${message}`);
}
