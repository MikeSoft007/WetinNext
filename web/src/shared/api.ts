export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch("/api/v1" + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(sessionStorage.getItem("wetinnext_access_token")
        ? {
            Authorization: `Bearer ${sessionStorage.getItem("wetinnext_access_token")}`,
          }
        : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ detail: "The server is unavailable. Please retry." }));
    throw Error(
      typeof body.detail === "string"
        ? body.detail
        : "Please check your details and try again.",
    );
  }
  return response.json();
}
