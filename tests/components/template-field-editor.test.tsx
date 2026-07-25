import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TemplateFieldDefinition, TemplateValue } from "@/lib/page-templates";
import { TemplateFieldEditor } from "@/features/page-templates/template-field-editor";

afterEach(cleanup);

function field(type: TemplateFieldDefinition["type"], overrides = {}): TemplateFieldDefinition {
  return { key: type, label: `${type} field`, type, ...overrides };
}

function renderField(
  definition: TemplateFieldDefinition,
  value: TemplateValue | undefined,
  onChange = vi.fn(),
) {
  return {
    onChange,
    ...render(<TemplateFieldEditor field={definition} value={value} onChange={onChange} />),
  };
}

describe("TemplateFieldEditor", () => {
  it("edits text, URL, date, rich text, and number values", () => {
    const change = vi.fn();
    const view = renderField(field("text", { placeholder: "Title" }), "Old", change);
    fireEvent.change(screen.getByDisplayValue("Old"), { target: { value: "New" } });
    expect(change).toHaveBeenLastCalledWith("New");

    view.rerender(<TemplateFieldEditor field={field("url")} value={42} onChange={change} />);
    expect(view.container.querySelector(".sc-mono")).toBeTruthy();

    view.rerender(<TemplateFieldEditor field={field("date")} value={null} onChange={change} />);
    expect(view.container.querySelector('input[type="date"]')).toBeTruthy();

    view.rerender(<TemplateFieldEditor field={field("richtext")} value="Body" onChange={change} />);
    fireEvent.change(screen.getByDisplayValue("Body"), { target: { value: "Updated body" } });
    expect(change).toHaveBeenLastCalledWith("Updated body");
    expect(screen.getByRole("button", { name: "Bold" })).toBeTruthy();

    view.rerender(<TemplateFieldEditor field={field("number")} value={3} onChange={change} />);
    fireEvent.change(screen.getByDisplayValue("3"), { target: { value: "8" } });
    expect(change).toHaveBeenLastCalledWith(8);
  });

  it("edits choices, references, toggles, and media", () => {
    const change = vi.fn();
    const view = renderField(
      field("choice", { options: ["Primary", "Secondary"] }),
      "Primary",
      change,
    );
    fireEvent.change(screen.getByDisplayValue("Primary"), { target: { value: "Secondary" } });
    expect(change).toHaveBeenLastCalledWith("Secondary");

    view.rerender(<TemplateFieldEditor field={field("reference")} value="" onChange={change} />);
    expect(screen.getByRole("option", { name: "No default reference" })).toBeTruthy();

    view.rerender(<TemplateFieldEditor field={field("toggle")} value={false} onChange={change} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(change).toHaveBeenLastCalledWith(true);
    view.rerender(<TemplateFieldEditor field={field("toggle")} value onChange={change} />);
    expect(screen.getByText("On")).toBeTruthy();

    view.rerender(
      <TemplateFieldEditor field={field("media")} value="hero.jpg" onChange={change} />,
    );
    expect(screen.getByText("hero.jpg")).toBeTruthy();
    view.rerender(<TemplateFieldEditor field={field("media")} value="" onChange={change} />);
    expect(screen.getByText("No default image")).toBeTruthy();
  });

  it("adds unique tags, ignores duplicates, and removes tags", () => {
    const change = vi.fn();
    const view = renderField(field("tags"), ["UI"], change);
    const input = screen.getByPlaceholderText("Add tag...");
    fireEvent.change(input, { target: { value: "Testing" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(change).toHaveBeenLastCalledWith(["UI", "Testing"]);

    fireEvent.change(input, { target: { value: "UI" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(change).toHaveBeenCalledTimes(1);

    fireEvent.click(view.container.querySelector(".sc-template-tags button")!);
    expect(change).toHaveBeenLastCalledWith([]);
    fireEvent.change(input, { target: { value: " " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(view.container.querySelector(".sc-template-tags")).toBeTruthy();
  });

  it("shows required, help, and validation copy", () => {
    renderField(
      field("text", { required: true, help: "Shown below the field" }),
      undefined,
      vi.fn(),
    ).rerender(
      <TemplateFieldEditor
        error="This is required"
        field={field("text", { required: true, help: "Shown below the field" })}
        value={undefined}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("*")).toBeTruthy();
    expect(screen.getByText("This is required")).toBeTruthy();
    expect(screen.getByText("Shown below the field")).toBeTruthy();
  });
});
