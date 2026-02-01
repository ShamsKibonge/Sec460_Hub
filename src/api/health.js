export async function getHealth() {
    const res = await fetch("/api/v1/health");
    return res.json();
}
