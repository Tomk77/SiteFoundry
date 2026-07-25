import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { createMediaUrlSearch, type parseMediaUrlSearch } from "@/lib/url-view-state";

interface Folder {
  id: string;
  name: string;
  parentId: string;
}
interface MediaFile {
  id: string;
  name: string;
  ext: string;
  width?: number;
  height?: number;
  size: string;
  author: string;
  date: string;
  parentId: string;
  tint: string;
  alt: string;
  kind: "image" | "svg" | "pdf";
}
const foldersSeed: Folder[] = [
  { id: "brand", name: "Brand", parentId: "root" },
  { id: "blog", name: "Blog images", parentId: "root" },
  { id: "team", name: "Team", parentId: "root" },
  { id: "product", name: "Product shots", parentId: "root" },
];
const makeFile = (
  id: string,
  name: string,
  ext: string,
  width: number | undefined,
  height: number | undefined,
  size: string,
  author: string,
  date: string,
  parentId: string,
  tint: string,
  kind: MediaFile["kind"] = "image",
): MediaFile => ({
  id,
  name,
  ext,
  width,
  height,
  size,
  author,
  date,
  parentId,
  tint,
  kind,
  alt: "",
});
const filesSeed: MediaFile[] = [
  makeFile(
    "hero",
    "hero-home",
    "JPG",
    1920,
    960,
    "412 KB",
    "Mara Jensen",
    "Jul 8, 2026",
    "root",
    "#eceef1",
  ),
  makeFile(
    "og",
    "og-default",
    "PNG",
    1200,
    630,
    "188 KB",
    "Devin Park",
    "Jul 2, 2026",
    "root",
    "#FBEBE1",
  ),
  makeFile(
    "cta",
    "cta-background",
    "JPG",
    2400,
    1200,
    "690 KB",
    "Sofia Ruiz",
    "Jun 28, 2026",
    "root",
    "#EAE6F5",
  ),
  makeFile(
    "favicon",
    "favicon",
    "PNG",
    512,
    512,
    "24 KB",
    "Mara Jensen",
    "May 3, 2026",
    "root",
    "#E3F3EA",
  ),
  makeFile(
    "logo-primary",
    "logo-primary",
    "SVG",
    320,
    84,
    "12 KB",
    "Mara Jensen",
    "Apr 26, 2026",
    "brand",
    "#E7EEF5",
    "svg",
  ),
  makeFile(
    "logo-white",
    "logo-white",
    "SVG",
    320,
    84,
    "11 KB",
    "Mara Jensen",
    "Apr 26, 2026",
    "brand",
    "#eceef1",
    "svg",
  ),
  makeFile(
    "guidelines",
    "brand-guidelines",
    "PDF",
    undefined,
    undefined,
    "2.4 MB",
    "Devin Park",
    "Apr 18, 2026",
    "brand",
    "#F0E6EC",
    "pdf",
  ),
  makeFile(
    "swatches",
    "color-swatches",
    "PNG",
    1600,
    900,
    "210 KB",
    "Sofia Ruiz",
    "Apr 15, 2026",
    "brand",
    "#F7EDDA",
  ),
  makeFile(
    "headless",
    "headless-cms-cover",
    "JPG",
    1600,
    900,
    "344 KB",
    "Mara Jensen",
    "Jun 19, 2026",
    "blog",
    "#EAE6F5",
  ),
  makeFile(
    "migration",
    "migration-diagram",
    "PNG",
    1400,
    860,
    "226 KB",
    "Devin Park",
    "Jun 11, 2026",
    "blog",
    "#E3F3EA",
  ),
  makeFile(
    "tree",
    "page-tree-screenshot",
    "PNG",
    1800,
    1125,
    "494 KB",
    "Mara Jensen",
    "May 29, 2026",
    "blog",
    "#eceef1",
  ),
  makeFile(
    "mara",
    "mara-jensen",
    "JPG",
    800,
    800,
    "98 KB",
    "Mara Jensen",
    "Mar 12, 2026",
    "team",
    "#FBEBE1",
  ),
  makeFile(
    "devin",
    "devin-park",
    "JPG",
    800,
    800,
    "104 KB",
    "Devin Park",
    "Mar 12, 2026",
    "team",
    "#E7EEF5",
  ),
  makeFile(
    "sofia",
    "sofia-ruiz",
    "JPG",
    800,
    800,
    "101 KB",
    "Sofia Ruiz",
    "Mar 12, 2026",
    "team",
    "#F7EDDA",
  ),
];

