export type StructuredFieldType =
  | "text"
  | "long"
  | "rich"
  | "email"
  | "phone"
  | "url"
  | "number"
  | "date"
  | "toggle"
  | "tags"
  | "image"
  | "choice"
  | "reference";

export type StructuredValue = string | boolean | string[];

export interface StructuredField {
  id: string;
  key: string;
  label: string;
  type: StructuredFieldType;
  primary?: boolean;
  required?: boolean;
  options?: string[];
}

export interface StructuredRecord {
  id: string;
  status: "published" | "concept";
  updated: string;
  values: Record<string, StructuredValue>;
}

export interface StructuredType {
  id: string;
  slug: string;
  name: string;
  singular: string;
  icon: string;
  chipBg: string;
  chipFg: string;
  description: string;
  fields: StructuredField[];
  records: StructuredRecord[];
}

export const structuredFieldTypes: Record<StructuredFieldType, { label: string; icon: string }> = {
  text: { label: "Text", icon: "ph-text-aa" },
  long: { label: "Long text", icon: "ph-text-align-left" },
  rich: { label: "Rich text", icon: "ph-article" },
  email: { label: "Email", icon: "ph-envelope-simple" },
  phone: { label: "Phone", icon: "ph-phone" },
  url: { label: "URL", icon: "ph-link" },
  number: { label: "Number", icon: "ph-hash" },
  date: { label: "Date", icon: "ph-calendar-blank" },
  toggle: { label: "Toggle", icon: "ph-toggle-left" },
  tags: { label: "Tags", icon: "ph-tag" },
  image: { label: "Image", icon: "ph-image" },
  choice: { label: "Choice", icon: "ph-list-checks" },
  reference: { label: "Reference", icon: "ph-link-simple" },
};

const field = (
  key: string,
  label: string,
  type: StructuredFieldType,
  options: Partial<StructuredField> = {},
): StructuredField => ({ id: `field-${key}`, key, label, type, ...options });

export function createEmptyStructuredValues(fields: StructuredField[]) {
  return Object.fromEntries(
    fields.map((item) => [
      item.key,
      item.type === "toggle" ? false : item.type === "tags" ? [] : "",
    ]),
  ) as Record<string, StructuredValue>;
}

export function recordMatchesSearch(record: StructuredRecord, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return Object.values(record.values).some((value) =>
    (Array.isArray(value) ? value.join(" ") : String(value)).toLowerCase().includes(needle),
  );
}

