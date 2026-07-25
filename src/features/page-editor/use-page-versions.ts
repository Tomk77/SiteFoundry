import {
  discardEditablePageConcept,
  pageFromRevision,
  saveEditablePage,
  type EditablePage,
} from "@/lib/page-editor";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";

import { countPageChanges } from "./editor-model";

type SavingAction = "concept" | "publish" | "delete" | null;

interface UsePageVersionsOptions {
  page: EditablePage | null;
  saving: boolean;
  setPage: Dispatch<SetStateAction<EditablePage | null>>;
  setSavedLabel: Dispatch<SetStateAction<string>>;
  setSavingAction: Dispatch<SetStateAction<SavingAction>>;
  showToast: (message: string) => void;
}

export function usePageVersions({
  page,
  saving,
  setPage,
  setSavedLabel,
  setSavingAction,
  showToast,
}: UsePageVersionsOptions) {
  const [view, setView] = useState<"concept" | "published">("concept");
  const viewingPublished = view === "published" && Boolean(page?.publishedRevision);
  const displayedPage =
    page && viewingPublished && page.publishedRevision
      ? pageFromRevision(page, page.publishedRevision.snapshot)
      : page;
  const changeCount = useMemo(
    () => (page ? countPageChanges(page, page.publishedRevision?.snapshot ?? null) : 0),
    [page],
  );

  useEffect(() => setView("concept"), [page?.id]);

  const save = async (publish = false) => {
    if (!page || saving) return;
    const path = `${page.parentPath}${page.slug}`.replace(/\/{2,}/g, "/");
    setSavingAction(publish ? "publish" : "concept");
    setSavedLabel("Saving…");
    try {
      const result = await saveEditablePage(page, publish);
      setPage((value) =>
        value
          ? {
              ...value,
              path,
              updatedAt: result.updatedAt,
              status: result.status,
              validationStatus: result.validationStatus,
              conceptRevision: result.conceptRevision,
              publishedRevision:
                publish && result.publishedRevisionId
                  ? {
                      id: result.publishedRevisionId,
                      version: result.publishedRevisionVersion ?? 1,
                      publishedAt: result.publishedAt ?? result.updatedAt,
                      sourceConceptRevisionId: result.conceptRevision?.id ?? null,
                      snapshot: {
                        title: page.title,
                        slug: page.slug,
                        path,
                        blocks: page.blocks,
                        seoTitle: page.seoTitle,
                        seoDescription: page.seoDescription,
                        socialImage: page.socialImage,
                        preferredChildTemplate: page.preferredChildTemplate,
                        validationStatus: result.validationStatus,
                      },
                    }
                  : value.publishedRevision,
            }
          : value,
      );
      setView("concept");
      setSavedLabel("All changes saved");
      showToast(
        publish
          ? page.publishedRevision
            ? "Concept published · now live"
            : "Page published · now live"
          : "Concept saved",
      );
    } catch (error) {
      setSavedLabel("Save failed");
      showToast(error instanceof Error ? error.message : "Unable to save this page");
    } finally {
      setSavingAction(null);
    }
  };

  const discardConcept = async () => {
    if (!page || saving || !page.publishedRevision) return;
    setSavingAction("concept");
    try {
      setPage(await discardEditablePageConcept(page.id));
      setView("concept");
      setSavedLabel("All changes saved");
      showToast("Concept discarded · back to the published version");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to discard this concept");
    } finally {
      setSavingAction(null);
    }
  };

  return {
    changeCount,
    discardConcept,
    displayedPage,
    save,
    setView,
    viewingPublished,
  };
}