function Preview({ item, compact = false }: { item: MediaFile; compact?: boolean }) {
  const icon =
    item.kind === "pdf" ? "ph-file-pdf" : item.kind === "svg" ? "ph-bezier-curve" : "ph-image";

  return (
    <div
      className={`sc-media-preview [position:relative] [display:grid] [aspect-ratio:4/3] [width:100%] [place-items:center] [overflow:hidden] [border-radius:10px] [color:#7fa9a4] [border:1.5px_solid_transparent] [&>i]:[font-size:38px] [&>i]:[opacity:0.75] [&>span]:[position:absolute] [&>span]:[right:7px] [&>span]:[bottom:7px] [&>span]:[border-radius:4px] [&>span]:[padding:3px_6px] [&>span]:text-ink-muted [&>span]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.08)] [&>span]:[background:rgba(255,_255,_255,_0.88)] [&>span]:[font:600_9.5px_'Geist_Mono'] ${compact ? "compact" : ""}`}
      style={{ background: item.tint }}
    >
      <i className={`ph-fill ${icon}`} />
      <span>{item.ext}</span>
    </div>
  );
}

export function MediaScreen({ urlSearch }: { urlSearch: ReturnType<typeof parseMediaUrlSearch> }) {
  const navigate = useNavigate({ from: "/media" });
  const [folders, setFolders] = useState(foldersSeed);
  const [files, setFiles] = useState(filesSeed);
  const [selected, setSelected] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState("");
  const cwd =
    urlSearch.folder && folders.some((folder) => folder.id === urlSearch.folder)
      ? urlSearch.folder
      : "root";
  const view = urlSearch.view ?? "grid";
  const query = urlSearch.q ?? "";
  const updateUrlView = (next: { q?: string; folder?: string; view?: "grid" | "list" }) => {
    void navigate({
      to: "/media",
      search: createMediaUrlSearch({
        q: next.q ?? query,
        folder: next.folder ?? cwd,
        view: next.view ?? view,
      }),
      replace: true,
      resetScroll: false,
    });
  };

  const setQuery = (value: string) => updateUrlView({ q: value });
  const setView = (value: "grid" | "list") => updateUrlView({ view: value });
  const currentFolder = folders.find((folder) => folder.id === cwd);
  const q = query.toLowerCase();
  const visibleFolders = folders.filter(
    (folder) => folder.parentId === cwd && folder.name.toLowerCase().includes(q),
  );
  const visibleFiles = files.filter(
    (item) => item.parentId === cwd && `${item.name}.${item.ext}`.toLowerCase().includes(q),
  );
  const selectedFile = files.find((item) => item.id === selected) ?? null;
  const itemCount = visibleFolders.length + visibleFiles.length;
  const breadcrumbs = useMemo(
    () =>
      currentFolder
        ? [
            { id: "root", name: "Media" },
            { id: currentFolder.id, name: currentFolder.name },
          ]
        : [{ id: "root", name: "Media" }],
    [currentFolder],
  );
  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };

  const openFolder = (id: string) => {
    setSelected(null);
    updateUrlView({ q: "", folder: id });
  };

  const addFolder = () => {
    const id = `folder-${Date.now()}`;
    setFolders((value) => [...value, { id, name: "Untitled folder", parentId: cwd }]);
    setRenaming(id);
  };

  const updateFile = (changes: Partial<MediaFile>) =>
    selectedFile &&
    setFiles((value) =>
      value.map((item) => (item.id === selectedFile.id ? { ...item, ...changes } : item)),
    );
  const deleteFile = () => {
    if (!selectedFile) return;
    setFiles((value) => value.filter((item) => item.id !== selectedFile.id));
    setSelected(null);
    showToast("File deleted");
  };

  return (
    <AppShell active="media">
      <header className="sc-media-head [display:flex] [align-items:center] [gap:12px] [padding:16px_22px_14px] [border-bottom:1px_solid_var(--sc-sunken)] max-[800px]:[flex-wrap:wrap] dark:[border-color:#323841]">
        <div className="sc-tree-title [display:flex] [flex-direction:column] [gap:1px] [&_b]:text-ink-subtle [&_b]:[font:500_12px_'Geist_Mono'] [&_div]:[display:flex] [&_div]:[align-items:center] [&_div]:[gap:9px] [&_h1]:[margin:0] [&_h1]:[font-size:19px] [&_h1]:[font-weight:600] [&_h1]:[letter-spacing:-0.015em] [&>span]:[font-size:12px] [&>span]:text-ink-subtle">
          <div>
            <h1>Media</h1>
            <b>{itemCount} items</b>
          </div>
          <span>Manage images and files used across your website.</span>
        </div>
        <span className="sc-spacer [flex:1]" />
        <label
          className="sc-search sc-media-search [display:flex] [height:36px] [width:196px] [width:248px] [align-items:center] [gap:8px] [border-radius:8px] bg-surface [padding:0_12px] [border:1.5px_solid_#cfd6d0] max-[800px]:[order:5] max-[800px]:[width:100%] max-[800px]:[width:190px] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_i]:[font-size:15px] [&_i]:text-ink-subtle [&_input]:[width:100%] [&_input]:[padding:0] [&_input]:[font-size:13px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[background:transparent] [&_input]:[border:0] dark:[&_input]:[color:#e9ecf1] [&:focus-within]:border-action [&:focus-within]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)]"
          htmlFor="media-search"
        >
          <i className="ph ph-magnifying-glass" />
          <Input
            unstyled
            id="media-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files..."
          />
        </label>
        <div className="sc-view-toggle [display:flex] [border-radius:8px] bg-sunken [padding:2px] dark:[background:#242930] [&_button]:[display:grid] [&_button]:[height:30px] [&_button]:[width:30px] [&_button]:[cursor:pointer] [&_button]:[place-items:center] [&_button]:[border-radius:6px] [&_button]:[font-size:15px] [&_button]:[color:#71817e] [&_button]:[background:transparent] [&_button]:[border:0] [&_button.active]:bg-surface [&_button.active]:text-action [&_button.active]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] dark:[&_button.active]:[border-color:#3d444e] dark:[&_button.active]:[color:#e9ecf1] dark:[&_button.active]:[background:#1d2126]">
          <Button
            unstyled
            className={view === "grid" ? "active" : ""}
            onClick={() => setView("grid")}
          >
            <i className="ph ph-squares-four" />
          </Button>
          <Button
            unstyled
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
          >
            <i className="ph ph-list" />
          </Button>
        </div>
        <Button
          unstyled
          className="sc-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
          onClick={addFolder}
        >
          <i className="ph ph-folder-plus" />
          New folder
        </Button>
        <Button
          unstyled
          className="sc-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
          onClick={() => setUploadOpen(true)}
        >
          <i className="ph-bold ph-upload-simple" />
          Upload
        </Button>
      </header>
      <nav className="sc-media-crumbs [display:flex] [min-height:42px] [align-items:center] [gap:6px] [padding:11px_22px] [border-bottom:1px_solid_var(--sc-sunken)] dark:[border-color:#323841] [&_button]:[cursor:pointer] [&_button]:[padding:0] [&_button]:[font-size:12.5px] [&_button]:[font-weight:500] [&_button]:text-action [&_button]:[background:transparent] [&_button]:[border:0] [&_button.current]:text-ink-muted [&_i]:[font-size:12px] [&_i]:[color:#a5b0ad] [&_span]:[display:flex] [&_span]:[align-items:center] [&_span]:[gap:6px]">
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.id}>
            {index > 0 && <i className="ph ph-caret-right" />}
            <Button
              unstyled
              className={index === breadcrumbs.length - 1 ? "current" : ""}
              onClick={() => openFolder(crumb.id)}
            >
              {crumb.name}
            </Button>
          </span>
        ))}
      </nav>
      <div className="sc-media-body [display:flex] [min-height:0] [flex:1]">
        <section className="sc-media-content sc-scroll [min-width:0] [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [overflow:auto] [padding:20px_22px_40px] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
          {visibleFolders.length > 0 && (
            <div className="sc-media-section [margin-bottom:26px] [display:flex] [flex-direction:column] [gap:10px] [&>h2]:[margin:0] [&>h2]:[font-size:11px] [&>h2]:[font-weight:600] [&>h2]:[letter-spacing:0.07em] [&>h2]:text-ink-muted [&>h2]:[text-transform:uppercase] dark:[&>h2]:[color:#79808b]">
              <h2>Folders</h2>
              <div className="sc-folder-grid [display:grid] [grid-template-columns:repeat(auto-fill,_minmax(200px,_1fr))] [gap:12px]">
                {visibleFolders.map((folder) => (
                  <div
                    className="sc-folder-card [display:flex] [min-width:0] [align-items:center] [gap:8px] [border-radius:10px] bg-surface [padding:12px] [border:1.5px_solid_var(--sc-border)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:hover]:[border-color:#b7c5c1] [&:hover]:[box-shadow:0_2px_7px_rgba(23,_35,_38,_0.06)] dark:[&:hover]:[background:#2c333b]"
                    key={folder.id}
                  >
                    <Button
                      unstyled
                      className="sc-folder-main [display:flex] [min-width:0] [flex:1] [cursor:pointer] [align-items:center] [gap:11px] [padding:0] [text-align:left] [background:transparent] [border:0] [&_input]:[height:27px] [&_input]:[width:100%] [&_input]:[border-radius:5px] [&_input]:[padding:0_7px] [&_input]:[font-size:12.5px] [&_input]:[outline:0] [&_input]:[border:1.5px_solid_var(--sc-accent)] [&_small]:[font-size:11px] [&_small]:text-ink-subtle dark:[&_small]:[color:#79808b] [&_strong]:[overflow:hidden] [&_strong]:[font-size:13px] [&_strong]:[font-weight:600] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap] [&>i]:[display:grid] [&>i]:[height:38px] [&>i]:[width:38px] [&>i]:[flex:none] [&>i]:[place-items:center] [&>i]:[border-radius:8px] [&>i]:bg-selection [&>i]:[font-size:20px] [&>i]:text-action [&>span]:[display:flex] [&>span]:[min-width:0] [&>span]:[flex:1] [&>span]:[flex-direction:column] [&>span]:[gap:2px]"
                      onClick={() => openFolder(folder.id)}
                    >
                      <i className="ph-fill ph-folder" />
                      <span>
                        {renaming === folder.id ? (
                          <Input
                            unstyled
                            autoFocus
                            value={folder.name}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setFolders((all) =>
                                all.map((f) =>
                                  f.id === folder.id ? { ...f, name: e.target.value } : f,
                                ),
                              )
                            }
                            onBlur={() => setRenaming(null)}
                            onKeyDown={(e) => e.key === "Enter" && setRenaming(null)}
                          />
                        ) : (
                          <>
                            <strong>{folder.name}</strong>
                            <small>
                              {files.filter((item) => item.parentId === folder.id).length} items
                            </small>
                          </>
                        )}
                      </span>
                    </Button>
                    <Button
                      unstyled
                      className="sc-icon-button [display:grid] [height:28px] [width:28px] [flex:none] [cursor:pointer] [place-items:center] [border-radius:6px] text-ink-subtle [background:transparent] [border:0] [&:hover]:bg-sunken [&:hover]:text-ink"
                      onClick={() => setRenaming(folder.id)}
                    >
                      <i className="ph ph-dots-three" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {visibleFiles.length > 0 && (
            <div className="sc-media-section [margin-bottom:26px] [display:flex] [flex-direction:column] [gap:10px] [&>h2]:[margin:0] [&>h2]:[font-size:11px] [&>h2]:[font-weight:600] [&>h2]:[letter-spacing:0.07em] [&>h2]:text-ink-muted [&>h2]:[text-transform:uppercase] dark:[&>h2]:[color:#79808b]">
              <h2>Files</h2>
              {view === "grid" ? (
                <div className="sc-file-grid [display:grid] [grid-template-columns:repeat(auto-fill,_minmax(158px,_1fr))] [gap:16px]">
                  {visibleFiles.map((item) => (
                    <Button
                      unstyled
                      className={`sc-file-card [display:flex] [min-width:0] [cursor:pointer] [flex-direction:column] [align-items:stretch] [padding:0] [text-align:left] [background:transparent] [border:0] [&.selected_.sc-media-preview]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.12)] [&.selected_.sc-media-preview]:[border:2px_solid_var(--sc-accent)] ${selected === item.id ? "selected" : ""}`}
                      key={item.id}
                      onClick={() => setSelected(item.id)}
                    >
                      <Preview item={item} />
                      <span className="sc-file-name [margin-top:8px] [overflow:hidden] [font-size:12.5px] [font-weight:600] [text-overflow:ellipsis] [white-space:nowrap] text-ink dark:[color:#e9ecf1]">
                        {item.name}
                      </span>
                      <span className="sc-file-meta [margin-top:2px] text-ink-subtle [font:400_10.5px_'Geist_Mono'] dark:[color:#79808b]">
                        {item.ext} · {item.size}
                      </span>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="sc-file-list [overflow:hidden] [border-radius:9px] [border:1px_solid_var(--sc-border)] [&_.sc-media-preview.compact]:[aspect-ratio:auto] [&_.sc-media-preview.compact]:[height:34px] [&_.sc-media-preview.compact]:[width:34px] [&_.sc-media-preview.compact]:[border-radius:7px] [&_.sc-media-preview.compact_i]:[font-size:16px] [&_.sc-media-preview.compact_span]:[display:none] [&_small]:[overflow:hidden] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap] [&_small]:[color:#9aa8a4] [&_small]:[font:10px_'Geist_Mono'] [&_strong]:[overflow:hidden] [&_strong]:[font-size:12.5px] [&_strong]:[font-weight:600] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap] [&_strong]:text-ink [&>button]:[display:grid] [&>button]:[min-height:54px] [&>button]:[width:100%] [&>button]:[cursor:pointer] [&>button]:[grid-template-columns:34px_minmax(160px,_1fr)_70px_110px_80px_120px] [&>button]:[align-items:center] [&>button]:[gap:12px] [&>button]:bg-surface [&>button]:[padding:8px_14px] [&>button]:[text-align:left] [&>button]:[font-size:11.5px] [&>button]:text-ink-muted [&>button]:[border-bottom:1px_solid_var(--sc-canvas)] [&>button]:[border:0] max-[1050px]:[&>button]:[grid-template-columns:34px_minmax(140px,_1fr)_60px_100px_70px] dark:[&>button]:[border-color:#3d444e] dark:[&>button]:[color:#e9ecf1] dark:[&>button]:[background:#1d2126] [&>button.selected]:bg-selection dark:[&>button.selected]:[background:#2c333b] [&>button:hover]:bg-selection dark:[&>button:hover]:[background:#2c333b] [&>button:last-child]:[border-bottom:0] max-[1050px]:[&>button>*:last-child]:[display:none] [&>button>span:nth-child(2)]:[display:flex] [&>button>span:nth-child(2)]:[min-width:0] [&>button>span:nth-child(2)]:[flex-direction:column] [&>button>span:nth-child(2)]:[gap:2px]">
                  <div className="sc-file-list-head [display:grid] [height:34px] [width:100%] [grid-template-columns:34px_minmax(160px,_1fr)_70px_110px_80px_120px] [align-items:center] [gap:12px] [padding:0_14px] [text-align:left] [font-size:10px] [font-weight:600] [letter-spacing:0.06em] text-ink-subtle [text-transform:uppercase] [background:#fafcfa] [border-bottom:1px_solid_var(--sc-border)] max-[1050px]:[grid-template-columns:34px_minmax(140px,_1fr)_60px_100px_70px] dark:[border-color:#323841] dark:[background:#181b20] max-[1050px]:[&>*:last-child]:[display:none]">
                    <span />
                    <span>Name</span>
                    <span>Type</span>
                    <span>Dimensions</span>
                    <span>Size</span>
                    <span>Uploaded</span>
                  </div>
                  {visibleFiles.map((item) => (
                    <Button
                      unstyled
                      className={selected === item.id ? "selected" : ""}
                      key={item.id}
                      onClick={() => setSelected(item.id)}
                    >
                      <Preview item={item} compact />
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.name}.{item.ext.toLowerCase()}
                        </small>
                      </span>
                      <span>{item.ext}</span>
                      <span>{item.width ? `${item.width}×${item.height}` : "Document"}</span>
                      <span>{item.size}</span>
                      <span>{item.date}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
          {itemCount === 0 && (
            <div className="sc-media-empty [display:flex] [height:100%] [min-height:330px] [flex-direction:column] [align-items:center] [justify-content:center] [text-align:center] text-ink-subtle [&_h2]:[margin:0_0_6px] [&_h2]:[font-size:15px] [&_h2]:[color:#33474a] dark:[&_h3]:[color:#e9ecf1] [&_p]:[margin:0_0_17px] [&_p]:[max-width:390px] [&_p]:[font-size:12.5px] [&_p]:[line-height:1.5] [&>i]:[margin-bottom:14px] [&>i]:[display:grid] [&>i]:[height:54px] [&>i]:[width:54px] [&>i]:[place-items:center] [&>i]:[border-radius:14px] [&>i]:bg-sunken [&>i]:[font-size:27px] [&>i]:[color:#718784] dark:[&>span]:[background:#242930]">
              <i className="ph ph-image-square" />
              <h2>{query ? "No matches in this folder" : "This folder is empty"}</h2>
              <p>
                {query
                  ? "Try a different search, or clear it to see everything here."
                  : "Drag images in, or use Upload to add your first assets to this folder."}
              </p>
              <Button
                unstyled
                className="sc-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
                onClick={() => setUploadOpen(true)}
              >
                <i className="ph-bold ph-upload-simple" />
                Upload images
              </Button>
            </div>
          )}
        </section>
        {selectedFile && (
          <aside className="sc-media-details [display:flex] [width:312px] [flex:none] [flex-direction:column] [background:#fafcfa] [border-left:1px_solid_var(--sc-border)] max-[1050px]:[width:280px] max-[800px]:[position:absolute] max-[800px]:[top:0] max-[800px]:[right:0] max-[800px]:[bottom:0] max-[800px]:[z-index:10] max-[800px]:[box-shadow:-8px_0_24px_rgba(23,_35,_38,_0.12)] dark:[border-color:#323841] dark:[background:#181b20]">
            <div className="sc-details-head [display:flex] [align-items:center] [justify-content:space-between] [padding:14px_16px] [border-bottom:1px_solid_var(--sc-border)] dark:[border-color:#323841] [&_button]:[display:grid] [&_button]:[height:28px] [&_button]:[width:28px] [&_button]:[flex:none] [&_button]:[cursor:pointer] [&_button]:[place-items:center] [&_button]:[border-radius:6px] [&_button]:text-ink-subtle [&_button]:[background:transparent] [&_button]:[border:0] [&_button:hover]:bg-sunken [&_button:hover]:text-ink [&_strong]:[font-size:13px] [&_strong]:[font-weight:600]">
              <strong>File details</strong>
              <Button unstyled onClick={() => setSelected(null)}>
                <i className="ph ph-x" />
              </Button>
            </div>
            <div className="sc-details-body sc-scroll [display:flex] [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [flex-direction:column] [gap:16px] [overflow:auto] [padding:16px] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff] [&>.sc-media-preview]:[flex:none]">
              <Preview item={selectedFile} />
              <label
                className="sc-detail-field [display:flex] [flex-direction:column] [gap:6px] [&_em]:[padding-right:9px] [&_em]:text-ink-subtle [&_em]:[font:normal_11px_'Geist_Mono'] [&_input]:[min-width:0] [&_input]:[flex:1] [&_input]:[padding:0_9px] [&_input]:[font-size:12.5px] [&_input]:[outline:0] [&_input]:[background:transparent] [&_input]:[border:0] dark:[&_input]:[border-color:#3d444e] dark:[&_input]:[color:#e9ecf1] dark:[&_input]:[background:#1d2126] [&_select]:[height:36px] [&_select]:[width:100%] [&_select]:[border-radius:7px] [&_select]:bg-surface [&_select]:[padding:0_8px] [&_select]:[font-size:12px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1.5px_solid_var(--sc-field)] [&_textarea]:[height:74px] [&_textarea]:[width:100%] [&_textarea]:[resize:vertical] [&_textarea]:[border-radius:7px] [&_textarea]:bg-surface [&_textarea]:[padding:9px] [&_textarea]:[font-size:12px] [&_textarea]:[line-height:1.4] [&_textarea]:text-ink [&_textarea]:[outline:0] [&_textarea]:[border:1.5px_solid_var(--sc-field)] dark:[&_textarea]:[border-color:#3d444e] dark:[&_textarea]:[color:#e9ecf1] dark:[&_textarea]:[background:#1d2126] [&>div]:[display:flex] [&>div]:[height:36px] [&>div]:[align-items:center] [&>div]:[border-radius:7px] [&>div]:bg-surface [&>div]:[border:1.5px_solid_var(--sc-field)] [&>span]:[font-size:11.5px] [&>span]:[font-weight:600] [&>span]:text-ink-muted dark:[&>span]:[color:#79808b]"
                htmlFor="media-file-name"
              >
                <span>File name</span>
                <div>
                  <Input
                    unstyled
                    id="media-file-name"
                    value={selectedFile.name}
                    onChange={(e) => updateFile({ name: e.target.value })}
                  />
                  <em>.{selectedFile.ext.toLowerCase()}</em>
                </div>
              </label>
              <label
                className="sc-detail-field [display:flex] [flex-direction:column] [gap:6px] [&_em]:[padding-right:9px] [&_em]:text-ink-subtle [&_em]:[font:normal_11px_'Geist_Mono'] [&_input]:[min-width:0] [&_input]:[flex:1] [&_input]:[padding:0_9px] [&_input]:[font-size:12.5px] [&_input]:[outline:0] [&_input]:[background:transparent] [&_input]:[border:0] dark:[&_input]:[border-color:#3d444e] dark:[&_input]:[color:#e9ecf1] dark:[&_input]:[background:#1d2126] [&_select]:[height:36px] [&_select]:[width:100%] [&_select]:[border-radius:7px] [&_select]:bg-surface [&_select]:[padding:0_8px] [&_select]:[font-size:12px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1.5px_solid_var(--sc-field)] [&_textarea]:[height:74px] [&_textarea]:[width:100%] [&_textarea]:[resize:vertical] [&_textarea]:[border-radius:7px] [&_textarea]:bg-surface [&_textarea]:[padding:9px] [&_textarea]:[font-size:12px] [&_textarea]:[line-height:1.4] [&_textarea]:text-ink [&_textarea]:[outline:0] [&_textarea]:[border:1.5px_solid_var(--sc-field)] dark:[&_textarea]:[border-color:#3d444e] dark:[&_textarea]:[color:#e9ecf1] dark:[&_textarea]:[background:#1d2126] [&>div]:[display:flex] [&>div]:[height:36px] [&>div]:[align-items:center] [&>div]:[border-radius:7px] [&>div]:bg-surface [&>div]:[border:1.5px_solid_var(--sc-field)] [&>span]:[font-size:11.5px] [&>span]:[font-weight:600] [&>span]:text-ink-muted dark:[&>span]:[color:#79808b]"
                htmlFor="media-alt-text"
              >
                <span>Alternative text</span>
                <Textarea
                  unstyled
                  id="media-alt-text"
                  value={selectedFile.alt}
                  onChange={(e) => updateFile({ alt: e.target.value })}
                  placeholder="Describe this image for accessibility"
                />
              </label>
              {!selectedFile.alt && selectedFile.kind === "image" && (
                <div className="sc-alt-warning [display:flex] [align-items:flex-start] [gap:8px] [border-radius:7px] bg-concept-soft [padding:9px_10px] [font-size:11px] [line-height:1.45] text-concept [&_i]:[margin-top:1px] [&_i]:[font-size:14px]">
                  <i className="ph-fill ph-warning-circle" />
                  <span>Add alternative text so this image is accessible to everyone.</span>
                </div>
              )}
              <dl className="sc-media-metadata [margin:0] [border-radius:8px] bg-surface [padding:10px_12px] [border:1px_solid_var(--sc-border)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_dd]:[margin:0] [&_dd]:[text-align:right] [&_dd]:[color:#33474a] [&_dd]:[font:500_10.5px_'Geist_Mono'] dark:[&_dd]:[color:#e9ecf1] [&_div]:[display:flex] [&_div]:[justify-content:space-between] [&_div]:[gap:12px] [&_div]:[padding:5px_0] [&_dt]:[font-size:10.5px] [&_dt]:text-ink-subtle dark:[&_dt]:[color:#79808b]">
                <div>
                  <dt>Type</dt>
                  <dd>{selectedFile.ext}</dd>
                </div>
                <div>
                  <dt>Dimensions</dt>
                  <dd>
                    {selectedFile.width
                      ? `${selectedFile.width} × ${selectedFile.height} px`
                      : "Document"}
                  </dd>
                </div>
                <div>
                  <dt>File size</dt>
                  <dd>{selectedFile.size}</dd>
                </div>
                <div>
                  <dt>Uploaded by</dt>
                  <dd>{selectedFile.author}</dd>
                </div>
                <div>
                  <dt>Date</dt>
                  <dd>{selectedFile.date}</dd>
                </div>
              </dl>
              <label className="sc-detail-field [display:flex] [flex-direction:column] [gap:6px] [&_em]:[padding-right:9px] [&_em]:text-ink-subtle [&_em]:[font:normal_11px_'Geist_Mono'] [&_input]:[min-width:0] [&_input]:[flex:1] [&_input]:[padding:0_9px] [&_input]:[font-size:12.5px] [&_input]:[outline:0] [&_input]:[background:transparent] [&_input]:[border:0] dark:[&_input]:[border-color:#3d444e] dark:[&_input]:[color:#e9ecf1] dark:[&_input]:[background:#1d2126] [&_select]:[height:36px] [&_select]:[width:100%] [&_select]:[border-radius:7px] [&_select]:bg-surface [&_select]:[padding:0_8px] [&_select]:[font-size:12px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1.5px_solid_var(--sc-field)] [&_textarea]:[height:74px] [&_textarea]:[width:100%] [&_textarea]:[resize:vertical] [&_textarea]:[border-radius:7px] [&_textarea]:bg-surface [&_textarea]:[padding:9px] [&_textarea]:[font-size:12px] [&_textarea]:[line-height:1.4] [&_textarea]:text-ink [&_textarea]:[outline:0] [&_textarea]:[border:1.5px_solid_var(--sc-field)] dark:[&_textarea]:[border-color:#3d444e] dark:[&_textarea]:[color:#e9ecf1] dark:[&_textarea]:[background:#1d2126] [&>div]:[display:flex] [&>div]:[height:36px] [&>div]:[align-items:center] [&>div]:[border-radius:7px] [&>div]:bg-surface [&>div]:[border:1.5px_solid_var(--sc-field)] [&>span]:[font-size:11.5px] [&>span]:[font-weight:600] [&>span]:text-ink-muted dark:[&>span]:[color:#79808b]">
                <span>Folder</span>
                <NativeSelect
                  unstyled
                  value={selectedFile.parentId}
                  onChange={(e) => {
                    updateFile({ parentId: e.target.value });
                    showToast("File moved");
                  }}
                >
                  <option value="root">Media</option>
                  {folders.map((folder) => (
                    <option value={folder.id} key={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <div className="sc-details-actions [display:grid] [grid-template-columns:1fr_1fr] [gap:8px] [&_button]:[display:flex] [&_button]:[height:34px] [&_button]:[cursor:pointer] [&_button]:[align-items:center] [&_button]:[justify-content:center] [&_button]:[gap:6px] [&_button]:[border-radius:7px] [&_button]:bg-surface [&_button]:[font-size:11.5px] [&_button]:[font-weight:600] [&_button]:[border:1px_solid_var(--sc-field)] dark:[&_button]:[border-color:#3d444e] dark:[&_button]:[color:#e9ecf1] dark:[&_button]:[background:#1d2126]">
                <Button unstyled onClick={() => showToast("URL copied")}>
                  <i className="ph ph-link" />
                  Copy URL
                </Button>
                <Button unstyled onClick={() => showToast("Download will be connected later")}>
                  <i className="ph ph-download-simple" />
                  Download
                </Button>
              </div>
              <Button
                unstyled
                className="sc-delete-file [display:flex] [height:34px] [width:100%] [cursor:pointer] [align-items:center] [justify-content:center] [gap:6px] [border-radius:7px] [border-color:#e9c8c2] bg-surface [font-size:11.5px] [font-weight:600] text-danger [border:1px_solid_var(--sc-field)]"
                onClick={deleteFile}
              >
                <i className="ph ph-trash" />
                Delete file
              </Button>
            </div>
          </aside>
        )}
      </div>
      {uploadOpen && (
        <div
          className="sc-modal-backdrop [position:fixed] [inset:0] [z-index:50] [display:grid] [place-items:center] [padding:24px] [backdrop-filter:blur(2px)] [background:rgba(15,_27,_29,_0.42)]"
          onMouseDown={(e) => e.target === e.currentTarget && setUploadOpen(false)}
          role="presentation"
        >
          <section
            className="sc-upload-modal [width:min(480px,_100%)] [overflow:hidden] [border-radius:13px] bg-surface [box-shadow:0_24px_70px_rgba(23,_35,_38,_0.22)] [border:1px_solid_#d7ded9] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_button:disabled]:[cursor:not-allowed] [&_button:disabled]:[opacity:0.45] [&_footer]:[display:flex] [&_footer]:[justify-content:flex-end] [&_footer]:[gap:8px] [&_footer]:[padding:13px_20px] [&_footer]:[background:#fafcfa] [&_footer]:[border-top:1px_solid_var(--sc-sunken)] dark:[&_footer]:[border-color:#323841] dark:[&_footer]:[background:#242930] [&_h2]:[margin:0_0_3px] [&_h2]:[font-size:17px] [&_header]:[display:flex] [&_header]:[align-items:flex-start] [&_header]:[justify-content:space-between] [&_header]:[padding:18px_20px] [&_header]:[border-bottom:1px_solid_var(--sc-sunken)] dark:[&_header]:[border-color:#323841] [&_header_button]:[display:grid] [&_header_button]:[height:28px] [&_header_button]:[width:28px] [&_header_button]:[flex:none] [&_header_button]:[cursor:pointer] [&_header_button]:[place-items:center] [&_header_button]:[border-radius:6px] [&_header_button]:text-ink-subtle [&_header_button]:[background:transparent] [&_header_button]:[border:0] [&_header_button:hover]:bg-sunken [&_header_button:hover]:text-ink dark:[&_header_p]:[color:#79808b] [&_p]:[margin:0] [&_p]:[font-size:12px] [&_p]:text-ink-subtle"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <h2>Upload files</h2>
                <p>Add images and documents to this folder.</p>
              </div>
              <Button unstyled onClick={() => setUploadOpen(false)}>
                <i className="ph ph-x" />
              </Button>
            </header>
            <div className="sc-upload-drop [margin:20px] [display:flex] [min-height:230px] [flex-direction:column] [align-items:center] [justify-content:center] [border-radius:10px] [text-align:center] [background:#fafcfa] [border:1.5px_dashed_#b7c5c1] dark:[border-color:#323841] dark:[background:#181b20] [&_button]:[height:34px] [&_button]:[cursor:pointer] [&_button]:[border-radius:7px] [&_button]:bg-surface [&_button]:[padding:0_12px] [&_button]:[font-size:12px] [&_button]:[font-weight:600] [&_button]:[border:1px_solid_var(--sc-field)] [&_small]:[margin-top:13px] [&_small]:[font-size:10.5px] [&_small]:[color:#a5b0ad] [&_span]:[margin:4px_0_14px] [&_span]:[font-size:12px] [&_span]:text-ink-subtle [&_strong]:[font-size:14px] [&>i]:[margin-bottom:13px] [&>i]:[display:grid] [&>i]:[height:50px] [&>i]:[width:50px] [&>i]:[place-items:center] [&>i]:[border-radius:13px] [&>i]:bg-selection [&>i]:[font-size:25px] [&>i]:text-action">
              <i className="ph ph-cloud-arrow-up" />
              <strong>Drop files here</strong>
              <span>or choose files from your computer</span>
              <Button
                unstyled
                onClick={() => showToast("File selection will be connected with uploading")}
              >
                Choose files
              </Button>
              <small>JPG, PNG, SVG, GIF or PDF · up to 10 MB</small>
            </div>
            <footer>
              <Button
                unstyled
                className="sc-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
                onClick={() => setUploadOpen(false)}
              >
                Cancel
              </Button>
              <Button
                unstyled
                className="sc-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
                disabled
              >
                Upload
              </Button>
            </footer>
          </section>
        </div>
      )}
      {toast && (
        <div className="sc-media-toast [position:fixed] [right:22px] [bottom:22px] [z-index:70] [display:flex] [align-items:center] [gap:8px] [border-radius:8px] [padding:11px_14px] [font-size:12px] [font-weight:600] [color:#fff] [box-shadow:0_8px_25px_rgba(23,_35,_38,_0.2)] [background:var(--sc-ink)] [&_i]:[font-size:16px] [&_i]:[color:#75d3aa]">
          <i className="ph-fill ph-check-circle" />
          {toast}
        </div>
      )}
    </AppShell>
  );
}
