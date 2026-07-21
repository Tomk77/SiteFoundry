import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

afterEach(cleanup);

describe("UI form primitives", () => {
  it("renders button variants, loading state, and unstyled overrides", () => {
    const click = vi.fn();
    const view = render(<Button onClick={click}>Save</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(click).toHaveBeenCalledOnce();
    expect(buttonVariants({ variant: "destructive", size: "lg" })).toContain("bg-danger");

    view.rerender(
      <Button className="plain" loading unstyled>
        Saving
      </Button>,
    );
    const loading = screen.getByRole("button", { name: "Saving" });
    expect(loading.getAttribute("aria-busy")).toBe("true");
    expect(loading.hasAttribute("disabled")).toBe(true);
    expect(loading.className).toBe("plain");
    expect(view.container.querySelector(".sf-button-spinner")).toBeTruthy();
  });

  it("renders styled and unstyled text controls", () => {
    const view = render(<Input aria-label="Title" className="custom-input" />);
    expect(screen.getByLabelText("Title").getAttribute("data-slot")).toBe("input");
    expect(screen.getByLabelText("Title").className).toContain("custom-input");
    view.rerender(<Input aria-label="Title" className="raw" unstyled />);
    expect(screen.getByLabelText("Title").className).toBe("raw");

    view.rerender(<Textarea aria-label="Description" className="custom-area" />);
    expect(screen.getByLabelText("Description").className).toContain("custom-area");
    view.rerender(<Textarea aria-label="Description" className="raw-area" unstyled />);
    expect(screen.getByLabelText("Description").className).toBe("raw-area");
  });

  it("renders native select variants and an interactive switch", () => {
    const view = render(
      <NativeSelect aria-label="Language" className="custom-select">
        <option>English</option>
      </NativeSelect>,
    );
    expect(screen.getByLabelText("Language").className).toContain("custom-select");
    view.rerender(
      <NativeSelect aria-label="Language" className="raw-select" unstyled>
        <option>English</option>
      </NativeSelect>,
    );
    expect(screen.getByLabelText("Language").className).toBe("raw-select");

    const change = vi.fn();
    view.rerender(<Switch aria-label="Published" onCheckedChange={change} size="sm" />);
    const control = screen.getByRole("switch", { name: "Published" });
    expect(control.getAttribute("data-size")).toBe("sm");
    fireEvent.click(control);
    expect(change).toHaveBeenCalledWith(true, expect.anything());
  });

  it("renders and operates the complete custom select composition", async () => {
    const change = vi.fn();
    render(
      <Select defaultValue="draft" onValueChange={change}>
        <SelectTrigger aria-label="Status" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false} side="top">
          <SelectGroup>
            <SelectLabel>Workflow</SelectLabel>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectSeparator />
            <SelectItem value="published">Published</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByRole("combobox", { name: "Status" });
    expect(trigger.getAttribute("data-size")).toBe("sm");
    fireEvent.click(trigger);
    const published = await screen.findByRole("option", { name: "Published" });
    expect(published.getAttribute("data-slot")).toBe("select-item");
  });
});
