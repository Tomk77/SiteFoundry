import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { NativeSelect } from "../components/ui/native-select";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "../components/app-shell";
import {
  createMediaUrlSearch,
  parseMediaUrlSearch,
} from "../lib/url-view-state";
import "../media.css";

export const Route = createFileRoute("/media")({
  validateSearch: parseMediaUrlSearch,
  component: Media,
});

type Folder = { id: string; name: string; parentId: string };
type MediaFile = {
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
};
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

function Preview({
  item,
  compact = false,
}: {
  item: MediaFile;
  compact?: boolean;
}) {
  const icon =
    item.kind === "pdf"
      ? "ph-file-pdf"
      : item.kind === "svg"
        ? "ph-bezier-curve"
        : "ph-image";
  return (
    <div
      className={`sf-media-preview ${compact ? "compact" : ""}`}
      style={{ background: item.tint }}
    >
      <i className={`ph-fill ${icon}`} />
      <span>{item.ext}</span>
    </div>
  );
}

function Media() {
  const navigate = useNavigate();
  const urlSearch = Route.useSearch();
  const [folders, setFolders] = useState(foldersSeed),
    [files, setFiles] = useState(filesSeed),
    [selected, setSelected] = useState<string | null>(null),
    [renaming, setRenaming] = useState<string | null>(null),
    [uploadOpen, setUploadOpen] = useState(false),
    [toast, setToast] = useState("");
  const cwd =
    urlSearch.folder && folders.some((folder) => folder.id === urlSearch.folder)
      ? urlSearch.folder
      : "root";
  const view = urlSearch.view ?? "grid";
  const query = urlSearch.q ?? "";
  const updateUrlView = (next: {
    q?: string;
    folder?: string;
    view?: "grid" | "list";
  }) => {
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
  const currentFolder = folders.find((folder) => folder.id === cwd),
    q = query.toLowerCase();
  const visibleFolders = folders.filter(
    (folder) =>
      folder.parentId === cwd && folder.name.toLowerCase().includes(q),
  );
  const visibleFiles = files.filter(
    (item) =>
      item.parentId === cwd &&
      `${item.name}.${item.ext}`.toLowerCase().includes(q),
  );
  const selectedFile = files.find((item) => item.id === selected) ?? null,
    itemCount = visibleFolders.length + visibleFiles.length;
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
    setFolders((value) => [
      ...value,
      { id, name: "Untitled folder", parentId: cwd },
    ]);
    setRenaming(id);
  };
  const updateFile = (changes: Partial<MediaFile>) =>
    selectedFile &&
    setFiles((value) =>
      value.map((item) =>
        item.id === selectedFile.id ? { ...item, ...changes } : item,
      ),
    );
  const deleteFile = () => {
    if (!selectedFile) return;
    setFiles((value) => value.filter((item) => item.id !== selectedFile.id));
    setSelected(null);
    showToast("File deleted");
  };
  return (
    <AppShell active="media">
      <header className="sf-media-head">
        <div className="sf-tree-title">
          <div>
            <h1>Media</h1>
            <b>{itemCount} items</b>
          </div>
          <span>Manage images and files used across your website.</span>
        </div>
        <span className="sf-spacer" />
        <label className="sf-search sf-media-search">
          <i className="ph ph-magnifying-glass" />
          <Input unstyled
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files..."
          />
        </label>
        <div className="sf-view-toggle">
          <Button unstyled
            className={view === "grid" ? "active" : ""}
            onClick={() => setView("grid")}
          >
            <i className="ph ph-squares-four" />
          </Button>
          <Button unstyled
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
          >
            <i className="ph ph-list" />
          </Button>
        </div>
        <Button unstyled className="sf-action" onClick={addFolder}>
          <i className="ph ph-folder-plus" />
          New folder
        </Button>
        <Button unstyled
          className="sf-action primary"
          onClick={() => setUploadOpen(true)}
        >
          <i className="ph-bold ph-upload-simple" />
          Upload
        </Button>
      </header>
      <nav className="sf-media-crumbs">
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.id}>
            {index > 0 && <i className="ph ph-caret-right" />}
            <Button unstyled
              className={index === breadcrumbs.length - 1 ? "current" : ""}
              onClick={() => openFolder(crumb.id)}
            >
              {crumb.name}
            </Button>
          </span>
        ))}
      </nav>
      <div className="sf-media-body">
        <section className="sf-media-content sf-scroll">
          {visibleFolders.length > 0 && (
            <div className="sf-media-section">
              <h2>Folders</h2>
              <div className="sf-folder-grid">
                {visibleFolders.map((folder) => (
                  <div className="sf-folder-card" key={folder.id}>
                    <Button unstyled
                      className="sf-folder-main"
                      onClick={() => openFolder(folder.id)}
                    >
                      <i className="ph-fill ph-folder" />
                      <span>
                        {renaming === folder.id ? (
                          <Input unstyled
                            autoFocus
                            value={folder.name}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setFolders((all) =>
                                all.map((f) =>
                                  f.id === folder.id
                                    ? { ...f, name: e.target.value }
                                    : f,
                                ),
                              )
                            }
                            onBlur={() => setRenaming(null)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && setRenaming(null)
                            }
                          />
                        ) : (
                          <>
                            <strong>{folder.name}</strong>
                            <small>
                              {
                                files.filter(
                                  (item) => item.parentId === folder.id,
                                ).length
                              }{" "}
                              items
                            </small>
                          </>
                        )}
                      </span>
                    </Button>
                    <Button unstyled
                      className="sf-icon-button"
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
            <div className="sf-media-section">
              <h2>Files</h2>
              {view === "grid" ? (
                <div className="sf-file-grid">
                  {visibleFiles.map((item) => (
                    <Button unstyled
                      className={`sf-file-card ${selected === item.id ? "selected" : ""}`}
                      key={item.id}
                      onClick={() => setSelected(item.id)}
                    >
                      <Preview item={item} />
                      <span className="sf-file-name">{item.name}</span>
                      <span className="sf-file-meta">
                        {item.ext} · {item.size}
                      </span>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="sf-file-list">
                  <div className="sf-file-list-head">
                    <span />
                    <span>Name</span>
                    <span>Type</span>
                    <span>Dimensions</span>
                    <span>Size</span>
                    <span>Uploaded</span>
                  </div>
                  {visibleFiles.map((item) => (
                    <Button unstyled
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
                      <span>
                        {item.width
                          ? `${item.width}×${item.height}`
                          : "Document"}
                      </span>
                      <span>{item.size}</span>
                      <span>{item.date}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
          {itemCount === 0 && (
            <div className="sf-media-empty">
              <i className="ph ph-image-square" />
              <h2>
                {query ? "No matches in this folder" : "This folder is empty"}
              </h2>
              <p>
                {query
                  ? "Try a different search, or clear it to see everything here."
                  : "Drag images in, or use Upload to add your first assets to this folder."}
              </p>
              <Button unstyled
                className="sf-action primary"
                onClick={() => setUploadOpen(true)}
              >
                <i className="ph-bold ph-upload-simple" />
                Upload images
              </Button>
            </div>
          )}
        </section>
        {selectedFile && (
          <aside className="sf-media-details">
            <div className="sf-details-head">
              <strong>File details</strong>
              <Button unstyled onClick={() => setSelected(null)}>
                <i className="ph ph-x" />
              </Button>
            </div>
            <div className="sf-details-body sf-scroll">
              <Preview item={selectedFile} />
              <label className="sf-detail-field">
                <span>File name</span>
                <div>
                  <Input unstyled
                    value={selectedFile.name}
                    onChange={(e) => updateFile({ name: e.target.value })}
                  />
                  <em>.{selectedFile.ext.toLowerCase()}</em>
                </div>
              </label>
              <label className="sf-detail-field">
                <span>Alternative text</span>
                <Textarea unstyled
                  value={selectedFile.alt}
                  onChange={(e) => updateFile({ alt: e.target.value })}
                  placeholder="Describe this image for accessibility"
                />
              </label>
              {!selectedFile.alt && selectedFile.kind === "image" && (
                <div className="sf-alt-warning">
                  <i className="ph-fill ph-warning-circle" />
                  <span>
                    Add alternative text so this image is accessible to
                    everyone.
                  </span>
                </div>
              )}
              <dl className="sf-media-metadata">
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
              <label className="sf-detail-field">
                <span>Folder</span>
                <NativeSelect unstyled
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
              <div className="sf-details-actions">
                <Button unstyled onClick={() => showToast("URL copied")}>
                  <i className="ph ph-link" />
                  Copy URL
                </Button>
                <Button unstyled
                  onClick={() => showToast("Download will be connected later")}
                >
                  <i className="ph ph-download-simple" />
                  Download
                </Button>
              </div>
              <Button unstyled className="sf-delete-file" onClick={deleteFile}>
                <i className="ph ph-trash" />
                Delete file
              </Button>
            </div>
          </aside>
        )}
      </div>
      {uploadOpen && (
        <div
          className="sf-modal-backdrop"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setUploadOpen(false)
          }
        >
          <section className="sf-upload-modal" role="dialog" aria-modal="true">
            <header>
              <div>
                <h2>Upload files</h2>
                <p>Add images and documents to this folder.</p>
              </div>
              <Button unstyled onClick={() => setUploadOpen(false)}>
                <i className="ph ph-x" />
              </Button>
            </header>
            <div className="sf-upload-drop">
              <i className="ph ph-cloud-arrow-up" />
              <strong>Drop files here</strong>
              <span>or choose files from your computer</span>
              <Button unstyled
                onClick={() =>
                  showToast("File selection will be connected with uploading")
                }
              >
                Choose files
              </Button>
              <small>JPG, PNG, SVG, GIF or PDF · up to 10 MB</small>
            </div>
            <footer>
              <Button unstyled
                className="sf-action"
                onClick={() => setUploadOpen(false)}
              >
                Cancel
              </Button>
              <Button unstyled className="sf-action primary" disabled>
                Upload
              </Button>
            </footer>
          </section>
        </div>
      )}
      {toast && (
        <div className="sf-media-toast">
          <i className="ph-fill ph-check-circle" />
          {toast}
        </div>
      )}
    </AppShell>
  );
}
