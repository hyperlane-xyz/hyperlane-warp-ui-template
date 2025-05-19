export function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

export function updateQueryParam(key: string, value?: string | number) {
  const params = getQueryParams(); // Get current query parameters

  if (value === undefined || value === null) {
    // Remove the parameter if the value is undefined or null
    params.delete(key);
  } else {
    // Add or update the parameter
    params.set(key, value.toString());
  }

  // Update the browser's URL without reloading the page
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', newUrl);
}

export function updateQueryParams(params: Record<string, string | number>) {
  for (const [key, value] of Object.entries(params)) {
    updateQueryParam(key, value);
  }
}
