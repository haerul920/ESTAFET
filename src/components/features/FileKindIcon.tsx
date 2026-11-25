import { FileArchive, FileCode2, FileImage, FileSpreadsheet, FileText, FileType, Presentation } from "lucide-react";
import type { ProjectFile } from "@/lib/db/types";

const ICONS: Record<ProjectFile["kind"], typeof FileText> = {
  pdf: FileText,
  markdown: FileCode2,
  image: FileImage,
  word: FileType,
  spreadsheet: FileSpreadsheet,
  slides: Presentation,
  code_tree: FileArchive,
};

export function FileKindIcon({ kind, size = 18 }: { kind: ProjectFile["kind"]; size?: number }) {
  const Icon = ICONS[kind] ?? FileText;
  return <Icon size={size} aria-hidden="true" className="flex-none text-text-2" />;
}
