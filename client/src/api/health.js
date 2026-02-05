import { API_BASE_URL } from "../config";

export async function getHealth() {
    const res = await fetch(`${API_BASE_URL}/api/v1/health`);
    return res.json();
}
