import { readFileSync } from "fs";
import { join } from "path";
import { createTranslator, hasTranslation, LANGUAGE_OPTIONS, SUPPORTED_LANGUAGES, type Language, type TranslationKey } from "./i18n";

describe("i18n language support", () => {
  it("offers English, Chinese, Japanese, French, and Korean as supported interface languages", () => {
    expect(SUPPORTED_LANGUAGES).toEqual(["en", "zh", "ja", "fr", "ko"]);
    expect(LANGUAGE_OPTIONS.map((option) => option.value)).toEqual(SUPPORTED_LANGUAGES);
    expect(LANGUAGE_OPTIONS.map((option) => option.label)).toEqual([
      "English",
      "中文",
      "日本語",
      "Français",
      "한국어"
    ]);
  });

  it.each([
    ["ja", "タスク", "カレンダー", "設定"],
    ["fr", "Tâches", "Calendrier", "Paramètres"],
    ["ko", "작업", "캘린더", "설정"]
  ] as const)("translates the core Task Hub surface for %s", (language, tasks, calendar, settingsWord) => {
    const t = createTranslator(language);

    expect(t("tasks")).toBe(tasks);
    expect(t("calendar")).toBe(calendar);
    expect(t("settingsTitle")).toContain(settingsWord);
    expect(t("language")).not.toBe(createTranslator("en")("language"));
    expect(t.locale).toMatch(/^(ja-JP|fr-FR|ko-KR)$/u);
  });

  it("falls back to English for unsupported keys while keeping the selected language metadata", () => {
    const t = createTranslator("fr");

    expect(t("localAppleRemindersCreateRiskConfirm")).toBe(createTranslator("en")("localAppleRemindersCreateRiskConfirm"));
    expect(t.language).toBe("fr");
    expect(t.locale).toBe("fr-FR");
    expect(t.isCjk).toBe(false);
  });

  it("keeps every settings page label and description translated for new interface languages", () => {
    const settingsSource = readFileSync(join(__dirname, "settings.ts"), "utf8");
    const settingsKeys = [...new Set([...settingsSource.matchAll(/t\("([^"]+)"\)/gu)].map((match) => match[1] as TranslationKey))]
      .filter((key) => hasTranslation("en", key))
      .sort();
    const languages: Language[] = ["ja", "fr", "ko"];

    for (const language of languages) {
      const missingKeys = settingsKeys.filter((key) => !hasTranslation(language, key));
      expect(missingKeys).toEqual([]);
    }
  });
});
