import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const hubRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = path.join(hubRoot, specifier.slice(2));
    const resolvedTarget = fs.existsSync(target)
      ? target
      : fs.existsSync(`${target}.ts`)
        ? `${target}.ts`
        : fs.existsSync(`${target}.tsx`)
          ? `${target}.tsx`
          : target;
    return {
      shortCircuit: true,
      url: pathToFileURL(resolvedTarget).href,
    };
  }

  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const parentPath = path.dirname(fileURLToPath(context.parentURL));
    const target = path.resolve(parentPath, specifier);
    for (const candidate of [target, `${target}.ts`, `${target}.tsx`, `${target}.mjs`]) {
      if (fs.existsSync(candidate)) {
        return { shortCircuit: true, url: pathToFileURL(candidate).href };
      }
    }
  }

  return nextResolve(specifier, context);
}
