import { languages, type Language } from "../i18n";

type LanguageSwitcherProps = {
  language: Language;
  onChange: (language: Language) => void;
};

export function LanguageSwitcher({ language, onChange }: LanguageSwitcherProps) {
  return (
    <select
      className="language-switcher"
      aria-label="Language"
      value={language}
      onChange={(event) => onChange(event.target.value as Language)}
    >
      {languages.map((item) => (
        <option key={item.code} value={item.code}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
