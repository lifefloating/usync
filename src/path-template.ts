import os from "node:os";
import path from "node:path";

const HOME_TOKEN = "$HOME";
const PROJECT_TOKEN = "$PROJECT";

export function toTemplatePath(absolutePath: string, projectRoot: string): string {
  const normalized = path.resolve(absolutePath);
  const home = path.resolve(os.homedir());
  const root = path.resolve(projectRoot);

  if (normalized.startsWith(`${root}${path.sep}`) || normalized === root) {
    return normalized.replace(root, PROJECT_TOKEN);
  }
  if (normalized.startsWith(`${home}${path.sep}`) || normalized === home) {
    return normalized.replace(home, HOME_TOKEN);
  }
  return normalized;
}

export function resolveTemplatePath(templatePath: string, projectRoot: string): string {
  const home = path.resolve(os.homedir());
  const root = path.resolve(projectRoot);

  if (templatePath.startsWith(HOME_TOKEN)) {
    return path.resolve(templatePath.replace(HOME_TOKEN, home));
  }
  if (templatePath.startsWith(PROJECT_TOKEN)) {
    return path.resolve(templatePath.replace(PROJECT_TOKEN, root));
  }
  return path.resolve(templatePath);
}

export function templatePathToPortablePath(templatePath: string): string {
  if (templatePath.startsWith(HOME_TOKEN)) {
    return path.join("home", templatePath.slice(HOME_TOKEN.length));
  }
  if (templatePath.startsWith(PROJECT_TOKEN)) {
    return path.join("project", templatePath.slice(PROJECT_TOKEN.length));
  }
  return path.join("absolute", templatePath.replace(/^\/+/, ""));
}
