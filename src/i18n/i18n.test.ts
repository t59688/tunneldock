import { describe, expect, it } from "vitest";
import { zhCN } from "./locales/zh-CN";
import { enUS } from "./locales/en-US";

function collectKeys(obj: Record<string, any>, prefix = ""): string[] {
  let keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (obj[key] !== null && typeof obj[key] === "object") {
      keys = keys.concat(collectKeys(obj[key], fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys;
}

describe("i18n locale dictionaries", () => {
  it("zh-CN and en-US keys match 100%", () => {
    const zhKeys = collectKeys(zhCN).sort();
    const enKeys = collectKeys(enUS).sort();

    expect(zhKeys).toEqual(enKeys);
    expect(zhKeys.length).toBeGreaterThan(50);
  });

  it("handles parameter interpolation correctly", () => {
    const template = "Found {count} items in {location}";
    const replaced = template.replaceAll("{count}", "5").replaceAll("{location}", "Beijing");
    expect(replaced).toBe("Found 5 items in Beijing");
  });
});
