const DEFAULT_BASE_PATH = process.env.NEXT_PUBLIC_APP_BASE_PATH ?? "/trust-dashboard";

export function withBasePath(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === DEFAULT_BASE_PATH || normalized.startsWith(`${DEFAULT_BASE_PATH}/`)) {
    return normalized;
  }

  return `${DEFAULT_BASE_PATH}${normalized}`;
}
