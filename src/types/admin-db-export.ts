export type AdminDbExportScope =
  | "catalog"
  | "customers"
  | "orders"
  | "sellers"
  | "operations"
  | "settings"
  | "all";

export type AdminDbExportFormat = "json" | "csv";

export type AdminDbExportScopeOption = {
  value: AdminDbExportScope;
  label: string;
  description: string;
  tables: string[];
};

export type AdminDbExportFormatOption = {
  value: AdminDbExportFormat;
  label: string;
  description: string;
};

export type AdminDbExportPanelPayload = {
  defaultScope: AdminDbExportScope;
  defaultFormat: AdminDbExportFormat;
  scopes: AdminDbExportScopeOption[];
  formats: AdminDbExportFormatOption[];
  generatedAt: string;
};

