// Application view of the database types. The table and function shapes come from
// database.generated.ts (`pnpm db:types`). Postgres cannot tell the generator which function
// arguments accept null, so those are widened here, and nowhere else.
import type { Database as GeneratedDatabase, Json } from "./database.generated";

export type { Json };

type Generated = GeneratedDatabase["public"]["Functions"];

type NullableArgs<Name extends keyof Generated, Keys extends keyof Generated[Name]["Args"]> = {
  Args: Omit<Generated[Name]["Args"], Keys> & {
    [Key in Keys]: Generated[Name]["Args"][Key] | null;
  };
  Returns: Generated[Name]["Returns"];
};

type Functions = Omit<
  Generated,
  "save_page_revision" | "save_page_template" | "save_content_type"
> & {
  save_page_revision: NullableArgs<
    "save_page_revision",
    "expected_concept_revision_id" | "target_social_image" | "target_preferred_child_template"
  >;
  save_page_template: NullableArgs<"save_page_template", "target_template_id">;
  save_content_type: NullableArgs<"save_content_type", "target_type_id">;
};

export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedDatabase["public"], "Functions"> & { Functions: Functions };
};

export type PageRow = Database["public"]["Tables"]["pages"]["Row"];