export function seedStructuredTypes(): StructuredType[] {
  return [
    {
      id: "colleagues",
      slug: "colleagues",
      name: "Colleagues",
      singular: "colleague",
      icon: "ph-users",
      chipBg: "#ede7f5",
      chipFg: "#5b4b8a",
      description: "People shown in team sections and author bylines.",
      fields: [
        field("name", "Full name", "text", { primary: true, required: true }),
        field("role", "Role", "text"),
        field("email", "Email", "email"),
        field("phone", "Phone", "phone"),
        field("department", "Department", "choice", {
          options: ["Engineering", "Design", "Marketing", "Sales", "Operations"],
        }),
        field("photo", "Photo", "image"),
        field("startDate", "Start date", "date"),
        field("website", "Personal site", "url"),
        field("skills", "Skills", "tags"),
        field("featured", "Featured on team page", "toggle"),
        field("bio", "Biography", "rich"),
      ],
      records: [
        {
          id: "colleague-mara",
          status: "published",
          updated: "2 days ago",
          values: {
            name: "Mara Jensen",
            role: "Head of Content",
            email: "mara@acme.com",
            phone: "+31 20 555 0110",
            department: "Marketing",
            startDate: "2021-03-01",
            website: "https://marajensen.com",
            skills: ["Editorial", "SEO", "Localization"],
            featured: true,
            bio: "Mara leads content strategy across every site, with a focus on editorial quality and clean, durable URLs.",
          },
        },
        {
          id: "colleague-deniz",
          status: "published",
          updated: "5 days ago",
          values: {
            name: "Deniz Kaya",
            role: "Senior Engineer",
            email: "deniz@acme.com",
            phone: "+31 20 555 0112",
            department: "Engineering",
            startDate: "2020-09-14",
            website: "",
            skills: ["TypeScript", "React", "Infra"],
            featured: true,
            bio: "Deniz builds the rendering pipeline and keeps deploys boring.",
          },
        },
        {
          id: "colleague-lotte",
          status: "published",
          updated: "1 week ago",
          values: {
            name: "Lotte Visser",
            role: "Product Designer",
            email: "lotte@acme.com",
            department: "Design",
            skills: ["UI", "Prototyping"],
            featured: false,
            bio: "Lotte owns the design system and the admin visual language.",
          },
        },
        {
          id: "colleague-sam",
          status: "concept",
          updated: "Just now",
          values: {
            name: "Sam Okafor",
            role: "Account Executive",
            email: "sam@acme.com",
            department: "Sales",
            skills: [],
            featured: false,
            bio: "",
          },
        },
      ],
    },
    {
      id: "locations",
      slug: "locations",
      name: "Locations",
      singular: "location",
      icon: "ph-map-pin",
      chipBg: "#e1eef0",
      chipFg: "#2c6e78",
      description: "Offices and venues referenced on contact pages.",
      fields: [
        field("name", "Name", "text", { primary: true, required: true }),
        field("city", "City", "text"),
        field("address", "Address", "text"),
        field("phone", "Phone", "phone"),
      ],
      records: [
        {
          id: "location-amsterdam",
          status: "published",
          updated: "3 weeks ago",
          values: {
            name: "Amsterdam HQ",
            city: "Amsterdam",
            address: "Herengracht 210",
            phone: "+31 20 555 0110",
          },
        },
        {
          id: "location-berlin",
          status: "published",
          updated: "3 weeks ago",
          values: {
            name: "Berlin Studio",
            city: "Berlin",
            address: "Torstraße 44",
            phone: "+49 30 555 220",
          },
        },
        {
          id: "location-london",
          status: "concept",
          updated: "Yesterday",
          values: {
            name: "London Loft",
            city: "London",
            address: "Shoreditch High St 9",
            phone: "+44 20 5550 990",
          },
        },
      ],
    },
    {
      id: "jobs",
      slug: "job-openings",
      name: "Job openings",
      singular: "opening",
      icon: "ph-briefcase",
      chipBg: "#e7eaf5",
      chipFg: "#3f4c8a",
      description: "Vacancies rendered on the careers page.",
      fields: [
        field("title", "Title", "text", { primary: true, required: true }),
        field("team", "Team", "choice", {
          options: ["Engineering", "Design", "Marketing", "Sales", "Operations"],
        }),
        field("location", "Location", "text"),
        field("mode", "Type", "choice", { options: ["Full-time", "Part-time", "Contract"] }),
      ],
      records: [
        {
          id: "job-frontend",
          status: "published",
          updated: "4 days ago",
          values: {
            title: "Frontend Engineer",
            team: "Engineering",
            location: "Amsterdam / Remote",
            mode: "Full-time",
          },
        },
        {
          id: "job-content",
          status: "published",
          updated: "1 week ago",
          values: {
            title: "Content Strategist",
            team: "Marketing",
            location: "Berlin",
            mode: "Full-time",
          },
        },
        {
          id: "job-design",
          status: "concept",
          updated: "2 days ago",
          values: {
            title: "Design Intern",
            team: "Design",
            location: "Amsterdam",
            mode: "Part-time",
          },
        },
      ],
    },
    {
      id: "faqs",
      slug: "faq-items",
      name: "FAQ items",
      singular: "question",
      icon: "ph-question",
      chipBg: "#f5e7ef",
      chipFg: "#5e299c",
      description: "Question and answer pairs reused across help pages.",
      fields: [
        field("question", "Question", "text", { primary: true, required: true }),
        field("answer", "Answer", "rich", { required: true }),
        field("topic", "Topic", "choice", {
          options: ["Billing", "Account", "Product", "Privacy"],
        }),
      ],
      records: [
        {
          id: "faq-password",
          status: "published",
          updated: "6 days ago",
          values: {
            question: "How do I reset my password?",
            answer: "Use the reset link on the sign-in screen. The email arrives within a minute.",
            topic: "Account",
          },
        },
        {
          id: "faq-plan",
          status: "published",
          updated: "6 days ago",
          values: {
            question: "Can I change my plan later?",
            answer: "Yes. Upgrades apply immediately and downgrades at the next cycle.",
            topic: "Billing",
          },
        },
        {
          id: "faq-data",
          status: "concept",
          updated: "Today",
          values: {
            question: "Where is my data stored?",
            answer: "In EU-based data centres.",
            topic: "Privacy",
          },
        },
      ],
    },
    {
      id: "testimonials",
      slug: "testimonials",
      name: "Testimonials",
      singular: "testimonial",
      icon: "ph-quotes",
      chipBg: "#eaecef",
      chipFg: "#4a5064",
      description: "Customer quotes used on landing pages.",
      fields: [
        field("quote", "Quote", "long", { primary: true, required: true }),
        field("author", "Author", "text"),
        field("role", "Role or company", "text"),
      ],
      records: [
        {
          id: "testimonial-one",
          status: "published",
          updated: "2 weeks ago",
          values: {
            quote: "Finally, a CMS our editors actually understand.",
            author: "Noor de Wit",
            role: "Digital lead, Northstar",
          },
        },
        {
          id: "testimonial-two",
          status: "concept",
          updated: "Yesterday",
          values: {
            quote: "The page tree changed how our team thinks about content.",
            author: "Amir Malik",
            role: "Product manager, Common Ground",
          },
        },
      ],
    },
  ];
}
