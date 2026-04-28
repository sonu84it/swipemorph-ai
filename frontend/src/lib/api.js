const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { detail: await response.text() };

  if (!response.ok) {
    throw new Error(payload.detail || "Request failed");
  }

  return payload;
}

async function request(url, options) {
  try {
    const response = await fetch(url, options);
    return parseResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error(`Could not reach the backend at ${API_BASE_URL}. Make sure FastAPI is running on port 8080.`);
    }
    throw error;
  }
}

export async function uploadImage(file) {
  const form = new FormData();
  form.append("file", file);

  return request(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    body: form
  });
}

export async function generateFirstVariation(payload) {
  return request(`${API_BASE_URL}/api/generate-first-variation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function generateNextVariation(payload) {
  return request(`${API_BASE_URL}/api/generate-next-variation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
