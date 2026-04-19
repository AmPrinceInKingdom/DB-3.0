type AuthRuntimeContext = "login" | "register";

type ClassifiedAuthRuntimeFailure = {
  message: string;
  code: string;
  status: number;
};

function getUnavailableMessage(context: AuthRuntimeContext) {
  if (context === "register") {
    return "Registration service is temporarily unavailable. Please try again shortly.";
  }
  return "Sign-in service is temporarily unavailable. Please try again shortly.";
}

export function classifyAuthRuntimeFailure(
  error: unknown,
  context: AuthRuntimeContext,
): ClassifiedAuthRuntimeFailure | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("jwt_secret") ||
    message.includes("environment variable not found: database_url") ||
    message.includes("environment variable not found: direct_url")
  ) {
    return {
      message: getUnavailableMessage(context),
      code: "AUTH_CONFIG_ERROR",
      status: 503,
    };
  }

  if (
    message.includes("the table") ||
    message.includes("does not exist") ||
    message.includes("p2021")
  ) {
    return {
      message: "Database schema is not ready yet. Please try again after setup.",
      code: "AUTH_SCHEMA_MISSING",
      status: 503,
    };
  }

  if (
    message.includes("tenant or user not found") ||
    message.includes("authentication failed against database server")
  ) {
    return {
      message: "Database credentials are invalid for this deployment.",
      code: "AUTH_DB_CREDENTIALS_INVALID",
      status: 503,
    };
  }

  if (
    message.includes("database_url") ||
    message.includes("can't reach database server") ||
    message.includes("prisma")
  ) {
    return {
      message: getUnavailableMessage(context),
      code: "AUTH_DB_UNAVAILABLE",
      status: 503,
    };
  }

  return null;
}
