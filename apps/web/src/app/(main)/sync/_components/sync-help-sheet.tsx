"use client";

import { HelpSheet, type HelpSection } from "@/components/help-sheet";
import { useTranslation } from "@workspace/i18n";

export function SyncHelpSheet() {
  const { t } = useTranslation("sync");

  const sections: HelpSection[] = [
    {
      title: t("howItWorks.title"),
      steps: [
        {
          title: t("howItWorks.step1Title"),
          description: t("howItWorks.step1Description"),
        },
        {
          title: t("howItWorks.step2Title"),
          description: t("howItWorks.step2Description"),
        },
        {
          title: t("howItWorks.step3Title"),
          description: t("howItWorks.step3Description"),
        },
      ],
    },
    {
      title: t("fieldMappings.syncModeExplained"),
      items: [
        {
          title: "",
          badge: t("fieldMappings.syncModes.always"),
          description: t("fieldMappings.syncModeAlwaysExplained"),
        },
        {
          title: "",
          badge: t("fieldMappings.syncModes.createOnly"),
          description: t("fieldMappings.syncModeCreateOnlyExplained"),
        },
        {
          title: "",
          badge: t("fieldMappings.syncModes.ifEmpty"),
          description: t("fieldMappings.syncModeIfEmptyExplained"),
        },
      ],
    },
  ];

  return (
    <HelpSheet
      title={t("help.title")}
      description={t("help.description")}
      sections={sections}
    />
  );
}
