import { FileText, Image, ListChecks, Type, Video } from "lucide-react";
import type { TranslationKey } from "../i18n";

export type BlockType = "text" | "video" | "image" | "quiz" | "pdf";

type BlockToolbarProps = {
  disabled: boolean;
  t: (key: TranslationKey) => string;
  onInsert: (blockType: BlockType) => void;
};

const tools: Array<{ type: BlockType; labelKey: TranslationKey; icon: typeof Type }> = [
  { type: "text", labelKey: "text", icon: Type },
  { type: "video", labelKey: "video", icon: Video },
  { type: "image", labelKey: "image", icon: Image },
  { type: "quiz", labelKey: "quiz", icon: ListChecks },
  { type: "pdf", labelKey: "pdf", icon: FileText }
];

export function BlockToolbar({ disabled, t, onInsert }: BlockToolbarProps) {
  return (
    <aside className="block-toolbar">
      <div className="tool-group">
        {tools.map((tool) => (
          <button
            key={tool.type}
            type="button"
            disabled={disabled}
            onClick={() => onInsert(tool.type)}
            title={t(tool.labelKey)}
          >
            <tool.icon size={19} />
            <span>{t(tool.labelKey)}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
